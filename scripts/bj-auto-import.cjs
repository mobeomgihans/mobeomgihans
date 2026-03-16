// 발주모아 연동 가져오기 — Puppeteer 자동화 (웨일 브라우저)
// spawn으로 웨일 실행 → CDP 연결 → 자동화 실행
// 사용법: node bj-auto-import.cjs [--channel all|coupang|smartstore|etc]

const puppeteer = require('puppeteer-core');
const { spawn: spawnProcess } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

// ─── 설정 ────────────────────────────────────────────
const WHALE_PATH = 'C:/Program Files/Naver/Naver Whale/Application/whale.exe';
const CDP_PORT = 9333;
const IMPORT_URL = 'https://others2.baljumoa.com/Dist/pop_orderLinkCollect';
const STATUS_PATH = path.resolve(__dirname, '../public/import-status.json');
const VITE_PORT = 5173;
const USER_DATA_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.bj-import-session');

// ─── 채널 인자 파싱 ──────────────────────────────────
const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');
const CHANNEL = channelIdx >= 0 && args[channelIdx + 1] ? args[channelIdx + 1] : 'all';
const CHANNEL_LABELS = { all: '전체', coupang: '쿠팡', smartstore: '스마트스토어', etc: '기타' };
const channelLabel = CHANNEL_LABELS[CHANNEL] || CHANNEL;

// ─── 로그 관리 ───────────────────────────────────────
const logs = [];
const addLog = (msg) => {
  const entry = { time: new Date().toISOString(), msg };
  logs.push(entry);
  console.log(`[BJ Auto] ${msg}`);
};

const writeStatus = (status) => {
  try { fs.writeFileSync(STATUS_PATH, JSON.stringify({ ...status, logs, channel: CHANNEL }, null, 2), 'utf8'); } catch {}
};

