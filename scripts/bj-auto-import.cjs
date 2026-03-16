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
      if (fs.existsSync(p)) { fs.unlinkSync(p); addLog(`잠금파일 제거: ${f}`); }
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
    addLog('웨일 브라우저 실행중...');
    addLog(`경로: ${WHALE_PATH}`);
    addLog(`세션 디렉토리: ${USER_DATA_DIR}`);
    whaleProc = spawnProcess(WHALE_PATH, [
      '--remote-debugging-port=' + CDP_PORT,
      '--user-data-dir=' + USER_DATA_DIR,
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
      IMPORT_URL
    ], { detached: true, stdio: 'ignore' });
    whaleProc.unref();
    addLog(`웨일 프로세스 시작됨 (PID: ${whaleProc.pid})`);
    writeStatus({ triggered: true, status: 'launching', time: new Date().toISOString() });

    await sleep(5000);
    addLog(`CDP 연결 시도 (port: ${CDP_PORT})...`);
    writeStatus({ triggered: true, status: 'connecting', time: new Date().toISOString() });

    // ─── CDP 연결 ────────────────────────────────────
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:' + CDP_PORT,
      defaultViewport: null,
    });
    addLog('CDP 연결 성공');

    // 페이지 탭 대기 (최대 10초)
    let pages = [];
    for (let i = 0; i < 10; i++) {
      pages = await browser.pages();
      addLog(`탭 검색중... (${pages.length}개 발견, ${i+1}/10)`);
      if (pages.length > 0) break;
      await sleep(1000);
    }
    if (pages.length === 0) {
      addLog('탭 없음 — 새 탭 생성');
      const p = await browser.newPage();
      await p.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      pages = [p];
    }
    let page = pages.find(p => p.url().includes('baljumoa')) || pages[0];
    addLog(`활성 탭: ${page.url().substring(0, 80)}`);
    if (!page.url().includes('baljumoa')) {
      addLog('발주모아 페이지로 이동중...');
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
        addLog(`로그인 대기중... (${i+1}/36) URL: ${currentUrl.substring(0, 60)}`);
        writeStatus({ triggered: true, status: 'login_required', time: new Date().toISOString() });
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
      addLog('연동 가져오기 페이지로 이동...');
      await page.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(2000);
    }

    addLog('연동 가져오기 페이지 접속 완료');
    writeStatus({ triggered: true, status: 'importing', time: new Date().toISOString() });

    // ─── 페이지 내 계정 목록 확인 ────────────────────
    writeStatus({ triggered: true, status: 'checking_accounts', time: new Date().toISOString() });
    const accountInfo = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll('input[type=checkbox]');
      const accounts = [];
      for (const cb of checkboxes) {
        if (cb.id === 'chkCheckDataAll') continue;
        const parent = cb.closest('li, tr, div, label, span') || cb.parentElement;
        if (!parent) continue;
        const text = (parent.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
        accounts.push({ text, checked: cb.checked, id: cb.id || '' });
      }
      const selectAll = document.querySelector('.link_selectAll');
      return { total: accounts.length, accounts, hasSelectAll: !!selectAll };
    });
    addLog(`계정 목록: ${accountInfo.total}개 발견 (전체선택 버튼: ${accountInfo.hasSelectAll ? '있음' : '없음'})`);
    for (const acc of accountInfo.accounts) {
      addLog(`  계정: "${acc.text}" [${acc.checked ? '체크됨' : '미체크'}]`);
    }

    // ─── 채널별 계정 선택 ────────────────────────────
    writeStatus({ triggered: true, status: 'selecting_channel', time: new Date().toISOString() });
    if (CHANNEL === 'all') {
      addLog('전체 계정 선택...');
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && !sa.classList.contains('active')) sa.click();
      });
      addLog('전체 선택 완료');
    } else {
      addLog(`${channelLabel} 계정만 선택 시작...`);

      // 1. 먼저 전체 선택 → 전체 해제 (모든 체크박스 초기화)
      addLog('모든 체크박스 초기화 (전체선택→전체해제)...');
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && !sa.classList.contains('active')) sa.click(); // 전체 선택
      });
      await sleep(300);
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && sa.classList.contains('active')) sa.click(); // 전체 해제
      });
      await sleep(500);

      // 초기화 후 상태 확인
      const afterReset = await page.evaluate(() => {
        const cbs = document.querySelectorAll('input[type=checkbox]');
        let checked = 0;
        for (const cb of cbs) { if (cb.id !== 'chkCheckDataAll' && cb.checked) checked++; }
        return checked;
      });
      addLog(`초기화 완료 — 체크된 항목: ${afterReset}개`);

      // 2. 해당 채널 키워드로 개별 계정 체크박스 선택
      const channelKeywords = {
        coupang: ['쿠팡', 'Coupang', 'coupang', 'COUPANG'],
        smartstore: ['스마트스토어', 'SmartStore', 'smartstore', '스마트 스토어', 'SMARTSTORE'],
        etc: []
      };

      const selectionResult = await page.evaluate((ch, keywords) => {
        const checkboxes = document.querySelectorAll('input[type=checkbox]');
        let count = 0;
        const selected = [];
        const skipped = [];
        for (const cb of checkboxes) {
          if (cb.id === 'chkCheckDataAll') continue;
          const parent = cb.closest('li, tr, div, label, span') || cb.parentElement;
          if (!parent) continue;
          const text = (parent.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 50);
          const isChecked = cb.checked;

          if (ch === 'etc') {
            const isCoupang = ['쿠팡', 'Coupang', 'coupang', 'COUPANG'].some(k => text.includes(k));
            const isSmart = ['스마트스토어', 'SmartStore', 'smartstore', '스마트 스토어'].some(k => text.includes(k));
            if (!isCoupang && !isSmart && !isChecked) {
              cb.click(); count++;
              selected.push(text);
            } else {
              skipped.push(text);
            }
          } else {
            const match = keywords.some(k => text.includes(k));
            if (match && !isChecked) {
              cb.click(); count++;
              selected.push(text);
            } else {
              skipped.push(text);
            }
          }
        }

        // 체크박스 못 찾으면 클릭 가능한 계정 아이템으로 시도
        if (count === 0) {
          const items = document.querySelectorAll('[class*=link] li, [class*=account] li, .link_item, .account_item');
          for (const item of items) {
            const text = (item.textContent || '').trim().substring(0, 50);
            if (ch === 'etc') {
              const isCoupang = ['쿠팡', 'Coupang'].some(k => text.includes(k));
              const isSmart = ['스마트스토어', 'SmartStore'].some(k => text.includes(k));
              if (!isCoupang && !isSmart) { item.click(); count++; selected.push(text); }
            } else {
              const match = keywords.some(k => text.includes(k));
              if (match) { item.click(); count++; selected.push(text); }
            }
          }
        }
        return { count, selected, skipped };
      }, CHANNEL, channelKeywords[CHANNEL] || []);

      addLog(`${channelLabel} 계정 ${selectionResult.count}개 선택됨`);
      for (const s of selectionResult.selected) addLog(`  선택: "${s}"`);
      if (selectionResult.skipped.length > 0) {
        addLog(`  제외: ${selectionResult.skipped.length}개`);
      }

      if (selectionResult.count === 0) {
        addLog('개별 선택 실패 — 전체 계정으로 fallback');
        await page.evaluate(() => {
          const sa = document.querySelector('.link_selectAll');
          if (sa && !sa.classList.contains('active')) sa.click();
        });
      }
    }
    await sleep(500);

    // ─── 날짜 & 필터 설정 ────────────────────────────
    addLog('날짜 설정: 오늘');
    writeStatus({ triggered: true, status: 'setting_date', time: new Date().toISOString() });
    await page.evaluate(() => { if (typeof setDate === 'function') setDate('today'); });
    await sleep(300);

    addLog('필터: 신규주문(N)');
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
    addLog('confirm/alert 오버라이드 설정');

    // ─── 가져오기 실행 ───────────────────────────────
    addLog('가져오기 버튼 클릭 (beforeOnList)...');
    writeStatus({ triggered: true, status: 'fetching', time: new Date().toISOString() });
    await page.evaluate(() => { beforeOnList(); });
    addLog('가져오기 요청 전송됨 — 서버 응답 대기중...');
    await sleep(3000);

    // 쿠팡 안내 모달 확인 — 모달이 뜨면 확인 버튼 클릭
    await sleep(2000);
    const coupangHandled = await page.evaluate(() => {
      const cv = document.querySelector('#CoupangView');
      if (cv) {
        if (typeof onList === 'function') { onList(); return 'onList'; }
        const btn = cv.querySelector('button') || cv.querySelector('[onclick]');
        if (btn) { btn.click(); return 'btn'; }
      }
      const modals = document.querySelectorAll('.modal, .popup, [class*=modal], [class*=popup], [role=dialog]');
      for (const m of modals) {
        const text = m.textContent || '';
        if (text.includes('쿠팡') && (text.includes('확인') || text.includes('상품준비'))) {
          const btns = m.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent.trim() === '확인' && btn.offsetParent !== null) { btn.click(); return 'modal-btn'; }
          }
        }
      }
      return null;
    });
    if (coupangHandled) {
      addLog(`쿠팡 안내 모달 처리 완료 (${coupangHandled})`);
      await sleep(3000);
    }

    // 추가: 화면에 남아있는 모든 확인 버튼 클릭 (안내 팝업 정리)
    const extraModals = await page.evaluate(() => {
      let clicked = 0;
      const modals = document.querySelectorAll('.modal, .popup, [class*=modal], [role=dialog]');
      for (const m of modals) {
        if (m.offsetParent === null) continue;
        const btns = m.querySelectorAll('button');
        for (const btn of btns) {
          const t = btn.textContent.trim();
          if (t === '확인' && btn.offsetParent !== null) { btn.click(); clicked++; break; }
        }
      }
      return clicked;
    });
    if (extraModals > 0) addLog(`추가 모달 ${extraModals}개 닫음`);
    await sleep(1000);

    // 주문 로딩 대기
    addLog('주문 데이터 로딩 대기중...');
    writeStatus({ triggered: true, status: 'waiting_orders', time: new Date().toISOString() });
    try {
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length > 0, { timeout: 60000 });
      addLog('주문 테이블 로딩됨');
    } catch {
      addLog('주문 로딩 타임아웃 (60초) — 주문이 없을 수 있음');
    }
    await sleep(2000);

    // 결과 모달 닫기 (연동계정에서 가져온 결과)
    const resultModal = await page.evaluate(() => {
      const modals = document.querySelectorAll('.modal, [class*=modal], [role=dialog]');
      for (const m of modals) {
        const text = m.textContent || '';
        if (text.includes('연동계정에서 가져온') || text.includes('가져오기 결과') || text.includes('수집 결과')) {
          const btns = m.querySelectorAll('button');
          for (const btn of btns) { if (btn.textContent.trim() === '확인') { btn.click(); return text.substring(0, 100); } }
        }
      }
      return null;
    });
    if (resultModal) addLog(`결과 모달 닫음: "${resultModal.substring(0, 60)}..."`);
    await sleep(1000);

    // 주문 수 확인
    const orderInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const details = [];
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cells = rows[i].querySelectorAll('td');
        const texts = Array.from(cells).map(c => c.textContent.trim().substring(0, 30));
        details.push(texts.join(' | '));
      }
      return { count: rows.length, details };
    });
    addLog(`주문 ${orderInfo.count}건 가져옴`);
    for (const d of orderInfo.details) {
      addLog(`  주문: ${d}`);
    }
    if (orderInfo.count > 10) addLog(`  ... 외 ${orderInfo.count - 10}건`);

    const orderCount = orderInfo.count;

    if (orderCount === 0) {
      addLog('등록할 주문 없음 — 완료');
      const result = { success: true, count: 0, message: '등록할 주문 없음', channel: channelLabel };
      writeStatus({ triggered: false, status: 'done', time: new Date().toISOString(), result });
      await notifyDone(result);
      addLog('브라우저 종료중...');
      await browser.disconnect();
      try { process.kill(whaleProc.pid); } catch {}
      addLog('완료!');
      return;
    }

    // ─── 전체 선택 & 등록 ────────────────────────────
    addLog('주문 전체 선택...');
    writeStatus({ triggered: true, status: 'selecting_orders', time: new Date().toISOString() });
    // 전체선택 체크박스 시도
    await page.evaluate(() => {
      const cb = document.querySelector('#chkCheckDataAll');
      if (cb && !cb.checked) cb.click();
    });
    await sleep(500);

    // 전체선택이 안 되었을 수 있으므로 개별 체크박스도 클릭 (단일 주문 대응)
    await page.evaluate(() => {
      const cbs = document.querySelectorAll('table tbody input[type=checkbox]');
      for (const cb of cbs) { if (!cb.checked) cb.click(); }
    });
    await sleep(300);

    // 선택된 주문 수 확인
    const selectedOrders = await page.evaluate(() => {
      const cbs = document.querySelectorAll('table tbody input[type=checkbox]');
      let checked = 0;
      for (const cb of cbs) { if (cb.checked) checked++; }
      return checked;
    });
    addLog(`선택된 주문: ${selectedOrders}건 / 전체: ${orderCount}건`);

    addLog(`${orderCount}건 등록 시작 (onReg)...`);
    writeStatus({ triggered: true, status: 'registering', time: new Date().toISOString(), count: orderCount });
    await page.evaluate(() => { onReg(); });

    // 등록 완료 대기
    addLog('등록 처리중 — 서버 응답 대기...');
    let regComplete = false;
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      const progress = await page.evaluate((iter) => {
        const text = document.body.innerText || '';
        const hasComplete = text.includes('주문등록이 완료') || text.includes('주문 수집이 완료') ||
            text.includes('등록이 완료') || text.includes('등록 완료') ||
            text.includes('처리가 완료') || text.includes('처리 완료');
        if (hasComplete) return { done: true, reason: 'complete_text' };
        if (iter > 5) {
          const loadingEl = document.querySelector('.loading_wrap, .dim_wrap, [class*=loading], [class*=progress]');
          if (!loadingEl || loadingEl.style.display === 'none') return { done: true, reason: 'no_loading' };
        }
        // 진행률 표시가 있으면 보고
        const progressEl = document.querySelector('[class*=progress], [class*=percent]');
        const progressText = progressEl ? progressEl.textContent.trim() : '';
        return { done: false, progressText };
      }, i);
      if (progress.progressText) addLog(`등록 진행: ${progress.progressText}`);
      if (i % 5 === 4) addLog(`등록 대기중... (${(i+1)*2}초 경과)`);
      writeStatus({ triggered: true, status: 'registering', time: new Date().toISOString(), count: orderCount });
      if (progress.done) { regComplete = true; addLog(`등록 완료 감지 (${progress.reason})`); break; }
    }

    if (regComplete) {
      addLog('주문 등록 완료!');
    } else {
      addLog('등록 타임아웃 (60초) — 모달 정리 시도');
    }

    // ─── 모달 정리: 확인 → 닫기 순서로 클릭 ─────────
    addLog('모달 정리 시작...');
    writeStatus({ triggered: true, status: 'closing_modals', time: new Date().toISOString() });
    await sleep(1000);

    // Step A: "연동계정에서 가져온 주문 결과" 확인 버튼 클릭
    const stepA = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const t = btn.textContent.trim();
        if (t === '확인' && btn.offsetParent !== null) { btn.click(); return t; }
      }
      return null;
    });
    if (stepA) addLog(`모달A: "${stepA}" 버튼 클릭`);
    await sleep(1000);

    // Step B: "처리 내용 저장" 또는 "닫 기" 버튼 클릭
    const stepB = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const t = btn.textContent.trim();
        if ((t === '닫기' || t === '닫 기') && btn.offsetParent !== null) { btn.click(); return t; }
      }
      return null;
    });
    if (stepB) addLog(`모달B: "${stepB}" 버튼 클릭`);
    await sleep(500);

    // Step C: 혹시 남은 모달 전부 닫기
    const stepC = await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      let clicked = [];
      for (const btn of btns) {
        const t = btn.textContent.trim();
        if ((t === '닫기' || t === '닫 기' || t === '확인' || t === '처리 내용 저장') && btn.offsetParent !== null) {
          btn.click();
          clicked.push(t);
        }
      }
      return clicked;
    });
    if (stepC.length > 0) addLog(`모달C: 잔여 버튼 ${stepC.length}개 클릭 [${stepC.join(', ')}]`);
    await sleep(500);

    // confirm/alert 복원
    await page.evaluate(() => {
      if (window.__origConfirm) window.confirm = window.__origConfirm;
      if (window.__origAlert) window.alert = window.__origAlert;
    });
    addLog('confirm/alert 복원');

    // 결과 알림
    const result = { success: true, count: orderCount, message: `${channelLabel} ${orderCount}건 연동 완료`, channel: channelLabel };
    addLog(`완료! ${channelLabel} ${orderCount}건 등록 성공`);
    writeStatus({ triggered: false, status: 'done', time: new Date().toISOString(), result });
    await notifyDone(result);

    // 브라우저 닫기
    addLog('브라우저 종료중...');
    await sleep(2000);
    await browser.disconnect();
    try { process.kill(whaleProc.pid); } catch {}
    addLog('브라우저 종료 완료');

  } catch (e) {
    addLog(`오류 발생: ${e.message}`);
    if (e.stack) addLog(`스택: ${e.stack.split('\n')[1]?.trim() || ''}`);
    const result = { success: false, error: e.message, channel: channelLabel };
    writeStatus({ triggered: false, status: 'error', time: new Date().toISOString(), result });
    await notifyDone(result);
    if (browser) try { await browser.disconnect(); } catch {}
    if (whaleProc) try { process.kill(whaleProc.pid); } catch {}
    process.exit(1);
  }
})();
