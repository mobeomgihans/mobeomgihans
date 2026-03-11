import { useState } from "react";

// ─── 아이콘 (stroke SVG, 필요한 것만 남기고 추가/삭제 가능) ───
const I = (d, extra) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{extra}{typeof d==="string"?<path d={d}/>:d}</svg>;
const ICONS = {
  pause:    I(null, <><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></>),
  play:     I(null, <polygon points="5 3 19 12 5 21 5 3"/>),
  eye:      I(null, <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>),
  copy:     I(null, <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>),
  trash:    I(null, <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></>),
  settings: I(null, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>),
  close:    I(null, <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  download: I(null, <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
  edit:     I(null, <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
  check:    I(null, <polyline points="20 6 9 17 4 12"/>),
  refresh:  I(null, <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></>),
  filter:   I(null, <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>),
  send:     I(null, <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>),
};

// ─── 버튼 variant별 색상 ────────────────────────────
const V = {
  default: { c: "#D1D5DB", hc: "#FFF",    hb: "rgba(255,255,255,0.1)"  },
  danger:  { c: "#D1D5DB", hc: "#F87171", hb: "rgba(248,113,113,0.15)" },
  success: { c: "#D1D5DB", hc: "#34D399", hb: "rgba(52,211,153,0.15)"  },
  primary: { c: "#D1D5DB", hc: "#818CF8", hb: "rgba(129,140,248,0.15)" },
  warning: { c: "#D1D5DB", hc: "#FBBF24", hb: "rgba(251,191,36,0.15)"  },
};

// ─── 개별 버튼 ──────────────────────────────────────
function Btn({ icon, label, onClick, variant="default", active, disabled, size=36 }) {
  const [h, setH] = useState(false);
  const v = V[variant] || V.default;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      title={label}
      disabled={disabled}
      style={{
        width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center",
        background: h ? v.hb : active ? "rgba(255,255,255,0.12)" : "transparent",
        border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
        color: active ? "#fff" : h ? v.hc : v.c,
        transition: "all 0.15s", opacity: disabled ? 0.4 : 1, position: "relative", flexShrink: 0,
      }}
    >
      {typeof icon === "string" ? ICONS[icon] : icon}
      {h && label && <span style={{
        position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)",
        background:"#1F2937", color:"#F9FAFB", padding:"4px 10px", borderRadius:6,
        fontSize:11, fontWeight:600, whiteSpace:"nowrap", pointerEvents:"none",
        boxShadow:"0 4px 12px rgba(0,0,0,0.3)", zIndex:10,
      }}>{label}</span>}
    </button>
  );
}

// ─── 구분선 ──────────────────────────────────────────
const Divider = () => <div style={{width:1, height:20, background:"rgba(255,255,255,0.12)", margin:"0 2px", flexShrink:0}}/>;

/**
 * FloatingToolbar
 *
 * @example 기본 (이미지 동일)
 * <FloatingToolbar
 *   buttons={[
 *     { icon:"pause", label:"일시정지", onClick:fn },
 *     { icon:"eye",   label:"보기",     onClick:fn },
 *     { icon:"copy",  label:"복제",     onClick:fn },
 *     { icon:"trash", label:"삭제",     onClick:fn, variant:"danger" },
 *     { divider:true },
 *     { icon:"settings", label:"설정",  onClick:fn },
 *     { icon:"close",    label:"닫기",  onClick:fn },
 *   ]}
 * />
 *
 * @param buttons  - 버튼 배열 [{icon,label,onClick,variant?,active?,disabled?}] 또는 {divider:true}
 * @param position - "bottom-center"|"bottom-left"|"bottom-right"|"top-center"|{top,left,...}
 * @param visible  - 표시 여부 (애니메이션)
 * @param theme    - "dark"|"light"|"blur"
 * @param size     - "sm"|"md"|"lg"
 */
export default function FloatingToolbar({ buttons=[], position="bottom-center", visible=true, theme="dark", size="md", style:cs }) {
  const pos = {
    "bottom-center": { bottom:24, left:"50%", transform:"translateX(-50%)" },
    "bottom-left":   { bottom:24, left:24 },
    "bottom-right":  { bottom:24, right:24 },
    "top-center":    { top:24, left:"50%", transform:"translateX(-50%)" },
    "top-left":      { top:24, left:24 },
    "top-right":     { top:24, right:24 },
  };
  const p = typeof position==="string" ? pos[position] : position;

  const themes = {
    dark: { background:"rgba(17,24,39,0.92)",       border:"1px solid rgba(255,255,255,0.08)", boxShadow:"0 8px 32px rgba(0,0,0,0.4)" },
    light:{ background:"rgba(255,255,255,0.95)",     border:"1px solid rgba(0,0,0,0.08)",       boxShadow:"0 8px 32px rgba(0,0,0,0.12)" },
    blur: { background:"rgba(17,24,39,0.72)",        border:"1px solid rgba(255,255,255,0.1)",  boxShadow:"0 8px 32px rgba(0,0,0,0.3)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)" },
  };
  const t = themes[theme] || themes.dark;
  const s = size==="sm"?30:size==="lg"?42:36;

  return (
    <div style={{
      position:"fixed", ...p, zIndex:9999,
      display:"flex", alignItems:"center", gap:2,
      padding:size==="sm"?"4px 6px":size==="lg"?"8px 10px":"6px 8px",
      borderRadius:14, ...t,
      opacity:visible?1:0,
      transform:`${p?.transform||""} translateY(${visible?0:12}px)`,
      transition:"opacity 0.25s ease, transform 0.25s ease",
      pointerEvents:visible?"auto":"none",
      ...cs,
    }}>
      {buttons.map((b,i) => b.divider
        ? <Divider key={`d${i}`}/>
        : <Btn key={`${b.icon}-${i}`} {...b} size={s}/>
      )}
    </div>
  );
}

export { Btn as ToolbarButton, Divider as ToolbarDivider, ICONS };