const notifyDone = (result) => {
  return new Promise((resolve) => {
    const data = JSON.stringify(result);
    const req = http.request({
      hostname: 'localhost', port: VITE_PORT,
      path: '/api/import-done', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => { let body = ''; res.on('data', c => body += c); res.on('end', () => resolve(body)); });
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const cleanLocks = () => {
  try {
    const files = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
    for (const f of files) {
      const p = path.join(USER_DATA_DIR, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch {}
};

(async () => {
  addLog(`시작 (채널: ${channelLabel})`);
  writeStatus({ triggered: true, status: 'launching', time: new Date().toISOString() });

  let browser = null;
  let whaleProc = null;

  try {
    cleanLocks();

    // ─── 웨일 브라우저 실행 ──────────────────────────
    addLog('웨일 브라우저 실행...');
    whaleProc = spawnProcess(WHALE_PATH, [
      '--remote-debugging-port=' + CDP_PORT,
      '--user-data-dir=' + USER_DATA_DIR,
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
      IMPORT_URL
    ], { detached: true, stdio: 'ignore' });
    whaleProc.unref();

    await sleep(5000);
    addLog('CDP 연결중...');
    writeStatus({ triggered: true, status: 'connecting', time: new Date().toISOString() });

    // ─── CDP 연결 ────────────────────────────────────
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:' + CDP_PORT,
      defaultViewport: null,
    });
    addLog('웨일 연결 완료');

    // 페이지 탭 대기 (최대 10초)
    let pages = [];
    for (let i = 0; i < 10; i++) {
      pages = await browser.pages();
      if (pages.length > 0) break;
      await sleep(1000);
    }
    if (pages.length === 0) {
      const p = await browser.newPage();
      await p.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      pages = [p];
    }
    let page = pages.find(p => p.url().includes('baljumoa')) || pages[0];
    if (!page.url().includes('baljumoa')) {
      await page.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // ─── 로그인 확인 ─────────────────────────────────
    await sleep(2000);
    let currentUrl = page.url();
    addLog('현재 URL: ' + currentUrl);

    if (currentUrl.includes('Login') || currentUrl.includes('login')) {
      addLog('로그인 필요 — 브라우저에서 직접 로그인해주세요');
      writeStatus({ triggered: true, status: 'login_required', time: new Date().toISOString() });

      let loggedIn = false;
      for (let i = 0; i < 36; i++) {
        await sleep(5000);
        currentUrl = page.url();
        if (!currentUrl.includes('Login') && !currentUrl.includes('login')) {
          loggedIn = true;
          break;
        }
      }
      if (!loggedIn) throw new Error('로그인 타임아웃 (3분)');

      addLog('로그인 완료!');
      await page.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
    }

    if (!page.url().includes('pop_orderLinkCollect')) {
      await page.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
    }

    addLog('연동 가져오기 페이지 접속 완료');
    writeStatus({ triggered: true, status: 'importing', time: new Date().toISOString() });

    // ─── 채널별 계정 선택 ────────────────────────────
    if (CHANNEL === 'all') {
      addLog('전체 계정 선택...');
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && !sa.classList.contains('active')) sa.click();
      });
    } else {
      addLog(`${channelLabel} 계정 선택...`);
      // 먼저 전체 해제 후 특정 채널만 선택
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && sa.classList.contains('active')) sa.click(); // 전체 해제
      });
      await sleep(300);

      const channelKeywords = {
        coupang: ['쿠팡', 'Coupang', 'coupang'],
        smartstore: ['스마트스토어', 'SmartStore', 'smartstore', '네이버'],
        etc: [] // 쿠팡, 스마트스토어 제외한 나머지
      };

      const selectedCount = await page.evaluate((ch, keywords) => {
        const items = document.querySelectorAll('.link_item, .account_item, [class*=link_list] li, [class*=account] li');
        let count = 0;
        for (const item of items) {
          const text = item.textContent || '';
          const cb = item.querySelector('input[type=checkbox]') || item;
          const isClickable = cb.click !== undefined;

          if (ch === 'etc') {
            // 쿠팡, 스마트스토어가 아닌 것만 선택
            const isCoupang = ['쿠팡', 'Coupang', 'coupang'].some(k => text.includes(k));
            const isSmart = ['스마트스토어', 'SmartStore', 'smartstore', '네이버'].some(k => text.includes(k));
            if (!isCoupang && !isSmart && isClickable) { cb.click(); count++; }
          } else {
            const match = keywords.some(k => text.includes(k));
            if (match && isClickable) { cb.click(); count++; }
          }
        }
        return count;
      }, CHANNEL, channelKeywords[CHANNEL] || []);

      addLog(`${channelLabel} 계정 ${selectedCount}개 선택됨`);

      // 개별 선택이 안되면 전체 선택 fallback
      if (selectedCount === 0) {
        addLog('개별 선택 실패 — 전체 계정으로 fallback');
        await page.evaluate(() => {
          const sa = document.querySelector('.link_selectAll');
          if (sa && !sa.classList.contains('active')) sa.click();
        });
      }
    }
    await sleep(500);

    // ─── 날짜 & 필터 설정 ────────────────────────────
    await page.evaluate(() => { if (typeof setDate === 'function') setDate('today'); });
    await sleep(300);

    await page.evaluate(() => {
      const radios = document.querySelectorAll('input[name="sel_type"]');
      for (const r of radios) { if (r.value === 'N') { r.checked = true; r.click(); break; } }
    });
    await sleep(300);

    // ─── confirm/alert 오버라이드 ────────────────────
    await page.evaluate(() => {
      window.__origConfirm = window.confirm;
      window.__origAlert = window.alert;
      window.confirm = () => true;
      window.alert = () => {};
    });

    // ─── 가져오기 실행 ───────────────────────────────
    addLog('가져오기 실행...');
    writeStatus({ triggered: true, status: 'fetching', time: new Date().toISOString() });
    await page.evaluate(() => { beforeOnList(); });
    await sleep(3000);

    // 쿠팡 안내 모달 확인
    const hasCoupang = await page.evaluate(() => !!document.querySelector('#CoupangView'));
    if (hasCoupang) {
      addLog('쿠팡 안내 확인...');
      await page.evaluate(() => { onList(); });
      await sleep(3000);
    }

    // 주문 로딩 대기
    addLog('주문 로딩 대기...');
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, { timeout: 60000 });
    await sleep(2000);

    // 결과 모달 닫기
    await page.evaluate(() => {
      const modals = document.querySelectorAll('.modal');
      for (const m of modals) {
        if (m.textContent.includes('연동계정에서 가져온')) {
          const btns = m.querySelectorAll('button');
          for (const btn of btns) { if (btn.textContent.trim() === '확인') { btn.click(); return; } }
        }
      }
    });
    await sleep(1000);

    // 주문 수 확인
    const orderCount = await page.evaluate(() => document.querySelectorAll('table tbody tr').length);
    addLog(`${orderCount}건 가져옴`);

    if (orderCount === 0) {
      addLog('등록할 주문 없음');
      const result = { success: true, count: 0, message: '등록할 주문 없음', channel: channelLabel };
      writeStatus({ triggered: false, status: 'done', time: new Date().toISOString(), result });
      await notifyDone(result);
      await browser.disconnect();
      try { process.kill(whaleProc.pid); } catch {}
      return;
    }

    // ─── 전체 선택 & 등록 ────────────────────────────
    await page.evaluate(() => {
      const cb = document.querySelector('#chkCheckDataAll');
      if (cb && !cb.checked) cb.click();
    });
    await sleep(500);

    addLog(`${orderCount}건 등록 시작...`);
    writeStatus({ triggered: true, status: 'registering', time: new Date().toISOString(), count: orderCount });
    await page.evaluate(() => { onReg(); });

    // 등록 완료 대기
    addLog('등록 처리중...');
    let regComplete = false;
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      regComplete = await page.evaluate((iter) => {
        const text = document.body.innerText || '';
        if (text.includes('주문등록이 완료') || text.includes('주문 수집이 완료') ||
            text.includes('등록이 완료') || text.includes('등록 완료') ||
            text.includes('처리가 완료') || text.includes('처리 완료')) return true;
        if (iter > 5) {
          const loadingEl = document.querySelector('.loading_wrap, .dim_wrap, [class*=loading], [class*=progress]');
          if (!loadingEl || loadingEl.style.display === 'none') return true;
        }
        return false;
      }, i);
      if (regComplete) break;
    }

    if (regComplete) {
      addLog('등록 완료!');
      await page.evaluate(() => {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          const t = btn.textContent.trim();
          if ((t === '닫기' || t === '닫 기') && btn.offsetParent !== null) { btn.click(); return; }
        }
      });
    } else {
      addLog('등록 타임아웃 — 수동 확인 필요');
    }

    // confirm/alert 복원
    await page.evaluate(() => {
      if (window.__origConfirm) window.confirm = window.__origConfirm;
      if (window.__origAlert) window.alert = window.__origAlert;
    });

    // 결과 알림
    const result = { success: true, count: orderCount, message: `${channelLabel} ${orderCount}건 연동 완료`, channel: channelLabel };
    addLog(`완료! ${channelLabel} ${orderCount}건 등록`);
    writeStatus({ triggered: false, status: 'done', time: new Date().toISOString(), result });
    await notifyDone(result);

    // 브라우저 닫기
    await sleep(3000);
    await browser.disconnect();
    try { process.kill(whaleProc.pid); } catch {}

  } catch (e) {
    addLog(`오류: ${e.message}`);
    const result = { success: false, error: e.message, channel: channelLabel };
    writeStatus({ triggered: false, status: 'error', time: new Date().toISOString(), result });
    await notifyDone(result);
    if (browser) try { await browser.disconnect(); } catch {}
    if (whaleProc) try { process.kill(whaleProc.pid); } catch {}
    process.exit(1);
  }
})();
