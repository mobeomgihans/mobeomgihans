/**
 * FloatingToolbar 사용 예시 (복사해서 사용)
 */
import FloatingToolbar from "./FloatingToolbar";

// 1) 기본 — 이미지와 동일한 다크 툴바
<FloatingToolbar buttons={[
  { icon:"pause", label:"일시정지", onClick:() => {} },
  { icon:"eye",   label:"보기",     onClick:() => {} },
  { icon:"copy",  label:"복제",     onClick:() => {} },
  { icon:"trash", label:"삭제",     onClick:() => {}, variant:"danger" },
  { divider:true },
  { icon:"settings", label:"설정",  onClick:() => {} },
  { icon:"close",    label:"닫기",  onClick:() => {} },
]} />

// 2) 블러 테마 + 우하단
<FloatingToolbar theme="blur" position="bottom-right" buttons={[
  { icon:"edit",     label:"수정",   onClick:() => {}, variant:"primary" },
  { icon:"download", label:"다운로드", onClick:() => {}, variant:"success" },
  { icon:"trash",    label:"삭제",   onClick:() => {}, variant:"danger" },
]} />

// 3) 선택 항목 연동 (visible로 토글)
<FloatingToolbar visible={selected.length > 0} buttons={[
  { icon:"check", label:`${selected.length}건`, active:true },
  { divider:true },
  { icon:"send",  label:"전송",   onClick:() => {}, variant:"primary" },
  { icon:"trash", label:"삭제",   onClick:() => {}, variant:"danger" },
  { icon:"close", label:"해제",   onClick:() => setSelected([]) },
]} />

/**
 * 아이콘: pause, play, eye, copy, trash, settings, close,
 *         download, edit, check, refresh, filter, send
 * 테마:   "dark" | "light" | "blur"
 * 위치:   "bottom-center" | "bottom-left" | "bottom-right" |
 *         "top-center" | "top-left" | "top-right" | {top,left,...}
 * 사이즈: "sm" | "md" | "lg"
 * variant: "default" | "danger" | "success" | "primary" | "warning"
 */
