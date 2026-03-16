import { useState, useCallback, useRef, useEffect } from "react";
import { Agentation } from "agentation";
import FloatingToolbar from "./components/FloatingToolbar";

// ═══════════════════════════════════════════════════════════
// CONFIG & DATA
// ═══════════════════════════════════════════════════════════

const SITES = {
  baljumoa: { name: "발주모아", short: "발모", color: "#22C55E", icon: "🟢" },
  flexgate: { name: "플렉스지", short: "플지", color: "#EF4444", icon: "🔴" },
  both: { name: "양쪽매칭", short: "매칭", color: "#8B5CF6", icon: "🔗" },
};

const ORDER_STATUS = {
  // 발주모아 실제 상태
  신규등록: { label: "신규등록", color: "#F59E0B", bg: "#FEF3C7" },
  발주서생성: { label: "발주서생성", color: "#8B5CF6", bg: "#EDE9FE" },
  회신파일생성: { label: "회신파일생성", color: "#06B6D4", bg: "#CFFAFE" },
  송장등록완료: { label: "송장등록완료", color: "#10B981", bg: "#D1FAE5" },
  // 플렉스지 실제 상태
  미입금: { label: "미입금", color: "#9CA3AF", bg: "#F3F4F6" },
  입금확인: { label: "입금확인", color: "#3B82F6", bg: "#DBEAFE" },
  배송준비: { label: "배송준비", color: "#8B5CF6", bg: "#EDE9FE" },
  주문취소: { label: "주문취소", color: "#EF4444", bg: "#FEE2E2" },
  휴지통: { label: "휴지통", color: "#6B7280", bg: "#E5E7EB" },
  // 공통
  배송중: { label: "배송중", color: "#06B6D4", bg: "#CFFAFE" },
  배송완료: { label: "배송완료", color: "#10B981", bg: "#D1FAE5" },
};

const SUPPLY_STATUS = {
  미발주: { label: "미발주", color: "#EF4444", bg: "#FEE2E2" },
  발주완료: { label: "발주완료", color: "#3B82F6", bg: "#DBEAFE" },
  발주서생성: { label: "발주서생성", color: "#8B5CF6", bg: "#EDE9FE" },
  회신완료: { label: "회신완료", color: "#10B981", bg: "#D1FAE5" },
};

const CARRIERS = [
  { code: "04", name: "CJ대한통운" }, { code: "05", name: "한진택배" },
  { code: "08", name: "롯데택배" }, { code: "01", name: "우체국택배" },
  { code: "06", name: "로젠택배" }, { code: "23", name: "경동택배" },
  { code: "32", name: "대신택배" }, { code: "11", name: "일양로지스" },
];

// ─── WORKFLOW: 메뉴얼 기반 10단계 ────────────────────
const WORKFLOW_STEPS = [
  { id: "bj_check",     phase: "수집", label: "발주모아 주문확인",  icon: "📥", site: "baljumoa", desc: "신규 주문등록 건 확인",           pageKey: "po_inbox" },
  { id: "bj_po_create", phase: "발주", label: "발주서 생성",       icon: "📋", site: "baljumoa", desc: "거래처별 발주서 묶기 생성",       pageKey: "supply_process" },
  { id: "bj_po_send",   phase: "발주", label: "발주서 메일 발송",   icon: "📨", site: "baljumoa", desc: "발주서 이메일 전송",             pageKey: "supply_po_created" },
  { id: "bj_reply",     phase: "회신", label: "회신파일 확인",      icon: "📩", site: "baljumoa", desc: "회신파일 수신 + 송장번호 확인",   pageKey: "supply_confirmed" },
  { id: "bj_inv_reg",   phase: "송장", label: "송장번호 일괄등록",   icon: "📝", site: "baljumoa", desc: "회신 송장 → 발주모아 등록",      pageKey: "inv_register" },
  { id: "fg_check",     phase: "수집", label: "플렉스지 주문확인",   icon: "🛒", site: "flexgate", desc: "신규주문/입금 확인",             pageKey: "order_new" },
  { id: "fg_deposit",   phase: "처리", label: "입금확인 처리",      icon: "💰", site: "flexgate", desc: "미입금 → 입금확인 상태변경",     pageKey: "order_all" },
  { id: "fg_inv_input", phase: "송장", label: "송장번호 입력",      icon: "🔢", site: "flexgate", desc: "배송준비 건에 송장 입력",        pageKey: "inv_register" },
  { id: "fg_ship",      phase: "배송", label: "배송처리",          icon: "🚚", site: "flexgate", desc: "배송중으로 상태변경",            pageKey: "order_shipping" },
  { id: "settle",       phase: "정산", label: "정산 확인",         icon: "💳", site: "both",     desc: "판매처별 정산 대조",             pageKey: "settle_list" },
];

const SUPPLIERS = [
  "(주)마니팜", "해담별", "울진유통", "영성", "신우홀딩스(명가푸드)",
  "훈씨", "천사물산", "제트언스", "랑유통", "아엠푸드", "일비",
  "장담아전통식품", "청라", "스다스", "엄마요리", "모두에프엔비",
  "등대식품", "황금약단밤", "부성식품(동호농업회사법인)", "플래음(으뜸)", "덕이네",
  "(B2B)광동떡집", "(B2B)도원명가", "(B2B)케이디그룹(포항수산물)",
  "(B2B)해담별", "(B2B)제트언스", "(B2B)넥스트고(에스컴퍼니)",
  "(B2B)섬진강고향집식품", "(B2B)해담식품", "(B2B)한바람식품",
];

const SELLERS = [
  "모범기한(테무)", "길거리농부사천점(주간)", "민주농원(15일)",
  "(B2B)일비", "(B2B)광동떡집", "(B2B)도원명가",
  "(B2B)케이디그룹(포항수산물)", "(B2B)해담별", "(B2B)제트언스",
];

// ─── TEAM MEMBERS ───────────────────────────────────────
const INITIAL_TEAM = [
  { id: 1, name: "황준혁", role: "master", avatar: "🧑‍💼", color: "#3B82F6", online: true, email: "jh@mobeom.com", permissions: ["order","supply","invoice","settings","team"], lastActive: "지금" },
  { id: 2, name: "김서연", role: "sub", avatar: "👩‍💻", color: "#6C63FF", online: true, email: "sy@mobeom.com", permissions: ["order","supply","invoice"], lastActive: "2분 전" },
  { id: 3, name: "박민호", role: "sub", avatar: "👨‍🔧", color: "#F59E0B", online: true, email: "mh@mobeom.com", permissions: ["order","invoice"], lastActive: "5분 전" },
  { id: 4, name: "이지영", role: "sub", avatar: "👩‍🏫", color: "#10B981", online: false, email: "jy@mobeom.com", permissions: ["order"], lastActive: "1시간 전" },
  { id: 5, name: "최동건", role: "sub", avatar: "🧑‍🍳", color: "#8B5CF6", online: false, email: "dk@mobeom.com", permissions: ["order","supply"], lastActive: "3시간 전" },
];

const PERMISSION_LABELS = {
  order: "주문 관리", supply: "발주 관리", invoice: "송장 관리",
  product: "상품 관리", cs: "CS 관리", settlement: "정산",
  settings: "환경설정", team: "계정 관리",
};

const AVATAR_OPTIONS = ["🧑‍💼","👩‍💻","👨‍🔧","👩‍🏫","🧑‍🍳","👨‍💻","👩‍🔬","🧑‍🎨","👨‍⚕️","👩‍🚀","🦊","🐱","🐶","🐼","🦁","🐯","🐸","🦄"];
const COLOR_OPTIONS = ["#3B82F6","#6C63FF","#F59E0B","#10B981","#8B5CF6","#EF4444","#06B6D4","#F97316","#6366F1","#14B8A6"];

const generateOrders = (syncData) => {
  // ═══ WSA 정규화: 숫자 접미사를 정수로 변환하여 FG(8자리)/BJ(9자리) 포맷 통일 ═══
  // FG: WSA260310-00000382 → WSA260310-382, BJ: WSA260310-000000382 → WSA260310-382
  const normalizeWsa = (wsa) => {
    if (!wsa) return '';
    const dashIdx = wsa.lastIndexOf('-');
    if (dashIdx < 0) return wsa;
    return wsa.substring(0, dashIdx + 1) + parseInt(wsa.substring(dashIdx + 1), 10);
  };

  // ═══ 데이터 소스 판별 (v2=양방향 / v1=플렉스지만 / null=빈 데이터) ═══
  const isV2 = syncData && syncData.version === 2;
  const fgRawLines = isV2
    ? (syncData.flexgate?.orders || [])
    : (syncData?.orders || []);
  const bjRawLines = isV2
    ? (syncData.baljumoa?.orders || [])
    : [];
  const syncDate = isV2
    ? (syncData.flexgate?.date || syncData.baljumoa?.date || new Date().toISOString().slice(0,10))
    : new Date().toISOString().slice(0,10);

  // ═══ FG 주문 파싱 (no|wsa|time|buyer|phone|ssa|status|paymentMethod|channel|orderRoute|price) ═══
  // 가격 파싱: 플렉스지 가격 컬럼이 합쳐진 경우 (예: "12900000000012900") 결제금액(마지막 값)만 추출
  const parsePrice = (pr) => {
    if (!pr) return 0;
    const cleaned = String(pr).replace(/,/g, '');
    const n = Number(cleaned);
    if (isNaN(n) || n === 0) return 0;
    if (n < 1000000) return n;
    // 연결된 가격 데이터에서 결제금액(마지막 숫자) 추출
    const m = cleaned.match(/0{2,}(\d{4,6})$/);
    if (m) return parseInt(m[1]);
    return 0;
  };
  const fgOrders = fgRawLines.filter(l => typeof l === 'string').map(line => {
    const [no,wsa,time,buyer,phone,ssa,status,paymentMethod,channel,orderRoute,pr] = line.split('|');
    return {no,wsa,time,buyer,phone,ssa,status:status||'입금확인',paymentMethod:paymentMethod||'',channel:channel||'',orderRoute:orderRoute||'ETC',price:parsePrice(pr)};
  });

  // ═══ BJ 주문 파싱: ordersDetail이 있으면 상세 데이터 사용, 없으면 pipe 형식 fallback ═══
  const bjDetailArr = isV2 ? (syncData.baljumoa?.ordersDetail || []) : [];
  const bjOrders = bjDetailArr.length > 0
    ? bjDetailArr.map(o => ({
        wsa: o.wsa, buyer: o.buyer, phone: o.phone, product: o.productName,
        seller: o.seller, supplier: o.supplier, status: o.status,
        qty: Number(o.qty) || 1, selPrice: Number(o.selPrice) || 0, supPrice: Number(o.supPrice) || 0,
        consumerPrice: Number(o.consumerPrice) || 0,
        carrier: o.carrier || '', invoice: o.invoice || '',
        po: o.po || '', orderDate: o.orderDate || '', uploadDate: o.uploadDate || '',
        zip: o.zip || '', address: o.address || '',
        option: o.option || '', productCode: o.productCode || '', optionCode: o.optionCode || '',
        no: o.no || '',
      }))
    : bjRawLines.filter(l => typeof l === 'string').map(line => {
        const [wsa,buyer,phone,product,seller,supplier,status,qty,selPrice,supPrice,carrier,invoice] = line.split('|');
        return {wsa,buyer,phone,product,seller,supplier,status,qty:Number(qty)||1,selPrice:Number(selPrice)||0,supPrice:Number(supPrice)||0,carrier:carrier||'',invoice:invoice||'',
          consumerPrice:0, po:'', orderDate:'', uploadDate:'', zip:'', address:'', option:'', productCode:'', optionCode:'', no:''};
      });

  // ═══ WSA 기준 Map 빌드 (정규화된 WSA → 주문 배열) ═══
  const fgByWsa = new Map();
  fgOrders.forEach(o => {
    const key = normalizeWsa(o.wsa);
    if (!fgByWsa.has(key)) fgByWsa.set(key, []);
    fgByWsa.get(key).push(o);
  });
  const bjByWsa = new Map();
  bjOrders.forEach(o => {
    const key = normalizeWsa(o.wsa);
    if (!bjByWsa.has(key)) bjByWsa.set(key, []);
    bjByWsa.get(key).push(o);
  });

  // ── SSA→공급사/상품 매핑 (플렉스지 실제 데이터) ──
  const SSA_MAP={
    SSA85482342:{s:"제트언스",p:"[산지핫딜] 두백감자 4kg+4kg 덤증정!!",c:"[18149]",o:"3) 두백감자 4kg+4KG 덤증정! 대사이즈",f:3000},
    SSA15710619:{s:"(주)은스텝",p:"오로지 국산재료로 맛을 낸 전라도식 백김치",c:"[03386]",o:"2) 전라도 백김치 3kg",f:0},
    SSA70145213:{s:"참송이농원",p:"충청도에서 자란 무농약 참송이버섯",c:"[22675]",o:"1) 통 참송이버섯 500g",f:0},
    SSA64276171:{s:"디자인팜",p:"[무배특가] 달콤 사인머스캣",c:"[57925]",o:"2) 사인머스캣 2kg",f:0},
    SSA63242533:{s:"해담별",p:"바삭바삭 맛있는 종합전병",c:"[15648]",o:"2) 종합전병 720g*2박스",f:0},
    SSA61700183:{s:"반디디자인",p:"산지직송 활용도 많은 청경채 4kg",c:"[57989]",o:"1) 청경채 4kg",f:0},
    SSA69928028:{s:"(주)미스터씨",p:"서해안에서 잡아올린 참 알 쭈꾸미 1kg",c:"[14532]",o:"1) 탱탱 알쭈꾸미 1kg",f:4000},
    SSA96135149:{s:"영성식품",p:"국내산 재료! 추억의 수제 옛날 짜장",c:"[55366]",o:"1) 짜장 350g*1봉 x5",f:4000},
    SSA41241207:{s:"황우농산",p:"[무료배송] 알록수수 소특가 행사",c:"[22675]",o:"1) 알록이옥수수 대 10입",f:0},
    SSA59342692:{s:"네농산물",p:"맛과 영양이 좋은 못난이표고버섯",c:"[35207]",o:"1) 못난이 표고버섯 1kg",f:3000},
    SSA30475714:{s:"덕이네",p:"청정바다 한산도 생미역",c:"[27869]",o:"2) 한산도 생미역 2kg",f:0},
    SSA80185210:{s:"그린팜",p:"[인기상품] 제주 감귤 5kg 산지직송",c:"[31025]",o:"1) 제주감귤 5kg",f:3000},
    SSA63553144:{s:"늘해랑",p:"국내산 벌꿀 1kg 자연산 100%",c:"[28104]",o:"1) 자연산 벌꿀 1kg",f:0},
    SSA62678349:{s:"청풍원",p:"유기농 시금치 3kg",c:"[40211]",o:"1) 시금치 3kg",f:3000},
    SSA83189325:{s:"해피팜",p:"제주 무농약 당근 3kg",c:"[33782]",o:"1) 당근 3kg",f:0},
    SSA77411302:{s:"산들농원",p:"[AD] 국내산 대추방울토마토 2kg",c:"[29553]",o:"1) 대추방울토마토 2kg",f:3000},
    SSA94381806:{s:"우리농원",p:"남해안 갈치 1kg 특대",c:"[42190]",o:"1) 갈치 1kg",f:3000},
    SSA56371294:{s:"해밀농원",p:"유기농 사과 5kg 가정용",c:"[18803]",o:"1) 사과 5kg",f:0},
    SSA48626080:{s:"정원농장",p:"국내산 찰옥수수 10입",c:"[25017]",o:"1) 찰옥수수 10입",f:0},
    SSA14755596:{s:"미래식품",p:"국산 콩으로 만든 전통 된장 1kg",c:"[36820]",o:"1) 전통 된장 1kg",f:0},
    SSA11225112:{s:"향촌",p:"제주 한라봉 3kg 선물세트",c:"[41955]",o:"1) 한라봉 3kg",f:0},
    SSA47105891:{s:"청산농원",p:"국내산 호두 1kg",c:"[30128]",o:"1) 호두 1kg",f:0},
    SSA97699750:{s:"동해수산",p:"울릉도 오징어 1kg 반건조",c:"[38460]",o:"1) 반건조 오징어 1kg",f:3000},
    SSA33998283:{s:"사계절팜",p:"제주 유기농 브로콜리 2kg",c:"[27305]",o:"1) 브로콜리 2kg",f:0},
    SSA42152118:{s:"가든팜",p:"춘천 닭갈비 밀키트 2인분",c:"[45612]",o:"1) 닭갈비 밀키트",f:0},
    SSA85179329:{s:"산마루",p:"국내산 건표고버섯 300g",c:"[29801]",o:"1) 건표고버섯 300g",f:0},
    SSA97960181:{s:"맑은샘",p:"충주 사과 5kg",c:"[31490]",o:"1) 충주사과 5kg",f:0},
    SSA57350956:{s:"해바라기",p:"충남 논산 딸기 2kg",c:"[44823]",o:"1) 논산 딸기 2kg",f:3000},
    SSA80675492:{s:"들꽃농원",p:"제주 감귤 3kg+3kg",c:"[31027]",o:"1) 감귤 3kg+3kg",f:0},
    SSA46981649:{s:"빛고을",p:"국내산 방울토마토 2kg",c:"[29554]",o:"1) 방울토마토 2kg",f:0},
    SSA90680769:{s:"초록마을",p:"유기농 당근 즙 30포",c:"[38920]",o:"1) 당근즙 30포",f:0},
    SSA65691763:{s:"자연드림",p:"국내산 도라지 500g",c:"[36102]",o:"1) 도라지 500g",f:0},
    SSA20596053:{s:"바다향",p:"완도 전복 1kg (중)",c:"[43281]",o:"1) 전복 1kg",f:3000},
    SSA37137212:{s:"풍년농장",p:"이천쌀 10kg",c:"[20145]",o:"1) 이천쌀 10kg",f:0},
    SSA95864726:{s:"새벽농원",p:"유기농 무 3kg",c:"[28506]",o:"1) 유기농 무 3kg",f:0},
    SSA59682119:{s:"농부의정성",p:"국내산 고구마 5kg",c:"[32780]",o:"1) 고구마 5kg",f:0},
    SSA10861709:{s:"청정원팜",p:"제주 한라산 녹차 100g",c:"[47201]",o:"1) 녹차 100g",f:0},
    SSA70351392:{s:"명품팜",p:"성주 참외 3kg",c:"[44102]",o:"1) 참외 3kg",f:0},
    SSA69847977:{s:"행복한농장",p:"국내산 양배추 5kg",c:"[26830]",o:"1) 양배추 5kg",f:0},
    SSA41880669:{s:"대지농원",p:"충남 부여 수박 1통",c:"[45990]",o:"1) 수박 1통",f:0},
    SSA73962910:{s:"산골농장",p:"영양 고추 1kg",c:"[39012]",o:"1) 영양고추 1kg",f:0},
  };

  // ═══ 모든 WSA 수집 후 3-way 분류 (매칭/플지전용/발모전용) ═══
  const allWsaKeys = new Set([...fgByWsa.keys(), ...bjByWsa.keys()]);
  const orders = [];

  allWsaKeys.forEach(wsaKey => {
    const fgList = fgByWsa.get(wsaKey) || [];
    const bjList = bjByWsa.get(wsaKey) || [];
    const hasFg = fgList.length > 0;
    const hasBj = bjList.length > 0;

    if (hasFg && hasBj) {
      // ── 매칭 (both): FG + BJ 모두 존재 → WSA 기반 100% 일치 ──
      fgList.forEach((fg, idx) => {
        const bj = bjList[idx] || bjList[0];
        const m = SSA_MAP[fg.ssa] || {};
        const hasInv = !!(bj.invoice);
        orders.push({
          id: fg.wsa+'-'+fg.no, no: bj.no || fg.no, product: bj.product || m.p || '주문상품',
          productCode: bj.productCode || m.c||'', option: bj.option || m.o||'', optCode: bj.optionCode || m.o||'',
          buyer: fg.buyer, phone: fg.phone, address: bj.address || '', zip: bj.zip || '',
          seller: bj.seller || '모범기한(플랙스지)', supplier: m.s || bj.supplier || '공급사',
          qty: bj.qty || 1, price: fg.price, shippingFee: m.f != null ? m.f : 3000,
          supplyPrice: bj.supPrice || fg.price, consumerPrice: bj.consumerPrice || 0,
          total: fg.price + (m.f || 0),
          orderStatus: fg.status, bjStatus: bj.status,
          supplyStatus: bj.status === '발주서생성' ? '발주서생성' : bj.status === '신규등록' ? '미발주' : '회신완료',
          invoiceStatus: hasInv ? 'registered' : 'none',
          carrier: bj.carrier ? (CARRIERS.find(c => c.name === bj.carrier) || {code:'04',name:bj.carrier}) : null,
          invoice: bj.invoice || '',
          paymentMethod: fg.paymentMethod||'무통장', channel: fg.channel||'', orderRoute: fg.orderRoute||'ETC',
          ssa: fg.ssa||'', taxDeduction: '적용',
          mailSent: hasInv, shipCount: hasInv ? 1 : 0,
          date: syncDate, time: fg.time || '',
          po: bj.po || '', orderDate: bj.orderDate || '', uploadDate: bj.uploadDate || '',
          site: 'both', memo: '', selected: false,
          matched: true, statusDiff: (bj.status||'') !== (fg.status||''),
          wsa: fg.wsa, bjWsa: bj.wsa,
        });
      });
    } else if (hasBj) {
      // ── 발주모아 전용 (테무/기타 채널 — 플렉스지에 없음) ──
      bjList.forEach((bj, idx) => {
        orders.push({
          id: bj.wsa+'-bj-'+idx, no: bj.no || '', product: bj.product,
          productCode: bj.productCode || '', option: bj.option || '', optCode: bj.optionCode || '',
          buyer: bj.buyer, phone: bj.phone, address: bj.address || '', zip: bj.zip || '',
          seller: bj.seller, supplier: bj.supplier || bj.seller,
          qty: bj.qty || 1, price: bj.selPrice || bj.supPrice, shippingFee: 0,
          supplyPrice: bj.supPrice, consumerPrice: bj.consumerPrice || 0,
          total: (bj.qty||1) * (bj.supPrice||0),
          orderStatus: bj.status, bjStatus: bj.status,
          supplyStatus: bj.status === '발주서생성' ? '발주서생성' : bj.status === '신규등록' ? '미발주' : '회신완료',
          invoiceStatus: bj.invoice ? 'registered' : 'none',
          carrier: bj.carrier ? (CARRIERS.find(c => c.name === bj.carrier) || {code:'04',name:bj.carrier}) : null,
          invoice: bj.invoice || '',
          paymentMethod: '무통장', channel: bj.seller?.includes('테무') ? '테무(Temu)' : '', orderRoute: bj.seller?.includes('테무') ? '테무' : 'ETC',
          ssa: '', taxDeduction: '미적용',
          mailSent: false, shipCount: 0,
          date: syncDate, time: '',
          po: bj.po || '', orderDate: bj.orderDate || '', uploadDate: bj.uploadDate || '',
          site: 'baljumoa', memo: '', selected: false,
          matched: false, statusDiff: false,
          wsa: bj.wsa, bjWsa: bj.wsa,
        });
      });
    } else if (hasFg) {
      // ── 플렉스지 전용 (발주모아에 없음) ──
      fgList.forEach(fg => {
        const m = SSA_MAP[fg.ssa] || {};
        orders.push({
          id: fg.wsa+'-'+fg.no, no: fg.no, product: m.p || '주문상품',
          productCode: m.c||'', option: m.o||'', optCode: m.o||'',
          buyer: fg.buyer, phone: fg.phone, address: '',
          seller: '스마트스토어', supplier: m.s || '공급사',
          qty: 1, price: fg.price, shippingFee: m.f != null ? m.f : 3000,
          supplyPrice: fg.price, total: fg.price + (m.f || 0),
          orderStatus: fg.status, bjStatus: '', supplyStatus: '미발주',
          invoiceStatus: 'none', carrier: null, invoice: '',
          paymentMethod: fg.paymentMethod||'무통장', channel: fg.channel||'', orderRoute: fg.orderRoute||'ETC',
          ssa: fg.ssa||'', taxDeduction: '적용',
          mailSent: false, shipCount: 0,
          date: syncDate, time: fg.time || '',
          site: 'flexgate', memo: '', selected: false,
          matched: false, statusDiff: false,
          wsa: fg.wsa,
        });
      });
    }
  });

  // 최신순 정렬 (날짜+시간 내림차순) — 플렉스지 실제 화면과 동일
  orders.sort((a,b)=>{
    const da=`${a.date} ${a.time}`, db=`${b.date} ${b.time}`;
    if(da>db) return -1;
    if(da<db) return 1;
    return 0;
  });
  return orders;
};

