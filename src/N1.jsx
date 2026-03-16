import { useState, useCallback, useRef } from "react";
import { Agentation } from "agentation";

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
  { id: 2, name: "김서연", role: "sub", avatar: "👩‍💻", color: "#EC4899", online: true, email: "sy@mobeom.com", permissions: ["order","supply","invoice"], lastActive: "2분 전" },
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
const COLOR_OPTIONS = ["#3B82F6","#EC4899","#F59E0B","#10B981","#8B5CF6","#EF4444","#06B6D4","#F97316","#6366F1","#14B8A6"];

const generateOrders = () => {
  // ═══ 02-24 실데이터: 발주모아 + 플렉스지 매칭 주문 (WSA 일치) ═══
  const matchedOrders = [
    {wsa:"WSA260224-00001145",bj:{no:"1038",buyer:"김현민",product:"꿀이 줄줄! 햇 호박 고구마",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"977",supplier:"늘해랑",status:"배송준비",carrier:"",invoice:"",price:19900}},
    {wsa:"WSA260224-00001143",bj:{no:"1037",buyer:"임판숙",product:"동해안 자연산 미주구리회 물가자미회",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"976",supplier:"울진유통",status:"입금확인",carrier:"",invoice:"",price:7900}},
    {wsa:"WSA260224-00001140",bj:{no:"1036",buyer:"장년순",product:"숙성묵은지 맛깔나게 드세요",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"롯데택배",invoice:"258793866015"},fg:{no:"975",supplier:"코리아푸드",status:"배송중",carrier:"롯데택배",invoice:"258793866015",price:32900}},
    {wsa:"WSA260224-00001139",bj:{no:"1035",buyer:"윤중도",product:"[무료배송] 시원하고 아삭한 햇월동무 동치미!",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"974",supplier:"천사물산",status:"배송준비",carrier:"",invoice:"",price:15900}},
    {wsa:"WSA260224-00001138",bj:{no:"1034",buyer:"똥굥티비",product:"홀라당 벗겨지는 칼집약단밤",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"롯데택배",invoice:""},fg:{no:"973",supplier:"황금약단밤",status:"배송중",carrier:"롯데택배",invoice:"266348520987",price:24800}},
    {wsa:"WSA260224-00001137",bj:{no:"1033",buyer:"정은정",product:"맛과 영양이 좋은 못난이표고버섯",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"972",supplier:"등대식품",status:"배송중",carrier:"CJ대한통운",invoice:"640123456789",price:17900}},
    {wsa:"WSA260224-00001136",bj:{no:"1032",buyer:"이은주",product:"자연이 만든 대저 완숙 찰토마토",seller:"모범기한(플랙스지)",status:"발주서생성",carrier:"",invoice:""},fg:{no:"971",supplier:"해담별",status:"배송준비",carrier:"",invoice:"",price:29900}},
    {wsa:"WSA260224-00001135",bj:{no:"1031",buyer:"이은주",product:"아삭달큰 못난이당근 3kg",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"970",supplier:"해담별",status:"배송준비",carrier:"",invoice:"",price:8900}},
    {wsa:"WSA260224-00001134",bj:{no:"1030",buyer:"신혜숙",product:"햇살듬뿍받은 프리미엄 타이벡감귤",seller:"모범기한(플랙스지)",status:"발주서생성",carrier:"",invoice:""},fg:{no:"969",supplier:"(주)마니팜",status:"배송준비",carrier:"",invoice:"",price:14900}},
    {wsa:"WSA260224-00001133",bj:{no:"1029",buyer:"이성란",product:"2천원대 새꼬막?! 한정수량 나갑니다",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"968",supplier:"모두에프엔비",status:"배송중",carrier:"CJ대한통운",invoice:"640987654321",price:12900}},
    {wsa:"WSA260224-00001131",bj:{no:"1028",buyer:"박영숙",product:"제주 감귤 5kg 선물세트",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"",invoice:""},fg:{no:"967",supplier:"(주)마니팜",status:"배송준비",carrier:"",invoice:"",price:22900}},
    {wsa:"WSA260224-00001130",bj:{no:"1027",buyer:"김순옥",product:"달콤한 꿀고구마 3kg",seller:"모범기한(플랙스지)",status:"회신파일생성",carrier:"CJ대한통운",invoice:""},fg:{no:"966",supplier:"늘해랑",status:"배송준비",carrier:"",invoice:"",price:14900}},
    {wsa:"WSA260224-00001129",bj:{no:"1026",buyer:"홍길동",product:"프리미엄 한우 불고기 500g",seller:"모범기한(플랙스지)",status:"발주서생성",carrier:"",invoice:""},fg:{no:"965",supplier:"아엠푸드",status:"배송준비",carrier:"",invoice:"",price:35900}},
    {wsa:"WSA260224-00001115",bj:{no:"962",buyer:"김영환",product:"동해안 자연산 미주구리회 물가자미회",seller:"모범기한(플랙스지)",status:"발주서생성",carrier:"",invoice:""},fg:{no:"964",supplier:"울진유통",status:"배송준비",carrier:"",invoice:"",price:15800}},
  ];

  // ═══ 발주모아 전용 (테무 채널 - 플렉스지에 없음) ═══
  const bjOnly = [
    {no:"103706",wsa:"WSA260224-000000980",buyer:"김종배",phone:"010-7273-2369",product:"(테무)당일제조, 식사대용 수제 영양떡",seller:"모범기한(테무)",status:"발주서생성",qty:2,supPrice:34800},
    {no:"103705",wsa:"WSA260224-000000979",buyer:"서영미",phone:"010-3813-4523",product:"(테무)[무설탕] 대추90%함량 대추고",seller:"모범기한(테무)",status:"발주서생성",qty:2,supPrice:19600},
    {no:"103704",wsa:"WSA260224-000000978",buyer:"안윤남",phone:"010-3833-1812",product:"(테무)당일제조, 식사대용 수제 영양떡",seller:"모범기한(테무)",status:"발주서생성",qty:3,supPrice:52200},
    {no:"103703",wsa:"WSA260224-000000977",buyer:"김정옥",phone:"010-2725-6711",product:"(테무) 통영 자연산 바다 대장어",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:26900},
    {no:"103702",wsa:"WSA260224-000000976",buyer:"임현수",phone:"010-3223-2581",product:"(테무)당일제조, 식사대용 수제 영양떡",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:17400},
    {no:"103701",wsa:"WSA260224-000000975",buyer:"도한정",phone:"010-6480-4252",product:"(테무) 통영 자연산 바다 대장어",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:26900},
    {no:"103700",wsa:"WSA260224-000000974",buyer:"장영석",phone:"010-5418-3049",product:"(테무) 100% 한우 사골 도가니탕",seller:"모범기한(테무)",status:"발주서생성",qty:2,supPrice:26000},
    {no:"103699",wsa:"WSA260224-000000973",buyer:"정해영",phone:"010-2317-0552",product:"(테무) 통영 자연산 바다 대장어",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:26900},
    {no:"103698",wsa:"WSA260224-000000972",buyer:"윤진숙",phone:"010-3388-1430",product:"(테무)[무설탕] 대추90%함량 대추고",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:9800},
    {no:"103697",wsa:"WSA260224-000000971",buyer:"고상순",phone:"010-6324-1167",product:"(테무)당일제조, 식사대용 수제 영양떡",seller:"모범기한(테무)",status:"발주서생성",qty:1,supPrice:17400},
  ];

  // ═══ 플렉스지 전용 (발주모아에 없는 주문) ═══
  const fgOnly = [
    {no:"138555",wsa:"WSA260224-00000474",buyer:"강혜영",phone:"010-3470-4574",product:"당도높은 새콤달콤 서귀포 감귤",supplier:"(주)마니팜",supPrice:14900,status:"미입금"},
    {no:"138554",wsa:"WSA260224-00000473",buyer:"정종문",phone:"010-3032-3663",product:"당도높은 새콤달콤 서귀포 감귤",supplier:"(주)마니팜",supPrice:11900,status:"미입금"},
    {no:"138553",wsa:"WSA260224-00000471",buyer:"김경자",phone:"010-7131-2238",product:"[한정특가]제주 정품 구좌당근 백모래당근",supplier:"해담별",supPrice:14900,status:"입금확인"},
    {no:"138552",wsa:"WSA260224-00000470",buyer:"박도희",phone:"010-9630-3547",product:"[초특가] 새콤달콤 제주 노지한라봉",supplier:"해담별",supPrice:13900,status:"입금확인"},
    {no:"138551",wsa:"WSA260224-00000469",buyer:"손일근",phone:"010-9346-1960",product:"동해안 자연산 미주구리회 물가자미회",supplier:"울진유통",supPrice:35900,status:"미입금"},
    {no:"138550",wsa:"WSA260224-00000468",buyer:"임현자",phone:"010-9511-3679",product:"당도높은 새콤달콤 서귀포 감귤",supplier:"(주)마니팜",supPrice:23800,status:"미입금"},
    {no:"138549",wsa:"WSA260224-00000467",buyer:"정극주",phone:"010-6878-0462",product:"건강을 지키는 진한 생강청",supplier:"영성",supPrice:12900,status:"입금확인"},
    {no:"138548",wsa:"WSA260224-00000466",buyer:"허경옥",phone:"010-9080-1501",product:"안동 가정용 타이벡부사 5kg",supplier:"해담별",supPrice:16900,status:"입금확인"},
    {no:"138547",wsa:"WSA260224-00000465",buyer:"이선주",phone:"010-6686-0620",product:"[한정특가]제주 정품 구좌당근",supplier:"해담별",supPrice:14900,status:"입금확인"},
    {no:"138546",wsa:"WSA260224-00000464",buyer:"권사임",phone:"010-4571-9660",product:"당도높은 새콤달콤 서귀포 감귤",supplier:"(주)마니팜",supPrice:14900,status:"입금확인"},
  ];

  // ── 통합 주문 배열 생성 ──
  const orders = [];

  // 1) 매칭 주문 (양쪽 존재) — 양쪽 상태 모두 표시
  matchedOrders.forEach(m => {
    const hasInv = !!(m.bj.invoice || m.fg.invoice);
    orders.push({
      id: m.wsa, no: m.bj.no, product: m.bj.product, optCode: "",
      buyer: m.bj.buyer, phone: "", address: "",
      seller: m.bj.seller, supplier: m.fg.supplier,
      qty: 1, price: m.fg.price, supplyPrice: m.fg.price, total: m.fg.price,
      orderStatus: m.fg.status, // 플렉스지 상태 (최신)
      bjStatus: m.bj.status, // 발주모아 상태
      supplyStatus: m.bj.status === "발주서생성" ? "발주서생성" : "회신완료",
      invoiceStatus: hasInv ? "registered" : "none",
      carrier: (m.fg.carrier||m.bj.carrier) ? CARRIERS.find(c => c.name === (m.fg.carrier||m.bj.carrier)) || {code:"04",name:m.fg.carrier||m.bj.carrier} : null,
      invoice: m.fg.invoice || m.bj.invoice || "",
      date: "2026-02-24", time: "23:00",
      site: "both", memo: "", selected: false,
      matched: true, // 양쪽 매칭됨
      statusDiff: m.bj.status !== m.fg.status, // 상태 불일치
    });
  });

  // 2) 발주모아 전용
  bjOnly.forEach(r => {
    orders.push({
      id: r.wsa, no: r.no, product: r.product, optCode: "",
      buyer: r.buyer, phone: r.phone, address: "",
      seller: r.seller, supplier: r.seller,
      qty: r.qty, price: r.supPrice, supplyPrice: r.supPrice, total: r.qty * r.supPrice,
      orderStatus: r.status, bjStatus: r.status, supplyStatus: "발주서생성",
      invoiceStatus: "none", carrier: null, invoice: "",
      date: "2026-02-24", time: "09:46",
      site: "baljumoa", memo: "", selected: false,
      matched: false, statusDiff: false,
    });
  });

  // 3) 플렉스지 전용
  fgOnly.forEach(r => {
    orders.push({
      id: r.wsa, no: r.no, product: r.product, optCode: "",
      buyer: r.buyer, phone: r.phone, address: "",
      seller: "스마트스토어", supplier: r.supplier,
      qty: 1, price: r.supPrice, supplyPrice: r.supPrice, total: r.supPrice,
      orderStatus: r.status, bjStatus: "", supplyStatus: "미발주",
      invoiceStatus: "none", carrier: null, invoice: "",
      date: "2026-02-24", time: "14:06",
      site: "flexgate", memo: "", selected: false,
      matched: false, statusDiff: false,
    });
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

const Badge = ({children,color,bg}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:5,fontSize:10.5,fontWeight:600,color,background:bg,whiteSpace:"nowrap"}}>{children}</span>
);
const Dot = ({color,size=6}) => (<span style={{width:size,height:size,borderRadius:"50%",background:color,flexShrink:0}}/>);

const Btn = ({onClick,children,variant="default",disabled,small,style:es}) => {
  const v={default:{bg:"#F3F4F6",c:"#374151",b:"1px solid #E5E7EB"},primary:{bg:"#111827",c:"#fff",b:"none"},success:{bg:"#059669",c:"#fff",b:"none"},danger:{bg:"#FEE2E2",c:"#DC2626",b:"1px solid #FECACA"},warning:{bg:"#FEF3C7",c:"#92400E",b:"1px solid #FDE68A"},purple:{bg:"#7C3AED",c:"#fff",b:"none"},outline:{bg:"#fff",c:"#374151",b:"1px solid #D1D5DB"},ghost:{bg:"transparent",c:"#6B7280",b:"none"}}[variant]||{bg:"#F3F4F6",c:"#374151",b:"1px solid #E5E7EB"};
  return (<button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:5,padding:small?"5px 10px":"7px 13px",borderRadius:7,fontSize:small?11:12,fontWeight:600,cursor:disabled?"not-allowed":"pointer",background:v.bg,color:v.c,border:v.b,opacity:disabled?0.5:1,whiteSpace:"nowrap",transition:"all 0.12s",...es}}>{children}</button>);
};
const Input = ({style:es,...p}) => (<input {...p} style={{padding:"7px 11px",borderRadius:7,border:"1px solid #D1D5DB",fontSize:12,outline:"none",width:"100%",boxSizing:"border-box",...es}}/>);
const Select = ({style:es,children,...p}) => (<select {...p} style={{padding:"7px 11px",borderRadius:7,border:"1px solid #D1D5DB",fontSize:12,outline:"none",appearance:"none",paddingRight:26,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='3'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 8px center",boxSizing:"border-box",...es}}>{children}</select>);

const Modal = ({open,onClose,title,width=700,children}) => {
  if(!open)return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.45)",backdropFilter:"blur(3px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,width:"96%",maxWidth:width,maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 20px 50px rgba(0,0,0,0.2)",animation:"modalIn 0.2s ease-out"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid #E5E7EB"}}>
          <h3 style={{margin:0,fontSize:15,fontWeight:700}}>{title}</h3>
          <button onClick={onClose} style={{background:"#F3F4F6",border:"none",borderRadius:7,width:28,height:28,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{padding:20,overflow:"auto",flex:1}}>{children}</div>
      </div>
    </div>
  );
};

const Toast = ({message,type="success",visible}) => (
  <div style={{position:"fixed",bottom:20,left:"50%",transform:`translateX(-50%) translateY(${visible?0:80}px)`,zIndex:2000,background:type==="success"?"#059669":type==="error"?"#DC2626":"#2563EB",color:"#fff",padding:"10px 22px",borderRadius:10,fontSize:12,fontWeight:600,boxShadow:"0 6px 24px rgba(0,0,0,0.15)",opacity:visible?1:0,transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)",display:"flex",alignItems:"center",gap:6}}>
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

const TH={padding:"9px 10px",textAlign:"left",fontWeight:700,color:"#374151",fontSize:10.5,whiteSpace:"nowrap"};
const TD={padding:"7px 10px",color:"#374151",fontSize:12};

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

export default function App() {
  const [orders,setOrders]=useState(()=>generateOrders());
  const [page,setPage]=useState("home");
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
  const [newMember,setNewMember]=useState({name:"",email:"",avatar:"👩‍💻",color:"#EC4899",permissions:["order"]});

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

  // ─── Automation Engine State ──────────────────────────
  const [autoLogs,setAutoLogs]=useState([]);
  const [autoRunning,setAutoRunning]=useState(false);
  const [autoProg,setAutoProg]=useState({c:0,t:0,txt:""});
  const [syncRes,setSyncRes]=useState(null);
  const [invInput,setInvInput]=useState("");
  const [invParsed,setInvParsed]=useState([]);
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
    {id:"CS001",order:"WSA..0002",buyer:"박셋별",type:"교환",status:"접수",date:"2026-02-24",desc:"사이즈 교환"},
    {id:"CS002",order:"WSA..0012",buyer:"김민수",type:"반품",status:"처리중",date:"2026-02-23",desc:"상품 파손"},
    {id:"CS003",order:"WSA..0040",buyer:"오동건",type:"문의",status:"완료",date:"2026-02-22",desc:"배송 일정"},
    {id:"CS004",order:"WSA..0004",buyer:"최수진",type:"환불",status:"접수",date:"2026-02-24",desc:"단순 변심"},
  ];
  const sampleSettle=[
    {id:"S1",period:"2026-02",seller:"쿠팡",cnt:342,sales:12450000,cost:8230000,profit:4220000,done:false},
    {id:"S2",period:"2026-02",seller:"테무",cnt:189,sales:6780000,cost:4120000,profit:2660000,done:false},
    {id:"S3",period:"2026-01",seller:"네이버",cnt:267,sales:9340000,cost:6150000,profit:3190000,done:true},
    {id:"S4",period:"2026-01",seller:"쿠팡",cnt:398,sales:14200000,cost:9350000,profit:4850000,done:true},
    {id:"S5",period:"2026-02",seller:"G마켓",cnt:78,sales:2890000,cost:1870000,profit:1020000,done:false},
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

  const selected=filtered.filter(o=>o.selected);
  const uniqueSellers=[...new Set(orders.map(o=>o.seller))].sort();
  const uniqueSuppliers=[...new Set(orders.map(o=>o.supplier))].sort();

  const toggleSelect=id=>setOrders(p=>p.map(o=>o.id===id?{...o,selected:!o.selected}:o));
  const toggleAll=()=>{const v=!selectAll;setSelectAll(v);const ids=new Set(filtered.map(o=>o.id));setOrders(p=>p.map(o=>ids.has(o.id)?{...o,selected:v}:o));};
  const clearSel=()=>{setOrders(p=>p.map(o=>({...o,selected:false})));setSelectAll(false);};
  const navigatePage=k=>{
    setPage(k);setQuickFilter(null);setStatusFilter("all");setSupplyFilter("all");setSiteFilter("all");setSellerFilter("all");clearSel();setSearch("");
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
  const SAFE_MODE = true;
  const safeBlock = (name) => { showToast(`⛔ [안전모드] ${name} 기능이 비활성화되었습니다`, "error"); };

  const handleSendPO=()=>safeBlock("발주서 전송");
  const confirmSendPO=()=>safeBlock("발주서 전송");
  const handleStatusChange=()=>safeBlock("상태 변경");
  const openInvoiceModal=()=>safeBlock("송장 등록");
  const submitInvoices=()=>safeBlock("송장 등록");
  const simExcel=()=>safeBlock("엑셀 업로드");
  const refresh=()=>{setProcessing(true);setTimeout(()=>{setOrders(generateOrders());setProcessing(false);showToast("데이터 새로고침 완료");},1400);};

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
    setNewMember({name:"",email:"",avatar:"👩‍💻",color:"#EC4899",permissions:["order"]});
    setAddMemberModal(false);
    showToast("부계정 추가 완료");
  };

  const SW=sideCollapsed?76:240;
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
    <div style={{display:"flex",height:"100vh",overflow:"hidden",fontFamily:"'Pretendard Variable',-apple-system,BlinkMacSystemFont,sans-serif",color:"#111827",background:"#F5F6F8"}}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes modalIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        input:focus,select:focus{border-color:#111827!important;box-shadow:0 0 0 2px rgba(17,24,39,0.06)}
        input[type="date"]{cursor:pointer!important;position:relative}
        input[type="date"]::-webkit-calendar-picker-indicator{cursor:pointer;position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;opacity:0;margin:0;padding:0}
        button:hover:not(:disabled){opacity:0.88}button:active:not(:disabled){transform:scale(0.97)}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}
        .mi{transition:all 0.1s;cursor:pointer}.mi:hover{background:#F3F4F6!important}
        .qc{transition:all 0.15s;cursor:pointer;user-select:none}.qc:hover{transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,0.08)}
        [draggable]{user-select:none;-webkit-user-select:none}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
      `}</style>

      {/* ═══ SIDEBAR ═══════════════════════════════════════ */}
      <aside style={{width:SW,minWidth:SW,height:"100vh",background:"#fff",borderRight:"1px solid #E5E7EB",display:"flex",flexDirection:"column",transition:"width 0.2s, min-width 0.2s",overflow:"hidden"}}>

        {/* Logo + collapse */}
        <div style={{height:56,display:"flex",alignItems:"center",padding:sideCollapsed?0:"0 14px",borderBottom:"1px solid #E5E7EB",flexShrink:0,gap:8,justifyContent:"center"}}>
          {sideCollapsed?(
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <div onClick={()=>{setPage("home");setQuickFilter(null);}} style={{cursor:"pointer"}}>
                <Avatar emoji={myProfile.avatar} color={myProfile.color} size={34} border={`2px solid ${myProfile.color}`}/>
              </div>
              <button onClick={()=>setSideCollapsed(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:"2px",display:"flex",alignItems:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          ):(
            <>
            <div onClick={()=>{setPage("home");setQuickFilter(null);}} style={{cursor:"pointer"}}>
              <Avatar emoji={myProfile.avatar} color={myProfile.color} size={34} border={`2px solid ${myProfile.color}`}/>
            </div>
            <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>{setPage("home");setQuickFilter(null);}}>
              <div style={{fontSize:14,fontWeight:800,color:"#111827",letterSpacing:"-0.02em"}}>발주 자동화</div>
              <div style={{fontSize:9,color:"#9CA3AF",marginTop:-1}}>{myProfile.name} · {myProfile.company}</div>
            </div>
            <button onClick={()=>setSideCollapsed(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",padding:"2px",display:"flex",alignItems:"center"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            </>
          )}
        </div>

        {/* Search bar */}
        {!sideCollapsed&&(
          <div style={{padding:"8px 12px",borderBottom:"1px solid #F3F4F6",flexShrink:0,position:"relative"}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setSideSearchOpen(false);}} tabIndex={-1}>
            <div style={{position:"relative"}}>
              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#9CA3AF",pointerEvents:"none"}}>🔍</span>
              <input value={sideSearch} onChange={e=>setSideSearch(e.target.value)} onFocus={()=>setSideSearchOpen(true)} placeholder="메뉴 검색..." style={{width:"100%",padding:"8px 10px 8px 32px",borderRadius:8,border:"1px solid #E5E7EB",fontSize:12,outline:"none",background:"#F9FAFB",boxSizing:"border-box"}}/>
              {sideSearch&&<button onClick={()=>{setSideSearch("");setSideSearchOpen(false);}} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#9CA3AF"}}>✕</button>}
            </div>
            {sideSearchOpen&&sideSearch.trim()&&(()=>{
              const q=sideSearch.trim().toLowerCase();
              const results=[];
              for(const sec of MENU)for(const it of sec.items){
                const match=it.label.toLowerCase().includes(q)||sec.section.toLowerCase().includes(q)||
                  (q.includes("발주")&&(it.label.includes("발주")||sec.section.includes("발주")))||
                  (q.includes("송장")&&(it.label.includes("송장")||sec.section.includes("송장")))||
                  (q.includes("주문")&&(it.label.includes("주문")||sec.section.includes("주문")))||
                  (q.includes("정산")&&(it.label.includes("정산")||sec.section.includes("정산")))||
                  (q.includes("상품")&&(it.label.includes("상품")||sec.section.includes("상품")))||
                  (q.includes("cs")&&(sec.section.includes("CS")))||
                  (q.includes("매출")&&(sec.section.includes("매출")||it.label.includes("매출")))||
                  (q.includes("재고")&&(sec.section.includes("재고")))||
                  (q.includes("설정")&&(sec.section.includes("설정")||it.label.includes("설정")));
                if(match)results.push({...it,secIcon:sec.icon,secName:sec.section});
              }
              if(results.length===0)return null;
              return(
                <div style={{position:"absolute",top:"100%",left:0,right:0,zIndex:100,background:"#fff",border:"1px solid #E5E7EB",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,0.12)",marginTop:4,maxHeight:240,overflow:"auto"}}>
                  <div style={{padding:"6px 10px",fontSize:10,fontWeight:600,color:"#9CA3AF",borderBottom:"1px solid #F3F4F6"}}>검색 결과 {results.length}건</div>
                  {results.map(r=>(
                    <div key={r.key} onClick={()=>{navigatePage(r.key);setSideSearch("");setSideSearchOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",cursor:"pointer",borderBottom:"1px solid #FAFBFC",transition:"background 0.1s"}} onMouseOver={e=>e.currentTarget.style.background="#F3F4F6"} onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:14}}>{r.secIcon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:"#111827"}}>{r.label}</div>
                        <div style={{fontSize:10,color:"#9CA3AF"}}>{r.secName}</div>
                      </div>
                      <span style={{fontSize:10,color:"#D1D5DB"}}>→</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* User row with refresh */}
        {!sideCollapsed&&(
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderBottom:"1px solid #F3F4F6",flexShrink:0}}>
            <Dot color="#22C55E" size={7}/>
            <span style={{fontSize:11,fontWeight:600,color:"#374151"}}>접속중</span>
            <span style={{fontSize:10,color:"#9CA3AF"}}>{onlineCount}명</span>
            <button onClick={refresh} disabled={processing} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#9CA3AF",padding:"2px 4px",marginLeft:"auto"}} title="새로고침">
              {processing?"⏳":"🔄"}
            </button>
          </div>
        )}

        {/* Sync Actions (핵심 구역) */}
        {!sideCollapsed&&(
          <div style={{padding:"14px 14px",borderBottom:"2px solid #E5E7EB",flexShrink:0,background:"linear-gradient(180deg,#F8F9FB,#fff)"}}>
            <button onClick={autoFull} disabled={autoRunning} style={{width:"100%",padding:"14px 14px",borderRadius:10,border:"none",background:autoRunning?"#E5E7EB":"linear-gradient(135deg,#111827,#1e1b4b)",color:autoRunning?"#9CA3AF":"#fff",fontSize:14,fontWeight:800,cursor:autoRunning?"not-allowed":"pointer",transition:"all 0.15s",marginBottom:10,letterSpacing:"-0.01em"}}>
              {autoRunning?"⏳ 동기화 진행 중...":"🔄 데이터 동기화 실행"}
            </button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              <button onClick={autoCollect} disabled={autoRunning} style={{padding:"14px 6px",borderRadius:10,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",fontSize:12,fontWeight:700,cursor:"pointer",opacity:autoRunning?0.4:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.1s"}}>
                <span style={{fontSize:22}}>📡</span>수집
              </button>
              <button onClick={autoAnalyze} disabled={autoRunning} style={{padding:"14px 6px",borderRadius:10,border:"1px solid #E5E7EB",background:"#fff",color:"#374151",fontSize:12,fontWeight:700,cursor:"pointer",opacity:autoRunning?0.4:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.1s"}}>
                <span style={{fontSize:22}}>🔍</span>분석
              </button>
              <button onClick={()=>{if(autoRunning){setAutoRunning(false);showToast("동기화 중지");}else{refresh();}}} style={{padding:"14px 6px",borderRadius:10,border:"1px solid #E5E7EB",background:autoRunning?"#FEF2F2":"#fff",color:autoRunning?"#DC2626":"#374151",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all 0.1s"}}>
                <span style={{fontSize:22}}>{autoRunning?"⏹":"🔄"}</span>{autoRunning?"중지":"새로고침"}
              </button>
            </div>
            {autoLogs.length>0&&(
              <div style={{maxHeight:70,overflow:"auto",borderRadius:6,background:"#0f172a",padding:"5px 8px",marginTop:10}}>
                {autoLogs.slice(-5).map((l,i)=>(
                  <div key={i} style={{fontSize:8.5,lineHeight:1.5,fontFamily:"monospace",color:l.type==="success"?"#22c55e":l.type==="error"?"#ef4444":l.type==="action"?"#60a5fa":"#475569"}}>{l.msg}</div>
                ))}
              </div>
            )}
            {autoProg.t>0&&autoRunning&&(
              <div style={{height:4,borderRadius:2,background:"#E5E7EB",marginTop:6}}>
                <div style={{height:"100%",borderRadius:2,transition:"width 0.3s",background:"linear-gradient(90deg,#3B82F6,#8B5CF6)",width:`${(autoProg.c/autoProg.t)*100}%`}}/>
              </div>
            )}
          </div>
        )}
        {sideCollapsed&&(
          <div style={{padding:"10px 0",borderBottom:"2px solid #E5E7EB",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
            <button onClick={autoFull} disabled={autoRunning} title="데이터 동기화" style={{width:54,height:44,borderRadius:10,border:"none",background:autoRunning?"#E5E7EB":"#111827",color:autoRunning?"#9CA3AF":"#fff",fontSize:20,cursor:autoRunning?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto"}}>🔄</button>
            <div style={{display:"flex",gap:4,justifyContent:"center"}}>
              <button onClick={autoCollect} disabled={autoRunning} title="수집" style={{width:32,height:32,borderRadius:7,border:"1px solid #E5E7EB",background:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:autoRunning?0.4:1}}>📡</button>
              <button onClick={autoAnalyze} disabled={autoRunning} title="분석" style={{width:32,height:32,borderRadius:7,border:"1px solid #E5E7EB",background:"#fff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",opacity:autoRunning?0.4:1}}>🔍</button>
            </div>
          </div>
        )}

        {/* Nav menu */}
        <nav style={{flex:1,overflow:"auto",padding:"4px 0"}}>
          {MENU.map(sec=>{
            // 접힌 상태에서 섹션 내 뱃지 합산
            const secBadge=sideCollapsed?sec.items.reduce((sum,it)=>{
              const v=it.key==="po_inbox"?3:it.key==="supply_process"?counts.unordered:it.key==="inv_unregistered"?counts.noInvoice:it.key==="order_new"?counts.new:it.key==="order_preparing"?counts.preparing:it.key==="order_shipping"?counts.shipping:0;
              return sum+v;
            },0):0;
            const secActive=sideCollapsed&&sec.items.some(it=>it.key===page&&!quickFilter);
            return(
            <div key={sec.section}>
              <button onClick={()=>{
                if(sideCollapsed){
                  // 접힌 상태에서 섹션 클릭 → 첫 번째 아이템으로 이동
                  navigatePage(sec.items[0].key);
                }else{
                  setExpandedSections(p=>({...p,[sec.section]:!p[sec.section]}));
                }
              }} title={sec.section} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:sideCollapsed?"center":"flex-start",gap:7,padding:sideCollapsed?"10px 0":"10px 14px",background:secActive?"#EEF2FF":"none",border:"none",borderRight:secActive?"3px solid #3B82F6":"3px solid transparent",cursor:"pointer",marginTop:sideCollapsed?0:4,position:"relative"}}>
                <span style={{fontSize:sideCollapsed?22:14,lineHeight:1,display:"flex",alignItems:"center",justifyContent:"center",width:sideCollapsed?40:"auto",height:sideCollapsed?32:"auto"}}>{sec.icon}</span>
                {!sideCollapsed&&(<><span style={{fontSize:12,fontWeight:700,color:"#4B5563",flex:1,textAlign:"left"}}>{sec.section}</span><span style={{fontSize:8,color:"#9CA3AF",transform:expandedSections[sec.section]?"rotate(0)":"rotate(-90deg)",transition:"0.15s"}}>▼</span></>)}
                {sideCollapsed&&secBadge>0&&(
                  <span style={{position:"absolute",top:4,right:10,minWidth:18,height:18,borderRadius:99,background:"#EF4444",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{secBadge}</span>
                )}
              </button>
              {!sideCollapsed&&expandedSections[sec.section]&&sec.items.map(it=>{
                const isActive=page===it.key&&!quickFilter;
                const badgeVal=it.key==="po_inbox"?3:it.key==="supply_process"?counts.unordered:it.key==="inv_unregistered"?counts.noInvoice:it.key==="order_new"?counts.new:it.key==="order_preparing"?counts.preparing:it.key==="order_shipping"?counts.shipping:it.key==="settings_team"?team.length:null;
                return(
                  <button key={it.key} className="mi" onClick={()=>navigatePage(it.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:6,padding:"9px 14px 9px 30px",justifyContent:"flex-start",background:isActive?"#EEF2FF":"transparent",border:"none",borderRight:isActive?"3px solid #3B82F6":"3px solid transparent"}}>
                    <span style={{fontSize:12.5,fontWeight:isActive?700:500,color:isActive?"#2563EB":"#374151",flex:1,textAlign:"left"}}>{it.label}</span>
                    {badgeVal!=null&&badgeVal>0&&(<span style={{padding:"2px 8px",borderRadius:99,fontSize:10,fontWeight:700,background:isActive?"#2563EB":"#6B7280",color:"#fff",minWidth:20,textAlign:"center"}}>{badgeVal}</span>)}
                  </button>
                );
              })}
              {sideCollapsed&&<div style={{height:1,background:"#F3F4F6",margin:"3px 12px"}}/>}
            </div>
            );
          })}
        </nav>

        {/* Bottom status */}
        <div style={{padding:sideCollapsed?"8px 4px":"10px 14px",borderTop:"1px solid #F3F4F6",flexShrink:0}}>
          {!sideCollapsed?(
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              {Object.entries(SITES).map(([k,s])=>(<div key={k} style={{display:"flex",alignItems:"center",gap:6,fontSize:10.5}}><Dot color="#22C55E" size={6}/><span style={{fontWeight:600,color:"#374151"}}>{s.name}</span><span style={{fontSize:9,color:"#9CA3AF",marginLeft:"auto"}}>연결됨</span></div>))}
            </div>
          ):(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,padding:"2px 0"}}>
            {Object.entries(SITES).map(([k,s])=>(<div key={k} title={`${s.name} 연결됨`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:4,width:"100%"}}><Dot color="#22C55E" size={7}/><span style={{fontSize:9,fontWeight:700,color:s.color}}>{s.short}</span></div>))}
          </div>)}
        </div>
      </aside>

      {/* ═══ MAIN ══════════════════════════════════════════ */}
      <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ═══ Tab Bar (항상 표시) ═══ */}
        <div style={{flexShrink:0}}>
          <div style={{display:"flex",alignItems:"stretch",background:"#F3F4F6",borderBottom:"1px solid #E5E7EB",height:56,overflow:"hidden"}}>
            {/* Home tab - always visible */}
            <div onClick={()=>{setPage("home");setQuickFilter(null);}} style={{display:"flex",alignItems:"center",gap:5,padding:"0 20px",background:page==="home"?"#fff":"transparent",borderRight:"1px solid #E5E7EB",cursor:"pointer",fontSize:18,fontWeight:page==="home"?700:500,color:page==="home"?"#111827":"#6B7280",borderBottom:page==="home"?"3px solid #3B82F6":"3px solid transparent",transition:"all 0.1s"}}>
              🏠
            </div>
            {/* Open tabs (draggable) */}
            <div style={{display:"flex",flex:1,overflow:"auto"}}>
              {openTabs.map((tab,idx)=>{
                const isActive=page===tab.key;
                const isDragOver=dragOverIdx===idx&&dragTab!==idx;
                return(
                  <div key={tab.key} draggable onDragStart={e=>onTabDragStart(e,idx)} onDragOver={e=>onTabDragOver(e,idx)} onDrop={e=>onTabDrop(e,idx)} onDragEnd={onTabDragEnd} onClick={()=>{setPage(tab.key);setQuickFilter(null);}} style={{display:"flex",alignItems:"center",gap:8,padding:"0 16px",background:isActive?"#fff":"transparent",borderRight:"1px solid #E5E7EB",cursor:"grab",fontSize:13.5,fontWeight:isActive?700:500,color:isActive?"#111827":"#6B7280",borderBottom:isActive?"3px solid #3B82F6":"3px solid transparent",borderLeft:isDragOver?"2px solid #3B82F6":"2px solid transparent",whiteSpace:"nowrap",transition:"border 0.15s",minWidth:0,maxWidth:220,opacity:dragTab===idx?0.5:1}}>
                    <span style={{fontSize:14}}>{tab.icon}</span>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{tab.label}</span>
                    <button onClick={e=>closeTab(tab.key,e)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#9CA3AF",padding:"2px 4px",lineHeight:1,flexShrink:0,borderRadius:4}} onMouseOver={e=>e.target.style.color="#EF4444"} onMouseOut={e=>e.target.style.color="#9CA3AF"}>✕</button>
                  </div>
                );
              })}
            </div>
            {/* Right: preset + close all + team avatars */}
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"0 14px",flexShrink:0}}>
              <button onClick={()=>setPresetModal(true)} title="탭 프리셋" style={{background:"none",border:"1px solid #E5E7EB",borderRadius:6,cursor:"pointer",fontSize:11,color:"#6B7280",padding:"4px 8px",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",fontWeight:600}} onMouseOver={e=>{e.currentTarget.style.color="#3B82F6";e.currentTarget.style.borderColor="#93C5FD";}} onMouseOut={e=>{e.currentTarget.style.color="#6B7280";e.currentTarget.style.borderColor="#E5E7EB";}}>⚡ 프리셋</button>
              {openTabs.length>1&&(
                <button onClick={()=>{setOpenTabs([]);setPage("home");setQuickFilter(null);}} title="탭 전체 닫기" style={{background:"none",border:"1px solid #E5E7EB",borderRadius:6,cursor:"pointer",fontSize:11,color:"#9CA3AF",padding:"4px 8px",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap",fontWeight:600}} onMouseOver={e=>{e.currentTarget.style.color="#EF4444";e.currentTarget.style.borderColor="#FECACA";}} onMouseOut={e=>{e.currentTarget.style.color="#9CA3AF";e.currentTarget.style.borderColor="#E5E7EB";}}>✕ 전체닫기</button>
              )}
              <div style={{display:"flex",alignItems:"center"}}>
                {team.filter(t=>t.online).map((t,i)=>(
                  <div key={t.id} style={{marginLeft:i===0?0:-7,zIndex:10-i}} title={t.name}>
                    <Avatar emoji={t.avatar} color={t.color} size={30} online={t.online}/>
                  </div>
                ))}
                {team.filter(t=>!t.online).length>0&&(
                  <div style={{marginLeft:-5,width:30,height:30,borderRadius:"50%",background:"#E5E7EB",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#9CA3AF",zIndex:1}}>+{team.filter(t=>!t.online).length}</div>
                )}
              </div>
            </div>
          </div>

          {/* Sub-header: page title + status badges (non-home, non-settings) */}
          {page!=="home"&&!isSettingsPage&&(
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 20px",background:"#fff",borderBottom:"1px solid #E5E7EB"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,fontWeight:700}}>{getPageTitle()}</span>
                {!isExtraPage&&<span style={{fontSize:11,color:"#9CA3AF"}}>{filtered.length}건</span>}
                {quickFilter&&(<button onClick={()=>setQuickFilter(null)} style={{background:"#F3F4F6",border:"none",borderRadius:5,padding:"2px 8px",fontSize:10,color:"#6B7280",cursor:"pointer",fontWeight:600}}>✕ 필터 해제</button>)}
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
            <div style={{display:"flex",gap:0,background:"#fff",borderBottom:"1px solid #E5E7EB"}}>
              {quickCards.map((card,ci)=>{
                const isActive=quickFilter===card.key;
                return(
                  <div key={card.key} className="qc" onClick={()=>handleQuickFilter(card.key)} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 6px",background:isActive?card.color:"#fff",borderRight:ci<quickCards.length-1?"1px solid #F3F4F6":"none",cursor:"pointer",transition:"all 0.15s",minWidth:0}}>
                    <span style={{fontSize:12,fontWeight:700,color:isActive?"#fff":"#374151",whiteSpace:"nowrap"}}>{card.label}</span>
                    <span style={{fontSize:18,fontWeight:800,color:isActive?"#fff":card.color,lineHeight:1}}>{card.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{flex:1,overflow:"auto",padding:page==="home"?0:16}}>

          {/* ═══ HOME DASHBOARD (뱅킹/카드사 스타일) ═══ */}
          {page==="home"&&(
            <div style={{minHeight:"100%",background:"linear-gradient(180deg,#F8F9FB 0%,#EEF0F4 100%)"}}>

              {/* 빠른 접근 메뉴 (라운드 카드 - 확대) */}
              <div style={{padding:"28px 28px"}}>
                <div style={{fontSize:16,fontWeight:800,color:"#111827",marginBottom:18}}>빠른 접근</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
                  {[
                    {icon:"📋",label:"발주 등록",desc:"발주서 수신 · 등록",page:"po_inbox",color:"#3B82F6",badge:3},
                    {icon:"📦",label:"주문 현황",desc:"전체 주문 조회",page:"order_all",color:"#8B5CF6",badge:counts.total},
                    {icon:"📝",label:"송장 관리",desc:"송장 등록 · 회신",page:"inv_register",color:"#06B6D4",badge:counts.noInvoice},
                    {icon:"🚚",label:"발주 관리",desc:"발주 처리 · 확인",page:"supply_process",color:"#F59E0B",badge:counts.unordered},
                    {icon:"🛒",label:"상품 관리",desc:"상품 · 옵션 매칭",page:"prod_list",color:"#10B981"},
                    {icon:"🎧",label:"CS 관리",desc:"교환 · 반품 · 환불",page:"cs_list",color:"#EC4899"},
                    {icon:"💰",label:"정산",desc:"판매사 · 공급사 정산",page:"settle_profit",color:"#F97316"},
                    {icon:"📊",label:"매출/통계",desc:"실시간 모니터링",page:"monitor",color:"#6366F1"},
                  ].map(menu=>(
                    <div key={menu.label} onClick={()=>navigatePage(menu.page)} style={{background:"#fff",borderRadius:18,padding:"26px 20px",cursor:"pointer",border:"1px solid #E5E7EB",transition:"all 0.2s",display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center"}} className="qc">
                      <div style={{position:"relative",marginBottom:14}}>
                        <div style={{width:56,height:56,borderRadius:16,background:`${menu.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{menu.icon}</div>
                        {menu.badge>0&&(
                          <div style={{position:"absolute",top:-6,right:-10,minWidth:24,height:24,borderRadius:12,background:menu.color,color:"#fff",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 6px"}}>{menu.badge}</div>
                        )}
                      </div>
                      <div style={{fontSize:15,fontWeight:700,color:"#111827",marginBottom:4}}>{menu.label}</div>
                      <div style={{fontSize:12,color:"#9CA3AF",fontWeight:500}}>{menu.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 하단 2열: 최근 주문 + 알림 */}
              <div style={{padding:"0 28px 28px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                {/* 최근 매칭 주문 */}
                <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{fontSize:13,fontWeight:700}}>🔗 최근 매칭 주문</span>
                    <span onClick={()=>{navigatePage("order_all");setQuickFilter("unordered");}} style={{fontSize:11,color:"#3B82F6",cursor:"pointer",fontWeight:600}}>전체보기 →</span>
                  </div>
                  <div style={{padding:"4px 0"}}>
                    {orders.filter(o=>o.matched).slice(0,5).map(o=>(
                      <div key={o.id} style={{display:"flex",alignItems:"center",padding:"10px 18px",borderBottom:"1px solid #FAFBFC",gap:10}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.product}</div>
                          <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>{o.buyer} · {o.supplier}</div>
                        </div>
                        <div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:12,fontWeight:700}}>₩{o.total.toLocaleString()}</div>
                          <div style={{display:"flex",gap:3,marginTop:2,justifyContent:"flex-end"}}>
                            <Badge color={ORDER_STATUS[o.bjStatus]?.color||"#6B7280"} bg={ORDER_STATUS[o.bjStatus]?.bg||"#F3F4F6"}>{o.bjStatus||"-"}</Badge>
                            {o.statusDiff&&<span style={{fontSize:9,color:"#F59E0B"}}>⚠️</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 알림/상태 요약 */}
                <div style={{background:"#fff",borderRadius:16,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #F3F4F6"}}>
                    <span style={{fontSize:13,fontWeight:700}}>📢 알림 · 현황</span>
                  </div>
                  <div style={{padding:"8px 0"}}>
                    {[
                      {icon:"⚠️",text:`상태 불일치 ${counts.statusDiff}건 확인 필요`,color:"#F59E0B",time:"방금"},
                      {icon:"📋",text:`발주 미등록 ${counts.unordered}건`,color:"#EF4444",time:"2분 전"},
                      {icon:"📝",text:`송장 미등록 ${counts.noInvoice}건 처리 대기`,color:"#06B6D4",time:"5분 전"},
                      {icon:"🔗",text:`양쪽 매칭 완료 ${counts.matched}건`,color:"#8B5CF6",time:"10분 전"},
                      {icon:"✅",text:"발주모아 · 플렉스지 연결됨",color:"#10B981",time:"접속중"},
                    ].map((n,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 18px",borderBottom:i<4?"1px solid #FAFBFC":"none"}}>
                        <div style={{width:34,height:34,borderRadius:10,background:`${n.color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{n.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,fontWeight:600,color:"#374151"}}>{n.text}</div>
                        </div>
                        <span style={{fontSize:10,color:"#9CA3AF",flexShrink:0}}>{n.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 하단 설정 바로가기 */}
              <div style={{padding:"0 28px 28px"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
                  {[
                    {icon:"🏭",label:"재고 관리",page:"stock_list"},
                    {icon:"⚡",label:"탭 프리셋",page:"settings_preset"},
                    {icon:"⚙️",label:"환경설정",page:"settings_general"},
                    {icon:"👤",label:"계정 관리",page:"settings_team"},
                  ].map(s=>(
                    <div key={s.label} onClick={()=>navigatePage(s.page)} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}} className="qc">
                      <span style={{fontSize:20}}>{s.icon}</span>
                      <span style={{fontSize:12.5,fontWeight:600,color:"#374151"}}>{s.label}</span>
                      <span style={{marginLeft:"auto",fontSize:10,color:"#D1D5DB"}}>›</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {page==="settings_profile"&&(
            <div style={{maxWidth:560}}>
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:24,marginBottom:16}}>
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
                  <div key={m.id} style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:16,animation:"fadeIn 0.2s ease-out"}}>
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
                            <button key={k} onClick={()=>!isMaster&&togglePermission(m.id,k)} style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:isMaster?"default":"pointer",background:has?"#111827":"#F3F4F6",color:has?"#fff":"#6B7280",border:"none",opacity:isMaster?0.7:1}}>
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
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:24,marginBottom:16}}>
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
                            <div key={it.key} onClick={()=>togglePresetItem(it.key,it.label,sec.icon)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:8,border:sel?"2px solid #3B82F6":"1px solid #E5E7EB",background:sel?"#EFF6FF":"#fff",cursor:"pointer",transition:"all 0.12s",position:"relative"}}>
                              <div style={{width:18,height:18,borderRadius:4,border:sel?"2px solid #3B82F6":"2px solid #D1D5DB",background:sel?"#3B82F6":"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:700,flexShrink:0}}>{sel?(idx+1):""}</div>
                              <span style={{fontSize:12,fontWeight:sel?700:500,color:sel?"#1E40AF":"#374151"}}>{it.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 선택된 항목 미리보기 + 저장 */}
                {presetSelected.length>0&&(
                  <div style={{padding:14,background:"#F0F4FF",borderRadius:10,border:"1px solid #DBEAFE",marginBottom:12}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#1E40AF",marginBottom:8}}>선택된 탭 ({presetSelected.length}개) — 순서대로 열립니다</div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {presetSelected.map((t,i)=>(
                        <span key={t.key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:6,background:"#fff",border:"1px solid #DBEAFE",fontSize:11,fontWeight:600,color:"#1E40AF"}}>
                          <span style={{fontSize:9,color:"#3B82F6",fontWeight:800}}>{i+1}</span> {t.icon} {t.label}
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
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:24,marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                  <h4 style={{margin:0,fontSize:14,fontWeight:700}}>📂 내 프리셋 ({tabPresets.length})</h4>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>👤 {myProfile.name} 전용</span>
                </div>
                {tabPresets.length===0?(
                  <div style={{padding:30,textAlign:"center",color:"#9CA3AF",fontSize:12,background:"#FAFBFC",borderRadius:8}}>저장된 프리셋이 없습니다. 위에서 메뉴를 선택하여 만들어보세요.</div>
                ):(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {tabPresets.map(preset=>(
                      <div key={preset.id} style={{borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden",transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.borderColor="#3B82F6"} onMouseOut={e=>e.currentTarget.style.borderColor="#E5E7EB"}>
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
              <div style={{background:"#FFFBEB",borderRadius:12,border:"1px solid #FDE68A",padding:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"#92400E",marginBottom:6}}>💡 프리셋 사용 팁</div>
                <div style={{fontSize:11.5,color:"#78350F",lineHeight:1.7}}>
                  메뉴를 클릭한 순서대로 탭이 열립니다. 번호가 순서를 나타냅니다.<br/>
                  탭바의 <strong>⚡ 프리셋</strong> 버튼으로 빠르게 전환할 수 있습니다.<br/>
                  각 계정마다 개별 프리셋이 저장됩니다.
                </div>
              </div>
            </div>
          )}

          {page==="settings_general"&&(
            <div style={{maxWidth:560}}>
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:24}}>
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
                    <div key={i} style={{background:"#fff",borderRadius:8,padding:"12px 14px",border:"1px solid #E5E7EB",borderLeft:`3px solid ${s.c}`}}>
                      <div style={{fontSize:10,color:"#6B7280",fontWeight:600,marginBottom:4}}>{s.l}</div>
                      <div style={{fontSize:20,fontWeight:800,color:s.c}}>{s.v}</div>
                    </div>
                  ))}
                </div>
              )}
              {(page==="monitor"||page==="stat_supplier")&&(
                <div style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",padding:16}}>
                  <h4 style={{margin:"0 0 10px",fontSize:13,fontWeight:700}}>🏭 공급사별</h4>
                  {uniqueSuppliers.map(sup=>{const so=orders.filter(o=>o.supplier===sup);return(<div key={sup} style={{display:"flex",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #F3F4F6",gap:6}}><span style={{fontSize:11.5,fontWeight:600,flex:1}}>{sup}</span><Badge color="#EF4444" bg="#FEE2E2">미발주 {so.filter(o=>o.supplyStatus==="미발주").length}</Badge><Badge color="#F59E0B" bg="#FEF3C7">송장 {so.filter(o=>o.invoiceStatus==="none"&&o.supplyStatus!=="미발주").length}</Badge><Badge color="#10B981" bg="#D1FAE5">완료 {so.filter(o=>o.invoiceStatus==="registered").length}</Badge></div>);})}
                </div>
              )}
              {(page==="monitor"||page==="stat_seller")&&(
                <div style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",padding:16}}>
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
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:700}}>📦 상품 {sampleProducts.length}건</span>
                    <div style={{display:"flex",gap:6}}><Btn variant="outline" small>📤 엑셀</Btn><Btn variant="primary" small>+ 상품 등록</Btn></div>
                  </div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB"}}><th style={TH}>코드</th><th style={{...TH,minWidth:160}}>상품명</th><th style={TH}>공급사</th><th style={{...TH,textAlign:"right"}}>판매가</th><th style={{...TH,textAlign:"right"}}>공급가</th><th style={{...TH,textAlign:"right"}}>재고</th><th style={{...TH,textAlign:"center"}}>시트연동</th></tr></thead>
                  <tbody>{sampleProducts.map(p=>(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontFamily:"monospace",fontSize:10}}>{p.code.slice(-8)}</td><td style={{...TD,fontWeight:600,fontSize:11.5}}>{p.name}</td><td style={{...TD,fontSize:11}}>{p.supplier}</td><td style={{...TD,textAlign:"right"}}>₩{p.price.toLocaleString()}</td><td style={{...TD,textAlign:"right",color:"#6B7280"}}>₩{p.supply.toLocaleString()}</td><td style={{...TD,textAlign:"right"}}><span style={{fontWeight:700,color:p.stock===0?"#EF4444":p.stock<10?"#F59E0B":"#374151"}}>{p.stock}</span></td><td style={{...TD,textAlign:"center"}}>{p.synced?<Badge color="#10B981" bg="#D1FAE5">연동</Badge>:<Badge color="#9CA3AF" bg="#F3F4F6">미연동</Badge>}</td></tr>))}</tbody></table></div>
                </div>
              )}
              {page==="prod_matching"&&(
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:20}}>
                  <h4 style={{margin:"0 0 12px",fontSize:14,fontWeight:700}}>🔗 상품/옵션 매칭</h4>
                  <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>발주모아/플렉스지의 상품을 자동 매칭합니다. 미매칭 건을 수동으로 연결할 수 있습니다.</p>
                  <div style={{display:"flex",gap:8,marginBottom:12}}><Btn variant="primary" small>🔄 자동 매칭 실행</Btn><Btn variant="outline" small>미매칭 목록 보기</Btn></div>
                  <div style={{padding:14,background:"#F0FDF4",borderRadius:8,fontSize:12,color:"#166534"}}>✅ 현재 매칭률: <strong>94.2%</strong> (283/300건) — 미매칭 17건</div>
                </div>
              )}
              {page==="prod_gsheet"&&(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:20}}>
                    <h4 style={{margin:"0 0 4px",fontSize:14,fontWeight:700}}>📊 구글시트 연동</h4>
                    <p style={{fontSize:12,color:"#6B7280",marginBottom:16}}>구글 스프레드시트와 상품 데이터를 실시간 연동합니다. 시트에서 가격/재고/상품정보를 관리하면 <strong>최신화 업데이트</strong> 클릭 시 완전히 반영됩니다.</p>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                      <Input value={gsheetUrl} onChange={e=>setGsheetUrl(e.target.value)} placeholder="구글 스프레드시트 URL (https://docs.google.com/spreadsheets/d/...)" style={{flex:1}}/>
                      <Btn onClick={syncGsheet} variant="primary" disabled={gsheetSyncing}>{gsheetSyncing?"⏳ 동기화 중...":"🔄 최신화 업데이트"}</Btn>
                    </div>
                    {gsheetLastSync&&<div style={{padding:10,background:"#F0FDF4",borderRadius:8,fontSize:12,color:"#166534"}}>✅ 마지막 동기화: <strong>{gsheetLastSync}</strong> — 상품 8건 업데이트 완료</div>}
                    {!gsheetLastSync&&<div style={{padding:10,background:"#FEF3C7",borderRadius:8,fontSize:12,color:"#92400E"}}>⚠️ 아직 연동되지 않았습니다. URL 입력 후 최신화 업데이트를 눌러주세요.</div>}
                  </div>
                  <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:20}}>
                    <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>연동 설정</h4>
                    {[{l:"자동 동기화",d:"변경 감지 시 자동 반영",opt:["수동","5분","30분","1시간"]},{l:"동기화 방향",d:"데이터 흐름 방향",opt:["시트→시스템","시스템→시트","양방향"]},{l:"컬럼 매핑",d:"시트 컬럼↔시스템 필드",opt:["자동 감지","수동 설정"]}].map((s,i)=>(<div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:i<2?"1px solid #F3F4F6":"none"}}><div><div style={{fontSize:12,fontWeight:600}}>{s.l}</div><div style={{fontSize:10.5,color:"#9CA3AF"}}>{s.d}</div></div><Select style={{width:140}}>{s.opt.map(o=><option key={o}>{o}</option>)}</Select></div>))}
                  </div>
                  <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:20}}>
                    <h4 style={{margin:"0 0 12px",fontSize:13,fontWeight:700}}>상품별 연동 현황</h4>
                    <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB"}}><th style={TH}>상품명</th><th style={TH}>코드</th><th style={{...TH,textAlign:"center"}}>상태</th><th style={TH}>최종 동기화</th></tr></thead><tbody>{sampleProducts.map(p=>(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:500}}>{p.name}</td><td style={{...TD,fontSize:10,fontFamily:"monospace"}}>{p.code.slice(-8)}</td><td style={{...TD,textAlign:"center"}}>{p.synced?<Badge color="#10B981" bg="#D1FAE5">✓ 연동</Badge>:<Badge color="#F59E0B" bg="#FEF3C7">미연동</Badge>}</td><td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{p.synced?"2026-02-24 14:11":"—"}</td></tr>))}</tbody></table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ CS MANAGEMENT ═════════════════════════════ */}
          {isCSPage&&(
            <div style={{maxWidth:800}}>
              <div style={{display:"flex",gap:8,marginBottom:12}}><Btn variant="primary" small>+ CS 등록</Btn><Btn variant="outline" small>엑셀↓</Btn></div>
              <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB"}}><th style={TH}>번호</th><th style={TH}>주문번호</th><th style={TH}>고객</th><th style={TH}>유형</th><th style={{...TH,textAlign:"center"}}>상태</th><th style={TH}>내용</th><th style={TH}>날짜</th></tr></thead>
                <tbody>{sampleCS.map(c=>{const sc=c.status==="접수"?"#F59E0B":c.status==="처리중"?"#3B82F6":"#10B981";return(<tr key={c.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:600,color:"#2563EB"}}>{c.id}</td><td style={{...TD,fontSize:10.5,fontFamily:"monospace"}}>{c.order}</td><td style={{...TD,fontWeight:500}}>{c.buyer}</td><td style={TD}><Badge color={c.type==="교환"?"#8B5CF6":c.type==="반품"?"#EF4444":"#F59E0B"} bg={c.type==="교환"?"#EDE9FE":c.type==="반품"?"#FEE2E2":"#FEF3C7"}>{c.type}</Badge></td><td style={{...TD,textAlign:"center"}}><Badge color={sc} bg={`${sc}28`}>{c.status}</Badge></td><td style={{...TD,fontSize:11}}>{c.desc}</td><td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{c.date}</td></tr>);})}</tbody></table>
              </div>
            </div>
          )}

          {/* ═══ SETTLEMENT ════════════════════════════════ */}
          {isSettlePage&&(
            <div style={{maxWidth:900}}>
              {page==="settle_profit"&&(
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
                  {[{l:"이번달 매출",v:"₩22,120,000",c:"#3B82F6"},{l:"이번달 수익",v:"₩7,900,000",c:"#059669"},{l:"수익률",v:"35.7%",c:"#8B5CF6"}].map((s,i)=>(<div key={i} style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",padding:"16px 18px",borderLeft:`3px solid ${s.c}`}}><div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginBottom:6}}>{s.l}</div><div style={{fontSize:22,fontWeight:800,color:s.c}}>{s.v}</div></div>))}
                </div>
              )}
              {(page==="settle_seller"||page==="settle_supplier")&&(
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #E5E7EB",display:"flex",gap:8}}><Select style={{width:120}}><option>2026-02</option><option>2026-01</option></Select><Btn variant="outline" small>엑셀↓</Btn></div>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB"}}><th style={TH}>기간</th><th style={TH}>판매사</th><th style={{...TH,textAlign:"right"}}>주문수</th><th style={{...TH,textAlign:"right"}}>매출</th><th style={{...TH,textAlign:"right"}}>공급가</th><th style={{...TH,textAlign:"right"}}>수익</th><th style={{...TH,textAlign:"center"}}>상태</th></tr></thead>
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
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:"#F9FAFB"}}><th style={TH}>상품명</th><th style={TH}>공급사</th><th style={{...TH,textAlign:"right"}}>현재고</th><th style={{...TH,textAlign:"center"}}>상태</th></tr></thead>
                  <tbody>{sampleProducts.map(p=>{const st=p.stock===0?"품절":p.stock<10?"부족":"정상";const c=p.stock===0?"#EF4444":p.stock<10?"#F59E0B":"#10B981";return(<tr key={p.id} style={{borderTop:"1px solid #F3F4F6"}}><td style={{...TD,fontWeight:600}}>{p.name}</td><td style={{...TD,fontSize:11}}>{p.supplier}</td><td style={{...TD,textAlign:"right",fontWeight:700,color:c}}>{p.stock}개</td><td style={{...TD,textAlign:"center"}}><Badge color={c} bg={`${c}28`}>{st}</Badge></td></tr>);})}</tbody></table></div>
                </div>
              )}
              {page==="stock_alert"&&(
                <div style={{background:"#fff",borderRadius:12,border:"1px solid #E5E7EB",padding:20}}>
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
              <div style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",padding:"12px 14px",marginBottom:10}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  <div style={{position:"relative",flex:"1 1 220px",minWidth:200}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#9CA3AF"}}>🔍</span>
                    <Input placeholder="주문번호, 상품, 구매자, 판매사 검색..." value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:32,height:36}}/>
                  </div>
                  <button onClick={()=>setAdvSearch(p=>!p)} style={{padding:"7px 14px",borderRadius:7,border:"1px solid #D1D5DB",background:advSearch?"#111827":"#fff",color:advSearch?"#fff":"#374151",fontSize:11.5,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"all 0.15s",height:36}}>
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
                      <button onClick={()=>showToast("검색 조건 적용","info")} style={{padding:"8px 28px",borderRadius:7,border:"none",background:"#111827",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>🔍 검색</button>
                      <button onClick={()=>{setAdvFilters({supplier:"all",status:"all",bjStatus:"all",fgStatus:"all",matchType:"all",dateFrom:new Date().toISOString().slice(0,10),dateTo:new Date().toISOString().slice(0,10),buyer:"",product:"",invoiceYn:"all",dateType:"order_date"});setSellerFilter("all");setSiteFilter("all");setSearch("");showToast("초기화 완료");}} style={{padding:"8px 28px",borderRadius:7,border:"1px solid #D1D5DB",background:"#F9FAFB",color:"#374151",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>🔄 초기화</button>
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
                <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:8,padding:"6px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#4338CA"}}>✓ {selected.length}건 | ₩{selected.reduce((a,b)=>a+b.total,0).toLocaleString()}</span>
                  <Btn onClick={clearSel} variant="outline" small>해제</Btn>
                </div>
              )}
              <div style={{background:"#fff",borderRadius:10,border:"1px solid #E5E7EB",overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#F9FAFB"}}>
                      <th style={{...TH,width:32,textAlign:"center"}}><input type="checkbox" checked={selectAll} onChange={toggleAll} style={{width:14,height:14,cursor:"pointer",accentColor:"#111827"}}/></th>
                      <th style={TH}>No</th><th style={TH}>사이트</th><th style={{...TH,minWidth:90}}>주문번호</th><th style={{...TH,minWidth:150}}>상품정보</th><th style={TH}>공급사</th><th style={TH}>주문자</th><th style={{...TH,textAlign:"right"}}>금액</th><th style={{...TH,textAlign:"center"}}>🟢발모상태</th><th style={{...TH,textAlign:"center"}}>🔴플지상태</th><th style={{...TH,textAlign:"center"}}>매칭</th>
                      {(isInvoicePage||quickFilter==="noInvoice")&&(<><th style={TH}>택배사</th><th style={TH}>송장번호</th></>)}
                      <th style={TH}>일시</th>
                    </tr></thead>
                    <tbody>
                      {filtered.length===0?(<tr><td colSpan={20} style={{padding:50,textAlign:"center",color:"#9CA3AF",fontSize:13}}>해당 조건의 주문이 없습니다</td></tr>):filtered.slice(0,100).map((o,i)=>{
                        const siteConf = o.site==="both"?{name:"양쪽",short:"양쪽",color:"#8B5CF6",icon:"🔗"}:SITES[o.site];
                        const bjSt = ORDER_STATUS[o.bjStatus||""];
                        const fgSt = ORDER_STATUS[o.orderStatus];
                        return(<tr key={o.id} style={{borderTop:"1px solid #F3F4F6",background:o.selected?"#F0F4FF":"#fff",animation:`fadeIn 0.1s ease-out ${Math.min(i*0.01,0.3)}s both`}}>
                          <td style={{...TD,textAlign:"center"}}><input type="checkbox" checked={o.selected} onChange={()=>toggleSelect(o.id)} style={{width:14,height:14,cursor:"pointer",accentColor:"#111827"}}/></td>
                          <td style={{...TD,fontSize:10.5,color:"#9CA3AF"}}>{o.no}</td>
                          <td style={TD}><Badge color={siteConf.color} bg={`${siteConf.color}24`}>{siteConf.icon}{siteConf.short}</Badge></td>
                          <td style={{...TD,cursor:"pointer"}} onClick={()=>setDetailModal(o)}><span style={{fontWeight:600,color:"#2563EB",fontSize:10.5}}>{o.id.slice(-10)}</span></td>
                          <td style={{...TD,maxWidth:170}}><div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:500,fontSize:11.5}}>{o.product}</div></td>
                          <td style={{...TD,fontSize:11}}>{o.supplier}</td>
                          <td style={TD}><div style={{fontWeight:500,fontSize:11.5}}>{o.buyer}</div></td>
                          <td style={{...TD,textAlign:"right",fontWeight:700,fontSize:11.5}}>₩{o.total.toLocaleString()}</td>
                          <td style={{...TD,textAlign:"center"}}>{bjSt?<Badge color={bjSt.color} bg={bjSt.bg}><Dot color={bjSt.color}/>{bjSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}</td>
                          <td style={{...TD,textAlign:"center"}}>{fgSt?<Badge color={fgSt.color} bg={fgSt.bg}><Dot color={fgSt.color}/>{fgSt.label}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}</td>
                          <td style={{...TD,textAlign:"center"}}>{o.matched?<Badge color={o.statusDiff?"#F59E0B":"#10B981"} bg={o.statusDiff?"#FEF3C7":"#D1FAE5"}>{o.statusDiff?"⚠️불일치":"✅일치"}</Badge>:<span style={{color:"#D1D5DB",fontSize:10}}>—</span>}</td>
                          {(isInvoicePage||quickFilter==="noInvoice")&&(<><td style={{...TD,fontSize:10.5,color:o.carrier?"#374151":"#D1D5DB"}}>{o.carrier?.name||"—"}</td><td style={{...TD,fontFamily:"monospace",fontSize:10.5,color:o.invoice?"#374151":"#D1D5DB"}}>{o.invoice||"—"}</td></>)}
                        </tr>);
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{padding:"8px 14px",borderTop:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",fontSize:10.5,color:"#6B7280"}}>
                  <span>{filtered.length}건 (전체 {orders.length}건)</span>
                  <span>합계: <b style={{color:"#111827"}}>₩{filtered.reduce((a,b)=>a+b.total,0).toLocaleString()}</b></span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ═══ MODALS ════════════════════════════════════════ */}
      <Modal open={!!detailModal} onClose={()=>setDetailModal(null)} title="주문 상세" width={560}>
        {detailModal&&(()=>{const o=detailModal,site=SITES[o.site],os=ORDER_STATUS[o.orderStatus],ss=SUPPLY_STATUS[o.supplyStatus];return(<div style={{display:"flex",flexDirection:"column",gap:12}}><div style={{display:"flex",gap:6,flexWrap:"wrap"}}><Badge color={site.color} bg={`${site.color}24`}>{site.icon} {site.name}</Badge><Badge color={os.color} bg={os.bg}><Dot color={os.color}/>{os.label}</Badge><Badge color={ss.color} bg={ss.bg}>{ss.label}</Badge><Badge color="#DC2626" bg="#FEE2E2">⛔ 읽기 전용</Badge></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[["주문번호",o.id],["No",o.no],["상품",o.product],["옵션",o.optCode],["판매사",o.seller],["공급사",o.supplier],["주문자",`${o.buyer}/${o.phone}`],["주소",o.address],["수량",`${o.qty}개`],["금액",`₩${o.total.toLocaleString()}`],["택배사",o.carrier?.name||"미등록"],["송장",o.invoice||"미등록"]].map(([k,v],i)=>(<div key={i} style={{padding:"8px 10px",background:"#F9FAFB",borderRadius:7}}><div style={{fontSize:9.5,color:"#6B7280",fontWeight:600,marginBottom:2}}>{k}</div><div style={{fontSize:11.5,fontWeight:600}}>{v}</div></div>))}</div></div>);})()}
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
          <div><label style={{fontSize:11,fontWeight:600,color:"#6B7280",marginBottom:4,display:"block"}}>권한</label><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{Object.entries(PERMISSION_LABELS).map(([k,label])=>{const has=newMember.permissions.includes(k);return(<button key={k} onClick={()=>setNewMember(p=>({...p,permissions:has?p.permissions.filter(x=>x!==k):[...p.permissions,k]}))} style={{padding:"5px 12px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",background:has?"#111827":"#F3F4F6",color:has?"#fff":"#6B7280",border:"none"}}>{has?"✓ ":""}{label}</button>);})}</div></div>
          <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}><Btn onClick={()=>setAddMemberModal(false)} variant="outline" small>취소</Btn><Btn onClick={addMember} variant="primary" small>추가</Btn></div>
        </div>
      </Modal>

      {/* ═══ Preset Modal ═══ */}
      <Modal open={presetModal} onClose={()=>setPresetModal(false)} title="⚡ 탭 프리셋" width={480}>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {/* 현재 탭 빠른 저장 */}
          {openTabs.length>0&&(
            <div style={{padding:14,background:"#F0F4FF",borderRadius:10,border:"1px solid #DBEAFE"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#1E40AF",marginBottom:8}}>💾 현재 탭 빠른 저장</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {openTabs.map(t=>(<span key={t.key} style={{padding:"3px 8px",borderRadius:6,background:"#fff",border:"1px solid #DBEAFE",fontSize:11,fontWeight:600,color:"#374151"}}>{t.icon} {t.label}</span>))}
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
              <span onClick={()=>{navigatePage("settings_preset");setPresetModal(false);}} style={{fontSize:11,color:"#3B82F6",cursor:"pointer",fontWeight:600}}>⚙️ 프리셋 설정 →</span>
            </div>
            {tabPresets.length===0&&(<div style={{fontSize:12,color:"#9CA3AF",padding:20,textAlign:"center"}}>저장된 프리셋이 없습니다</div>)}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {tabPresets.map(preset=>(
                <div key={preset.id} onClick={()=>loadPreset(preset)} style={{padding:12,borderRadius:10,border:"1px solid #E5E7EB",background:"#fff",cursor:"pointer",transition:"all 0.15s"}} onMouseOver={e=>e.currentTarget.style.borderColor="#3B82F6"} onMouseOut={e=>e.currentTarget.style.borderColor="#E5E7EB"}>
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
      <Agentation />
    </div>
  );
}