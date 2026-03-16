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
const CONFIG_PATH = path.resolve(__dirname, '../bj-login.json');
const VITE_PORT = 5173;
const USER_DATA_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.bj-import-session');

// ─── 로그인 설정 로드 ───────────────────────────────
let LOGIN_ID = '';
let LOGIN_PW = '';
let REP_ID = '';
let LOGIN_TYPE = 'sub'; // "main"=주계정, "sub"=부계정
try {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  LOGIN_ID = cfg.loginId || '';
  LOGIN_PW = cfg.loginPw || '';
  REP_ID = cfg.repId || '';
  LOGIN_TYPE = cfg.loginType || 'sub';
} catch {}

// ─── 채널 인자 파싱 (다중 채널 지원: "coupang,smartstore") ──
const args = process.argv.slice(2);
const channelIdx = args.indexOf('--channel');
const CHANNEL_RAW = channelIdx >= 0 && args[channelIdx + 1] ? args[channelIdx + 1] : 'all';
const CHANNELS = CHANNEL_RAW.split(',').map(c => c.trim());
const IS_ALL = CHANNELS.includes('all');
const CHANNEL_LABELS = { all: '전체', coupang: '쿠팡', smartstore: '스마트스토어', etc: '기타' };
const channelLabel = IS_ALL ? '전체' : CHANNELS.map(c => CHANNEL_LABELS[c] || c).join(', ');

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
    whaleProc = spawnProcess(WHALE_PATH, [
      '--remote-debugging-port=' + CDP_PORT,
      '--user-data-dir=' + USER_DATA_DIR,
      '--no-first-run',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1400,900',
      IMPORT_URL
    ], { detached: true, stdio: 'ignore' });
    whaleProc.unref();
    addLog(`웨일 PID: ${whaleProc.pid}`);
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
      if (pages.length > 0) break;
      await sleep(1000);
    }
    if (pages.length === 0) {
      addLog('탭 없음 — 새 탭 생성');
      const p = await browser.newPage();
      await p.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
      pages = [p];
    }
    addLog(`탭 ${pages.length}개 발견`);
    let page = pages.find(p => p.url().includes('baljumoa')) || pages[0];
    if (!page.url().includes('baljumoa')) {
      addLog('발주모아 페이지로 이동중...');
      await page.goto(IMPORT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    // ─── 로그인 확인 & 자동 로그인 ───────────────────
    await sleep(2000);
    let currentUrl = page.url();
    addLog('현재 URL: ' + currentUrl);

    if (currentUrl.includes('Login') || currentUrl.includes('login')) {
      if (LOGIN_ID && LOGIN_PW) {
        addLog('자동 로그인 시도...');
        writeStatus({ triggered: true, status: 'login_auto', time: new Date().toISOString() });

        // 부계정 로그인 모드: "부계정 로그인" 버튼 클릭하여 대표계정 필드 노출
        if (LOGIN_TYPE === 'sub') {
          addLog('부계정 로그인 모드 전환...');
          const clicked = await page.evaluate(() => {
            const links = document.querySelectorAll('a, button, span, label, div');
            for (const el of links) {
              const t = (el.textContent || '').trim();
              if (t.includes('부계정') && t.includes('로그인')) {
                el.click();
                return true;
              }
            }
            return false;
          });
          if (clicked) {
            addLog('부계정 로그인 폼 전환 성공');
            await sleep(1000);
          } else {
            addLog('부계정 로그인 버튼 못찾음 — 현재 폼으로 진행');
          }
        } else {
          addLog('주계정 로그인 모드');
        }

        // 아이디, 비밀번호 입력
        await page.evaluate((loginType, repId, id, pw) => {
          const allInputs = document.querySelectorAll('input[type="text"], input:not([type])');
          const pwField = document.querySelector('input[type="password"]');

          if (loginType === 'sub' && allInputs.length >= 2) {
            // 부계정: 첫번째=대표계정 아이디, 두번째=아이디
            const repField = allInputs[0];
            const idField = allInputs[1];
            repField.value = repId; repField.dispatchEvent(new Event('input', { bubbles: true }));
            idField.value = id; idField.dispatchEvent(new Event('input', { bubbles: true }));
          } else {
            // 주계정: 첫번째=아이디
            const idField = allInputs[0];
            if (idField) { idField.value = id; idField.dispatchEvent(new Event('input', { bubbles: true })); }
          }
          if (pwField) { pwField.value = pw; pwField.dispatchEvent(new Event('input', { bubbles: true })); }
        }, LOGIN_TYPE, REP_ID, LOGIN_ID, LOGIN_PW);
        if (REP_ID) addLog(`대표계정: ${REP_ID}`);
        await sleep(500);

        // 로그인 버튼 클릭
        await page.evaluate(() => {
          const btns = document.querySelectorAll('button, input[type="submit"], a');
          for (const btn of btns) {
            const text = (btn.textContent || btn.value || '').trim();
            if (text.includes('로그인') || text.includes('Login') || text.includes('LOGIN')) {
              btn.click();
              return;
            }
          }
          // form submit fallback
          const form = document.querySelector('form');
          if (form) form.submit();
        });
        addLog('로그인 폼 제출됨');
        await sleep(3000);

        currentUrl = page.url();
        if (currentUrl.includes('Login') || currentUrl.includes('login')) {
          addLog('자동 로그인 실패 — 수동 로그인 필요');
          writeStatus({ triggered: true, status: 'login_required', time: new Date().toISOString() });
        } else {
          addLog('자동 로그인 성공!');
        }
      } else {
        addLog('로그인 필요 — 로그인 정보 미설정');
        addLog('설정에서 발주모아 로그인 정보를 입력해주세요');
        writeStatus({ triggered: true, status: 'login_required', time: new Date().toISOString() });
      }

      // 여전히 로그인 페이지면 수동 대기
      currentUrl = page.url();
      if (currentUrl.includes('Login') || currentUrl.includes('login')) {
        let loggedIn = false;
        for (let i = 0; i < 36; i++) {
          await sleep(5000);
          currentUrl = page.url();
          if (i % 6 === 0) addLog(`로그인 대기중... (${Math.floor((i+1)*5/60)}분 경과)`);
          writeStatus({ triggered: true, status: 'login_required', time: new Date().toISOString() });
          if (!currentUrl.includes('Login') && !currentUrl.includes('login')) {
            loggedIn = true;
            break;
          }
        }
        if (!loggedIn) throw new Error('로그인 타임아웃 (3분)');
        addLog('로그인 완료!');
      }

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
    // 발주모아 연동계정은 클릭 가능한 탭/버튼 형태
    // "전체 선택", "토스", "N 스마트스토어", "쿠팡_산지농수산" 등
    writeStatus({ triggered: true, status: 'checking_accounts', time: new Date().toISOString() });
    const accountInfo = await page.evaluate(() => {
      const result = { accounts: [], selectAllEl: null, method: '' };

      // 방법1: "전체 선택" 근처의 클릭 가능한 계정 요소 찾기
      // 연동계정 영역의 모든 클릭 가능 요소 탐색
      const allElements = document.querySelectorAll('a, span, label, button, div, li');
      const accountEls = [];
      let foundSelectAll = false;

      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        // "전체 선택" 또는 "전체선택" 텍스트를 가진 요소
        if (text === '전체 선택' || text === '전체선택') {
          foundSelectAll = true;
          result.selectAllEl = true;
          continue;
        }
      }

      // link_selectAll 클래스 확인
      const selectAllLink = document.querySelector('.link_selectAll');
      if (selectAllLink) result.selectAllEl = true;

      // 체크박스 기반 계정 목록
      const checkboxes = document.querySelectorAll('input[type=checkbox]');
      for (const cb of checkboxes) {
        if (cb.id === 'chkCheckDataAll') continue;
        const parent = cb.closest('li, tr, div, label, span') || cb.parentElement;
        if (!parent) continue;
        const text = (parent.textContent || '').trim().replace(/\s+/g, ' ').substring(0, 80);
        // 주문 테이블의 체크박스는 제외 (연동계정 체크박스만)
        if (parent.closest('table tbody')) continue;
        accountEls.push({ text, checked: cb.checked, type: 'checkbox' });
      }

      if (accountEls.length > 0) {
        result.accounts = accountEls;
        result.method = 'checkbox';
        return result;
      }

      // 방법2: 연동계정 영역 근처의 클릭 가능한 탭/버튼 형태
      // "연동계정" 라벨을 포함하는 행 찾기
      for (const el of allElements) {
        const text = (el.textContent || '').trim();
        if (text.startsWith('연동계정') || text === '연동계정') {
          // 이 요소의 부모 또는 형제에서 계정 아이템 찾기
          const container = el.closest('tr, div, section, fieldset') || el.parentElement;
          if (!container) continue;
          const items = container.querySelectorAll('a, span, button, label');
          for (const item of items) {
            const t = (item.textContent || '').trim();
            if (t && t !== '연동계정' && t.length < 50 && !t.includes('배송준비') && !t.includes('등록구분')) {
              const isActive = item.classList.contains('active') || item.classList.contains('on') || item.classList.contains('selected') || item.getAttribute('aria-selected') === 'true' || getComputedStyle(item).borderColor.includes('rgb(0, 128') || getComputedStyle(item).backgroundColor !== 'rgba(0, 0, 0, 0)';
              accountEls.push({ text: t, checked: isActive, type: 'tab' });
            }
          }
          if (accountEls.length > 0) break;
        }
      }

      if (accountEls.length > 0) {
        result.accounts = accountEls;
        result.method = 'tab';
        return result;
      }

      // 방법3: 페이지 전체 HTML에서 계정 관련 요소 덤프
      const html = document.querySelector('body')?.innerHTML?.substring(0, 3000) || '';
      result.method = 'none';
      result.htmlSnippet = html.substring(0, 500);
      return result;
    });

    addLog(`계정 탐지 방식: ${accountInfo.method} (전체선택 버튼: ${accountInfo.selectAllEl ? '있음' : '없음'})`);
    addLog(`계정 ${accountInfo.accounts.length}개 발견:`);
    for (const acc of accountInfo.accounts) {
      addLog(`  ${acc.type === 'checkbox' ? '☐' : '◉'} "${acc.text}" [${acc.checked ? '선택됨' : '미선택'}]`);
    }

    // ─── 채널별 계정 선택 ────────────────────────────
    writeStatus({ triggered: true, status: 'selecting_channel', time: new Date().toISOString() });

    const channelKeywords = {
      coupang: ['쿠팡', 'Coupang', 'coupang', 'COUPANG'],
      smartstore: ['스마트스토어', 'SmartStore', 'smartstore', '스마트 스토어', 'SMARTSTORE'],
      etc: []
    };

    if (IS_ALL) {
      addLog('전체 계정 선택...');
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && !sa.classList.contains('active')) { sa.click(); return; }
        const els = document.querySelectorAll('a, span, button, label');
        for (const el of els) {
          const t = (el.textContent || '').trim();
          if (t === '전체 선택' || t === '전체선택') { el.click(); return; }
        }
      });
      await sleep(500);
      addLog('전체 선택 완료');
    } else {
      addLog(`${channelLabel} 계정만 선택 시작...`);

      // 1단계: 전체 해제
      addLog('모든 계정 해제중...');
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && !sa.classList.contains('active')) sa.click();
        else {
          const els = document.querySelectorAll('a, span, button, label');
          for (const el of els) { if ((el.textContent || '').trim() === '전체 선택') { el.click(); break; } }
        }
      });
      await sleep(400);
      await page.evaluate(() => {
        const sa = document.querySelector('.link_selectAll');
        if (sa && sa.classList.contains('active')) sa.click();
        else {
          const els = document.querySelectorAll('a, span, button, label');
          for (const el of els) { if ((el.textContent || '').trim() === '전체 선택') { el.click(); break; } }
        }
      });
      await sleep(500);

      // 2단계: 해당 채널 계정들만 클릭 (다중 채널 지원)
      // 각 채널의 키워드를 합산
      const allKeywords = [];
      const hasEtc = CHANNELS.includes('etc');
      for (const ch of CHANNELS) {
        if (channelKeywords[ch]) allKeywords.push(...channelKeywords[ch]);
      }

      const selResult = await page.evaluate((channels, allKw, hasEtc) => {
        const selected = [];
        const skipped = [];
        const coupangKw = ['쿠팡', 'Coupang', 'coupang', 'COUPANG'];
        const smartKw = ['스마트스토어', 'SmartStore', 'smartstore', '스마트 스토어'];

        const shouldSelect = (text) => {
          // 키워드 매칭
          if (allKw.some(k => text.includes(k))) return true;
          // "기타" 채널: 쿠팡/스마트스토어가 아닌 것
          if (hasEtc) {
            const isCoupang = coupangKw.some(k => text.includes(k));
            const isSmart = smartKw.some(k => text.includes(k));
            if (!isCoupang && !isSmart) return true;
          }
          return false;
        };

        // 체크박스 방식
        const checkboxes = document.querySelectorAll('input[type=checkbox]');
        for (const cb of checkboxes) {
          if (cb.id === 'chkCheckDataAll') continue;
          const parent = cb.closest('li, tr, div, label, span') || cb.parentElement;
          if (!parent || parent.closest('table tbody')) continue;
          const text = (parent.textContent || '').trim();
          if (shouldSelect(text) && !cb.checked) { cb.click(); selected.push(text.substring(0, 50)); }
          else if (!shouldSelect(text)) { skipped.push(text.substring(0, 50)); }
        }
        if (selected.length > 0) return { count: selected.length, selected, skipped, method: 'checkbox' };

        // 탭/버튼 방식
        const allEls = document.querySelectorAll('a, span, button, label');
        let inAccountSection = false;
        for (const el of allEls) {
          const t = (el.textContent || '').trim();
          if (t === '연동계정' || t.startsWith('연동계정')) { inAccountSection = true; continue; }
          if (t === '배송준비일' || t === '등록구분' || t.startsWith('배송준비')) { inAccountSection = false; continue; }
          if (!inAccountSection || t === '전체 선택' || t === '전체선택' || !t || t.length > 50) continue;
          if (shouldSelect(t)) { el.click(); selected.push(t); }
          else { skipped.push(t); }
        }
        return { count: selected.length, selected, skipped, method: 'tab' };
      }, CHANNELS, allKeywords, hasEtc);

      addLog(`${channelLabel} 계정 ${selResult.count}개 선택 (방식: ${selResult.method})`);
      for (const s of selResult.selected) addLog(`  선택: "${s}"`);
      for (const s of selResult.skipped) addLog(`  제외: "${s}"`);

      if (selResult.count === 0) {
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
    addLog('서버 응답 대기중...');
    await sleep(3000);

    // 쿠팡 안내 모달 확인
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
      addLog(`쿠팡 안내 모달 처리 (${coupangHandled})`);
      await sleep(3000);
    }

    // 추가 모달 정리
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
      addLog('주문 로딩 타임아웃 — 주문이 없을 수 있음');
    }
    await sleep(2000);

    // 결과 모달 닫기
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
    if (resultModal) addLog(`결과 모달 닫음`);
    await sleep(1000);

    // 주문 수 확인
    const orderInfo = await page.evaluate(() => {
      const rows = document.querySelectorAll('table tbody tr');
      const details = [];
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const cells = rows[i].querySelectorAll('td');
        const texts = Array.from(cells).map(c => c.textContent.trim().substring(0, 25));
        details.push(texts.slice(0, 5).join(' | '));
      }
      // "조회 내용이 없습니다" 체크
      const noData = document.body.innerText.includes('조회 내용이 없습니다');
      return { count: noData ? 0 : rows.length, details, noData };
    });

    if (orderInfo.noData) {
      addLog('조회 내용이 없습니다 — 주문 0건');
    } else {
      addLog(`주문 ${orderInfo.count}건 가져옴`);
      for (const d of orderInfo.details) addLog(`  ${d}`);
      if (orderInfo.count > 5) addLog(`  ... 외 ${orderInfo.count - 5}건`);
    }

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

    // 개별 체크박스도 클릭 (단일 주문 대응)
    await page.evaluate(() => {
      const cbs = document.querySelectorAll('table tbody input[type=checkbox]');
      for (const cb of cbs) { if (!cb.checked) cb.click(); }
    });
    await sleep(300);

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
    addLog('등록 처리중...');
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
        return { done: false };
      }, i);
      if (i % 5 === 4) addLog(`등록 대기중... (${(i+1)*2}초)`);
      writeStatus({ triggered: true, status: 'registering', time: new Date().toISOString(), count: orderCount });
      if (progress.done) { regComplete = true; addLog(`등록 완료 감지`); break; }
    }

    if (!regComplete) addLog('등록 타임아웃 — 모달 정리 시도');

    // ─── 모달 정리 ───────────────────────────────────
    addLog('모달 정리...');
    writeStatus({ triggered: true, status: 'closing_modals', time: new Date().toISOString() });
    await sleep(1000);

    // Step A: 확인 버튼
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (btn.textContent.trim() === '확인' && btn.offsetParent !== null) { btn.click(); break; }
      }
    });
    await sleep(1000);

    // Step B: 닫기 버튼
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const t = btn.textContent.trim();
        if ((t === '닫기' || t === '닫 기') && btn.offsetParent !== null) { btn.click(); return; }
      }
    });
    await sleep(500);

    // Step C: 잔여 모달
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        const t = btn.textContent.trim();
        if ((t === '닫기' || t === '닫 기' || t === '확인' || t === '처리 내용 저장') && btn.offsetParent !== null) {
          btn.click();
        }
      }
    });
    await sleep(500);

    // confirm/alert 복원
    await page.evaluate(() => {
      if (window.__origConfirm) window.confirm = window.__origConfirm;
      if (window.__origAlert) window.alert = window.__origAlert;
    });

    // 결과 알림
    const result = { success: true, count: orderCount, message: `${channelLabel} ${orderCount}건 연동 완료`, channel: channelLabel };
    addLog(`완료! ${channelLabel} ${orderCount}건 등록 성공`);
    writeStatus({ triggered: false, status: 'done', time: new Date().toISOString(), result });
    await notifyDone(result);

    addLog('브라우저 종료중...');
    await sleep(2000);
    await browser.disconnect();
    try { process.kill(whaleProc.pid); } catch {}
    addLog('브라우저 종료 완료');

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
