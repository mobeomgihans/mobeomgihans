// 발주모아 실시간 추출 스크립트 (MCP JavaScript tool에서 실행)
// 발주모아 탭에서 same-origin fetch로 오늘 주문 전체를 추출 → localhost로 자동 푸시
// 출력 파이프 형식: wsa|buyer|phone|product|seller|supplier|status|qty|selPrice|supPrice|carrier|invoice

const today = new Date().toISOString().slice(0,10);
const searchUrl = `/Dist/order00?date_from=${today}&date_to=${today}&pagesize=2000&daytype=upload_date&page=1`;
const clean = s => (s||'').split('\n')[0].trim();
const getText = td => (td?.textContent || '').trim();

fetch(searchUrl).then(r => r.text()).then(html => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tbBasic = doc.querySelector('table.tb_basic');
  if (!tbBasic) { window.__bjLiveData = []; window.__bjLiveCount = 0; return; }

  const rows = tbBasic.querySelectorAll('tbody tr');
  const orders = [];

  for (const row of rows) {
    const tds = row.querySelectorAll('td');
    if (tds.length < 12) continue;

    const c3 = getText(tds[3]);
    const wsaMatch = c3.match(/(WSA[\w-]+)/);
    if (!wsaMatch) continue;

    const c4 = getText(tds[4]);
    const c4Lines = c4.split('\n').map(s => s.trim()).filter(Boolean);
    const buyer = c4Lines[0] || '';
    const phoneMatch = c4.match(/(01[0-9][-\s]?\d{3,4}[-\s]?\d{4})/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : '';

    const c6 = getText(tds[6]);
    const product = clean(c6);
    const sellerMatch = c6.match(/판매사:\s*(.+?)(?:\s*\[|$)/m);
    const supplierMatch = c6.match(/공급사:\s*(.+?)(?:\s*\[|$)/m);
    const seller = sellerMatch ? sellerMatch[1].trim() : '';
    const supplier = supplierMatch ? supplierMatch[1].trim() : '';

    const c8 = getText(tds[8]);
    const qtyMatch = c8.match(/수량\s*:\s*(\d+)/);
    const selPriceMatch = c8.match(/판매사\s*:\s*([\d,]+)/);
    const supPriceMatch = c8.match(/공급사\s*:\s*([\d,]+)/);
    const qty = qtyMatch ? qtyMatch[1] : '1';
    const selPrice = selPriceMatch ? selPriceMatch[1].replace(/,/g, '') : '0';
    const supPrice = supPriceMatch ? supPriceMatch[1].replace(/,/g, '') : '0';

    const c9 = getText(tds[9]);
    const c9Lines = c9.split('\n').map(s => s.trim()).filter(Boolean);
    const carrier = c9Lines[0] || '';
    const invoice = c9Lines[1] || '';

    const c11 = getText(tds[11]);
    const status = clean(c11);

    orders.push(
      `${wsaMatch[1]}|${buyer}|${phone}|${product}|${seller}|${supplier}|${status}|${qty}|${selPrice}|${supPrice}|${carrier}|${invoice}`
    );
  }

  window.__bjLiveData = orders;
  window.__bjLiveCount = orders.length;
  window.__bjLiveTime = new Date().toISOString();

  // localhost dev 서버로 자동 푸시
  return fetch('http://localhost:5180/api/push-source', {
    method: 'POST',
    body: JSON.stringify({ source: 'baljumoa', date: today, orders })
  }).then(r => r.json());
}).then(result => {
  window.__bjPushResult = result;
}).catch(e => {
  window.__bjPushResult = { error: e.message };
});
