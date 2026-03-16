import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn } from 'child_process'

// 플렉스지 MCP 브릿지 플러그인
function fgBridgePlugin() {
  let syncRequested = false;
  let lastReceived = null;
  const syncJsonPath = path.resolve('public/fg-sync.json');
  const downloadsDir = path.join(os.homedir(), 'Downloads');

  // Downloads 폴더에서 prefix에 매칭되는 최신 파일 찾기 (Chrome이 (1), (2) 등 붙이므로)
  const findLatestFile = (prefix) => {
    try {
      const files = fs.readdirSync(downloadsDir)
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .map(f => ({ name: f, path: path.join(downloadsDir, f), mtime: fs.statSync(path.join(downloadsDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      return files.length > 0 ? files[0] : null;
    } catch { return null; }
  };

  // Downloads 폴더에서 최신 파일 읽어서 fg-sync.json에 병합
  const importFromDownloads = () => {
    let updated = false;
    let existing = {};
    try { existing = JSON.parse(fs.readFileSync(syncJsonPath, 'utf8')); } catch {}

    let fgData = existing.flexgate || { count: 0, date: '', orders: [] };
    let bjData = existing.baljumoa || { count: 0, date: '', orders: [] };

    const fgFile = findLatestFile('fg-orders');
    const bjFile = findLatestFile('bj-orders');

    try {
      if (fgFile) {
        const fg = JSON.parse(fs.readFileSync(fgFile.path, 'utf8'));
        if (fg.orders && fg.orders.length > 0) {
          fgData = { count: fg.orders.length, date: fg.date || new Date().toISOString().slice(0,10), orders: fg.orders };
          updated = true;
          console.log(`[FG Bridge] Downloads에서 플렉스지 ${fgData.count}건 import (${fgFile.name})`);
        }
      }
    } catch (e) { console.log(`[FG Bridge] fg-orders 읽기 실패: ${e.message}`); }

    try {
      if (bjFile) {
        const bj = JSON.parse(fs.readFileSync(bjFile.path, 'utf8'));
        if (bj.orders && bj.orders.length > 0) {
          bjData = {
            count: bj.orders.length, date: bj.date || new Date().toISOString().slice(0,10),
            orders: bj.orders,
            ...(bj.ordersDetail ? { ordersDetail: bj.ordersDetail } : {})
          };
          updated = true;
          console.log(`[FG Bridge] Downloads에서 발주모아 ${bjData.count}건 import (${bjFile.name}, detail: ${bj.ordersDetail?.length || 0})`);
        }
      }
    } catch (e) { console.log(`[FG Bridge] bj-orders 읽기 실패: ${e.message}`); }

    if (updated) {
      const syncData = {
        lastSync: new Date().toISOString(),
        source: 'mcp-dual-live',
        version: 2,
        flexgate: fgData,
        baljumoa: bjData
      };
      fs.writeFileSync(syncJsonPath, JSON.stringify(syncData, null, 2), 'utf8');
      lastReceived = new Date().toISOString();
      console.log(`[FG Bridge] fg-sync.json 갱신 완료: 플지 ${fgData.count}건 / 발모 ${bjData.count}건`);
    }
    return { updated, fgCount: fgData.count, bjCount: bjData.count, lastSync: lastReceived };
  };

  // 소스별 임시 저장소 (push-source용)
  const pendingData = { flexgate: null, baljumoa: null };

  return {
    name: 'fg-bridge',
    configureServer(server) {
      // CORS 헤더 추가
      const cors = (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      };

      // Downloads 폴더 자동 감지 (파일 변경 시 자동 import)
      let watchDebounce = null;
      try {
        fs.watch(downloadsDir, (event, filename) => {
          if (filename && (filename.startsWith('fg-orders') || filename.startsWith('bj-orders')) && filename.endsWith('.json')) {
            if (watchDebounce) clearTimeout(watchDebounce);
            watchDebounce = setTimeout(() => {
              console.log(`[FG Bridge] Downloads 파일 변경 감지: ${filename}`);
              importFromDownloads();
            }, 1500);
          }
        });
        console.log(`[FG Bridge] Downloads 폴더 감시 시작: ${downloadsDir}`);
      } catch (e) { console.log(`[FG Bridge] Downloads 감시 실패: ${e.message}`); }

      server.middlewares.use((req, res, next) => {
        // OPTIONS preflight
        if (req.method === 'OPTIONS' && req.url.startsWith('/api/')) {
          cors(res);
          res.statusCode = 204;
          return res.end();
        }

        // GET /api/import-downloads — Downloads 폴더에서 최신 데이터 import
        if (req.method === 'GET' && req.url === '/api/import-downloads') {
          cors(res);
          res.setHeader('Content-Type', 'application/json');
          const result = importFromDownloads();
          return res.end(JSON.stringify({ ok: true, ...result }));
        }

        // GET /api/sync-status — 플렉스지 탭이 폴링하는 엔드포인트
        if (req.method === 'GET' && req.url === '/api/sync-status') {
          cors(res);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ requested: syncRequested }));
        }

        // POST /api/request-sync — 앱에서 동기화 요청
        if (req.method === 'POST' && req.url === '/api/request-sync') {
          syncRequested = true;
          cors(res);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ ok: true, message: 'sync requested' }));
        }

        // POST /api/fg-receive — 플렉스지 탭에서 데이터 수신 (v1 호환)
        if (req.method === 'POST' && req.url === '/api/fg-receive') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const syncData = {
                lastSync: new Date().toISOString(),
                source: 'flexgate-mcp-bridge-live',
                count: data.count || data.orders.length,
                orders: data.orders
              };
              fs.writeFileSync(syncJsonPath, JSON.stringify(syncData, null, 2), 'utf8');
              syncRequested = false;
              lastReceived = new Date().toISOString();
              cors(res);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, count: syncData.count, lastReceived }));
              console.log(`[FG Bridge] 수신 완료: ${syncData.count}건`);
            } catch (e) {
              cors(res);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // POST /api/push-source — 소스별 개별 데이터 푸시 (브라우저 탭에서 직접 호출)
        // body: { source: "flexgate"|"baljumoa", date: "2026-03-10", orders: [...] }
        if (req.method === 'POST' && req.url === '/api/push-source') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              let data;
              try { data = JSON.parse(body); } catch { const params = new URLSearchParams(body); data = JSON.parse(params.get("data") || "{}"); }
              const src = data.source;
              if (src !== 'flexgate' && src !== 'baljumoa') {
                throw new Error('Invalid source: ' + src);
              }
              pendingData[src] = {
                count: data.orders?.length || 0,
                date: data.date || new Date().toISOString().slice(0,10),
                orders: data.orders || [],
                ...(data.ordersDetail ? { ordersDetail: data.ordersDetail } : {})
              };
              console.log(`[FG Bridge] push-source: ${src} ${pendingData[src].count}건 수신`);

              // 기존 fg-sync.json 읽어서 다른 소스 데이터 보존
              let existing = {};
              try { existing = JSON.parse(fs.readFileSync(syncJsonPath, 'utf8')); } catch {}

              const syncData = {
                lastSync: new Date().toISOString(),
                source: 'mcp-dual-live',
                version: 2,
                flexgate: pendingData.flexgate || existing.flexgate || { count: 0, date: '', orders: [] },
                baljumoa: pendingData.baljumoa || existing.baljumoa || { count: 0, date: '', orders: [] }
              };
              fs.writeFileSync(syncJsonPath, JSON.stringify(syncData, null, 2), 'utf8');
              syncRequested = false;
              lastReceived = new Date().toISOString();

              cors(res);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                ok: true,
                source: src,
                count: pendingData[src].count,
                fgCount: syncData.flexgate.count,
                bjCount: syncData.baljumoa.count,
                lastReceived
              }));
              console.log(`[FG Bridge] fg-sync.json 갱신: 플지 ${syncData.flexgate.count}건 / 발모 ${syncData.baljumoa.count}건`);
            } catch (e) {
              cors(res);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // POST /api/dual-receive — 플렉스지 + 발주모아 양방향 데이터 수신 (v2)
        if (req.method === 'POST' && req.url === '/api/dual-receive') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const syncData = {
                lastSync: new Date().toISOString(),
                source: 'mcp-dual-live',
                version: 2,
                flexgate: {
                  count: data.flexgate?.orders?.length || 0,
                  date: data.flexgate?.date || new Date().toISOString().slice(0,10),
                  orders: data.flexgate?.orders || []
                },
                baljumoa: {
                  count: data.baljumoa?.orders?.length || 0,
                  date: data.baljumoa?.date || new Date().toISOString().slice(0,10),
                  orders: data.baljumoa?.orders || []
                }
              };
              fs.writeFileSync(syncJsonPath, JSON.stringify(syncData, null, 2), 'utf8');
              syncRequested = false;
              lastReceived = new Date().toISOString();
              cors(res);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                ok: true,
                fgCount: syncData.flexgate.count,
                bjCount: syncData.baljumoa.count,
                lastReceived
              }));
              console.log(`[FG Bridge] 양방향 수신: 플지 ${syncData.flexgate.count}건 / 발모 ${syncData.baljumoa.count}건`);
            } catch (e) {
              cors(res);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // POST /api/trigger-import — 발주모아 연동 가져오기 트리거
        // 웨일 브라우저 Puppeteer 스크립트 자동 실행
        if (req.method === 'POST' && req.url === '/api/trigger-import') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            let channel = 'all';
            try { channel = JSON.parse(body).channel || 'all'; } catch {}

            cors(res);
            const statusPath = path.resolve('public/import-status.json');
            const status = { triggered: true, time: new Date().toISOString(), status: 'launching', channel, logs: [] };
            fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf8');

            const scriptPath = path.resolve('scripts/bj-auto-import.cjs');
            const child = spawn('node', [scriptPath, '--channel', channel], {
              stdio: ['ignore', 'pipe', 'pipe'],
              cwd: path.resolve('.'),
              windowsHide: false,
            });
            // 프로세스 PID 저장 (중지용)
            server.__importChildPid = child.pid;

            child.stdout.on('data', (data) => console.log(data.toString().trim()));
            child.stderr.on('data', (data) => console.error(data.toString().trim()));
            child.on('error', (err) => {
              console.error(`[FG Bridge] 스크립트 실행 실패: ${err.message}`);
              const errStatus = { triggered: false, status: 'error', time: new Date().toISOString(), result: { error: err.message }, logs: [] };
              try { fs.writeFileSync(statusPath, JSON.stringify(errStatus, null, 2), 'utf8'); } catch {}
              server.__importChildPid = null;
            });
            child.on('exit', (code) => {
              server.__importChildPid = null;
              // 프로세스 종료 시 상태가 아직 triggered면 stopped로 갱신
              try {
                const cur = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
                if (cur.triggered) {
                  const stoppedStatus = { triggered: false, status: code === 0 ? 'done' : 'stopped', time: new Date().toISOString(), result: { success: false, message: '프로세스 종료됨' }, logs: cur.logs || [] };
                  fs.writeFileSync(statusPath, JSON.stringify(stoppedStatus, null, 2), 'utf8');
                  console.log(`[FG Bridge] 연동 프로세스 종료 (code: ${code})`);
                }
              } catch {}
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, channel, message: `${channel} 채널 연동 가져오기 실행중...` }));
            console.log(`[FG Bridge] 발주모아 연동 가져오기 — 채널: ${channel}`);
          });
          return;
        }

        // POST /api/stop-import — 연동 가져오기 중지
        if (req.method === 'POST' && req.url === '/api/stop-import') {
          cors(res);
          const statusPath = path.resolve('public/import-status.json');
          let killed = false;
          // 1. Node 스크립트 종료
          if (server.__importChildPid) {
            try { process.kill(server.__importChildPid); killed = true; } catch {}
            server.__importChildPid = null;
          }
          // 2. 웨일 브라우저 종료
          try { spawn('taskkill', ['/F', '/IM', 'whale.exe'], { stdio: 'ignore' }); } catch {}
          // 3. 상태 갱신
          try {
            const cur = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
            const stoppedStatus = { triggered: false, status: 'stopped', time: new Date().toISOString(), result: { success: false, message: '사용자가 중지함' }, logs: cur.logs || [], channel: cur.channel };
            fs.writeFileSync(statusPath, JSON.stringify(stoppedStatus, null, 2), 'utf8');
          } catch {}
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, killed }));
          console.log('[FG Bridge] 연동 가져오기 중지됨');
          return;
        }

        // GET /api/import-status — 연동 가져오기 상태 확인
        if (req.method === 'GET' && req.url === '/api/import-status') {
          cors(res);
          res.setHeader('Content-Type', 'application/json');
          const statusPath = path.resolve('public/import-status.json');
          try {
            const data = fs.readFileSync(statusPath, 'utf8');
            res.end(data);
          } catch {
            res.end(JSON.stringify({ triggered: false }));
          }
          return;
        }

        // POST /api/import-done — 연동 가져오기 완료 알림 (MCP에서 호출)
        if (req.method === 'POST' && req.url === '/api/import-done') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const statusPath = path.resolve('public/import-status.json');
              const status = { triggered: false, status: 'done', time: new Date().toISOString(), result: data };
              fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), 'utf8');
              cors(res);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
              console.log(`[FG Bridge] 연동 가져오기 완료: ${data.count || 0}건`);
            } catch (e) {
              cors(res);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        // GET /api/bj-login — 로그인 설정 조회
        if (req.method === 'GET' && req.url === '/api/bj-login') {
          cors(res);
          res.setHeader('Content-Type', 'application/json');
          const loginPath = path.resolve('bj-login.json');
          try {
            const data = JSON.parse(fs.readFileSync(loginPath, 'utf8'));
            res.end(JSON.stringify({ ok: true, loginId: data.loginId || '', hasPassword: !!(data.loginPw) }));
          } catch {
            res.end(JSON.stringify({ ok: true, loginId: '', hasPassword: false }));
          }
          return;
        }

        // POST /api/bj-login — 로그인 설정 저장
        if (req.method === 'POST' && req.url === '/api/bj-login') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const loginPath = path.resolve('bj-login.json');
              let existing = {};
              try { existing = JSON.parse(fs.readFileSync(loginPath, 'utf8')); } catch {}
              if (data.loginId !== undefined) existing.loginId = data.loginId;
              if (data.loginPw !== undefined) existing.loginPw = data.loginPw;
              fs.writeFileSync(loginPath, JSON.stringify(existing, null, 2), 'utf8');
              cors(res);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
              console.log(`[FG Bridge] 발주모아 로그인 정보 저장됨`);
            } catch (e) {
              cors(res);
              res.statusCode = 400;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), fgBridgePlugin()],
})
