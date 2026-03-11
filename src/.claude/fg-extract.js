// 플렉스지 실시간 추출 스크립트 (MCP JavaScript tool에서 실행)
// 플렉스지 탭에서 same-origin fetch로 최신 주문 데이터를 추출 → localhost로 자동 푸시
// 출력 파이프 형식: no|wsa|time|buyer|phone|ssa|status|paymentMethod|channel|orderRoute|price

const today = new Date().toISOString().slice(0,10);
const searchUrl = `/NewOrder/deal01?formtype=A&date_from=${today}&date_to=${today}&pagesize=2000&page=1&sort=1&date_type=mo_order_date`;
const clean = s => (s||'').split('\n')[0].trim();
const getText = td => (td?.textContent || '').trim();

fetch(searchUrl).then(r => r.text()).then(html => {
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
  window.__fgLiveData = orders;
  window.__fgLiveCount = orders.length;
  window.__fgLiveTime = new Date().toISOString();

  // localhost dev 서버로 자동 푸시
  return fetch('http://localhost:5180/api/push-source', {
    method: 'POST',
    body: JSON.stringify({ source: 'flexgate', date: today, orders })
  }).then(r => r.json());
}).then(result => {
  window.__fgPushResult = result;
}).catch(e => {
  window.__fgPushResult = { error: e.message };
});
