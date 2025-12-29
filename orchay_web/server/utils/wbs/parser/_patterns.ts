/**
 * WBS Parser 정규식 패턴
 * Task: TSK-02-02-01
 * 상세설계: 020-detail-design.md 섹션 2.3
 */

// 헤더 패턴: ## WP-01: Title 형식
export const HEADER_PATTERN = /^(#{2,4})\s+(WP|ACT|TSK)-[\d-]+:\s*(.+)$/;

// ID 패턴
export const WP_ID_PATTERN = /^WP-\d{2}$/;
export const ACT_ID_PATTERN = /^ACT-\d{2}-\d{2}$/;
export const TSK_3LEVEL_PATTERN = /^TSK-\d{2}-\d{2}$/;
export const TSK_4LEVEL_PATTERN = /^TSK-\d{2}-\d{2}-\d{2}$/;

// 상태 코드 추출: "done [xx]" → "[xx]"
export const STATUS_PATTERN = /\[([^\]]+)\]$/;

// 일정 범위: "2025-12-01 ~ 2025-12-31"
export const SCHEDULE_PATTERN = /^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/;

// 속성 라인: "- key: value"
export const ATTRIBUTE_PATTERN = /^-\s+(\w+):\s*(.*)$/;

// 들여쓰기 리스트 아이템: "  - item"
export const INDENT_LIST_PATTERN = /^(\s{2,}|\t+)-\s*(.+)$/;

// 유효한 카테고리 값
export const VALID_CATEGORIES = ['development', 'defect', 'infrastructure'] as const;

// 유효한 우선순위 값
export const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
