// 발주모아 실시간 추출 스크립트 (MCP JavaScript tool에서 실행)
// 발주모아 탭에서 same-origin XHR로 오늘 주문 전체를 추출 → localhost로 자동 푸시
// pagesize=5000으로 1회 시도, 5000건 이상이면 다음 페이지도 XHR로 추가 fetch
// 출력: JSON 배열 (상세 필드 포함)

const today = new Date().toISOString().slice(0,10);
const PAGE_SIZE = 5000;
const clean = s => (s||'').split('\n')[0].trim();
const getText = td => (td?.innerText || td?.textContent || '').trim();

const parsePage = (html) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const tbBasic = doc.querySelector('table.tb_basic');
  if (!tbBasic) return [];

  const rows = tbBasic.querySelectorAll('tbody tr');
  const orders = [];

  for (const row of rows) {
    const tds = row.querySelectorAll('td');
    if (tds.length < 12) continue;

    const no = getText(tds[1]);
    const c3 = getText(tds[3]);
    const wsaMatch = c3.match(/(WSA[\w-]+)/);
    if (!wsaMatch) continue;
    const wsa = wsaMatch[1];
    const poMatch = c3.match(/\((PO-[\w-]+)\)/);
    const po = poMatch ? poMatch[1] : '';
    const orderDateMatch = c3.match(/주문일\s*([\d-]+\s*[\d:]*)/);
    const orderDate = orderDateMatch ? orderDateMatch[1].trim() : '';
    const uploadDateMatch = c3.match(/업로드\s*([\d-]+\s*[\d:]*)/);
    const uploadDate = uploadDateMatch ? uploadDateMatch[1].trim() : '';

    const c4 = getText(tds[4]);
    const c4Lines = c4.split('\n').map(s => s.trim()).filter(Boolean);
    const buyer = c4Lines[0] || '';
    const phoneMatch = c4.match(/(01[0-9][-\s]?\d{3,4}[-\s]?\d{4})/);
    const phone = phoneMatch ? phoneMatch[1].replace(/\s/g, '') : '';

    const c5 = getText(tds[5]);
    const zipMatch = c5.match(/\[(\d{5})\]/);
    const zip = zipMatch ? zipMatch[1] : '';
    const address = c5.replace(/\[\d{5}\]\s*/, '').trim();

    const c6 = getText(tds[6]);
    const productName = clean(c6);
    const optionMatch = c6.match(/\d+\)\s*(.+?)(?:\n|상품코드)/s);
    const option = optionMatch ? optionMatch[1].trim() : '';
    const productCodeMatch = c6.match(/상품코드:\s*(\S+)/);
    const productCode = productCodeMatch ? productCodeMatch[1] : '';
    const optionCodeMatch = c6.match(/옵션코드:\s*(\S+)/);
    const optionCode = optionCodeMatch ? optionCodeMatch[1] : '';
    const sellerMatch = c6.match(/판매사:\s*(.+?)(?:\s*\[|$)/m);
    const seller = sellerMatch ? sellerMatch[1].trim() : '';
    const supplierMatch = c6.match(/공급사:\s*(.+?)(?:\s*\[|$)/m);
    const supplier = supplierMatch ? supplierMatch[1].trim() : '';

    const c8 = getText(tds[8]);
    const qtyMatch = c8.match(/수량\s*[:\s]*(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const selPriceMatch = c8.match(/판매사\s*[:\s]*([\d,]+)/);
    const selPrice = selPriceMatch ? parseInt(selPriceMatch[1].replace(/,/g, '')) : 0;
    const supPriceMatch = c8.match(/공급사\s*[:\s]*([\d,]+)/);
    const supPrice = supPriceMatch ? parseInt(supPriceMatch[1].replace(/,/g, '')) : 0;
    const consumerPriceMatch = c8.match(/소비자\s*[:\s]*([\d,]+)/);
    const consumerPrice = consumerPriceMatch ? parseInt(consumerPriceMatch[1].replace(/,/g, '')) : 0;

    const c9 = getText(tds[9]);
    const c9Lines = c9.split('\n').map(s => s.trim()).filter(Boolean);
    const carrier = c9Lines[0] || '';
    const invoice = c9Lines[1] || '';

    const c11 = getText(tds[11]);
    const status = clean(c11);

    orders.push({
      no, wsa, po, orderDate, uploadDate,
      buyer, phone, zip, address,
      productName, option, productCode, optionCode,
      seller, supplier,
      qty, selPrice, supPrice, consumerPrice,
      carrier, invoice, status
    });
  }
  return orders;
};

// XHR로 페이지 HTML을 가져오기 (페이지 네비게이션 없이)
const fetchPageXHR = (pageNum) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/Dist/order00?date_from=${today}&date_to=${today}&pagesize=${PAGE_SIZE}&daytype=upload_date&page=${pageNum}`, true);
  xhr.onload = () => resolve(xhr.responseText);
  xhr.onerror = () => reject(new Error('XHR failed'));
  xhr.send();
});

// 전체 주문 수집: 5000건씩 페이지별로 XHR fetch
const fetchAll = async () => {
  const allOrders = [];
  let page = 1;
  const MAX_PAGES = 10; // 안전장치: 최대 50,000건

  while (page <= MAX_PAGES) {
    console.log(`[BJ Extract] 페이지 ${page} 요청중...`);
    const html = await fetchPageXHR(page);
    const pageOrders = parsePage(html);
    console.log(`[BJ Extract] 페이지 ${page}: ${pageOrders.length}건`);

    if (pageOrders.length === 0) break;
    allOrders.push(...pageOrders);

    // 이 페이지가 PAGE_SIZE보다 적으면 마지막 페이지
    if (pageOrders.length < PAGE_SIZE) break;
    page++;
  }

  return allOrders;
};

fetchAll().then(orders => {
  window.__bjLiveData = orders;
  window.__bjLiveCount = orders.length;
  window.__bjLiveTime = new Date().toISOString();
  console.log(`[BJ Extract] 전체 ${orders.length}건 추출 완료`);

  // pipe 형식도 호환용으로 생성 (기존 파서 호환)
  const pipeOrders = orders.map(o =>
    `${o.wsa}|${o.buyer}|${o.phone}|${o.productName}|${o.seller}|${o.supplier}|${o.status}|${o.qty}|${o.selPrice}|${o.supPrice}|${o.carrier}|${o.invoice}`
  );

  // JSON 파일 자동 다운로드 (Downloads 폴더 → Vite 서버 자동 감지)
  const downloadData = () => {
    const payload = JSON.stringify({
      source: 'baljumoa', date: today,
      orders: pipeOrders, ordersDetail: orders,
      count: orders.length, time: window.__bjLiveTime
    });
    const blob = new Blob([payload], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bj-orders.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    console.log(`[BJ Extract] bj-orders.json 다운로드 완료 (${orders.length}건)`);
  };

  // localhost push 시도 → 실패 시 자동 다운로드
  return fetch('http://localhost:5173/api/push-source', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'baljumoa', date: today, orders: pipeOrders, ordersDetail: orders })
  }).then(r => r.json()).then(r => { window.__bjPushResult = r; })
    .catch(() => { downloadData(); window.__bjPushResult = { fallback: 'downloaded' }; });
}).catch(e => {
  window.__bjPushResult = { error: e.message };
});
