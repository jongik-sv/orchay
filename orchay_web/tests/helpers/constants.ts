/**
 * 테스트 상수 정의
 * @description 테스트 전반에서 사용되는 타임아웃, 폴링 값 등의 상수
 */

/**
 * 테스트 타임아웃 설정
 */
export const TEST_TIMEOUTS = {
  /** Debounce 대기 시간 (ms) */
  DEBOUNCE_WAIT: 350,
  /** Debounce 안전 마진 (ms) - debounce + margin */
  DEBOUNCE_SAFETY_MARGIN: 50,
  /** 애니메이션 완료 대기 시간 (ms) */
  ANIMATION: 200,
  /** 페이지 준비 완료 대기 (ms) */
  PAGE_READY: 30000,
  /** WBS 데이터 로딩 대기 (ms) */
  WBS_LOAD: 15000,
  /** API 응답 대기 (ms) */
  API_RESPONSE: 7500,
  /** 렌더링 안정화 대기 (ms) */
  RENDER_STABILIZATION: 100
} as const;

/**
 * 폴링 설정
 */
export const POLLING = {
  /** 기본 타임아웃 (ms) */
  DEFAULT_TIMEOUT: 5000,
  /** 기본 폴링 간격 (ms) */
  DEFAULT_INTERVAL: 50
} as const;

/**
 * Console 필터링 패턴
 */
export const SUPPRESSED_WARNINGS = [
  'Extraneous non-props',
  'Hydration',
  'experimental'
] as const;

export const SUPPRESSED_ERRORS = [
  'Not implemented: HTMLFormElement.prototype.submit',
  'Not implemented: navigation'
] as const;

/**
 * 유효한 ARIA role 목록
 */
export const VALID_ARIA_ROLES = [
  'button',
  'link',
  'navigation',
  'main',
  'region',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'form',
  'dialog',
  'alert',
  'alertdialog',
  'menu',
  'menubar',
  'menuitem',
  'tab',
  'tablist',
  'tabpanel',
  'tree',
  'treeitem',
  'listbox',
  'option',
  'grid',
  'row',
  'cell',
  'columnheader',
  'rowheader',
  'group',
  'heading',
  'img',
  'list',
  'listitem',
  'status',
  'tooltip',
  'progressbar',
  'slider',
  'spinbutton',
  'checkbox',
  'radio',
  'radiogroup',
  'switch',
  'textbox',
  'combobox',
  'separator',
  'scrollbar',
  'log',
  'marquee',
  'timer',
  'presentation',
  'none',
  'document',
  'article',
  'note',
  'figure',
  'definition',
  'term',
  'math',
  'application',
  'toolbar'
] as const;
