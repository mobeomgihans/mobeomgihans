// 플렉스지 실시간 추출 스크립트 (MCP JavaScript tool에서 실행)
// 플렉스지 탭에서 same-origin XHR로 최신 주문 데이터를 추출 → localhost로 자동 푸시
// pagesize=5000으로 1회 시도, 5000건 이상이면 다음 페이지도 XHR로 추가 fetch
// 출력 파이프 형식: no|wsa|time|buyer|phone|ssa|status|paymentMethod|channel|orderRoute|price

const today = new Date().toISOString().slice(0,10);
const PAGE_SIZE = 5000;
const clean = s => (s||'').split('\n')[0].trim();
const getText = td => (td?.textContent || '').trim();

const parsePage = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('table tbody tr');
  const orders = [];
  for(const row of rows) {
    const cells = row.querySelectorAll('td');
    if(cells.length < 12) continue;
    const c1 = getText(cells[1]);
    const noMatch = c1.match(/\[(\d+)\]/);
    if(!noMatch) continue;
    const wsaMatch = c1.match(/(WSA[\w-]+)/);
    const timeMatch = c1.match(/주문일 \d{4}-\d{2}-\d{2} (\d{2}:\d{2})/);
    const c2 = getText(cells[2]);
    const buyer = c2.split('\n')[0].trim();
    const phoneMatch = c2.match(/(01[0-9][-\s]?\d{3,4}[-\s]?\d{4})/);
    const c5 = getText(cells[5]);
    const ssaMatch = c5.match(/(SSA\d+)/);
    const routeMatch = c5.match(/주문경로\s*:(\S+)/);
    const channelMatch = c5.match(/채널[,.\s]*([^\n]+)/);
    const c6 = getText(cells[6]);
    const priceNums = c6.match(/[\d,]+(?=\s*원)/g);
    const totalPrice = priceNums ? parseInt(priceNums[priceNums.length-1].replace(/,/g,'')) : 0;
    orders.push(
      `${noMatch[1]}|${wsaMatch?wsaMatch[1]:''}|${timeMatch?timeMatch[1]:''}|${buyer}|${phoneMatch?phoneMatch[1]:''}|${ssaMatch?ssaMatch[1]:''}|${clean(getText(cells[10]))}|${clean(getText(cells[9]))||clean(getText(cells[8]))}|${channelMatch?channelMatch[1].trim():''}|${routeMatch?routeMatch[1]:'ETC'}|${totalPrice}`
    );
  }
  return orders;
};

// XHR로 페이지 HTML을 가져오기 (페이지 네비게이션 없이)
const fetchPageXHR = (pageNum) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/NewOrder/deal01?formtype=A&date_from=${today}&date_to=${today}&pagesize=${PAGE_SIZE}&page=${pageNum}&sort=1&date_type=mo_order_date`, true);
  xhr.onload = () => resolve(xhr.responseText);
  xhr.onerror = () => reject(new Error('XHR failed'));
  xhr.send();
});

// 전체 주문 수집: 5000건씩 페이지별로 XHR fetch
const fetchAll = async () => {
  const allOrders = [];
  let page = 1;
  const MAX_PAGES = 10;

  while (page <= MAX_PAGES) {
    console.log(`[FG Extract] 페이지 ${page} 요청중...`);
    const html = await fetchPageXHR(page);
    const pageOrders = parsePage(html);
    console.log(`[FG Extract] 페이지 ${page}: ${pageOrders.length}건`);

    if (pageOrders.length === 0) break;
    allOrders.push(...pageOrders);

    if (pageOrders.length < PAGE_SIZE) break;
    page++;
  }

  return allOrders;
};

fetchAll().then(orders => {
  window.__fgLiveData = orders;
  window.__fgLiveCount = orders.length;
  window.__fgLiveTime = new Date().toISOString();
  console.log(`[FG Extract] 전체 ${orders.length}건 추출 완료`);

  // JSON 파일 자동 다운로드 (Downloads 폴더 → Vite 서버 자동 감지)
  const downloadData = () => {
    const payload = JSON.stringify({
      source: 'flexgate', date: today,
      orders, count: orders.length, time: window.__fgLiveTime
    });
    const blob = new Blob([payload], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fg-orders.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    console.log(`[FG Extract] fg-orders.json 다운로드 완료 (${orders.length}건)`);
  };

  // localhost push 시도 → 실패 시 자동 다운로드
  return fetch('http://localhost:5173/api/push-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'flexgate', date: today, orders })
  }).then(r => r.json()).then(r => { window.__fgPushResult = r; })
    .catch(() => { downloadData(); window.__fgPushResult = { fallback: 'downloaded' }; });
}).catch(e => {
  window.__fgPushResult = { error: e.message };
});
