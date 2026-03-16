// 발주모아 연동 가져오기 자동화 스크립트 (MCP JavaScript tool에서 실행)
// 발주모아 탭(others2.baljumoa.com)에서 실행
// 플로우: 연동 가져오기 페이지 → 전체 계정 선택 → 가져오기 → 쿠팡 확인 → 등록 → 완료

const sleep = ms => new Promise(r => setTimeout(r, ms));

const waitFor = async (fn, timeout = 30000, interval = 500) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = fn();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error('waitFor timeout');
};

(async () => {
  const log = msg => {
    console.log(`[BJ Import] ${msg}`);
    window.__bjImportLog = (window.__bjImportLog || []);
    window.__bjImportLog.push(`${new Date().toLocaleTimeString()} ${msg}`);
  };

  try {
    window.__bjImportStatus = 'running';
    window.__bjImportLog = [];

    // confirm/alert 자동 처리 (등록 시 confirm 팝업 차단)
    const origConfirm = window.confirm;
    const origAlert = window.alert;
    window.confirm = () => true;
    window.alert = () => {};

    // Step 1: 연동 가져오기 페이지 확인
    if (!location.pathname.includes('pop_orderLinkCollect')) {
      log('연동 가져오기 페이지로 이동중...');
      location.href = '/Dist/pop_orderLinkCollect';
      await sleep(3000);
    }

    // Step 2: 전체 계정 선택
    log('전체 계정 선택...');
    const selectAll = document.querySelector('.link_selectAll');
    if (selectAll && !selectAll.classList.contains('active')) {
      selectAll.click();
      await sleep(500);
    }

    // Step 3: 오늘 날짜 설정
    log('오늘 날짜 설정...');
    if (typeof setDate === 'function') setDate('today');
    await sleep(300);

    // Step 4: 등록구분 → 미등록(N) 선택
    const radios = document.querySelectorAll('input[name="sel_type"]');
    for (const r of radios) {
      if (r.value === 'N') { r.checked = true; r.click(); break; }
    }
    await sleep(300);

    // Step 5: 가져오기 (beforeOnList → onList)
    log('가져오기 실행...');
    beforeOnList();
    await sleep(2000);

    // Step 6: 쿠팡 안내 모달 자동 확인
    const coupangView = document.querySelector('#CoupangView');
    if (coupangView) {
      log('쿠팡 안내 확인...');
      onList();
      await sleep(2000);
    }

    // Step 7: 주문 로딩 대기 (최대 60초)
    log('주문 로딩 대기중...');
    await waitFor(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return rows.length > 0 ? rows : null;
    }, 60000, 1000);

    // Step 8: 결과 모달 확인 버튼 클릭
    await sleep(1500);
    const closeResultModal = () => {
      const modals = document.querySelectorAll('.modal');
      for (const m of modals) {
        if (m.textContent.includes('연동계정에서 가져온')) {
          const btns = m.querySelectorAll('button');
          for (const btn of btns) {
            if (btn.textContent.trim() === '확인') { btn.click(); return true; }
          }
        }
      }
      return false;
    };
    closeResultModal();
    await sleep(500);

    // Step 9: 주문 수 확인
    const orderRows = document.querySelectorAll('table tbody tr');
    const orderCount = orderRows.length;
    log(`총 ${orderCount}건 주문 가져옴`);

    if (orderCount === 0) {
      log('가져올 주문이 없습니다 (모두 등록 완료)');
      window.confirm = origConfirm;
      window.alert = origAlert;
      window.__bjImportStatus = 'done';
      window.__bjImportResult = { success: true, count: 0, message: '가져올 주문 없음' };
      return;
    }

    // Step 10: 전체 선택 체크박스
    const selectAllCb = document.querySelector('#chkCheckDataAll');
    if (selectAllCb && !selectAllCb.checked) {
      selectAllCb.click();
      await sleep(500);
    }

    // Step 11: 등록 실행
    log(`${orderCount}건 등록 시작...`);
    onReg();

    // Step 12: 등록 완료 대기 (최대 120초)
    // 등록이 완료되면 "주문 등록 현황" 모달에 "전체 주문등록이 완료 되었습니다" 텍스트 표시
    log('등록 처리중...');
    let regResult = null;
    for (let i = 0; i < 60; i++) {
      await sleep(2000);
      // "주문 등록 현황" 모달 내 텍스트 확인
      const modals = document.querySelectorAll('.modal, [class*=popup], .layer_wrap');
      for (const m of modals) {
        const text = m.textContent || '';
        if (text.includes('주문등록이 완료') || text.includes('주문 수집이 완료')) {
          regResult = text;
          break;
        }
      }
      if (regResult) break;
      // textarea 내 완료 로그 확인
      const textareas = document.querySelectorAll('textarea, [contenteditable], pre');
      for (const ta of textareas) {
        const val = ta.value || ta.textContent || '';
        if (val.includes('주문등록이 완료') || val.includes('주문 수집이 완료')) {
          regResult = val;
          break;
        }
      }
      if (regResult) break;
    }

    if (regResult) {
      log('등록 완료!');
      // "처리 내용 저장" 또는 "닫기" 버튼 클릭
      await sleep(1000);
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        if (btn.textContent.trim() === '닫기' && btn.offsetParent !== null) {
          btn.click();
          break;
        }
      }
    } else {
      log('등록 타임아웃 — 수동 확인 필요');
    }

    // confirm/alert 복원
    window.confirm = origConfirm;
    window.alert = origAlert;

    window.__bjImportStatus = 'done';
    window.__bjImportResult = { success: true, count: orderCount, message: `${orderCount}건 연동 완료` };
    log(`연동 가져오기 완료! (${orderCount}건)`);

  } catch (e) {
    window.__bjImportStatus = 'error';
    window.__bjImportResult = { success: false, error: e.message };
    log(`오류: ${e.message}`);
    try { window.confirm = origConfirm; window.alert = origAlert; } catch {}
  }
})();

'[BJ Import] 자동화 시작됨 - window.__bjImportStatus / __bjImportLog 로 상태 확인';