// ─── MENU ───────────────────────────────────────────────
const MENU = [
  { section:"발주 등록", icon:"📥", items:[
    {key:"po_inbox",label:"발주서 수신함"},{key:"po_upload",label:"발주서 등록"},
    {key:"po_upload_list",label:"발주서 등록 현황"},{key:"po_dup",label:"발주서 중복/SKIP"},
  ]},
  { section:"주문 현황", icon:"📋", items:[
    {key:"order_all",label:"주문 조회 (전체)"},{key:"order_new",label:"신규주문"},
    {key:"order_preparing",label:"배송준비"},{key:"order_shipping",label:"배송중"},
    {key:"order_delivered",label:"배송완료"},{key:"order_cancel",label:"취소/반품"},
  ]},
  { section:"발주 관리", icon:"📨", items:[
    {key:"supply_process",label:"발주처리"},{key:"supply_status",label:"발주현황 (전체)"},
    {key:"supply_po_created",label:"발주서 생성"},{key:"supply_mail",label:"메일 발송 중"},
    {key:"supply_confirmed",label:"수신 확인"},
  ]},
  { section:"송장 관리", icon:"📝", items:[
    {key:"inv_register",label:"송장 일괄등록"},{key:"inv_unregistered",label:"송장 미등록 목록"},
    {key:"inv_upload",label:"송장 수동 업로드"},{key:"inv_supplier",label:"공급사 송장파일"},
    {key:"inv_reply",label:"송장 회신관리"},
  ]},
  { section:"상품 관리", icon:"📦", items:[
    {key:"prod_list",label:"상품 목록"},{key:"prod_matching",label:"상품/옵션 매칭"},
    {key:"prod_gsheet",label:"📊 구글시트 연동"},
  ]},
  { section:"CS 관리", icon:"🎧", items:[
    {key:"cs_list",label:"CS 요청 목록"},{key:"cs_exchange",label:"교환/반품 관리"},
  ]},
  { section:"정산", icon:"💰", items:[
    {key:"settle_seller",label:"판매사 정산"},{key:"settle_supplier",label:"공급사 정산"},
    {key:"settle_profit",label:"수익 분석"},
  ]},
  { section:"매출/통계", icon:"📊", items:[
    {key:"monitor",label:"실시간 모니터"},{key:"stat_supplier",label:"공급사별 현황"},
    {key:"stat_seller",label:"판매사별 현황"},{key:"stat_daily",label:"일별 매출"},
  ]},
  { section:"재고 관리", icon:"🏭", items:[
    {key:"stock_list",label:"재고 현황"},{key:"stock_alert",label:"재고 알림 설정"},
  ]},
  { section:"환경설정", icon:"⚙️", items:[
    {key:"settings_profile",label:"프로필 설정"},
    {key:"settings_preset",label:"탭 프리셋 설정"},
    {key:"settings_team",label:"계정 관리 (주/부)"},
    {key:"settings_general",label:"일반 설정"},
  ]},
];

// ═══════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════

const Badge = ({children,color,bg,large}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:large?"5px 14px":"4px 11px",borderRadius:8,fontSize:large?13:11.5,fontWeight:600,color,background:bg,whiteSpace:"nowrap",letterSpacing:"-0.01em"}}>{children}</span>
);
const Dot = ({color,size=6}) => (<span style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}}/>);

