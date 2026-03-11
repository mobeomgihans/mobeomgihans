import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// 플렉스지 MCP 브릿지 플러그인
function fgBridgePlugin() {
  let syncRequested = false;
  let lastReceived = null;
  const syncJsonPath = path.resolve('public/fg-sync.json');

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

      server.middlewares.use((req, res, next) => {
        // OPTIONS preflight
        if (req.method === 'OPTIONS' && req.url.startsWith('/api/')) {
          cors(res);
          res.statusCode = 204;
          return res.end();
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
                orders: data.orders || []
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

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), fgBridgePlugin()],
})