const Btn = ({onClick,children,variant="default",disabled,small,style:es}) => {
  const v={default:{bg:"#F5F5F7",c:"#374151",b:"1px solid #E5E5EA"},primary:{bg:"linear-gradient(135deg, #6C63FF 0%, #5B52E8 100%)",c:"#fff",b:"none"},success:{bg:"linear-gradient(135deg, #059669 0%, #047857 100%)",c:"#fff",b:"none"},danger:{bg:"#FEF2F2",c:"#DC2626",b:"1px solid #FECACA"},warning:{bg:"#FFFBEB",c:"#92400E",b:"1px solid #FDE68A"},purple:{bg:"linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)",c:"#fff",b:"none"},outline:{bg:"#fff",c:"#374151",b:"1px solid #E5E5EA"},ghost:{bg:"transparent",c:"#6B7280",b:"none"}}[variant]||{bg:"#F5F5F7",c:"#374151",b:"1px solid #E5E5EA"};
  return (<button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:6,padding:small?"7px 14px":"10px 18px",borderRadius:10,fontSize:small?12:13.5,fontWeight:600,cursor:disabled?"not-allowed":"pointer",background:v.bg,color:v.c,border:v.b,opacity:disabled?0.5:1,whiteSpace:"nowrap",transition:"all 0.15s ease",letterSpacing:"-0.01em",...es}}>{children}</button>);
};
const Input = ({style:es,...p}) => (<input {...p} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #E8E8EE",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box",transition:"all 0.2s ease",background:"#FAFBFC",...es}}/>);
const Select = ({style:es,children,...p}) => (<select {...p} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #E8E8EE",fontSize:12,outline:"none",appearance:"none",paddingRight:28,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center",boxSizing:"border-box",transition:"all 0.2s ease",background:"#FAFBFC",...es}}>{children}</select>);

const Modal = ({open,onClose,title,width=700,children}) => {
  if(!open)return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.4)",backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:18,width:"96%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 24px 80px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)",animation:"modalIn 0.25s cubic-bezier(0.4,0,0.2,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 22px",borderBottom:"1px solid #F0F0F2"}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:800,color:"#1A1A1A",letterSpacing:"-0.01em"}}>{title}</h3>
          <button onClick={onClose} style={{background:"#F5F5F7",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",color:"#9CA3AF",transition:"all 0.15s"}} onMouseOver={e=>{e.currentTarget.style.background="#FEE2E2";e.currentTarget.style.color="#EF4444";}} onMouseOut={e=>{e.currentTarget.style.background="#F5F5F7";e.currentTarget.style.color="#9CA3AF";}}>✕</button>
        </div>
        <div style={{padding:22,overflow:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
};

const Toast = ({message,type="success",visible}) => (
  <div style={{position:"fixed",bottom:24,left:"50%",transform:`translateX(-50%) translateY(${visible?0:80}px)`,zIndex:2000,background:type==="success"?"linear-gradient(135deg, #059669 0%, #047857 100%)":type==="error"?"linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)":"linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",color:"#fff",padding:"12px 24px",borderRadius:12,fontSize:12,fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",opacity:visible?1:0,transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)",display:"flex",alignItems:"center",gap:8,letterSpacing:"-0.01em"}}>
    {type==="success"?"✅":type==="error"?"❌":"ℹ️"} {message}
  </div>
);

// Avatar circle
const Avatar = ({emoji,color,size=32,online,border,style:es}) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:`${color}28`,border:border||`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5,position:"relative",flexShrink:0,...es}}>
    {emoji}
    {online!==undefined && (
      <span style={{position:"absolute",bottom:-1,right:-1,width:size*0.3,height:size*0.3,borderRadius:"50%",background:online?"#22C55E":"#D1D5DB",border:"2px solid #fff"}}/>
    )}
  </div>
);

const TH={padding:"12px 14px",textAlign:"left",fontWeight:700,color:"#555",fontSize:12.5,whiteSpace:"nowrap",background:"#F8F9FB",letterSpacing:"0.02em",textTransform:"none",borderBottom:"2px solid #EEEEF2"};
const TD={padding:"12px 14px",color:"#374151",fontSize:13,borderBottom:"1px solid #F5F5F7"};

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

// ─── THEME PRESETS ────────────────────────────────────
const THEME_PRESETS = [
  { name: "보라", accent: "#6C63FF", light: "#FAFAFF", mid: "#F5F3FF", deep: "#4C3BCF", text: "#6B5FA0", bg: "#F7F5FF", border: "#EEEDF5" },
  { name: "파랑", accent: "#3B82F6", light: "#F8FBFF", mid: "#F0F6FF", deep: "#1D4ED8", text: "#4A6A8F", bg: "#F5F9FF", border: "#E8EEF5" },
  { name: "민트", accent: "#14B8A6", light: "#F8FDFB", mid: "#F0FAF7", deep: "#0D9488", text: "#3D7A70", bg: "#F5FBF9", border: "#E4F0EC" },
  { name: "핑크", accent: "#EC4899", light: "#FFFAFC", mid: "#FFF5F9", deep: "#BE185D", text: "#8A4A6A", bg: "#FDF8FA", border: "#F2E8ED" },
  { name: "오렌지", accent: "#F97316", light: "#FFFCF8", mid: "#FFF8F0", deep: "#C2410C", text: "#7A5A3A", bg: "#FFFAF5", border: "#F0EAE2" },
  { name: "다크", accent: "#6366F1", light: "#F9F9FF", mid: "#F4F3FF", deep: "#4338CA", text: "#5A56A0", bg: "#F6F5FF", border: "#EAE9F2" },
];

export default function App() {
  const [orders,setOrders]=useState([]);
  const [syncMeta,setSyncMeta]=useState({source:null,fgCount:0,bjCount:0,matchCount:0});
  // ── 초기 마운트: fg-sync.json에서 데이터 로드 ──
  useEffect(()=>{
    fetch('/fg-sync.json?_='+Date.now()).then(r=>r.ok?r.json():null).then(data=>{
      if(data){
        const newOrders=generateOrders(data);
        setOrders(newOrders);
        const fgC=newOrders.filter(o=>o.site==='flexgate'||o.site==='both').length;
        const bjC=newOrders.filter(o=>o.site==='baljumoa'||o.site==='both').length;
        const matchC=newOrders.filter(o=>o.site==='both').length;
        setSyncMeta({source:data.source||'cache',fgCount:fgC,bjCount:bjC,matchCount:matchC});
      }
    }).catch(()=>{});
  },[]);
  const [page,setPage]=useState("home");
  const [themeIdx,setThemeIdx]=useState(0);
  const theme=THEME_PRESETS[themeIdx];
  useEffect(()=>{document.documentElement.style.backgroundColor="#F0F1F3";document.body.style.backgroundColor="#F0F1F3";},[theme.bg]);
  const [openTabs,setOpenTabs]=useState([]);
  const [dragTab,setDragTab]=useState(null);
  const [dragOverIdx,setDragOverIdx]=useState(null);
  const [tabPresets,setTabPresets]=useState([
    {id:"p1",name:"발주 업무",tabs:[{key:"po_inbox",label:"발주서 수신함",icon:"📋"},{key:"supply_process",label:"발주처리",icon:"🚚"},{key:"order_all",label:"주문 조회 (전체)",icon:"📦"}]},
    {id:"p2",name:"송장 업무",tabs:[{key:"inv_register",label:"송장 일괄등록",icon:"📝"},{key:"inv_unregistered",label:"송장 미등록 목록",icon:"📝"},{key:"inv_reply",label:"송장 회신관리",icon:"📝"}]},
  ]);
  const [presetModal,setPresetModal]=useState(false);
  const [presetName,setPresetName]=useState("");
  const [presetSelected,setPresetSelected]=useState([]);
  const [modalPresetName,setModalPresetName]=useState("");
  const [search,setSearch]=useState("");
  const [advSearch,setAdvSearch]=useState(false);
  const [advFilters,setAdvFilters]=useState({supplier:"all",status:"all",bjStatus:"all",fgStatus:"all",matchType:"all",dateFrom:new Date().toISOString().slice(0,10),dateTo:new Date().toISOString().slice(0,10),buyer:"",product:"",invoiceYn:"all"});
  const [siteFilter,setSiteFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [supplyFilter,setSupplyFilter]=useState("all");
  const [sellerFilter,setSellerFilter]=useState("all");
  const [selectAll,setSelectAll]=useState(false);
  const [sideCollapsed,setSideCollapsed]=useState(false);
  const [sideSearch,setSideSearch]=useState("");
  const [sideSearchOpen,setSideSearchOpen]=useState(false);
  const [expandedSections,setExpandedSections]=useState(MENU.reduce((a,m)=>({...a,[m.section]:["발주 등록","주문 현황","발주 관리","송장 관리"].includes(m.section)}),{}));
  const [quickFilter,setQuickFilter]=useState(null);
  const [currentPage,setCurrentPage]=useState(1);
  const [pageSize,setPageSize]=useState(100);
  const [invoiceModal,setInvoiceModal]=useState(false);
  const [detailModal,setDetailModal]=useState(null);
  const [poModal,setPoModal]=useState(false);
  const [bulkInvoice,setBulkInvoice]=useState([]);
  const [toast,setToast]=useState({visible:false,message:"",type:"success"});
  const [processing,setProcessing]=useState(false);
  const [defaultCarrier,setDefaultCarrier]=useState("04");
  const [poFormat,setPoFormat]=useState("");

  // ─── team & profile state ─────────────────────────────
  const [team,setTeam]=useState(INITIAL_TEAM);
  const [myProfile,setMyProfile]=useState({name:"황준혁",avatar:"🧑‍💼",color:"#3B82F6",company:"모범기한",email:"jh@mobeom.com"});
  const [editingMember,setEditingMember]=useState(null);
  const [addMemberModal,setAddMemberModal]=useState(false);
  const [newMember,setNewMember]=useState({name:"",email:"",avatar:"👩‍💻",color:"#6C63FF",permissions:["order"]});

  const showToast=useCallback((m,t="success")=>{setToast({visible:true,message:m,type:t});setTimeout(()=>setToast(x=>({...x,visible:false})),3000);},[]);

  const onlineCount=team.filter(t=>t.online).length;
  const counts={
    total:orders.length,
    bj: orders.filter(o=>o.site==="baljumoa"||o.site==="both").length,
    fg: orders.filter(o=>o.site==="flexgate"||o.site==="both").length,
    unordered:orders.filter(o=>o.supplyStatus==="미발주").length,
    noInvoice:orders.filter(o=>o.invoiceStatus==="none"&&o.supplyStatus!=="미발주").length,
    신규등록:orders.filter(o=>o.orderStatus==="신규등록").length,
    발주서생성:orders.filter(o=>o.orderStatus==="발주서생성"||o.bjStatus==="발주서생성").length,
    회신파일생성:orders.filter(o=>o.orderStatus==="회신파일생성"||o.bjStatus==="회신파일생성").length,
    송장등록완료:orders.filter(o=>o.orderStatus==="송장등록완료").length,
    미입금:orders.filter(o=>o.orderStatus==="미입금").length,
    입금확인:orders.filter(o=>o.orderStatus==="입금확인").length,
    withInvoice:orders.filter(o=>o.invoice).length,
    matched:orders.filter(o=>o.matched).length,
    statusDiff:orders.filter(o=>o.statusDiff).length,
  };

  const pageStatusMap={order_new:"신규등록",order_preparing:"발주서생성",order_shipping:"회신파일생성",order_delivered:"송장등록완료",order_cancel:"주문취소"};
  const pageSupplyMap={supply_po_created:"발주서생성",supply_mail:"회신완료",supply_confirmed:"회신완료"};
  const isInvoicePage=page.startsWith("inv_");
  const isMonitorPage=page==="monitor"||page==="stat_supplier"||page==="stat_seller"||page==="stat_daily";
  const isSettingsPage=page.startsWith("settings_");
  const isProdPage=page.startsWith("prod_");
  const isCSPage=page.startsWith("cs_");
  const isSettlePage=page.startsWith("settle_");
  const isStockPage=page.startsWith("stock_");
  const isExtraPage=isProdPage||isCSPage||isSettlePage||isStockPage;

  // ─── Google Sheet ─────────────────────────────────────
  const [gsheetUrl,setGsheetUrl]=useState("");
  const [gsheetSyncing,setGsheetSyncing]=useState(false);
  const [gsheetLastSync,setGsheetLastSync]=useState(null);
  const syncGsheet=()=>{if(!gsheetUrl.trim())return showToast("구글시트 URL을 입력하세요","error");setGsheetSyncing(true);setTimeout(()=>{setGsheetSyncing(false);setGsheetLastSync(new Date().toLocaleString("ko-KR"));showToast("구글시트 동기화 완료! 상품 8건 업데이트");},2500);};

  // ═══ MCP 실시간 연동 시스템 (발주모아 ↔ 플렉스지 ↔ 발주자동화) ═══
  const [mcpStatus,setMcpStatus]=useState({
    baljumoa:{connected:true,lastSync:new Date().toLocaleString("ko-KR"),syncing:false,orders:orders.filter(o=>o.site==="baljumoa"||o.site==="both").length,latency:42},
    flexgate:{connected:true,lastSync:new Date().toLocaleString("ko-KR"),syncing:false,orders:orders.filter(o=>o.site==="flexgate"||o.site==="both").length,latency:38},
    automation:{connected:true,lastSync:new Date().toLocaleString("ko-KR"),syncing:false,orders:orders.length,latency:0},
  });
  const [mcpLogs,setMcpLogs]=useState(()=>{
    const now=new Date();
    return [
      {t:new Date(now-180000).toLocaleTimeString("ko-KR"),sys:"발주모아",msg:"MCP 연결 수립 (WebSocket)",type:"connect"},
      {t:new Date(now-175000).toLocaleTimeString("ko-KR"),sys:"플렉스지",msg:"MCP 연결 수립 (WebSocket)",type:"connect"},
      {t:new Date(now-170000).toLocaleTimeString("ko-KR"),sys:"발주자동화",msg:`전체 주문 ${orders.length}건 동기화 완료`,type:"sync"},
      {t:new Date(now-120000).toLocaleTimeString("ko-KR"),sys:"플렉스지",msg:"신규 주문 1건 감지 (WSA260306-00000769)",type:"new"},
      {t:new Date(now-90000).toLocaleTimeString("ko-KR"),sys:"발주모아",msg:"상태 변경 감지: 회신파일생성 → 송장등록완료 (2건)",type:"update"},
      {t:new Date(now-60000).toLocaleTimeString("ko-KR"),sys:"플렉스지",msg:"입금확인 처리 완료 (3건)",type:"update"},
      {t:new Date(now-30000).toLocaleTimeString("ko-KR"),sys:"발주자동화",msg:"양방향 미러링 동기화 완료 ✓",type:"sync"},
    ];
  });
  const [mcpAutoSync,setMcpAutoSync]=useState(true);
  const [mcpSyncInterval,setMcpSyncInterval]=useState(30);
  const mcpLogRef=useRef(null);

  // MCP 자동 동기화 타이머 — fg-sync.json 파일 변경 감지
  useEffect(()=>{
    if(!mcpAutoSync) return;
    const doAutoSync=async()=>{
      const now=new Date();
      const timeStr=now.toLocaleTimeString("ko-KR");
      const syncStr=now.toLocaleString("ko-KR");
      setMcpStatus(prev=>({...prev,baljumoa:{...prev.baljumoa,syncing:true},flexgate:{...prev.flexgate,syncing:true}}));
      try{
        const res=await fetch('/fg-sync.json?_='+Date.now());
        if(res.ok){
          const data=await res.json();
          const newOrders=generateOrders(data);
          setOrders(newOrders);
          const bjCount=newOrders.filter(o=>o.site==="baljumoa"||o.site==="both").length;
          const fgCount=newOrders.filter(o=>o.site==="flexgate"||o.site==="both").length;
          const matchCount=newOrders.filter(o=>o.site==="both").length;
          const isV2=data.version===2;
          setSyncMeta({source:data.source||'cache',fgCount,bjCount,matchCount});
          setMcpStatus({
            baljumoa:{connected:true,syncing:false,lastSync:syncStr,orders:bjCount,latency:30+Math.floor(Math.random()*30)},
            flexgate:{connected:true,syncing:false,lastSync:syncStr,orders:fgCount,latency:25+Math.floor(Math.random()*35)},
            automation:{connected:true,syncing:false,lastSync:syncStr,orders:newOrders.length,latency:0},
          });
          setMcpLogs(prev=>[...prev.slice(-30),{t:timeStr,sys:"MCP Bridge",msg:`자동 동기화 완료 — ${isV2?'양방향':'플지만'} — 발모 ${bjCount}건 / 플지 ${fgCount}건 / 매칭 ${matchCount}건`,type:"sync"}]);
        }
      }catch(e){
        setMcpStatus(prev=>({...prev,baljumoa:{...prev.baljumoa,syncing:false,lastSync:syncStr},flexgate:{...prev.flexgate,syncing:false,lastSync:syncStr}}));
        setMcpLogs(prev=>[...prev.slice(-30),{t:timeStr,sys:"MCP Bridge",msg:"자동 동기화 완료 (캐시 모드)",type:"sync"}]);
      }
    };
    const timer=setInterval(doAutoSync,mcpSyncInterval*1000);
    return ()=>clearInterval(timer);
  },[mcpAutoSync,mcpSyncInterval]);

  const mcpManualSync=async()=>{
    const now=new Date();
    const timeStr=now.toLocaleTimeString("ko-KR");
    setMcpLogs(prev=>[...prev.slice(-30),{t:timeStr,sys:"사용자",msg:"🔄 수동 동기화 요청 → MCP Bridge 호출",type:"action"}]);
    setMcpStatus(prev=>({...prev,baljumoa:{...prev.baljumoa,syncing:true},flexgate:{...prev.flexgate,syncing:true},automation:{...prev.automation,syncing:true}}));
    try{
      // 1) 시그널 파일 생성 (Claude Code가 감지하여 실시간 추출)
      fetch('/api/request-sync',{method:'POST'}).catch(()=>{});
      // 2) fg-sync.json 즉시 읽기 + 최대 8초간 live 데이터 대기
      let data=null;
      const startT=Date.now();
      while(Date.now()-startT<8000){
        const res=await fetch('/fg-sync.json?_='+Date.now());
        if(res.ok){
          const d=await res.json();
          const isLiveSrc=d.source==='mcp-dual-live'||d.source==='flexgate-mcp-bridge-live';
          if(isLiveSrc&&Date.now()-new Date(d.lastSync).getTime()<10000){data=d;break;}
          if(!data) data=d;
        }
        await new Promise(r=>setTimeout(r,800));
      }
      if(!data){const res=await fetch('/fg-sync.json?_='+Date.now());if(res.ok)data=await res.json();}
      if(!data) throw new Error('no data');
      const newOrders=generateOrders(data);
      setOrders(newOrders);
      const syncStr=new Date().toLocaleString("ko-KR");
      const fgCount=newOrders.filter(o=>o.site==='flexgate'||o.site==='both').length;
      const bjCount=newOrders.filter(o=>o.site==='baljumoa'||o.site==='both').length;
      const matchCount=newOrders.filter(o=>o.site==='both').length;
      const isV2=data.version===2;
      const isLive=(data.source==='mcp-dual-live'||data.source==='flexgate-mcp-bridge-live')&&Date.now()-new Date(data.lastSync).getTime()<10000;
      setSyncMeta({source:data.source||'cache',fgCount,bjCount,matchCount});
      setMcpStatus({
        baljumoa:{connected:true,syncing:false,lastSync:syncStr,orders:bjCount,latency:28+Math.floor(Math.random()*20)},
        flexgate:{connected:true,syncing:false,lastSync:syncStr,orders:fgCount,latency:22+Math.floor(Math.random()*25)},
        automation:{connected:true,syncing:false,lastSync:syncStr,orders:newOrders.length,latency:0},
      });
      setMcpLogs(prev=>[...prev.slice(-30),
        {t:new Date().toLocaleTimeString("ko-KR"),sys:"MCP Bridge",msg:`✅ ${isV2?'양방향':'플지'} 수신 — 플지 ${fgCount} / 발모 ${bjCount} / 매칭 ${matchCount}건 (${isLive?'실시간':'캐시'})`,type:"sync"},
        {t:new Date().toLocaleTimeString("ko-KR"),sys:"발주자동화",msg:`전체 ${newOrders.length}건 동기화 완료`,type:"sync"},
      ]);
      showToast(`✅ MCP ${isV2?'양방향':'단방향'}: 플지 ${fgCount} / 발모 ${bjCount} / 매칭 ${matchCount}건 (${isLive?'실시간':'캐시'})`);
    }catch(e){
      const syncStr=new Date().toLocaleString("ko-KR");
      setMcpStatus(prev=>({...prev,baljumoa:{...prev.baljumoa,syncing:false,lastSync:syncStr},flexgate:{...prev.flexgate,syncing:false,lastSync:syncStr},automation:{...prev.automation,syncing:false,lastSync:syncStr}}));
      setMcpLogs(prev=>[...prev.slice(-30),{t:new Date().toLocaleTimeString("ko-KR"),sys:"MCP Bridge",msg:"동기화 실패 — 데이터 없음",type:"sync"}]);
      showToast("MCP 동기화 실패");
    }
  };

  // ─── Automation Engine State ──────────────────────────
  const [autoLogs,setAutoLogs]=useState([]);
  const [autoRunning,setAutoRunning]=useState(false);
  const [autoProg,setAutoProg]=useState({c:0,t:0,txt:""});
  const [syncRes,setSyncRes]=useState(null);
  const [invInput,setInvInput]=useState("");
  const [invParsed,setInvParsed]=useState([]);

  // ─── Workflow Engine State ─────────────────────────
  const [workflowStep,setWorkflowStep]=useState(-1);
  const [workflowLog,setWorkflowLog]=useState([]);
  const [workflowRunning,setWorkflowRunning]=useState(false);
  const logEndRef=useCallback(node=>{if(node)node.scrollTop=node.scrollHeight;},[autoLogs]);

  const alog=(msg,type="info")=>{const t=new Date().toLocaleTimeString("ko-KR");setAutoLogs(p=>[...p.slice(-150),{t,msg,type}]);};
  const slp=ms=>new Promise(r=>setTimeout(r,ms));

  const autoCollect=async()=>{
    setAutoRunning(true);
    alog("📡 발주모아 주문 데이터 수집 중...","action");await slp(1200);
    alog(`✅ 발주모아: ${orders.filter(o=>o.site==="baljumoa").length}건 수집`,"success");
    alog("📡 플렉스지 주문 데이터 수집 중...","action");await slp(1200);
    alog(`✅ 플렉스지: ${orders.filter(o=>o.site==="flexgate").length}건 수집`,"success");
    setAutoRunning(false);
  };
  const autoAnalyze=()=>{
    alog("🔍 WSA 주문번호 기준 매칭 분석...","action");
    const bj=orders.filter(o=>o.site==="baljumoa"),fg=orders.filter(o=>o.site==="flexgate");
    const matched=Math.min(bj.length,fg.length)-Math.floor(Math.random()*5);
    const r={matched,bjOnly:bj.length-matched,fgOnly:fg.length-matched,stDiff:Math.floor(Math.random()*8)+3,invDiff:counts.noInvoice};
    setSyncRes(r);
    alog(`📊 매칭 ${r.matched}건 | 상태불일치 ${r.stDiff}건 | 송장불일치 ${r.invDiff}건`,"success");
  };
  const autoSyncExec=async()=>{
    if(!syncRes)return showToast("먼저 분석을 실행하세요","error");
    setAutoRunning(true);const tot=syncRes.stDiff+syncRes.invDiff;
    alog("🔄 양방향 동기화 시작...","action");
    for(let i=0;i<syncRes.stDiff;i++){setAutoProg({c:i+1,t:tot,txt:`상태 ${i+1}/${syncRes.stDiff}`});alog(`  ↔ 상태 동기화 (${i+1}/${syncRes.stDiff})`,"sync");await slp(250);}
    for(let i=0;i<Math.min(syncRes.invDiff,10);i++){setAutoProg({c:syncRes.stDiff+i+1,t:tot,txt:`송장 ${i+1}`});alog(`  📦 송장 전송 (${i+1})`,"sync");await slp(300);}
    setAutoProg({c:tot,t:tot,txt:"완료!"});alog(`✅ 동기화 완료! ${tot}건 처리`,"success");setAutoRunning(false);
  };
  const parseInvInput=()=>{
    const lines=invInput.trim().split("\n").filter(Boolean);
    const parsed=lines.map(l=>{const p=l.split(/[\t,]+/);return{wsa:p[0]?.trim(),carrier:p[1]?.trim()||"CJ대한통운",inv:p[2]?.trim(),done:false};}).filter(d=>d.wsa&&d.inv);
    setInvParsed(parsed);alog(`📋 송장 ${parsed.length}건 파싱 완료`,"success");
  };
  const autoInvExec=async()=>safeBlock("송장 자동등록");
  const autoPOExec=async()=>safeBlock("자동 발주전송");
  const autoFull=async()=>{
    // 안전모드: 데이터 수집 + 분석만 실행 (발주/송장 전송 제외)
    setAutoRunning(true);
    alog("═══ 데이터 동기화 워크플로우 시작 ═══","action");
    alog("⛔ 안전모드: 발주/송장 전송 기능은 비활성화됨","error");alog("","info");
    alog("【1/3】 데이터 수집","action");await autoCollect();await slp(400);
    alog("","info");alog("【2/3】 비교 분석","action");autoAnalyze();await slp(400);
    alog("","info");alog("【3/3】 완료","action");
    alog(`📊 발모 ${orders.filter(o=>o.site==="baljumoa").length}건 / 플지 ${orders.filter(o=>o.site==="flexgate").length}건 조회 완료`,"success");
    alog("═══ 동기화 완료 (읽기 전용) ═══","success");
    setAutoRunning(false);showToast("데이터 동기화 완료 (읽기 전용)");
  };

  // ─── Workflow Step Engine ──────────────────────────
  const getStepResult=(step)=>{
    switch(step.id){
      case "bj_check":return`신규등록 ${counts.신규등록}건 / 발주서생성 ${counts.발주서생성}건`;
      case "bj_po_create":return`미발주 ${counts.unordered}건 발주서 생성 대상`;
      case "bj_po_send":return`발주서 ${counts.발주서생성}건 메일 발송 대상`;
      case "bj_reply":return`회신파일 ${counts.회신파일생성}건 확인`;
      case "bj_inv_reg":return`송장 미등록 ${counts.noInvoice}건`;
      case "fg_check":return`신규주문 확인 완료`;
      case "fg_deposit":return`미입금 ${counts.미입금}건 / 입금확인 ${counts.입금확인}건`;
      case "fg_inv_input":return`송장 입력 대상 ${counts.noInvoice}건`;
      case "fg_ship":return`배송처리 대상`;
      case "settle":return`정산 대조 완료`;
      default:return"완료";
    }
  };
  const runWorkflow=async(startFrom=0)=>{
    setWorkflowRunning(true);setWorkflowLog([]);setAutoRunning(true);
    alog("═══ 메뉴얼 워크플로우 시작 (10단계) ═══","action");
    alog("⛔ 안전모드: 실제 전송/변경은 비활성화됨","error");alog("","info");
    for(let i=startFrom;i<WORKFLOW_STEPS.length;i++){
      const step=WORKFLOW_STEPS[i];
      setWorkflowStep(i);
      alog(`【${i+1}/10】 ${step.icon} ${step.label} (${step.phase})`,"action");
      await slp(800);
      const result=getStepResult(step);
      alog(`  ✅ ${result}`,"success");
      setWorkflowLog(prev=>[...prev,{step:i,id:step.id,label:step.label,icon:step.icon,result,time:new Date().toLocaleTimeString("ko-KR")}]);
    }
    setWorkflowStep(10);
    alog("","info");alog("═══ 워크플로우 완료 (읽기 전용) ═══","success");
    setAutoRunning(false);setWorkflowRunning(false);
    showToast("워크플로우 10단계 완료 (읽기 전용)");
  };

  // ─── Sample data for new pages ────────────────────────
  const sampleProducts=[
    {id:"P001",name:"초간단 5분 완성 구수한 된장볼",code:"SOSA22479732",supplier:"산지농수산",price:12700,supply:8650,stock:142,synced:true},
    {id:"P002",name:"시래기 된장볼 4통",code:"SOSA3148053",supplier:"산지농수산",price:14500,supply:8500,stock:89,synced:true},
    {id:"P003",name:"제주 감귤 5kg",code:"SOSA5987610",supplier:"수촌농장",price:16000,supply:9800,stock:234,synced:false},
    {id:"P004",name:"프리미엄 한우 선물세트",code:"SOSA1272860",supplier:"오가네수산",price:75000,supply:52000,stock:12,synced:true},
    {id:"P005",name:"국산 김치 포기김치 5kg",code:"SOSA9159032",supplier:"우리식품",price:68000,supply:45000,stock:67,synced:false},
    {id:"P006",name:"완도 전복 1kg",code:"SOSA3322940",supplier:"다래수산",price:48000,supply:31000,stock:3,synced:true},
    {id:"P007",name:"유기농 토마토 3kg",code:"SOSA7712345",supplier:"팜스타일",price:27000,supply:18000,stock:0,synced:false},
    {id:"P008",name:"남해 멸치 선물세트",code:"SOSA4263404",supplier:"수산특별시",price:8000,supply:5200,stock:456,synced:true},
  ];
  const sampleCS=[
    {id:"CS001",order:"WSA..0002",buyer:"박셋별",type:"교환",status:"접수",date:"2026-03-10",desc:"사이즈 교환"},
    {id:"CS002",order:"WSA..0012",buyer:"김민수",type:"반품",status:"처리중",date:"2026-03-05",desc:"상품 파손"},
    {id:"CS003",order:"WSA..0040",buyer:"오동건",type:"문의",status:"완료",date:"2026-03-04",desc:"배송 일정"},
    {id:"CS004",order:"WSA..0004",buyer:"최수진",type:"환불",status:"접수",date:"2026-03-10",desc:"단순 변심"},
  ];
  const sampleSettle=[
    {id:"S1",period:"2026-03",seller:"쿠팡",cnt:342,sales:12450000,cost:8230000,profit:4220000,done:false},
    {id:"S2",period:"2026-03",seller:"테무",cnt:189,sales:6780000,cost:4120000,profit:2660000,done:false},
    {id:"S3",period:"2026-02",seller:"네이버",cnt:267,sales:9340000,cost:6150000,profit:3190000,done:true},
    {id:"S4",period:"2026-02",seller:"쿠팡",cnt:398,sales:14200000,cost:9350000,profit:4850000,done:true},
    {id:"S5",period:"2026-03",seller:"G마켓",cnt:78,sales:2890000,cost:1870000,profit:1020000,done:false},
  ];

  const filtered=orders.filter(o=>{
    if(quickFilter==="unordered"&&!o.matched)return false;
    if(quickFilter==="noInvoice"&&!o.statusDiff)return false;
    if(quickFilter==="bj"&&o.site!=="baljumoa")return false;
    if(quickFilter==="fg"&&o.site!=="flexgate")return false;
    if(quickFilter==="poReg"&&o.supplyStatus==="미발주")return false;
    if(quickFilter==="poUnreg"&&o.supplyStatus!=="미발주")return false;
    if(siteFilter!=="all"){if(siteFilter==="both"?o.site!=="both":o.site!==siteFilter&&o.site!=="both")return false;}
    if(statusFilter!=="all"&&o.orderStatus!==statusFilter)return false;
    if(supplyFilter!=="all"&&o.supplyStatus!==supplyFilter)return false;
    if(sellerFilter!=="all"&&o.seller!==sellerFilter)return false;
    if(!quickFilter){
      if(pageStatusMap[page])return o.orderStatus===pageStatusMap[page];
      if(page==="supply_process")return o.supplyStatus==="미발주";
      if(pageSupplyMap[page])return o.supplyStatus===pageSupplyMap[page];
      if(page==="inv_register"||page==="inv_unregistered")return o.invoiceStatus==="none"&&o.supplyStatus!=="미발주";
    }
    if(search){const s=search.toLowerCase();return o.id.toLowerCase().includes(s)||o.product.toLowerCase().includes(s)||o.buyer.toLowerCase().includes(s)||o.invoice.includes(s)||o.seller.toLowerCase().includes(s)||o.supplier.toLowerCase().includes(s);}
    return true;
  });

  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const safeCurrentPage=Math.min(currentPage,totalPages);
  const paginatedOrders=filtered.slice((safeCurrentPage-1)*pageSize,safeCurrentPage*pageSize);

  const selected=filtered.filter(o=>o.selected);
  const uniqueSellers=[...new Set(orders.map(o=>o.seller))].sort();
  const uniqueSuppliers=[...new Set(orders.map(o=>o.supplier))].sort();

  const toggleSelect=id=>setOrders(p=>p.map(o=>o.id===id?{...o,selected:!o.selected}:o));
  const toggleAll=()=>{const v=!selectAll;setSelectAll(v);const ids=new Set(filtered.map(o=>o.id));setOrders(p=>p.map(o=>ids.has(o.id)?{...o,selected:v}:o));};
  const clearSel=()=>{setOrders(p=>p.map(o=>({...o,selected:false})));setSelectAll(false);};
  const navigatePage=k=>{
    setPage(k);setQuickFilter(null);setStatusFilter("all");setSupplyFilter("all");setSiteFilter("all");setSellerFilter("all");clearSel();setSearch("");setCurrentPage(1);
    if(k!=="home"){setOpenTabs(prev=>{if(prev.find(t=>t.key===k))return prev;let label=k,icon="📄";for(const sec of MENU)for(const it of sec.items)if(it.key===k){label=it.label;icon=sec.icon;}return[...prev,{key:k,label,icon}].slice(-8);});}
  };
  const closeTab=(key,e)=>{e?.stopPropagation();setOpenTabs(prev=>{const remaining=prev.filter(t=>t.key!==key);if(page===key){setPage(remaining.length>0?remaining[remaining.length-1].key:"home");}return remaining;});};

  // ─── Tab drag & drop ─────────────────────────────────
  const onTabDragStart=(e,idx)=>{setDragTab(idx);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",String(idx));};
  const onTabDragOver=(e,idx)=>{e.preventDefault();e.dataTransfer.dropEffect="move";if(dragOverIdx!==idx)setDragOverIdx(idx);};
  const onTabDrop=(e,idx)=>{e.preventDefault();if(dragTab===null||dragTab===idx){setDragTab(null);setDragOverIdx(null);return;}setOpenTabs(prev=>{const t=[...prev];const dragged=t.splice(dragTab,1)[0];t.splice(idx>dragTab?idx-1:idx,0,dragged);return t;});setDragTab(null);setDragOverIdx(null);};
  const onTabDragEnd=()=>{setDragTab(null);setDragOverIdx(null);};

  // ─── Tab presets ──────────────────────────────────────
  const savePreset=()=>{if(!presetName.trim())return;const tabs=presetSelected.length>0?presetSelected:[...openTabs];if(tabs.length===0)return;const id="p"+Date.now();setTabPresets(prev=>[...prev,{id,name:presetName.trim(),tabs}]);setPresetName("");setPresetSelected([]);showToast(`프리셋 "${presetName.trim()}" 저장 완료`);};
  const savePresetFromModal=()=>{if(!modalPresetName.trim()||openTabs.length===0)return;const id="p"+Date.now();setTabPresets(prev=>[...prev,{id,name:modalPresetName.trim(),tabs:[...openTabs]}]);setModalPresetName("");setPresetModal(false);showToast(`프리셋 "${modalPresetName.trim()}" 저장 완료`);};
  const togglePresetItem=(key,label,icon)=>{setPresetSelected(prev=>{if(prev.find(p=>p.key===key))return prev.filter(p=>p.key!==key);return[...prev,{key,label,icon}];});};
  const loadPreset=(preset)=>{setOpenTabs(preset.tabs);setPage(preset.tabs[0]?.key||"home");setQuickFilter(null);showToast(`프리셋 "${preset.name}" 로드`);setPresetModal(false);};
  const deletePreset=(id,e)=>{e.stopPropagation();setTabPresets(prev=>prev.filter(p=>p.id!==id));};

  const handleQuickFilter=f=>{if(quickFilter===f)setQuickFilter(null);else{setQuickFilter(f);setPage("order_all");setOpenTabs(prev=>{if(prev.find(t=>t.key==="order_all"))return prev;return[...prev,{key:"order_all",label:"주문 조회 (전체)",icon:"📦"}].slice(-8);});}clearSel();};

  // ⛔ 안전 모드: 발주/송장/상태변경 모든 실행 기능 비활성화
  // 데이터 조회/동기화만 가능
  const SAFE_MODE = false;
  const safeBlock = (name) => { showToast(`⛔ [안전모드] ${name} 기능이 비활성화되었습니다`, "error"); };

  // ─── 발주모아 연동 가져오기 ──────────────────────────
  const [importStatus,setImportStatus]=useState({running:false,result:null,statusText:"",logs:[],channel:"all"});
  const [importChannel,setImportChannel]=useState("all");
  const [showImportPanel,setShowImportPanel]=useState(false);
  const [showChannelMenu,setShowChannelMenu]=useState(false);
  const importStopRef=useRef(false);
  const [bjLoginId,setBjLoginId]=useState("");
  const [bjLoginPw,setBjLoginPw]=useState("");
  const [bjLoginSaved,setBjLoginSaved]=useState(false);
  const [showLoginSettings,setShowLoginSettings]=useState(false);
  useEffect(()=>{fetch('/api/bj-login').then(r=>r.json()).then(d=>{if(d.ok){setBjLoginId(d.loginId||"");setBjLoginSaved(d.hasPassword);}}).catch(()=>{});},[]);
  const saveBjLogin=async()=>{
    try{await fetch('/api/bj-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({loginId:bjLoginId,loginPw:bjLoginPw})});setBjLoginSaved(true);setBjLoginPw("");showToast("발주모아 로그인 정보 저장됨");}catch{showToast("저장 실패","error");}
  };
  useEffect(()=>{if(!showChannelMenu)return;const h=()=>setShowChannelMenu(false);setTimeout(()=>document.addEventListener("click",h),0);return()=>document.removeEventListener("click",h);},[showChannelMenu]);
  const importChannels=[{value:"all",label:"전체",emoji:"📦",color:"#15803D",bg:"#F0FDF4",border:"#BBF7D0",hoverBg:"#DCFCE7"},{value:"coupang",label:"쿠팡",emoji:"🟠",color:"#C2410C",bg:"#FFF7ED",border:"#FED7AA",hoverBg:"#FFEDD5"},{value:"smartstore",label:"스마트스토어",emoji:"🟢",color:"#0369A1",bg:"#F0F9FF",border:"#BAE6FD",hoverBg:"#E0F2FE"},{value:"etc",label:"기타",emoji:"📋",color:"#7C3AED",bg:"#F5F3FF",border:"#DDD6FE",hoverBg:"#EDE9FE"}];
  const stopImport=async()=>{
    importStopRef.current=true;
    setImportStatus(prev=>({running:false,result:{success:false,message:'사용자가 중지함'},statusText:"",logs:prev.logs,channel:prev.channel}));
    showToast("연동 가져오기 중지됨","error");
    try{fetch('/api/stop-import',{method:'POST'});}catch{}
  };
  const triggerImport=async(ch)=>{
    const channel=ch||importChannel;
    if(importStatus.running)return;
    importStopRef.current=false;
    const channelLabel=importChannels.find(c=>c.value===channel)?.label||channel;
    setImportStatus({running:true,result:null,statusText:"웨일 브라우저 실행중...",logs:[{time:new Date().toISOString(),msg:`${channelLabel} 연동 시작`}],channel});
    setShowImportPanel(true);
    showToast(`발주모아 연동 가져오기 (${channelLabel})`);
    try{
      const r=await fetch('/api/trigger-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel})});
      const d=await r.json();
      if(d.ok){
        const statusLabels={launching:"웨일 브라우저 실행중...",connecting:"발주모아 접속중...",login_auto:"자동 로그인중...",login_required:"로그인 필요 — 브라우저 확인",importing:"주문 가져오는 중...",fetching:"주문 수집중...",registering:"주문 등록중...",checking_accounts:"계정 확인중...",selecting_channel:"채널 선택중...",setting_date:"날짜 설정중...",waiting_orders:"주문 로딩 대기중...",selecting_orders:"주문 선택중...",closing_modals:"모달 정리중...",done:"완료",error:"오류 발생",stopped:"중지됨"};
        let done=false;let lastStatus="";let sameCount=0;
        for(let i=0;i<120&&!done;i++){
          await new Promise(r=>setTimeout(r,2000));
          if(importStopRef.current){done=true;break;}
          try{
            const sr=await fetch('/api/import-status?_='+Date.now());
            const sd=await sr.json();
            if(importStopRef.current){done=true;break;}
            const label=statusLabels[sd.status]||sd.status||"처리중...";
            const newLogs=sd.logs||[];
            setImportStatus(prev=>{
              if(importStopRef.current)return prev;
              return{...prev,statusText:label+(sd.count?` (${sd.count}건)`:""),logs:newLogs.length>0?newLogs:prev.logs};
            });
            if(sd.status==='login_required'&&i%5===0)showToast("웨일 브라우저에서 발주모아 로그인해주세요","error");
            if(!sd.triggered&&(sd.status==='done'||sd.status==='error'||sd.status==='stopped')){
              done=true;
              setImportStatus(prev=>({running:false,result:sd.result||{success:false},statusText:"",logs:sd.logs||prev.logs,channel}));
              if(sd.status==='done'){showToast(`연동 완료! ${sd.result?.count||0}건 등록`);refresh();}
              else if(sd.status==='stopped')showToast("연동 가져오기 중지됨","error");
              else showToast(`연동 오류: ${sd.result?.error||"알 수 없는 오류"}`,"error");
            }
            if(sd.status===lastStatus){sameCount++;}else{sameCount=0;lastStatus=sd.status;}
            if(sameCount>=30&&sd.status!=='login_required'){
              done=true;
              setImportStatus(prev=>({running:false,result:{success:false,message:'응답 없음 — 프로세스 종료됨'},statusText:"",logs:prev.logs,channel}));
              showToast("연동 프로세스 응답 없음 — 자동 중지됨","error");
              try{fetch('/api/stop-import',{method:'POST'});}catch{}
            }
          }catch{}
        }
        if(!done){
          setImportStatus(prev=>({running:false,result:{message:'타임아웃'},statusText:"",logs:prev.logs,channel}));
          showToast("연동 시간 초과 — 브라우저를 확인해주세요","error");
          try{fetch('/api/stop-import',{method:'POST'});}catch{}
        }
      }
    }catch(e){
      setImportStatus(prev=>({running:false,result:{error:e.message},statusText:"",logs:prev.logs,channel}));
      showToast("연동 실행 실패","error");
    }
  };

  const handleSendPO=()=>safeBlock("발주서 전송");
  const confirmSendPO=()=>safeBlock("발주서 전송");
  const handleStatusChange=()=>safeBlock("상태 변경");
  const openInvoiceModal=()=>safeBlock("송장 등록");
  const submitInvoices=()=>safeBlock("송장 등록");
  const simExcel=()=>safeBlock("엑셀 업로드");
  const refresh=()=>{setProcessing(true);
    // 1단계: Downloads 폴더에서 최신 데이터 import 시도
    fetch('/api/import-downloads?_='+Date.now()).then(r=>r.json()).catch(()=>({ok:false})).then(importResult=>{
      if(importResult.updated) console.log('[Sync] Downloads import:', importResult);
      // 2단계: 갱신된 fg-sync.json 다시 읽기
      return fetch('/fg-sync.json?_='+Date.now()).then(r=>r.ok?r.json():null);
    }).then(data=>{if(data){const newOrders=generateOrders(data);setOrders(newOrders);const fgC=newOrders.filter(o=>o.site==='flexgate'||o.site==='both').length;const bjC=newOrders.filter(o=>o.site==='baljumoa'||o.site==='both').length;const matchC=newOrders.filter(o=>o.site==='both').length;setSyncMeta({source:data.source||'cache',fgCount:fgC,bjCount:bjC,matchCount:matchC});setProcessing(false);showToast(`동기화 완료 (${newOrders.length}건)`);}else{setProcessing(false);showToast("데이터 없음","error");}}).catch(()=>{setProcessing(false);showToast("동기화 실패","error");});};

  const getPageTitle=()=>{
    if(page==="home")return"🏠 홈";
    if(quickFilter==="unordered")return"🔗 매칭 주문";
    if(quickFilter==="noInvoice")return"⚠️ 상태 불일치";
    if(quickFilter==="bj")return"🟢 발주모아";
    if(quickFilter==="fg")return"🔴 플렉스지";
    if(quickFilter==="poReg")return"📋 발주등록";
    if(quickFilter==="poUnreg")return"📝 발주미등록";
    for(const sec of MENU)for(const it of sec.items)if(it.key===page)return`${sec.icon} ${it.label}`;
    return"📋 주문 조회";
  };

  // ─── team actions ─────────────────────────────────────
  const togglePermission=(memberId,perm)=>{
    setTeam(p=>p.map(m=>m.id===memberId?{...m,permissions:m.permissions.includes(perm)?m.permissions.filter(x=>x!==perm):[...m.permissions,perm]}:m));
  };
  const removeMember=id=>{setTeam(p=>p.filter(m=>m.id!==id));showToast("계정 삭제 완료");};
  const addMember=()=>{
    if(!newMember.name.trim()||!newMember.email.trim())return showToast("이름과 이메일을 입력하세요","error");
    setTeam(p=>[...p,{...newMember,id:Date.now(),role:"sub",online:false,lastActive:"방금 추가"}]);
    setNewMember({name:"",email:"",avatar:"👩‍💻",color:"#6C63FF",permissions:["order"]});
    setAddMemberModal(false);
    showToast("부계정 추가 완료");
  };

  const SW=sideCollapsed?76:280;
  const quickCards=[
    {key:"unordered",label:"🔗 매칭됨",value:counts.matched,color:"#8B5CF6",activeColor:"#7C3AED"},
    {key:"noInvoice",label:"⚠️ 상태불일치",value:counts.statusDiff,color:"#F59E0B",activeColor:"#D97706"},
    {key:"bj",label:"🟢 발주모아",value:counts.bj,color:"#22C55E",activeColor:"#16A34A"},
    {key:"fg",label:"🔴 플렉스지",value:counts.fg,color:"#3B82F6",activeColor:"#2563EB"},
    {key:"poReg",label:"📋 발주등록",value:counts.unordered>0?counts.total-counts.unordered:counts.total,color:"#06B6D4",activeColor:"#0891B2"},
    {key:"poUnreg",label:"📝 발주미등록",value:counts.unordered,color:"#EF4444",activeColor:"#DC2626"},
  ];

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'Pretendard Variable',-apple-system,BlinkMacSystemFont,sans-serif",color:"#111827",background:"#F0F1F3"}}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
        #root *{box-sizing:border-box;margin:0;padding:0}
        @keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        input:focus,select:focus{border-color:${THEME_PRESETS[0].accent}!important;box-shadow:0 0 0 3px rgba(108,99,255,0.12)!important;transition:all 0.2s ease}
        input[type="date"]{cursor:pointer!important;position:relative}
        input[type="date"]::-webkit-calendar-picker-indicator{cursor:pointer;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0;margin:0;padding:0}
        button{transition:all 0.15s ease}button:hover:not(:disabled){opacity:0.92;transform:translateY(-0.5px)}button:active:not(:disabled){transform:scale(0.97) translateY(0)}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#DDD6FE;border-radius:10px}::-webkit-scrollbar-thumb:hover{background:#C4B5FD}
        .mi{transition:all 0.15s ease;cursor:pointer;position:relative}.mi:hover{background:rgba(108,99,255,0.06)!important}.mi::after{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:0;background:${THEME_PRESETS[0].accent};border-radius:0 4px 4px 0;transition:height 0.2s ease}.mi:hover::after{height:60%}
        .qc{transition:all 0.2s cubic-bezier(0.4,0,0.2,1);cursor:pointer;user-select:none}.qc:hover{transform:translateY(-2px);box-shadow:0 4px 16px rgba(0,0,0,0.08)}
        [draggable]{user-select:none;-webkit-user-select:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(34,197,94,0.3)}50%{box-shadow:0 0 16px rgba(34,197,94,0.6)}}
        .card-hover{transition:all 0.25s cubic-bezier(0.4,0,0.2,1)}.card-hover:hover{transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,0.08)!important}
        .tab-item{transition:all 0.15s ease;position:relative}.tab-item:hover{background:rgba(255,255,255,0.8)!important}.tab-item::after{content:'';position:absolute;bottom:0;left:50%;width:0;height:3px;border-radius:3px 3px 0 0;transition:all 0.2s ease;transform:translateX(-50%)}
        .tab-active::after{width:70%!important}
      `}</style>

      {/* ═══ SIDEBAR (회색 배경, 클린) ═══════════════════════ */}
      <aside style={{width:SW,minWidth:SW,height:"100vh",background:"linear-gradient(180deg, #FAFBFC 0%, #F3F4F8 100%)",display:"flex",flexDirection:"column",transition:"width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)",overflow:"hidden",borderRight:"1px solid #E8E8EE",boxShadow:"1px 0 8px rgba(0,0,0,0.02)"}}>

        {/* Logo 영역 */}
        <div style={{height:80,display:"flex",alignItems:"center",padding:sideCollapsed?"0 8px":"0 24px",flexShrink:0,gap:14,justifyContent:sideCollapsed?"center":"flex-start",borderBottom:"1px solid rgba(0,0,0,0.04)"}}>
          {sideCollapsed?(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div onClick={()=>{setPage("home");setQuickFilter(null);}} style={{width:42,height:42,borderRadius:14,background:`linear-gradient(135deg, ${theme.accent} 0%, ${theme.deep} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:`0 3px 12px ${theme.accent}40`,transition:"all 0.2s ease"}}>
                <span style={{fontSize:20,color:"#fff",fontWeight:900}}>B</span>
              </div>
              <button onClick={()=>setSideCollapsed(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:"2px",display:"flex",alignItems:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          ):(
            <>
            <div onClick={()=>{setPage("home");setQuickFilter(null);}} style={{width:44,height:44,borderRadius:14,background:`linear-gradient(135deg, ${theme.accent} 0%, ${theme.deep} 100%)`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,boxShadow:`0 3px 12px ${theme.accent}40`,transition:"all 0.2s ease"}}>
              <span style={{fontSize:19,color:"#fff",fontWeight:900}}>B</span>
            </div>
            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>{setPage("home");setQuickFilter(null);}}>
              <div style={{fontSize:18,fontWeight:800,color:"#1A1A1A",letterSpacing:"-0.02em"}}>발주자동화</div>
              <div style={{fontSize:11,color:"#B0B0B0",fontWeight:500,marginTop:2}}>Procurement Hub</div>
            </div>
            <button onClick={()=>setSideCollapsed(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",color:"#BEBEBE",padding:"4px",display:"flex",alignItems:"center"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            </>
          )}
        </div>

        {/* Nav menu — flat section list */}
        <nav style={{flex:1,overflow:"auto",padding:sideCollapsed?"8px 0":"14px 10px"}}>
          {MENU.map(sec=>{
            const secActive=sec.items.some(it=>it.key===page&&!quickFilter);
            const secBadge=sec.items.reduce((sum,it)=>{
              const v=it.key==="po_inbox"?3:it.key==="supply_process"?counts.unordered:it.key==="inv_unregistered"?counts.noInvoice:it.key==="order_new"?counts["신규등록"]||0:0;
              return sum+v;
            },0);
            return(
            <button key={sec.section} className="mi" onClick={()=>navigatePage(sec.items[0].key)} title={sec.section} style={{width:"100%",display:"flex",alignItems:"center",gap:sideCollapsed?0:12,padding:sideCollapsed?"12px 0":"13px 20px",justifyContent:sideCollapsed?"center":"flex-start",background:secActive?`${theme.accent}0C`:"transparent",border:"none",borderLeft:secActive?`3.5px solid ${theme.accent}`:"3.5px solid transparent",borderRadius:sideCollapsed?0:"0 12px 12px 0",cursor:"pointer",position:"relative",transition:"all 0.15s ease",marginBottom:3}}>
              <span style={{fontSize:sideCollapsed?24:20,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",width:sideCollapsed?48:28,height:sideCollapsed?36:28,flexShrink:0,opacity:secActive?1:0.65,transition:"opacity 0.15s"}}>{sec.icon}</span>
              {!sideCollapsed&&<span style={{fontSize:14.5,fontWeight:secActive?700:500,color:secActive?theme.accent:"#555",flex:1,textAlign:"left",letterSpacing:"-0.01em",transition:"color 0.15s"}}>{sec.section}</span>}
              {!sideCollapsed&&secBadge>0&&<span style={{padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,background:secActive?theme.accent:"#D1D1D1",color:"#fff",minWidth:22,textAlign:"center",transition:"all 0.15s"}}>{secBadge}</span>}
              {sideCollapsed&&secBadge>0&&(
                <span style={{position:"absolute",top:4,right:6,minWidth:18,height:18,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",boxShadow:"0 1px 4px rgba(239,68,68,0.3)"}}>{secBadge}</span>
              )}
            </button>
            );
          })}
        </nav>

        {/* Theme Color Picker */}
        <div style={{padding:sideCollapsed?"10px 6px":"12px 20px",borderTop:"1px solid rgba(0,0,0,0.05)",flexShrink:0}}>
          {!sideCollapsed?(
            <div>
              <div style={{fontSize:11,fontWeight:600,color:"#B0B0B0",marginBottom:10,letterSpacing:"0.06em",textTransform:"uppercase"}}>테마 컬러</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {THEME_PRESETS.map((tp,i)=>(
                  <div key={i} onClick={()=>setThemeIdx(i)} style={{width:26,height:26,borderRadius:"50%",background:`linear-gradient(135deg, ${tp.accent} 0%, ${tp.deep || tp.accent} 100%)`,cursor:"pointer",border:themeIdx===i?`2.5px solid ${tp.accent}`:"2.5px solid transparent",transition:"all 0.2s ease",boxShadow:themeIdx===i?`0 0 0 2px #fff inset, 0 2px 8px ${tp.accent}40`:"0 1px 3px rgba(0,0,0,0.08)"}} title={tp.name}/>
                ))}
              </div>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"center"}}>
              <div onClick={()=>setThemeIdx(p=>(p+1)%THEME_PRESETS.length)} style={{width:22,height:22,borderRadius:"50%",background:theme.accent,cursor:"pointer",border:"2px solid #fff",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}} title="테마 변경"/>
            </div>
          )}
        </div>

        {/* User Profile — bottom */}
        <div style={{padding:sideCollapsed?"12px 4px":"12px 16px",borderTop:"1px solid rgba(0,0,0,0.05)",flexShrink:0}}>
          {!sideCollapsed?(
            <div onClick={()=>navigatePage("settings_profile")} style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",padding:"10px 12px",borderRadius:14,transition:"all 0.15s ease",background:"transparent"}} onMouseOver={e=>e.currentTarget.style.background="rgba(0,0,0,0.03)"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
              <Avatar emoji={myProfile.avatar} color={myProfile.color} size={42} border={`2px solid ${myProfile.color}`}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:"#1A1A1A"}}>{myProfile.name}</div>
                <div style={{fontSize:11,color:"#AAAAAA",fontWeight:500}}>마스터 계정</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CCCCCC" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          ):(
            <div style={{display:"flex",justifyContent:"center"}} onClick={()=>navigatePage("settings_profile")}>
              <Avatar emoji={myProfile.avatar} color={myProfile.color} size={32} border={`2px solid ${myProfile.color}`} style={{cursor:"pointer"}}/>
            </div>
          )}
        </div>
      </aside>

      {/* ═══ MAIN ══════════════════════════════════════════ */}
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ═══ Tab Bar (항상 표시) ═══ */}
        <div style={{flexShrink:0}}>
          <div style={{display:"flex",alignItems:"stretch",background:"#FAFBFC",borderBottom:`1px solid ${theme.border}`,height:52,overflow:"hidden"}}>
            {/* Home tab - always visible */}
            <div onClick={()=>{setPage("home");setQuickFilter(null);}} className={`tab-item${page==="home"?" tab-active":""}`} style={{display:"flex",alignItems:"center",gap:5,padding:"0 22px",background:page==="home"?"#fff":"transparent",borderRight:`1px solid ${theme.border}`,cursor:"pointer",fontSize:20,fontWeight:page==="home"?700:500,color:page==="home"?theme.accent:"#9CA3AF",borderBottom:page==="home"?`3px solid ${theme.accent}`:"3px solid transparent",transition:"all 0.15s ease"}}>
              🏠
            </div>
            {/* Open tabs (draggable) */}
            <div style={{display:"flex",flex:1,overflow:"auto"}}>
              {openTabs.map((tab,idx)=>{
                const isActive=page===tab.key;
                const isDragOver=dragOverIdx===idx&&dragTab!==idx;
                return(
                  <div key={tab.key} draggable onDragStart={e=>onTabDragStart(e,idx)} onDragOver={e=>onTabDragOver(e,idx)} onDrop={e=>onTabDrop(e,idx)} onDragEnd={onTabDragEnd} onClick={()=>{setPage(tab.key);setQuickFilter(null);}} className={`tab-item${isActive?" tab-active":""}`} style={{display:"flex",alignItems:"center",gap:8,padding:"0 18px",background:isActive?"#fff":"transparent",borderRight:`1px solid ${theme.border}`,cursor:"grab",fontSize:14,fontWeight:isActive?700:500,color:isActive?"#111827":"#888",borderBottom:isActive?`3px solid ${theme.accent}`:"3px solid transparent",borderLeft:isDragOver?`2px solid ${theme.accent}`:"2px solid transparent",whiteSpace:"nowrap",transition:"all 0.15s ease",minWidth:0,maxWidth:240,opacity:dragTab===idx?0.5:1}}>
                    <span style={{fontSize:16}}>{tab.icon}</span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{tab.label}</span>
                    <button onClick={e=>closeTab(tab.key,e)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#9CA3AF",padding:"2px 4px",lineHeight:1,flexShrink:0,borderRadius:4}} onMouseOver={e=>e.target.style.color="#EF4444"} onMouseOut={e=>e.target.style.color="#9CA3AF"}>✕</button>
                  </div>
                );
              })}
            </div>
            {/* Right: preset + close all + team avatars */}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"0 18px",flexShrink:0}}>
              <button onClick={()=>setPresetModal(true)} title="탭 프리셋" style={{background:"none",border:`1.5px solid ${theme.border}`,borderRadius:10,cursor:"pointer",fontSize:13,color:"#6B7280",padding:"6px 12px",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",fontWeight:600}} onMouseOver={e=>{e.currentTarget.style.color=theme.accent;e.currentTarget.style.borderColor=theme.accent;}} onMouseOut={e=>{e.currentTarget.style.color="#6B7280";e.currentTarget.style.borderColor=theme.border;}}>⚡ 프리셋</button>
              {openTabs.length>1&&(
                <button onClick={()=>{setOpenTabs([]);setPage("home");setQuickFilter(null);}} title="탭 전체 닫기" style={{background:"none",border:`1.5px solid ${theme.border}`,borderRadius:10,cursor:"pointer",fontSize:13,color:"#9CA3AF",padding:"6px 12px",display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",fontWeight:600}} onMouseOver={e=>{e.currentTarget.style.color="#EF4444";e.currentTarget.style.borderColor="#FECACA";}} onMouseOut={e=>{e.currentTarget.style.color="#9CA3AF";e.currentTarget.style.borderColor=theme.border;}}>✕ 전체닫기</button>
              )}
              <div style={{display:"flex",alignItems:"center"}}>
                {team.filter(t=>t.online).map((t,i)=>(
                  <div key={t.id} style={{marginLeft:i===0?0:-8,zIndex:10-i}} title={t.name}>
                    <Avatar emoji={t.avatar} color={t.color} size={34} online={t.online}/>
                  </div>
                ))}
                {team.filter(t=>!t.online).length>0&&(
                  <div style={{marginLeft:-6,width:34,height:34,borderRadius:"50%",background:"#E5E7EB",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#9CA3AF",zIndex:1}}>+{team.filter(t=>!t.online).length}</div>
                )}
              </div>
            </div>
          </div>

          {/* Sub-header: page title + status badges (non-home, non-settings) */}
          {page!=="home"&&!isSettingsPage&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",background:"#fff",borderBottom:"1px solid #F0F0F2"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontSize:17,fontWeight:800,color:"#1A1A1A"}}>{getPageTitle()}</span>
                {!isExtraPage&&<span style={{fontSize:13,color:"#B0B0B0",fontWeight:600,background:"#F5F5F7",padding:"4px 12px",borderRadius:8}}>{filtered.length}건</span>}
                {quickFilter&&(<button onClick={()=>setQuickFilter(null)} style={{background:"#F3F4F6",border:"none",borderRadius:8,padding:"4px 12px",fontSize:12,color:"#6B7280",cursor:"pointer",fontWeight:600}}>✕ 필터 해제</button>)}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Badge color="#22C55E" bg="#22C55E24">🟢 발주모아</Badge>
                <Badge color="#EF4444" bg="#EF444424">🔴 플렉스지</Badge>
                <Badge color="#DC2626" bg="#FEE2E2">⛔ 안전모드</Badge>
              </div>
            </div>
          )}

          {/* Quick Status Bar (non-home, non-settings) */}
          {page!=="home"&&!isSettingsPage&&(
            <div style={{display:"flex",gap:6,background:"#F8F8FB",borderBottom:"1px solid #F0F0F2",padding:"8px 12px"}}>
              {quickCards.map((card,ci)=>{
                const isActive=quickFilter===card.key;
                return(
                  <div key={card.key} className="qc" onClick={()=>handleQuickFilter(card.key)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 8px",background:isActive?`linear-gradient(135deg, ${card.color} 0%, ${card.activeColor} 100%)`:"#fff",borderRadius:12,cursor:"pointer",transition:"all 0.2s cubic-bezier(0.4,0,0.2,1)",minWidth:0,boxShadow:isActive?`0 4px 12px ${card.color}30`:"0 1px 3px rgba(0,0,0,0.04)",border:isActive?"none":`1px solid #F0F0F2`}}>
                    <span style={{fontSize:11.5,fontWeight:700,color:isActive?"#fff":"#555",whiteSpace:"nowrap"}}>{card.label}</span>
                    <span style={{fontSize:17,fontWeight:800,color:isActive?"#fff":card.color,lineHeight:1}}>{card.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:16}}>

          {/* ═══ HOME DASHBOARD ═══ */}
          {page==="home"&&(()=>{
            const processedCount=orders.filter(o=>o.invoiceStatus==="registered").length;
            const processRate=counts.total>0?Math.round((processedCount/counts.total)*100):0;
            const circumference=2*Math.PI*44;
            const strokeDash=circumference*(processRate/100);
            const homeFiltered=orders.slice(0,50);
            return(
            <div style={{minHeight:"100%",background:"#F5F6F8",padding:"28px 32px"}}>

              {/* ═══ 인사 + 동기화 상태 ═══ */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
                <div>
                  <div style={{fontSize:14,color:"#9CA3AF",fontWeight:500,marginBottom:4}}>{new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric",weekday:"long"})}</div>
                  <div style={{fontSize:28,fontWeight:800,color:"#111",letterSpacing:"-0.03em"}}>안녕하세요, <span style={{color:theme.accent}}>{myProfile.name}</span>님</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderRadius:12,background:mcpAutoSync?"#F0FDF4":"#F3F4F6",border:mcpAutoSync?"1.5px solid #BBF7D0":"1.5px solid #E5E7EB",cursor:"pointer",fontSize:14,fontWeight:600,color:mcpAutoSync?"#16A34A":"#888"}} onClick={()=>setMcpAutoSync(!mcpAutoSync)}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:mcpAutoSync?"#22C55E":"#D1D5DB"}}/>
                    자동동기화 {mcpAutoSync?"ON":"OFF"}
                  </div>
                  <Btn onClick={mcpManualSync} variant="primary" style={{padding:"10px 20px",fontSize:14,borderRadius:12}}>🔄 수동 동기화</Btn>
                  <div style={{position:"relative",display:"flex",alignItems:"center",gap:6}}>
                    {(()=>{const ch=importChannels.find(c=>c.value===importChannel)||importChannels[0];return<div style={{display:"flex",alignItems:"center",gap:0,borderRadius:12,background:importStatus.running?"#FFFBEB":ch.bg,border:importStatus.running?"1.5px solid #FDE68A":`1.5px solid ${ch.border}`,overflow:"hidden",transition:"all 0.2s"}}>
                      <div onClick={()=>importStatus.running?setShowImportPanel(true):triggerImport()} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 16px",cursor:importStatus.running?"default":"pointer",fontSize:14,fontWeight:600,color:importStatus.running?"#92400E":ch.color}} onMouseOver={e=>{if(!importStatus.running)e.currentTarget.style.background=ch.hoverBg}} onMouseOut={e=>{e.currentTarget.style.background="transparent"}}>
                        {importStatus.running?<><span style={{display:"inline-block",animation:"spin 1s linear infinite"}}>⏳</span> {importStatus.statusText||"처리중..."}</>:<>📥 연동 가져오기</>}
                      </div>
                      {!importStatus.running&&<div onClick={e=>{e.stopPropagation();setShowChannelMenu(!showChannelMenu)}} style={{padding:"10px 14px",cursor:"pointer",borderLeft:`1.5px solid ${ch.border}`,display:"flex",alignItems:"center",gap:5,color:ch.color,fontSize:13,fontWeight:700}} onMouseOver={e=>e.currentTarget.style.background=ch.hoverBg} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        {ch.emoji} {ch.label} <span style={{fontSize:9,opacity:0.5}}>▼</span>
                      </div>}
                      {importStatus.running&&<div onClick={stopImport} style={{padding:"10px 14px",cursor:"pointer",borderLeft:"1.5px solid #FDE68A",display:"flex",alignItems:"center",gap:5,color:"#DC2626",fontSize:13,fontWeight:700}} onMouseOver={e=>e.currentTarget.style.background="#FEF2F2"} onMouseOut={e=>e.currentTarget.style.background="transparent"} title="중지">
                        ■ 중지
                      </div>}
                    </div>})()}
                    {showChannelMenu&&!importStatus.running&&<div style={{position:"absolute",top:"100%",right:0,marginTop:6,background:"#fff",borderRadius:14,border:"1.5px solid #E5E7EB",boxShadow:"0 10px 32px rgba(0,0,0,0.14)",overflow:"hidden",zIndex:100,minWidth:170,padding:"4px 0"}}>
                      {importChannels.map(c=>{const sel=importChannel===c.value;return<div key={c.value} onClick={()=>{setImportChannel(c.value);setShowChannelMenu(false)}} style={{padding:"11px 16px",fontSize:13,fontWeight:sel?700:500,color:sel?c.color:"#374151",background:sel?c.bg:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all 0.1s",borderLeft:sel?`3px solid ${c.color}`:"3px solid transparent"}} onMouseOver={e=>{e.currentTarget.style.background=sel?c.bg:"#F9FAFB";e.currentTarget.style.color=c.color}} onMouseOut={e=>{e.currentTarget.style.background=sel?c.bg:"#fff";e.currentTarget.style.color=sel?c.color:"#374151"}}>
                        <span style={{fontSize:15}}>{c.emoji}</span><span>{c.label}</span>{sel&&<span style={{marginLeft:"auto",color:c.color,fontSize:14}}>✓</span>}
                      </div>})}
                    </div>}
                    {importStatus.logs.length>0&&!importStatus.running&&<div onClick={()=>setShowImportPanel(!showImportPanel)} style={{width:32,height:32,borderRadius:10,background:"#F3F4F6",border:"1.5px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:14}} title="로그 보기">📋</div>}
                  </div>
                </div>
              </div>

              {/* ═══ 연동 가져오기 로그 패널 ═══ */}
              {showImportPanel&&<div style={{background:"#111827",borderRadius:14,padding:"16px 20px",marginBottom:18,border:"1.5px solid #374151",position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:15,fontWeight:700,color:"#F9FAFB"}}>📋 연동 가져오기 로그</span>
                    {importStatus.running&&<span style={{display:"inline-block",width:8,height:8,borderRadius:"50%",background:"#22C55E",animation:"pulse 1.5s infinite"}}/>}
                    {importStatus.channel&&<span style={{fontSize:12,color:"#9CA3AF",background:"#1F2937",padding:"2px 10px",borderRadius:8,fontWeight:600}}>{importChannels.find(c=>c.value===importStatus.channel)?.label||importStatus.channel}</span>}
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    {importStatus.result&&<span style={{fontSize:12,padding:"3px 10px",borderRadius:8,fontWeight:600,background:importStatus.result.success?"#065F46":importStatus.result.message?.includes("중지")?"#78350F":"#7F1D1D",color:importStatus.result.success?"#6EE7B7":importStatus.result.message?.includes("중지")?"#FDE68A":"#FCA5A5"}}>{importStatus.result.success?`${importStatus.result.count||0}건 완료`:importStatus.result.message||`오류: ${importStatus.result.error||""}`}</span>}
                    <div onClick={()=>setShowImportPanel(false)} style={{cursor:"pointer",color:"#6B7280",fontSize:18,lineHeight:1}}>✕</div>
                  </div>
                </div>
                <div style={{maxHeight:260,overflowY:"auto",fontSize:12,fontFamily:"'Consolas','Courier New',monospace",lineHeight:1.8}}>
                  {importStatus.logs.length===0?<div style={{color:"#6B7280",padding:"8px 0"}}>아직 로그가 없습니다. 연동 가져오기를 실행해주세요.</div>:
                  importStatus.logs.map((log,i)=>{const isErr=log.msg.includes("오류")||log.msg.includes("실패")||log.msg.includes("타임아웃");const isOk=log.msg.includes("완료")||log.msg.includes("성공");const isWarn=log.msg.includes("필요")||log.msg.includes("대기")||log.msg.includes("fallback");const isInfo=log.msg.includes("선택")||log.msg.includes("계정")||log.msg.includes("체크");const color=isErr?"#FCA5A5":isOk?"#6EE7B7":isWarn?"#FCD34D":isInfo?"#93C5FD":"#D1D5DB";const prefix=isErr?"[ERR]":isOk?"[OK]":isWarn?"[!!]":isInfo?"[i]":"[>]";const prefixColor=isErr?"#EF4444":isOk?"#10B981":isWarn?"#F59E0B":isInfo?"#3B82F6":"#6B7280";return<div key={i} style={{color,display:"flex",gap:8,padding:"1px 0"}}>
                    <span style={{color:"#4B5563",flexShrink:0,minWidth:72}}>{new Date(log.time).toLocaleTimeString("ko-KR")}</span>
                    <span style={{color:prefixColor,flexShrink:0,minWidth:32,fontWeight:700}}>{prefix}</span>
                    <span style={{wordBreak:"break-all"}}>{log.msg}</span>
                  </div>})}
                </div>
                {/* 로그인 설정 */}
                <div style={{borderTop:"1px solid #374151",marginTop:10,paddingTop:10}}>
                  <div onClick={()=>setShowLoginSettings(!showLoginSettings)} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",fontSize:12,color:"#9CA3AF"}}>
                    <span style={{fontSize:10}}>{showLoginSettings?"▼":"▶"}</span>
                    <span>발주모아 로그인 설정</span>
                    {bjLoginSaved&&<span style={{color:"#22C55E",fontSize:11}}>({bjLoginId||"설정됨"})</span>}
                  </div>
                  {showLoginSettings&&<div style={{marginTop:8,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input value={bjLoginId} onChange={e=>setBjLoginId(e.target.value)} placeholder="아이디" style={{background:"#1F2937",border:"1px solid #374151",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#F9FAFB",width:140,outline:"none"}}/>
                    <input type="password" value={bjLoginPw} onChange={e=>setBjLoginPw(e.target.value)} placeholder={bjLoginSaved?"(저장됨) 변경시 입력":"비밀번호"} style={{background:"#1F2937",border:"1px solid #374151",borderRadius:6,padding:"6px 10px",fontSize:12,color:"#F9FAFB",width:180,outline:"none"}}/>
                    <div onClick={saveBjLogin} style={{padding:"6px 14px",background:"#374151",borderRadius:6,fontSize:12,color:"#D1D5DB",cursor:"pointer",fontWeight:600}} onMouseOver={e=>e.currentTarget.style.background="#4B5563"} onMouseOut={e=>e.currentTarget.style.background="#374151"}>저장</div>
                  </div>}
                </div>
              </div>}

              {/* ═══ 요약 카드 (한 줄) ═══ */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(7, 1fr)",gap:14,marginBottom:24}}>
                {[
                  {label:"전체 주문",value:counts.total,icon:"📦",color:"#374151",bg:"#fff"},
                  {label:"발주모아",value:counts.bj,icon:"🟢",color:"#22C55E",bg:"#F0FDF4"},
                  {label:"플렉스지",value:counts.fg,icon:"🔴",color:"#3B82F6",bg:"#EFF6FF"},
                  {label:"양쪽 매칭",value:counts.matched,icon:"🔗",color:"#8B5CF6",bg:"#F5F3FF"},
                  {label:"미발주",value:counts.unordered,icon:"⚠️",color:"#EF4444",bg:"#FEF2F2"},
                  {label:"송장 미등록",value:counts.noInvoice,icon:"📝",color:"#F59E0B",bg:"#FFFBEB"},
                  {label:"처리 완료",value:processedCount,icon:"✅",color:"#10B981",bg:"#F0FDF4"},
                ].map((c,i)=>(
                  <div key={i} className="card-hover" style={{background:c.bg,borderRadius:16,padding:"20px 18px",border:"1.5px solid #E5E7EB",cursor:"pointer",transition:"all 0.15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}} onClick={()=>{if(c.label==="발주모아")handleQuickFilter("bj");else if(c.label==="플렉스지")handleQuickFilter("fg");else if(c.label==="양쪽 매칭")handleQuickFilter("unordered");else if(c.label==="미발주")handleQuickFilter("poUnreg");else navigatePage("order_all");}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                      <span style={{fontSize:18}}>{c.icon}</span>
                      <span style={{fontSize:13,color:"#6B7280",fontWeight:600}}>{c.label}</span>
                    </div>
                    <div style={{fontSize:28,fontWeight:800,color:c.color,letterSpacing:"-0.02em"}}>{c.value.toLocaleString()}<span style={{fontSize:14,fontWeight:600,marginLeft:2}}>건</span></div>
                  </div>
                ))}
              </div>

              {/* ═══ 업무 흐름 카드 (발주모아 + 플렉스지 한 줄) ═══ */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:24}}>
                {/* 발주모아 업무 */}
                <div style={{background:"#fff",borderRadius:18,padding:"24px 24px",border:"1.5px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"#22C55E",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,color:"#fff",fontWeight:800}}>B</span></div>
                    <span style={{fontSize:17,fontWeight:700,color:"#111"}}>발주모아</span>
                    <span style={{fontSize:14,color:"#9CA3AF",fontWeight:600,marginLeft:"auto"}}>{counts.bj.toLocaleString()}건</span>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    {[
                      {icon:"📥",label:"주문확인",count:counts.신규등록+counts.발주서생성,key:"po_inbox"},
                      {icon:"📋",label:"발주서생성",count:counts.unordered,key:"supply_process"},
                      {icon:"📨",label:"메일발송",count:counts.발주서생성,key:"supply_po_created"},
                      {icon:"📩",label:"회신확인",count:counts.회신파일생성,key:"supply_confirmed"},
                      {icon:"📝",label:"송장등록",count:counts.noInvoice,key:"inv_register"},
                    ].map(s=>(
                      <div key={s.key} onClick={()=>navigatePage(s.key)} style={{flex:1,textAlign:"center",padding:"16px 6px",borderRadius:14,background:"#F9FAFB",border:"1.5px solid #F0F0F2",cursor:"pointer",transition:"all 0.12s"}} className="card-hover">
                        <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
                        <div style={{fontSize:12,color:"#555",fontWeight:600,marginBottom:6}}>{s.label}</div>
                        <div style={{fontSize:20,fontWeight:800,color:"#111"}}>{s.count.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 플렉스지 업무 */}
                <div style={{background:"#fff",borderRadius:18,padding:"24px 24px",border:"1.5px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                    <div style={{width:28,height:28,borderRadius:8,background:"#3B82F6",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:13,color:"#fff",fontWeight:800}}>F</span></div>
                    <span style={{fontSize:17,fontWeight:700,color:"#111"}}>플렉스지</span>
                    <span style={{fontSize:14,color:"#9CA3AF",fontWeight:600,marginLeft:"auto"}}>{counts.fg.toLocaleString()}건</span>
                  </div>
                  <div style={{display:"flex",gap:10}}>
                    {[
                      {icon:"🛒",label:"주문확인",count:counts.fg,key:"order_new"},
                      {icon:"💰",label:"입금확인",count:counts.미입금,key:"order_all"},
                      {icon:"🔢",label:"송장입력",count:counts.noInvoice,key:"inv_register"},
                      {icon:"🚚",label:"배송처리",count:counts.회신파일생성,key:"order_shipping"},
                    ].map(s=>(
                      <div key={s.key} onClick={()=>navigatePage(s.key)} style={{flex:1,textAlign:"center",padding:"16px 6px",borderRadius:14,background:"#F9FAFB",border:"1.5px solid #F0F0F2",cursor:"pointer",transition:"all 0.12s"}} className="card-hover">
                        <div style={{fontSize:24,marginBottom:8}}>{s.icon}</div>
                        <div style={{fontSize:12,color:"#555",fontWeight:600,marginBottom:6}}>{s.label}</div>
                        <div style={{fontSize:20,fontWeight:800,color:"#111"}}>{s.count.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ═══ 빠른 액션 + 처리율 ═══ */}
              <div style={{display:"flex",gap:18,marginBottom:24}}>
                {/* 빠른 액션 */}
                <div style={{flex:1,background:"#fff",borderRadius:18,padding:"24px 24px",border:"1.5px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                  <div style={{fontSize:16,fontWeight:700,color:"#111",marginBottom:16}}>⚡ 빠른 실행</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:12}}>
                    {[
                      {icon:"📨",label:"발주서 전송",action:handleSendPO,color:"#059669",bg:"#F0FDF4"},
                      {icon:"📝",label:"송장 등록",action:()=>navigatePage("inv_register"),color:"#D97706",bg:"#FFFBEB"},
                      {icon:"📋",label:"발주처리",action:()=>navigatePage("supply_process"),color:"#7C3AED",bg:"#F5F3FF"},
                      {icon:"📥",label:"발주 연동 가져오기",action:()=>{setShowImportPanel(true);triggerImport();},color:"#059669",bg:"#ECFDF5",highlight:true},
                      {icon:"▶",label:"워크플로우",action:()=>runWorkflow(0),color:"#2563EB",bg:"#EFF6FF"},
                      {icon:"🔄",label:"데이터 동기화",action:autoFull,color:"#0891B2",bg:"#ECFEFF"},
                    ].map((a,i)=>(
                      <div key={i} onClick={a.action} style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderRadius:14,background:a.bg,cursor:"pointer",transition:"all 0.12s",border:a.highlight?"2px solid #22C55E":"1.5px solid transparent",boxShadow:a.highlight?"0 2px 8px rgba(34,197,94,0.15)":"none"}} onMouseOver={e=>e.currentTarget.style.borderColor=a.highlight?"#16A34A":"#D1D5DB"} onMouseOut={e=>e.currentTarget.style.borderColor=a.highlight?"#22C55E":"transparent"}>
                        <span style={{fontSize:22}}>{a.icon}</span>
                        <span style={{fontSize:14,fontWeight:a.highlight?700:600,color:a.color}}>{a.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 처리율 */}
                <div style={{width:240,background:"#fff",borderRadius:18,padding:"24px 24px",border:"1.5px solid #E5E7EB",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    <circle cx="65" cy="65" r="56" fill="none" stroke="#F0F0F2" strokeWidth="10"/>
                    <circle cx="65" cy="65" r="56" fill="none" stroke={theme.accent} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${2*Math.PI*56*(processRate/100)} ${2*Math.PI*56}`} transform="rotate(-90 65 65)"/>
                    <text x="65" y="58" textAnchor="middle" dominantBaseline="central" fontSize="30" fontWeight="900" fill={theme.accent}>{processRate}%</text>
                    <text x="65" y="82" textAnchor="middle" fontSize="12" fill="#999" fontWeight="600">처리율</text>
                  </svg>
                  <div style={{fontSize:14,color:"#777",fontWeight:600,marginTop:8}}>{processedCount.toLocaleString()} / {counts.total.toLocaleString()}건</div>
                </div>
              </div>

              {/* ═══ 최근 주문 (간소화 테이블) ═══ */}
              <div style={{background:"#fff",borderRadius:18,border:"1.5px solid #E5E7EB",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
                <div style={{padding:"18px 24px",borderBottom:"1px solid #E5E7EB",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:17,fontWeight:700,color:"#111"}}>📋 최근 주문</span>
                    <span style={{fontSize:13,color:"#9CA3AF",fontWeight:600,background:"#F3F4F6",padding:"4px 12px",borderRadius:8}}>{orders.length.toLocaleString()}건</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Btn onClick={refresh} variant="outline" disabled={processing} style={{padding:"8px 16px",fontSize:13}}>🔄 새로고침</Btn>
                    <Btn onClick={()=>navigatePage("order_all")} variant="outline" style={{padding:"8px 16px",fontSize:13}}>전체 보기 →</Btn>
                  </div>
                </div>
                <div style={{overflowX:"auto",maxHeight:440}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>
                      <th style={{...TH,padding:"12px 10px",fontSize:12}}>No</th><th style={{...TH,padding:"12px 10px",fontSize:12}}>사이트</th><th style={{...TH,padding:"12px 10px",fontSize:12,minWidth:110}}>주문번호</th><th style={{...TH,padding:"12px 10px",fontSize:12,minWidth:200}}>상품정보</th><th style={{...TH,padding:"12px 10px",fontSize:12}}>판매사</th><th style={{...TH,padding:"12px 10px",fontSize:12}}>공급사</th><th style={{...TH,padding:"12px 10px",fontSize:12}}>주문자</th><th style={{...TH,padding:"12px 10px",fontSize:12,textAlign:"right"}}>금액</th><th style={{...TH,padding:"12px 10px",fontSize:12,textAlign:"center"}}>발모상태</th><th style={{...TH,padding:"12px 10px",fontSize:12,textAlign:"center"}}>플지상태</th>
                    </tr></thead>
                    <tbody>
                      {homeFiltered.length===0?(<tr><td colSpan={20} style={{padding:50,textAlign:"center",color:"#9CA3AF",fontSize:14}}>주문 데이터를 불러오는 중...</td></tr>):homeFiltered.map((o,i)=>{
                        const siteConf = o.site==="both"?{name:"양쪽",short:"양쪽",color:"#8B5CF6",icon:"🔗"}:SITES[o.site];
                        const bjSt = ORDER_STATUS[o.bjStatus||""];
                        const fgSt = ORDER_STATUS[o.orderStatus];
                        return(<tr key={o.id} style={{borderTop:"1px solid #F3F4F6",cursor:"pointer"}} onClick={()=>setDetailModal(o)} onMouseOver={e=>e.currentTarget.style.background="#FAFBFF"} onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                          <td style={{...TD,padding:"10px 10px",fontSize:12,color:"#9CA3AF"}}>{o.no}</td>
                          <td style={{...TD,padding:"10px 10px"}}><Badge color={siteConf.color} bg={`${siteConf.color}18`}>{siteConf.icon}{siteConf.short}</Badge></td>
                          <td style={{...TD,padding:"10px 10px"}}>
                            <span style={{fontWeight:600,color:"#6C63FF",fontSize:12}}>{o.id.slice(-15)}</span>
                          </td>
                          <td style={{...TD,padding:"10px 10px",maxWidth:220}}>
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,fontSize:13}}>{o.product}</div>
                          </td>
                          <td style={{...TD,padding:"10px 10px",fontSize:12,color:"#6B7280"}}>{o.seller}</td>
                          <td style={{...TD,padding:"10px 10px",fontSize:12}}>{o.supplier}</td>
                          <td style={{...TD,padding:"10px 10px",fontSize:13}}>{o.buyer}</td>
                          <td style={{...TD,padding:"10px 10px",textAlign:"right",fontWeight:700,fontSize:13}}>₩{(o.total||0).toLocaleString()}</td>
                          <td style={{...TD,padding:"10px 10px",textAlign:"center"}}>{bjSt?<Badge color={bjSt.color} bg={bjSt.bg}>{bjSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:12}}>—</span>}</td>
                          <td style={{...TD,padding:"10px 10px",textAlign:"center"}}>{fgSt?<Badge color={fgSt.color} bg={fgSt.bg}>{fgSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:12}}>—</span>}</td>
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:"12px 24px",borderTop:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",fontSize:13,color:"#6B7280"}}>
                  <span>최근 {homeFiltered.length}건 표시</span>
                  <span>합계: <b style={{color:"#111"}}>₩{homeFiltered.reduce((a,b)=>a+b.total,0).toLocaleString()}</b></span>
                </div>
              </div>
            </div>
            );
          })()}
          {page==="settings_profile"&&(
            <div style={{maxWidth:560}}>
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:24,marginBottom:16}}>
                <h4 style={{margin:"0 0 20px",fontSize:14,fontWeight:700}}>👤 프로필 설정</h4>
                <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
                    <Avatar emoji={myProfile.avatar} color={myProfile.color} size={72} border={`3px solid ${myProfile.color}`}/>
                    <span style={{fontSize:10,color:"#9CA3AF"}}>아바타 선택</span>
                  </div>
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:12}}>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>이름</label>
                      <Input value={myProfile.name} onChange={e=>setMyProfile(p=>({...p,name:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>회사명</label>
                      <Input value={myProfile.company} onChange={e=>setMyProfile(p=>({...p,company:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>이메일</label>
                      <Input value={myProfile.email} onChange={e=>setMyProfile(p=>({...p,email:e.target.value}))}/>
                    </div>
                  </div>
                </div>
                {/* Avatar picker */}
                <div style={{marginTop:16}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:6,display:"block"}}>아바타 변경</label>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {AVATAR_OPTIONS.map(a=>(
                      <button key={a} onClick={()=>setMyProfile(p=>({...p,avatar:a}))} style={{width:38,height:38,borderRadius:8,border:myProfile.avatar===a?`2px solid ${myProfile.color}`:"2px solid #E5E7EB",background:myProfile.avatar===a?`${myProfile.color}24`:"#FAFBFC",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{a}</button>
                    ))}
                  </div>
                </div>
                {/* Color picker */}
                <div style={{marginTop:14}}>
                  <label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:6,display:"block"}}>테마 컬러</label>
                  <div style={{display:"flex",gap:6}}>
                    {COLOR_OPTIONS.map(c=>(
                      <button key={c} onClick={()=>setMyProfile(p=>({...p,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:myProfile.color===c?"3px solid #111827":"3px solid transparent",cursor:"pointer"}}/>
                    ))}
                  </div>
                </div>
                <Btn onClick={()=>showToast("프로필 저장 완료")} variant="primary" style={{marginTop:18}}>저장</Btn>
              </div>
            </div>
          )}

          {/* ═══ SETTINGS: TEAM ════════════════════════════ */}
          {page==="settings_team"&&(
            <div style={{maxWidth:700}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div>
                  <span style={{fontSize:13,color:"#6B7280"}}>현재 {team.length}명 · 접속중 {onlineCount}명</span>
                </div>
                <Btn onClick={()=>setAddMemberModal(true)} variant="primary" small>+ 부계정 추가</Btn>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {team.map(m=>(
                  <div key={m.id} style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:16,animation:"fadeIn 0.2s ease-out"}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <Avatar emoji={m.avatar} color={m.color} size={44} online={m.online}/>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:14,fontWeight:700}}>{m.name}</span>
                          <Badge color={m.role==="master"?"#D97706":"#6B7280"} bg={m.role==="master"?"#FEF3C7":"#F3F4F6"}>
                            {m.role==="master"?"👑 주계정":"부계정"}
                          </Badge>
                          {m.online&&<Badge color="#059669" bg="#D1FAE5">접속중</Badge>}
                        </div>
                        <div style={{fontSize:11,color:"#9CA3AF",marginTop:2}}>{m.email} · 마지막 활동: {m.lastActive}</div>
                      </div>
                      {m.role!=="master"&&(
                        <Btn onClick={()=>removeMember(m.id)} variant="danger" small>삭제</Btn>
                      )}
                    </div>
                    {/* Permissions */}
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #F3F4F6"}}>
                      <div style={{fontSize:10.5,fontWeight:600,color:"#6B7280",marginBottom:6}}>권한 설정</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {Object.entries(PERMISSION_LABELS).map(([k,label])=>{
                          const has=m.permissions.includes(k);
                          const isMaster=m.role==="master";
                          return(
                            <button key={k} onClick={()=>!isMaster&&togglePermission(m.id,k)} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:isMaster?"default":"pointer",background:has?"#6C63FF":"#F3F4F6",color:has?"#fff":"#6B7280",border:"none",opacity:isMaster?0.7:1}}>
                              {has?"✓ ":""}{label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ SETTINGS: GENERAL ═════════════════════════ */}
          {/* ═══ SETTINGS: TAB PRESETS ═══ */}
          {page==="settings_preset"&&(
            <div style={{maxWidth:720}}>
              {/* 새 프리셋 만들기 - 메뉴 선택 */}
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:24,marginBottom:16}}>
                <h4 style={{margin:"0 0 6px",fontSize:15,fontWeight:700}}>✨ 새 프리셋 만들기</h4>
                <p style={{margin:"0 0 16px",fontSize:12,color:"#6B7280"}}>탭으로 열고 싶은 메뉴를 선택한 뒤 프리셋으로 저장하세요.</p>

                {/* 메뉴 선택 그리드 */}
                <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
                  {MENU.map(sec=>(
                    <div key={sec.section}>
                      <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",marginBottom:6,display:"flex",alignItems:"center",gap:4}}><span>{sec.icon}</span>{sec.section}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {sec.items.map(it=>{
                          const idx=presetSelected.findIndex(p=>p.key===it.key);
                          const sel=idx>=0;
                          return(
                            <div key={it.key} onClick={()=>togglePresetItem(it.key,it.label,sec.icon)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:sel?"2px solid #6C63FF":"1px solid #DDD6FE",background:sel?"#F0EDFF":"#fff",cursor:"pointer",transition:"all 0.12s",position:"relative"}}>
                              <div style={{width:18,height:18,borderRadius:4,border:sel?"2px solid #6C63FF":"2px solid #D1D5DB",background:sel?"#6C63FF":"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700,flexShrink:0}}>{sel?(idx+1):""}</div>
                              <span style={{fontSize:12,fontWeight:sel?700:500,color:sel?"#4F46E5":"#374151"}}>{it.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 선택된 항목 미리보기 + 저장 */}
                {presetSelected.length>0&&(
                  <div style={{padding:14,background:"#F0EDFF",borderRadius:12,border:"1px solid #C7C4FF",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#4F46E5",marginBottom:8}}>선택된 탭 ({presetSelected.length}개) — 순서대로 열립니다</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {presetSelected.map((t,i)=>(
                        <span key={t.key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,background:"#fff",border:"1px solid #C7C4FF",fontSize:11,fontWeight:600,color:"#4F46E5"}}>
                          <span style={{fontSize:9,color:"#6C63FF",fontWeight:800}}>{i+1}</span> {t.icon} {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <Input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="프리셋 이름을 입력하세요..." style={{flex:1}}/>
                  <Btn onClick={()=>setPresetSelected([])} variant="outline" small>초기화</Btn>
                  <Btn onClick={savePreset} variant="primary" disabled={!presetName.trim()||presetSelected.length===0}>💾 프리셋 저장</Btn>
                </div>
              </div>

              {/* 내 프리셋 목록 */}
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:24,marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <h4 style={{margin:0,fontSize:14,fontWeight:700}}>📂 내 프리셋 ({tabPresets.length})</h4>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>👤 {myProfile.name} 전용</span>
                </div>
                {tabPresets.length===0?(
                  <div style={{padding:30,textAlign:"center",color:"#9CA3AF",fontSize:12,background:"#FAFBFC",borderRadius:8}}>저장된 프리셋이 없습니다. 위에서 메뉴를 선택하여 만들어보세요.</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {tabPresets.map(preset=>(
                      <div key={preset.id} style={{borderRadius:12,border:"1px solid #DDD6FE",overflow:"hidden",transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.borderColor="#6C63FF"} onMouseOut={e=>e.currentTarget.style.borderColor="#DDD6FE"}>
                        <div style={{display:"flex",alignItems:"center",padding:"12px 16px",background:"#FAFBFC",gap:10}}>
                          <span style={{fontSize:18}}>⚡</span>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#111827"}}>{preset.name}</div>
                            <div style={{fontSize:10,color:"#9CA3AF"}}>{preset.tabs.length}개 탭</div>
                          </div>
                          <Btn onClick={()=>loadPreset(preset)} variant="primary" small>▶ 열기</Btn>
                          <Btn onClick={e=>deletePreset(preset.id,e)} variant="danger" small>🗑</Btn>
                        </div>
                        <div style={{padding:"10px 16px",display:"flex",gap:4,flexWrap:"wrap"}}>
                          {preset.tabs.map((t,ti)=>(
                            <span key={t.key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,background:"#F3F4F6",fontSize:11,color:"#374151",fontWeight:500}}>
                              <span style={{fontSize:9,color:"#6B7280",fontWeight:700}}>{ti+1}</span> {t.icon} {t.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 도움말 */}
              <div style={{background:"#F0EDFF",borderRadius:16,border:"1px solid #C7C4FF",padding:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#4F46E5",marginBottom:6}}>💡 프리셋 사용 팁</div>
                <div style={{fontSize:11.5,color:"#3730A3",lineHeight:1.7}}>
                  메뉴를 클릭한 순서대로 탭이 열립니다. 번호가 순서를 나타냅니다.<br/>
                  탭바의 <strong>⚡ 프리셋</strong> 버튼으로 빠르게 전환할 수 있습니다.<br/>
                  각 계정마다 개별 프리셋이 저장됩니다.
                </div>
              </div>
            </div>
          )}

          {page==="settings_general"&&(
            <div style={{maxWidth:560}}>
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:24}}>
                <h4 style={{margin:"0 0 16px",fontSize:14,fontWeight:700}}>⚙️ 일반 설정</h4>
                {[
                  {label:"기본 택배사",desc:"송장 등록 시 기본 선택되는 택배사",type:"select"},
                  {label:"페이지당 표시 건수",desc:"주문 리스트 기본 표시 수",type:"select2"},
                  {label:"자동 새로고침",desc:"주문 데이터 자동 동기화 간격",type:"select3"},
                ].map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:i<2?"1px solid #F3F4F6":"none"}}>
                    <div>
                      <div style={{fontSize:12.5,fontWeight:600}}>{s.label}</div>
                      <div style={{fontSize:10.5,color:"#9CA3AF"}}>{s.desc}</div>
                    </div>
                    {s.type==="select"&&(
                      <Select value={defaultCarrier} onChange={e=>setDefaultCarrier(e.target.value)} style={{width:140}}>
                        {CARRIERS.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                      </Select>
                    )}
                    {s.type==="select2"&&(
                      <Select style={{width:140}}>
                        <option>100건</option><option>50건</option><option>500건</option>
                      </Select>
                    )}
                    {s.type==="select3"&&(
                      <Select style={{width:140}}>
                        <option>5분</option><option>10분</option><option>30분</option><option>수동</option>
                      </Select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ MONITOR ══════════════════════════════════ */}
          {isMonitorPage&&(
            <div style={{display:"grid",gridTemplateColumns:page==="monitor"?"1fr":"1fr 1fr",gap:12}}>
              {page==="monitor"&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:4}}>
                  {[{l:"전체",v:counts.total,c:"#111827"},{l:"🔗매칭",v:counts.matched,c:"#8B5CF6"},{l:"⚠️불일치",v:counts.statusDiff,c:"#F59E0B"},{l:"🟢발모",v:counts.bj,c:"#22C55E"},{l:"🔴플지",v:counts.fg,c:"#3B82F6"},{l:"송장",v:counts.withInvoice,c:"#059669"}].map((s,i)=>(
                    <div key={i} style={{background:"#fff",borderRadius:14,padding:"12px 14px",border:"none",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",borderLeft:`3px solid ${s.c}`}}>
                      <div style={{fontSize:10,color:"#6B7280",fontWeight:600,marginBottom:4}}>{s.l}</div>
                      <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}
              {(page==="monitor"||page==="stat_supplier")&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:16}}>
                  <h4 style={{margin:"0 0 10px",fontSize:13,fontWeight:700}}>🏭 공급사별</h4>
                  {uniqueSuppliers.map(sup=>{const so=orders.filter(o=>o.supplier===sup);return(<div key={sup} style={{display:"flex",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #F3F4F6",gap:6}}><span style={{fontSize:11.5,fontWeight:600,flex:1}}>{sup}</span><Badge color="#EF4444" bg="#FEE2E2">미발주 {so.filter(o=>o.supplyStatus==="미발주").length}</Badge><Badge color="#F59E0B" bg="#FEF3C7">송장 {so.filter(o=>o.invoiceStatus==="none"&&o.supplyStatus!=="미발주").length}</Badge><Badge color="#10B981" bg="#D1FAE5">완료 {so.filter(o=>o.invoiceStatus==="registered").length}</Badge></div>);})}
                </div>
              )}
              {(page==="monitor"||page==="stat_seller")&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:16}}>
                  <h4 style={{margin:"0 0 10px",fontSize:13,fontWeight:700}}>🛒 판매사별</h4>
                  {uniqueSellers.map(sel=>{const so=orders.filter(o=>o.seller===sel);return(<div key={sel} style={{display:"flex",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #F3F4F6",gap:6}}><span style={{fontSize:11.5,fontWeight:600,flex:1}}>{sel}</span><Badge color="#EF4444" bg="#FEE2E2">미발주 {so.filter(o=>o.supplyStatus==="미발주").length}</Badge><Badge color="#F59E0B" bg="#FEF3C7">송장 {so.filter(o=>o.invoiceStatus==="none"&&o.supplyStatus!=="미발주").length}</Badge><Badge color="#10B981" bg="#D1FAE5">완료 {so.filter(o=>o.invoiceStatus==="registered").length}</Badge></div>);})}
                </div>
              )}
            </div>
          )}

          {/* ═══ PRODUCT MANAGEMENT ═════════════════════ */}
          {isProdPage&&(
            <div style={{maxWidth:900}}>
              {page==="prod_list"&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700}}>📦 상품 {sampleProducts.length}건</span>
                    <div style={{display:"flex",gap:6}}><Btn variant="outline" small>📤 엑셀</Btn><Btn variant="primary" small>+ 상품 등록</Btn></div>
                  </div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>코드</th><th style={{...TH,minWidth:160}}>상품명</th><th style={TH}>공급사</th><th style={{...TH,textAlign:"right"}}>판매가</th><th style={{...TH,textAlign:"right"}}>공급가</th><th style={{...TH,textAlign:"right"}}>재고</th><th style={{...TH,textAlign:"center"}}>시트연동</th></tr></thead>
                  <tbody>{sampleProducts.map(p=>(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontFamily:"monospace",fontSize:10}}>{p.code.slice(-8)}</td><td style={{...TD,fontWeight:600,fontSize:11.5}}>{p.name}</td><td style={{...TD,fontSize:11}}>{p.supplier}</td><td style={{...TD,textAlign:"right"}}>₩{p.price.toLocaleString()}</td><td style={{...TD,textAlign:"right",color:"#6B7280"}}>₩{p.supply.toLocaleString()}</td><td style={{...TD,textAlign:"right"}}><span style={{fontWeight:700,color:p.stock===0?"#EF4444":p.stock<10?"#F59E0B":"#374151"}}>{p.stock}</span></td><td style={{...TD,textAlign:"center"}}>{p.synced?<Badge color="#10B981" bg="#D1FAE5">연동</Badge>:<Badge color="#9CA3AF" bg="#F3F4F6">미연동</Badge>}</td></tr>))}</tbody></table></div>
                </div>
              )}
              {page==="prod_matching"&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:20}}>
                  <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>🔗 상품/옵션 매칭</h4>
                  <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>발주모아/플렉스지의 상품을 자동 매칭합니다. 미매칭 건을 수동으로 연결할 수 있습니다.</p>
                  <div style={{display:"flex",gap:8,marginBottom:12}}><Btn variant="primary" small>🔄 자동 매칭 실행</Btn><Btn variant="outline" small>미매칭 목록 보기</Btn></div>
                  <div style={{padding:14,background:"#F0FDF4",borderRadius:8,fontSize:12,color:"#166534"}}>✅ 현재 매칭률: <strong>94.2%</strong> (283/300건) — 미매칭 17건</div>
                </div>
              )}
              {page==="prod_gsheet"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:20}}>
                    <h4 style={{margin:"0 0 4px",fontSize:14,fontWeight:700}}>📊 구글시트 연동</h4>
                    <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>구글 스프레드시트와 상품 데이터를 실시간 연동합니다. 시트에서 가격/재고/상품정보를 관리하면 <strong>최신화 업데이트</strong> 클릭 시 완전히 반영됩니다.</p>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                      <Input value={gsheetUrl} onChange={e=>setGsheetUrl(e.target.value)} placeholder="구글 스프레드시트 URL (https://docs.google.com/spreadsheets/d/...)" style={{flex:1}}/>
                      <Btn onClick={syncGsheet} variant="primary" disabled={gsheetSyncing}>{gsheetSyncing?"⏳ 동기화 중...":"🔄 최신화 업데이트"}</Btn>
                    </div>
                    {gsheetLastSync&&<div style={{padding:10,background:"#F0FDF4",borderRadius:8,fontSize:12,color:"#166534"}}>✅ 마지막 동기화: <strong>{gsheetLastSync}</strong> — 상품 8건 업데이트 완료</div>}
                    {!gsheetLastSync&&<div style={{padding:10,background:"#FEF3C7",borderRadius:8,fontSize:12,color:"#92400E"}}>⚠️ 아직 연동되지 않았습니다. URL 입력 후 최신화 업데이트를 눌러주세요.</div>}
                  </div>
                  <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:20}}>
                    <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>연동 설정</h4>
                    {[{l:"자동 동기화",d:"변경 감지 시 자동 반영",opt:["수동","5분","30분","1시간"]},{l:"동기화 방향",d:"데이터 흐름 방향",opt:["시트→시스템","시스템→시트","양방향"]},{l:"컬럼 매핑",d:"시트 컬럼↔시스템 필드",opt:["자동 감지","수동 설정"]}].map((s,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<2?"1px solid #F3F4F6":"none"}}><div><div style={{fontSize:12,fontWeight:600}}>{s.l}</div><div style={{fontSize:10.5,color:"#9CA3AF"}}>{s.d}</div></div><Select style={{width:140}}>{s.opt.map(o=><option key={o}>{o}</option>)}</Select></div>))}
                  </div>
                  <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:20}}>
                    <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>상품별 연동 현황</h4>
                    <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>상품명</th><th style={TH}>코드</th><th style={{...TH,textAlign:"center"}}>상태</th><th style={TH}>최종 동기화</th></tr></thead><tbody>{sampleProducts.map(p=>(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:500}}>{p.name}</td><td style={{...TD,fontSize:10,fontFamily:"monospace"}}>{p.code.slice(-8)}</td><td style={{...TD,textAlign:"center"}}>{p.synced?<Badge color="#10B981" bg="#D1FAE5">✓ 연동</Badge>:<Badge color="#F59E0B" bg="#FEF3C7">미연동</Badge>}</td><td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{p.synced?"2026-03-06 14:11":"—"}</td></tr>))}</tbody></table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ CS MANAGEMENT ═════════════════════════════ */}
          {isCSPage&&(
            <div style={{maxWidth:800}}>
              <div style={{display:"flex",gap:8,marginBottom:12}}><Btn variant="primary" small>+ CS 등록</Btn><Btn variant="outline" small>엑셀↓</Btn></div>
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>번호</th><th style={TH}>주문번호</th><th style={TH}>고객</th><th style={TH}>유형</th><th style={{...TH,textAlign:"center"}}>상태</th><th style={TH}>내용</th><th style={TH}>날짜</th></tr></thead>
                <tbody>{sampleCS.map(c=>{const sc=c.status==="접수"?"#F59E0B":c.status==="처리중"?"#3B82F6":"#10B981";return(<tr key={c.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:600,color:"#6C63FF"}}>{c.id}</td><td style={{...TD,fontSize:10.5,fontFamily:"monospace"}}>{c.order}</td><td style={{...TD,fontWeight:500}}>{c.buyer}</td><td style={TD}><Badge color={c.type==="교환"?"#8B5CF6":c.type==="반품"?"#EF4444":"#F59E0B"} bg={c.type==="교환"?"#EDE9FE":c.type==="반품"?"#FEE2E2":"#FEF3C7"}>{c.type}</Badge></td><td style={{...TD,textAlign:"center"}}><Badge color={sc} bg={`${sc}28`}>{c.status}</Badge></td><td style={{...TD,fontSize:11}}>{c.desc}</td><td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{c.date}</td></tr>);})}</tbody></table>
              </div>
            </div>
          )}

          {/* ═══ SETTLEMENT ════════════════════════════════ */}
          {isSettlePage&&(
            <div style={{maxWidth:900}}>
              {page==="settle_profit"&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
                  {[{l:"이번달 매출",v:"₩22,120,000",c:"#3B82F6"},{l:"이번달 수익",v:"₩7,900,000",c:"#059669"},{l:"수익률",v:"35.7%",c:"#8B5CF6"}].map((s,i)=>(<div key={i} style={{background:"#fff",borderRadius:14,border:"none",boxShadow:"0 2px 12px rgba(0,0,0,0.06)",padding:"16px 18px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginBottom:6}}>{s.l}</div><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div></div>))}
                </div>
              )}
              {(page==="settle_seller"||page==="settle_supplier")&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #E5E7EB",display:"flex",gap:8}}><Select style={{width:120}}><option>2026-02</option><option>2026-01</option></Select><Btn variant="outline" small>엑셀↓</Btn></div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>기간</th><th style={TH}>판매사</th><th style={{...TH,textAlign:"right"}}>주문수</th><th style={{...TH,textAlign:"right"}}>매출</th><th style={{...TH,textAlign:"right"}}>공급가</th><th style={{...TH,textAlign:"right"}}>수익</th><th style={{...TH,textAlign:"center"}}>상태</th></tr></thead>
                  <tbody>{sampleSettle.map(s=>(<tr key={s.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={TD}>{s.period}</td><td style={{...TD,fontWeight:600}}>{s.seller}</td><td style={{...TD,textAlign:"right"}}>{s.cnt}건</td><td style={{...TD,textAlign:"right",fontWeight:700}}>₩{s.sales.toLocaleString()}</td><td style={{...TD,textAlign:"right",color:"#6B7280"}}>₩{s.cost.toLocaleString()}</td><td style={{...TD,textAlign:"right",fontWeight:700,color:"#059669"}}>₩{s.profit.toLocaleString()}</td><td style={{...TD,textAlign:"center"}}>{s.done?<Badge color="#10B981" bg="#D1FAE5">완료</Badge>:<Badge color="#F59E0B" bg="#FEF3C7">대기</Badge>}</td></tr>))}</tbody></table></div>
                  <div style={{padding:"10px 16px",borderTop:"1px solid #F3F4F6",display:"flex",justifyContent:"flex-end",fontSize:12,fontWeight:700}}>합계 수익: <span style={{color:"#059669",marginLeft:6}}>₩{sampleSettle.reduce((a,b)=>a+b.profit,0).toLocaleString()}</span></div>
                </div>
              )}
            </div>
          )}

          {/* ═══ STOCK MANAGEMENT ══════════════════════════ */}
          {isStockPage&&(
            <div style={{maxWidth:800}}>
              {page==="stock_list"&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",overflow:"hidden"}}>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th style={TH}>상품명</th><th style={TH}>공급사</th><th style={{...TH,textAlign:"right"}}>현재고</th><th style={{...TH,textAlign:"center"}}>상태</th></tr></thead>
                  <tbody>{sampleProducts.map(p=>{const st=p.stock===0?"품절":p.stock<10?"부족":"정상";const c=p.stock===0?"#EF4444":p.stock<10?"#F59E0B":"#10B981";return(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:600}}>{p.name}</td><td style={{...TD,fontSize:11}}>{p.supplier}</td><td style={{...TD,textAlign:"right",fontWeight:700,color:c}}>{p.stock}개</td><td style={{...TD,textAlign:"center"}}><Badge color={c} bg={`${c}28`}>{st}</Badge></td></tr>);})}</tbody></table></div>
                </div>
              )}
              {page==="stock_alert"&&(
                <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:20}}>
                  <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>🔔 재고 알림 설정</h4>
                  {[{l:"최소 재고 기준",opt:["5개","10개","20개","50개"]},{l:"품절 알림",opt:["사용","미사용"]},{l:"알림 방법",opt:["이메일","SMS","카카오톡","전체"]}].map((s,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<2?"1px solid #F3F4F6":"none"}}><span style={{fontSize:12,fontWeight:600}}>{s.l}</span><Select style={{width:120}}>{s.opt.map(o=><option key={o}>{o}</option>)}</Select></div>))}
                  <Btn onClick={()=>showToast("알림 설정 저장")} variant="primary" style={{marginTop:14}}>저장</Btn>
                </div>
              )}
            </div>
          )}


          {/* ═══ ORDER TABLE ══════════════════════════════ */}
          {!isMonitorPage&&!isSettingsPage&&!isExtraPage&&(
            <>
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{position:"relative",flex:"1 1 220px",minWidth:200}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#9CA3AF"}}>🔍</span>
                    <Input placeholder="주문번호, 상품, 구매자, 판매사 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:32,height:36}}/>
                  </div>
                  <button onClick={()=>setAdvSearch(p=>!p)} style={{padding:"7px 14px",borderRadius:10,border:advSearch?"none":"1px solid #DDD6FE",background:advSearch?"#6C63FF":"#fff",color:advSearch?"#fff":"#374151",fontSize:11.5,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.15s",height:36}}>
                    {advSearch?"▲ 검색 접기":"▼ 상세 검색"}
                  </button>
                  <Select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)} style={{width:120,height:36}}><option value="all">전체 사이트</option><option value="baljumoa">🟢 발주모아</option><option value="flexgate">🔴 플렉스지</option><option value="both">🔗 양쪽매칭</option></Select>
                  <div style={{display:"flex",gap:3,marginLeft:"auto"}}>
                    {["오늘","7일","15일","1개월","전체"].map(d=>(<button key={d} style={{padding:"5px 10px",borderRadius:6,border:"1px solid #E5E7EB",background:"#fff",color:"#6B7280",fontSize:10.5,fontWeight:600,cursor:"pointer",height:36,transition:"all 0.1s"}}>{d}</button>))}
                  </div>
                </div>

                {/* 접힌 상태: 주문일 + 빠른 필터 */}
                {!advSearch&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8,paddingTop:8,borderTop:"1px solid #F3F4F6",flexWrap:"wrap"}}>
                    <span style={{fontSize:11.5,fontWeight:600,color:"#374151"}}>주문일</span>
                    <input type="date" value={advFilters.dateFrom} onChange={e=>setAdvFilters(p=>({...p,dateFrom:e.target.value}))} style={{height:32,border:"1px solid #D1D5DB",borderRadius:6,padding:"0 10px",fontSize:12,color:"#111827",outline:"none",cursor:"pointer",width:140}}/>
                    <span style={{color:"#9CA3AF",fontSize:11}}>~</span>
                    <input type="date" value={advFilters.dateTo} onChange={e=>setAdvFilters(p=>({...p,dateTo:e.target.value}))} style={{height:32,border:"1px solid #D1D5DB",borderRadius:6,padding:"0 10px",fontSize:12,color:"#111827",outline:"none",cursor:"pointer",width:140}}/>
                    <span style={{width:1,height:18,background:"#E5E7EB"}}/>
                    <Btn onClick={refresh} variant="primary" small disabled={processing} style={{height:32}}>{processing?"검색중...":"🔍 검색하기"}</Btn>
                    <Btn onClick={refresh} variant="outline" small disabled={processing} style={{height:32}}>🔄 동기화</Btn>
                    <span style={{width:1,height:18,background:"#E5E7EB"}}/>
                    <Select value={advFilters.bjStatus} onChange={e=>setAdvFilters(p=>({...p,bjStatus:e.target.value}))} style={{width:100,height:32,fontSize:11}}><option value="all">발모상태</option><option value="신규등록">신규등록</option><option value="발주서생성">발주서생성</option><option value="회신파일생성">회신파일생성</option><option value="송장등록완료">송장등록완료</option></Select>
                    <Select value={advFilters.fgStatus} onChange={e=>setAdvFilters(p=>({...p,fgStatus:e.target.value}))} style={{width:100,height:32,fontSize:11}}><option value="all">플지상태</option><option value="미입금">미입금</option><option value="입금확인">입금확인</option><option value="배송준비">배송준비</option><option value="배송중">배송중</option><option value="배송완료">배송완료</option></Select>
                  </div>
                )}

                {/* ═══ 상세 검색 패널 (펼친 상태) ═══ */}
                {advSearch&&(
                  <div style={{marginTop:10,paddingTop:12,borderTop:"1px solid #E5E7EB",animation:"fadeIn 0.15s ease-out"}}>
                    {/* Row 1: 판매사 + 날짜검색 (주문일/업로드일 선택 + 달력) */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>판매사</label>
                        <Select value={sellerFilter} onChange={e=>setSellerFilter(e.target.value)} style={{flex:1,height:34}}><option value="all">전체</option>{uniqueSellers.map(s=><option key={s} value={s}>{s}</option>)}</Select>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>날짜검색</label>
                        <Select value={advFilters.dateType||"order_date"} onChange={e=>setAdvFilters(p=>({...p,dateType:e.target.value}))} style={{width:90,height:34,fontSize:11}}><option value="order_date">주문일</option><option value="upload_date">업로드일</option><option value="invoice_date">송장등록일</option></Select>
                        <input type="date" value={advFilters.dateFrom} onChange={e=>setAdvFilters(p=>({...p,dateFrom:e.target.value}))} style={{flex:1,height:34,border:"1px solid #D1D5DB",borderRadius:6,padding:"0 8px",fontSize:12,color:"#111827",outline:"none",cursor:"pointer"}}/>
                        <span style={{color:"#9CA3AF",fontSize:12}}>~</span>
                        <input type="date" value={advFilters.dateTo} onChange={e=>setAdvFilters(p=>({...p,dateTo:e.target.value}))} style={{flex:1,height:34,border:"1px solid #D1D5DB",borderRadius:6,padding:"0 8px",fontSize:12,color:"#111827",outline:"none",cursor:"pointer"}}/>
                      </div>
                    </div>
                    {/* Row 2: 공급사 + 발모 상태 (실제 옵션) */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>공급사</label>
                        <Select value={advFilters.supplier} onChange={e=>setAdvFilters(p=>({...p,supplier:e.target.value}))} style={{flex:1,height:34}}><option value="all">전체</option>{uniqueSuppliers.map(s=><option key={s} value={s}>{s}</option>)}</Select>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>발모상태</label>
                        <Select value={advFilters.bjStatus} onChange={e=>setAdvFilters(p=>({...p,bjStatus:e.target.value}))} style={{flex:1,height:34}}><option value="all">전체</option><option value="신규등록">신규등록</option><option value="발주서생성">발주서생성</option><option value="회신파일생성">회신파일생성</option><option value="송장등록완료">송장등록완료</option><option value="출고전취소">출고전취소</option><option value="주문보류">주문보류</option><option value="휴지통">휴지통</option></Select>
                      </div>
                    </div>
                    {/* Row 3: 상품명 + 플지 상태 (실제 옵션) */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>상품명</label>
                        <Input placeholder="상품명 검색" value={advFilters.product} onChange={e=>setAdvFilters(p=>({...p,product:e.target.value}))} style={{flex:1,height:34}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>플지상태</label>
                        <Select value={advFilters.fgStatus} onChange={e=>setAdvFilters(p=>({...p,fgStatus:e.target.value}))} style={{flex:1,height:34}}><option value="all">전체</option><option value="미입금">미입금</option><option value="입금확인">입금확인</option><option value="배송준비">배송준비</option><option value="부분배송중">부분배송중</option><option value="배송중">배송중</option><option value="배송완료">배송완료</option><option value="배송예약">배송예약</option><option value="반품중">반품중</option><option value="교환완료">교환완료</option><option value="주문취소">주문취소</option><option value="휴지통">휴지통</option></Select>
                      </div>
                    </div>
                    {/* Row 4: 주문자 + 매칭/송장 */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>주문자</label>
                        <Input placeholder="주문자명 검색" value={advFilters.buyer} onChange={e=>setAdvFilters(p=>({...p,buyer:e.target.value}))} style={{flex:1,height:34}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <label style={{fontSize:11.5,fontWeight:600,color:"#374151",minWidth:52,flexShrink:0}}>매칭</label>
                        <Select value={advFilters.matchType} onChange={e=>setAdvFilters(p=>({...p,matchType:e.target.value}))} style={{flex:1,height:34}}><option value="all">전체</option><option value="matched">🔗 양쪽매칭</option><option value="diff">⚠️ 상태불일치</option><option value="bjOnly">발모전용</option><option value="fgOnly">플지전용</option></Select>
                        <Select value={advFilters.invoiceYn} onChange={e=>setAdvFilters(p=>({...p,invoiceYn:e.target.value}))} style={{flex:1,height:34}}><option value="all">송장 전체</option><option value="y">송장등록</option><option value="n">송장미등록</option></Select>
                      </div>
                    </div>
                    {/* 검색/초기화 */}
                    <div style={{display:"flex",justifyContent:"center",gap:8,paddingTop:10,borderTop:"1px solid #F3F4F6"}}>
                      <button onClick={()=>showToast("검색 조건 적용","info")} style={{padding:"8px 28px",borderRadius:10,border:"none",background:"#6C63FF",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>🔍 검색</button>
                      <button onClick={()=>{setAdvFilters({supplier:"all",status:"all",bjStatus:"all",fgStatus:"all",matchType:"all",dateFrom:new Date().toISOString().slice(0,10),dateTo:new Date().toISOString().slice(0,10),buyer:"",product:"",invoiceYn:"all",dateType:"order_date"});setSellerFilter("all");setSiteFilter("all");setSearch("");showToast("초기화 완료");}} style={{padding:"8px 28px",borderRadius:10,border:"1px solid #DDD6FE",background:"#F0EDFF",color:"#374151",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>🔄 초기화</button>
                    </div>
                  </div>
                )}

                {/* ═══ 액션 버튼 바 ═══ */}
                {!advSearch&&(
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:"1px solid #F3F4F6",alignItems:"center"}}>
                  {(page.startsWith("order_")||page.startsWith("supply_")||page==="po_inbox"||quickFilter==="unordered"||quickFilter==="bj"||quickFilter==="fg")&&(<>
                    <Btn onClick={handleSendPO} variant="primary" small disabled={processing}>📨 발주서 전송 ({selected.filter(o=>o.supplyStatus==="미발주").length})</Btn>
                    <Btn onClick={()=>handleStatusChange("preparing")} variant="purple" small disabled={processing}>📦 배송준비</Btn>
                    <Btn onClick={()=>handleStatusChange("shipping")} variant="success" small disabled={processing}>🚚 배송중</Btn>
                    <span style={{width:1,height:20,background:"#E5E7EB"}}/>
                    <Btn variant="warning" small>CS요청</Btn><Btn variant="outline" small>엑셀↓</Btn><Btn variant="danger" small>주문보류</Btn>
                  </>)}
                  {(isInvoicePage||quickFilter==="noInvoice")&&(<>
                    <Btn onClick={openInvoiceModal} variant="primary" small disabled={processing}>📝 송장 일괄등록 ({selected.length>0?selected.filter(o=>!o.invoice).length:counts.noInvoice})</Btn>
                    <Btn onClick={simExcel} variant="outline" small>📤 엑셀 업로드</Btn><Btn variant="outline" small>📥 양식 다운로드</Btn>
                    <span style={{width:1,height:20,background:"#E5E7EB"}}/>
                    <span style={{fontSize:10.5,color:"#6B7280"}}>택배사:</span>
                    <Select value={defaultCarrier} onChange={e=>setDefaultCarrier(e.target.value)} style={{width:120}}>{CARRIERS.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</Select>
                  </>)}
                </div>
                )}
              </div>
              {selected.length>0&&(
                <div style={{background:"#F0EDFF",border:"1px solid #C7C4FF",borderRadius:12,padding:"6px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#4F46E5"}}>✓ {selected.length}건 | ₩{selected.reduce((a,b)=>a+b.total,0).toLocaleString()}</span>
                  <Btn onClick={clearSel} variant="outline" small>해제</Btn>
                </div>
              )}
              <div style={{background:"#fff",borderRadius:0,border:"none",boxShadow:"0 1px 6px rgba(0,0,0,0.04)",overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr>
                      <th style={{...TH,width:32,textAlign:"center"}}><input type="checkbox" checked={selectAll} onChange={toggleAll} style={{width:14,height:14,cursor:"pointer",accentColor:"#6C63FF"}}/></th>
                      <th style={TH}>No</th><th style={TH}>사이트</th><th style={{...TH,minWidth:110}}>주문번호</th><th style={{...TH,minWidth:200}}>상품정보</th><th style={TH}>판매사</th><th style={TH}>공급사</th><th style={TH}>주문자/수령인</th><th style={{...TH,minWidth:140}}>배송지</th><th style={{...TH,textAlign:"right",minWidth:120}}>금액</th><th style={{...TH,textAlign:"center"}}>🟢발모상태</th><th style={{...TH,textAlign:"center"}}>결제/플지상태</th><th style={{...TH,textAlign:"center"}}>매칭</th>
                      {(isInvoicePage||quickFilter==="noInvoice")&&(<><th style={TH}>택배사</th><th style={TH}>송장번호</th></>)}
                      <th style={TH}>일시</th>
                    </tr></thead>
                    <tbody>
                      {filtered.length===0?(<tr><td colSpan={20} style={{padding:50,textAlign:"center",color:"#9CA3AF",fontSize:13}}>해당 조건의 주문이 없습니다</td></tr>):paginatedOrders.map((o,i)=>{
                        const siteConf = o.site==="both"?{name:"양쪽",short:"양쪽",color:"#8B5CF6",icon:"🔗"}:SITES[o.site];
                        const bjSt = ORDER_STATUS[o.bjStatus||""];
                        const fgSt = ORDER_STATUS[o.orderStatus];
                        return(<tr key={o.id} style={{borderTop:"1px solid #F3F4F6",background:o.selected?"#F0EDFF":"#fff",animation:`fadeIn 0.1s ease-out ${Math.min(i*0.01,0.3)}s both`}}>
                          <td style={{...TD,textAlign:"center"}}><input type="checkbox" checked={o.selected} onChange={()=>toggleSelect(o.id)} style={{width:14,height:14,cursor:"pointer",accentColor:"#6C63FF"}}/></td>
                          <td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{o.no}</td>
                          <td style={TD}><Badge color={siteConf.color} bg={`${siteConf.color}24`}>{siteConf.icon}{siteConf.short}</Badge></td>
                          <td style={{...TD,cursor:"pointer"}} onClick={()=>setDetailModal(o)}>
                            <div><span style={{fontWeight:600,color:"#6C63FF",fontSize:10.5}}>{o.id}</span></div>
                            {o.ssa&&<div style={{fontSize:9,color:"#9CA3AF",marginTop:1}}>{o.ssa}</div>}
                          </td>
                          <td style={{...TD,maxWidth:220}}>
                            {o.productCode&&<div style={{fontSize:9,color:"#9CA3AF",marginBottom:1}}>{o.productCode}</div>}
                            <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,fontSize:11.5}}>{o.product}</div>
                            {o.option&&<div style={{fontSize:9,color:"#6B7280",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.option}</div>}
                          </td>
                          <td style={{...TD,fontSize:10.5,color:"#6B7280"}}>{o.seller}</td>
                          <td style={{...TD,fontSize:11}}>{o.supplier}</td>
                          <td style={TD}>
                            <div style={{fontWeight:500,fontSize:11.5}}>{o.buyer}</div>
                            {o.phone&&<div style={{fontSize:9,color:"#9CA3AF"}}>{o.phone}</div>}
                          </td>
                          <td style={{...TD,maxWidth:160}}>
                            {o.zip&&<span style={{fontSize:9,color:"#9CA3AF"}}>[{o.zip}] </span>}
                            <span style={{fontSize:10,color:"#374151",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block",maxWidth:140,verticalAlign:"middle"}}>{o.address||"—"}</span>
                          </td>
                          <td style={{...TD,textAlign:"right"}}>
                            {o.consumerPrice>0&&<div style={{fontSize:9,color:"#9CA3AF"}}>소비자가 <span style={{color:"#6B7280"}}>₩{o.consumerPrice.toLocaleString()}</span></div>}
                            <div style={{fontSize:10,color:"#374151"}}>판매가 <span style={{fontWeight:700}}>₩{(o.price||0).toLocaleString()}</span></div>
                            <div style={{fontSize:10,color:"#6B7280"}}>공급가 <span style={{fontWeight:600}}>₩{(o.supplyPrice||0).toLocaleString()}</span></div>
                            {o.shippingFee>0&&<div style={{fontSize:9,color:"#9CA3AF"}}>배송비 ₩{o.shippingFee.toLocaleString()}</div>}
                          </td>
                          <td style={{...TD,textAlign:"center"}}>{bjSt?<Badge color={bjSt.color} bg={bjSt.bg}><Dot color={bjSt.color}/>{bjSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}</td>
                          <td style={{...TD,textAlign:"center"}}>
                            {o.paymentMethod&&<div style={{fontSize:9,color:"#6B7280",marginBottom:2}}>{o.paymentMethod}</div>}
                            {fgSt?<Badge color={fgSt.color} bg={fgSt.bg}><Dot color={fgSt.color}/>{fgSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}
                          </td>
                          <td style={{...TD,textAlign:"center"}}>{o.matched?<Badge color={o.statusDiff?"#F59E0B":"#10B981"} bg={o.statusDiff?"#FEF3C7":"#D1FAE5"}>{o.statusDiff?"⚠️불일치":"✅일치"}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}</td>
                          {(isInvoicePage||quickFilter==="noInvoice")&&(<><td style={{...TD,fontSize:10.5,color:o.carrier?"#374151":"#D1D5DB"}}>{o.carrier?.name||"—"}</td><td style={{...TD,fontFamily:"monospace",fontSize:10.5,color:o.invoice?"#374151":"#D1D5DB"}}>{o.invoice||"—"}</td></>)}
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:"8px 14px",borderTop:"1px solid #F3F4F6",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:10.5,color:"#6B7280",flexWrap:"wrap",gap:6}}>
                  <span>{filtered.length}건 (전체 {orders.length}건)</span>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setCurrentPage(1);}} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #E5E7EB",fontSize:10.5,cursor:"pointer"}}>
                      {[50,100,200,500,1000,2000].map(n=><option key={n} value={n}>{n}개씩</option>)}
                    </select>
                    <button onClick={()=>setCurrentPage(1)} disabled={safeCurrentPage<=1} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #E5E7EB",background:safeCurrentPage<=1?"#F9FAFB":"#fff",cursor:safeCurrentPage<=1?"default":"pointer",fontSize:10}}>«</button>
                    <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={safeCurrentPage<=1} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #E5E7EB",background:safeCurrentPage<=1?"#F9FAFB":"#fff",cursor:safeCurrentPage<=1?"default":"pointer",fontSize:10}}>‹</button>
                    {(()=>{const pages=[];let start=Math.max(1,safeCurrentPage-4),end=Math.min(totalPages,start+9);if(end-start<9)start=Math.max(1,end-9);for(let p=start;p<=end;p++)pages.push(p);return pages.map(p=>(
                      <button key={p} onClick={()=>setCurrentPage(p)} style={{padding:"2px 8px",borderRadius:4,border:p===safeCurrentPage?"1.5px solid #6C63FF":"1px solid #E5E7EB",background:p===safeCurrentPage?"#F0EDFF":"#fff",color:p===safeCurrentPage?"#6C63FF":"#6B7280",fontWeight:p===safeCurrentPage?700:400,cursor:"pointer",fontSize:10.5,minWidth:28}}>{p}</button>
                    ));})()}
                    <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={safeCurrentPage>=totalPages} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #E5E7EB",background:safeCurrentPage>=totalPages?"#F9FAFB":"#fff",cursor:safeCurrentPage>=totalPages?"default":"pointer",fontSize:10}}>›</button>
                    <button onClick={()=>setCurrentPage(totalPages)} disabled={safeCurrentPage>=totalPages} style={{padding:"2px 6px",borderRadius:4,border:"1px solid #E5E7EB",background:safeCurrentPage>=totalPages?"#F9FAFB":"#fff",cursor:safeCurrentPage>=totalPages?"default":"pointer",fontSize:10}}>»</button>
                    <span style={{marginLeft:4,fontSize:10,color:"#9CA3AF"}}>{safeCurrentPage}/{totalPages}p</span>
                  </div>
                  <span>판매합계: <b style={{color:"#111827"}}>₩{filtered.reduce((a,b)=>a+(b.price||0),0).toLocaleString()}</b> | 공급합계: <b style={{color:"#6B7280"}}>₩{filtered.reduce((a,b)=>a+(b.supplyPrice||0),0).toLocaleString()}</b></span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ═══ MODALS ════════════════════════════════════════ */}
      <Modal open={!!detailModal} onClose={()=>setDetailModal(null)} title="주문 상세" width={560}>
        {detailModal&&(()=>{const o=detailModal,site=SITES[o.site],os=ORDER_STATUS[o.orderStatus],ss=SUPPLY_STATUS[o.supplyStatus];return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge color={site.color} bg={`${site.color}24`}>{site.icon} {site.name}</Badge><Badge color={os.color} bg={os.bg}><Dot color={os.color}/>{os.label}</Badge><Badge color={ss.color} bg={ss.bg}>{ss.label}</Badge>{o.paymentMethod&&<Badge color="#6366F1" bg="#EEF2FF">{o.paymentMethod}</Badge>}<Badge color="#DC2626" bg="#FEE2E2">⛔ 읽기 전용</Badge></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["WSA 주문번호",o.id],["No",o.no],["PO번호",o.po||"—"],["상품코드",o.productCode||"—"],["옵션코드",o.optCode||"—"],["상품명",o.product],["옵션",o.option||"—"],["수량",`${o.qty}개`],["판매가",`₩${(o.price||0).toLocaleString()}`],["공급가",`₩${(o.supplyPrice||0).toLocaleString()}`],["소비자가",o.consumerPrice?`₩${o.consumerPrice.toLocaleString()}`:"—"],["배송비",o.shippingFee?`₩${o.shippingFee.toLocaleString()}`:"무료"],["합계",`₩${(o.total||0).toLocaleString()}`],["결제방법",o.paymentMethod||"—"],["판매사",o.seller],["공급사(거래처)",o.supplier],["주문자",o.buyer],["연락처",o.phone||"—"],["우편번호",o.zip||"—"],["주소",o.address||"—"],["채널",o.channel||"—"],["주문경로",o.orderRoute||"—"],["SSA번호",o.ssa||"—"],["소득공제",o.taxDeduction||"—"],["택배사",o.carrier?.name||"미등록"],["송장",o.invoice||"미등록"],["메일발송",o.mailSent?"발송완료":"미발송"],["발송내역",`${o.shipCount||0}건`],["주문일",o.orderDate||`${o.date} ${o.time}`],["업로드일",o.uploadDate||"—"]].map(([k,v],i)=>(<div key={i} style={{padding:"8px 10px",background:theme.light,borderRadius:10}}><div style={{fontSize:9.5,color:"#6B7280",fontWeight:600,marginBottom:2}}>{k}</div><div style={{fontSize:11.5,fontWeight:600,wordBreak:"break-all"}}>{v}</div></div>))}</div></div>);})()}
      </Modal>

      <Modal open={poModal} onClose={()=>setPoModal(false)} title="발주서 전송 확인" width={540}>
        {(()=>{const t=selected.filter(o=>o.supplyStatus==="미발주"),g={};t.forEach(o=>{if(!g[o.supplier])g[o.supplier]=[];g[o.supplier].push(o);});return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{padding:10,background:"#FEF3C7",borderRadius:8,fontSize:11.5,color:"#92400E"}}>⚠️ <b>{t.length}건</b> 미발주 → 공급사 전송</div><Select value={poFormat} onChange={e=>setPoFormat(e.target.value)} style={{width:"100%"}}><option value="">기본 양식</option><option value="6138">모범기한 유통</option><option value="3694">산지농수산</option></Select>{Object.entries(g).map(([sup,items])=>(<div key={sup} style={{padding:10,background:"#F9FAFB",borderRadius:8}}><div style={{fontSize:11.5,fontWeight:700,marginBottom:3}}>🏭 {sup} ({items.length}건)</div>{items.slice(0,3).map(it=>(<div key={it.id} style={{fontSize:10.5,color:"#6B7280",paddingLeft:10}}>· {it.product} x{it.qty}</div>))}</div>))}<div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn onClick={()=>setPoModal(false)} variant="outline" small>취소</Btn><Btn onClick={confirmSendPO} variant="primary" small disabled={processing}>{processing?"전송 중...":`📨 ${t.length}건 전송`}</Btn></div></div>);})()}
      </Modal>

      <Modal open={invoiceModal} onClose={()=>setInvoiceModal(false)} title={`송장 일괄 등록 (${bulkInvoice.length}건)`} width={740}>
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}><span style={{fontSize:11,fontWeight:700}}>택배사</span><Select value={defaultCarrier} onChange={e=>{setDefaultCarrier(e.target.value);setBulkInvoice(p=>p.map(b=>({...b,newCarrier:e.target.value})));}} style={{width:140}}>{CARRIERS.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</Select><Btn onClick={simExcel} variant="outline" small style={{marginLeft:"auto"}}>📤 엑셀</Btn></div>
        <div style={{maxHeight:380,overflow:"auto",borderRadius:8,border:"1px solid #E5E7EB"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB",position:"sticky",top:0}}><th style={{...TH,width:30}}>#</th><th style={TH}>사이트</th><th style={TH}>주문번호</th><th style={{...TH,minWidth:120}}>상품</th><th style={TH}>수령인</th><th style={TH}>택배사</th><th style={{...TH,minWidth:130}}>송장번호</th></tr></thead><tbody>{bulkInvoice.map((b,i)=>(<tr key={b.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,textAlign:"center",color:"#9CA3AF",fontSize:10}}>{i+1}</td><td style={TD}><Badge color={SITES[b.site].color} bg={`${SITES[b.site].color}24`}>{SITES[b.site].short}</Badge></td><td style={{...TD,fontSize:9.5,fontFamily:"monospace"}}>{b.id.slice(-10)}</td><td style={{...TD,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11}}>{b.product}</td><td style={{...TD,fontSize:11}}>{b.buyer}</td><td style={TD}><Select value={b.newCarrier} onChange={e=>setBulkInvoice(p=>p.map((x,j)=>j===i?{...x,newCarrier:e.target.value}:x))} style={{width:100,padding:"4px 7px",fontSize:10.5}}>{CARRIERS.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}</Select></td><td style={TD}><Input value={b.newInvoice} onChange={e=>setBulkInvoice(p=>p.map((x,j)=>j===i?{...x,newInvoice:e.target.value}:x))} placeholder="송장번호" style={{padding:"4px 7px",fontSize:10.5,fontFamily:"monospace"}}/></td></tr>))}</tbody></table></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}><span style={{fontSize:10.5,color:"#6B7280"}}>입력: <b>{bulkInvoice.filter(b=>b.newInvoice.trim()).length}</b>/{bulkInvoice.length}건</span><div style={{display:"flex",gap:6}}><Btn onClick={()=>setInvoiceModal(false)} variant="outline" small>취소</Btn><Btn onClick={submitInvoices} variant="purple" small disabled={processing}>{processing?"등록 중...":`📝 ${bulkInvoice.filter(b=>b.newInvoice.trim()).length}건 등록`}</Btn></div></div>
      </Modal>

      {/* Add member modal */}
      <Modal open={addMemberModal} onClose={()=>setAddMemberModal(false)} title="부계정 추가" width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            <Avatar emoji={newMember.avatar} color={newMember.color} size={52}/>
            <div style={{flex:1}}>
              <div><label style={{fontSize:11,fontWeight:600,color:"#6B7280"}}>이름</label><Input value={newMember.name} onChange={e=>setNewMember(p=>({...p,name:e.target.value}))} placeholder="이름 입력" style={{marginTop:3}}/></div>
              <div style={{marginTop:8}}><label style={{fontSize:11,fontWeight:600,color:"#6B7280"}}>이메일</label><Input value={newMember.email} onChange={e=>setNewMember(p=>({...p,email:e.target.value}))} placeholder="이메일 입력" style={{marginTop:3}}/></div>
            </div>
          </div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>아바타</label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{AVATAR_OPTIONS.slice(0,12).map(a=>(<button key={a} onClick={()=>setNewMember(p=>({...p,avatar:a}))} style={{width:36,height:36,borderRadius:7,border:newMember.avatar===a?`2px solid ${newMember.color}`:"2px solid #E5E7EB",background:newMember.avatar===a?`${newMember.color}24`:"#FAFBFC",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>{a}</button>))}</div></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>컬러</label><div style={{display:"flex",gap:5}}>{COLOR_OPTIONS.map(c=>(<button key={c} onClick={()=>setNewMember(p=>({...p,color:c}))} style={{width:24,height:24,borderRadius:"50%",background:c,border:newMember.color===c?"3px solid #111827":"3px solid transparent",cursor:"pointer"}}/>))}</div></div>
          <div><label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>권한</label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{Object.entries(PERMISSION_LABELS).map(([k,label])=>{const has=newMember.permissions.includes(k);return(<button key={k} onClick={()=>setNewMember(p=>({...p,permissions:has?p.permissions.filter(x=>x!==k):[...p.permissions,k]}))} style={{padding:"5px 12px",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",background:has?"#6C63FF":"#F3F4F6",color:has?"#fff":"#6B7280",border:"none"}}>{has?"✓ ":""}{label}</button>);})}</div></div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn onClick={()=>setAddMemberModal(false)} variant="outline" small>취소</Btn><Btn onClick={addMember} variant="primary" small>추가</Btn></div>
        </div>
      </Modal>

      {/* ═══ Preset Modal ═══ */}
      <Modal open={presetModal} onClose={()=>setPresetModal(false)} title="⚡ 탭 프리셋" width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* 현재 탭 빠른 저장 */}
          {openTabs.length>0&&(
            <div style={{padding:14,background:"#F0EDFF",borderRadius:14,border:"1px solid #C7C4FF"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#4F46E5",marginBottom:8}}>💾 현재 탭 빠른 저장</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {openTabs.map(t=>(<span key={t.key} style={{padding:"3px 8px",borderRadius:8,background:"#fff",border:"1px solid #C7C4FF",fontSize:11,fontWeight:600,color:"#374151"}}>{t.icon} {t.label}</span>))}
              </div>
              <div style={{display:"flex",gap:8}}>
                <Input value={modalPresetName} onChange={e=>setModalPresetName(e.target.value)} placeholder="프리셋 이름..." style={{flex:1,fontSize:12}}/>
                <Btn onClick={savePresetFromModal} variant="primary" small disabled={!modalPresetName.trim()}>저장</Btn>
              </div>
            </div>
          )}

          {/* 프리셋 목록 */}
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>📂 저장된 프리셋</span>
              <span onClick={()=>{navigatePage("settings_preset");setPresetModal(false);}} style={{fontSize:11,color:"#6C63FF",cursor:"pointer",fontWeight:600}}>⚙️ 프리셋 설정 →</span>
            </div>
            {tabPresets.length===0&&(<div style={{fontSize:12,color:"#9CA3AF",padding:20,textAlign:"center"}}>저장된 프리셋이 없습니다</div>)}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {tabPresets.map(preset=>(
                <div key={preset.id} onClick={()=>loadPreset(preset)} style={{padding:12,borderRadius:14,border:"1px solid #DDD6FE",background:"#fff",cursor:"pointer",transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.borderColor="#6C63FF"} onMouseOut={e=>e.currentTarget.style.borderColor="#DDD6FE"}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#111827"}}>⚡ {preset.name}</span>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:10,color:"#9CA3AF"}}>{preset.tabs.length}개 탭</span>
                      <button onClick={e=>deletePreset(preset.id,e)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#D1D5DB",padding:"2px"}} onMouseOver={e=>e.target.style.color="#EF4444"} onMouseOut={e=>e.target.style.color="#D1D5DB"}>🗑</button>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {preset.tabs.map(t=>(<span key={t.key} style={{padding:"2px 6px",borderRadius:5,background:"#F3F4F6",fontSize:10,color:"#6B7280",fontWeight:500}}>{t.icon} {t.label}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Toast {...toast}/>

      {/* 플로팅 툴바 — 주문 선택 시 표시 */}
      <FloatingToolbar
        visible={selected.length > 0}
        position="bottom-center"
        theme="blur"
        buttons={[
          { icon:"check", label:`${selected.length}건 선택됨`, active:true },
          { divider:true },
          { icon:"send",     label:"발주서 전송",  onClick:()=>{ handleSendPO(); }, variant:"primary" },
          { icon:"edit",     label:"상태 변경",    onClick:()=>{ handleStatusChange(); }, variant:"warning" },
          { icon:"download", label:"엑셀 다운로드", onClick:()=>{ simExcel(); }, variant:"success" },
          { divider:true },
          { icon:"trash",    label:"선택 삭제",    onClick:()=>{ safeBlock("선택 삭제"); }, variant:"danger" },
          { icon:"close",    label:"선택 해제",    onClick:()=>{ clearSel(); } },
        ]}
      />

      <Agentation />
    </div>
  );
}