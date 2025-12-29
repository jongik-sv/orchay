/**
 * 설정 JSON 스키마 타입 정의
 * Task: TSK-02-03-01
 * 기술설계: 010-tech-design.md
 */

// ============================================================
// Column (칸반 컬럼) 타입 정의
// PRD 5.1 기반 6단계 칸반 컬럼
// ============================================================

/**
 * 칸반 컬럼 정의
 */
export interface Column {
  /** 컬럼 ID (고유 식별자) */
  id: string;
  /** 컬럼 표시명 */
  name: string;
  /** 단일 상태 코드 (statusCodes와 상호 배타적) */
  statusCode?: string;
  /** 복수 상태 코드 (statusCode와 상호 배타적) */
  statusCodes?: string[];
  /** 표시 순서 (1부터 시작) */
  order: number;
  /** 컬럼 색상 (hex) */
  color: string;
  /** 컬럼 설명 */
  description: string;
}

/**
 * columns.json 설정 파일 스키마
 */
export interface ColumnsConfig {
  /** JSON 스키마 참조 (선택) */
  $schema?: string;
  /** 설정 버전 */
  version: string;
  /** 칸반 컬럼 목록 */
  columns: Column[];
}

// ============================================================
// Category (카테고리) 타입 정의
// PRD 4.3 기반 3가지 카테고리
// ============================================================

/**
 * 카테고리 정의
 */
export interface Category {
  /** 카테고리 ID (고유 식별자) */
  id: string;
  /** 카테고리 표시명 */
  name: string;
  /** 카테고리 코드 (약어) */
  code: string;
  /** 카테고리 색상 (hex) */
  color: string;
  /** 아이콘 (PrimeIcons) */
  icon: string;
  /** 카테고리 설명 */
  description: string;
  /** 연결된 워크플로우 ID */
  workflowId: string;
}

/**
 * categories.json 설정 파일 스키마
 */
export interface CategoriesConfig {
  /** JSON 스키마 참조 (선택) */
  $schema?: string;
  /** 설정 버전 */
  version: string;
  /** 카테고리 목록 */
  categories: Category[];
}

// ============================================================
// Workflow (워크플로우) 타입 정의 - 확장 스키마 v2.0
// ============================================================

/**
 * 상태 정의 (확장 스키마)
 */
export interface StateDefinition {
  /** 상태 ID (kebab-case) */
  id: string;
  /** 상태 표시명 (한글) */
  label: string;
  /** 상태 표시명 (영문) */
  labelEn: string;
  /** PrimeIcons 아이콘 */
  icon: string;
  /** HEX 색상 */
  color: string;
  /** PrimeVue severity */
  severity: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'danger';
  /** 진행률 가중치 (0-100) */
  progressWeight: number;
  /** 워크플로우 단계 (todo, design, implement, done) */
  phase: 'todo' | 'design' | 'implement' | 'done';
}

/**
 * 명령어 정의 (확장 스키마)
 */
export interface CommandDefinition {
  /** 명령어 표시명 (한글) */
  label: string;
  /** 명령어 표시명 (영문) */
  labelEn: string;
  /** PrimeIcons 아이콘 */
  icon: string;
  /** PrimeVue severity */
  severity: string;
  /** 상태 내 액션 여부 (true: 상태 전이 없음) */
  isAction?: boolean;
}

/**
 * 워크플로우 전이 규칙 (확장 스키마)
 */
export interface WorkflowTransition {
  /** 시작 상태 코드 */
  from: string;
  /** 종료 상태 코드 */
  to: string;
  /** 전이 명령어 */
  command: string;
  /** 전이 시 생성할 문서 (선택, 하위호환성) */
  document?: string | null;
  /** 전이 레이블 (선택, 하위호환성) */
  label?: string;
}

/**
 * 워크플로우 정의 (확장 스키마)
 */
export interface WorkflowDefinition {
  /** 워크플로우 표시명 */
  name: string;
  /** 포함된 상태 코드 목록 (순서대로) */
  states: string[];
  /** 상태 전이 규칙 목록 */
  transitions: WorkflowTransition[];
  /** 상태별 허용 액션 */
  actions?: Record<string, string[]>;
}

/**
 * workflows.json 설정 파일 스키마 (확장 v2.0)
 */
export interface WorkflowsConfig {
  /** JSON 스키마 참조 (선택) */
  $schema?: string;
  /** 설정 버전 */
  version: string;
  /** 상태 정의 맵 (상태코드 → StateDefinition) */
  states: Record<string, StateDefinition>;
  /** 명령어 정의 맵 (명령어 → CommandDefinition) */
  commands: Record<string, CommandDefinition>;
  /** 워크플로우 정의 맵 (카테고리 → WorkflowDefinition) */
  workflows: Record<string, WorkflowDefinition>;
}

// ============================================================
// 하위 호환성 타입 (v1.0 스키마)
// ============================================================

/**
 * @deprecated v1.0 스키마 - v2.0 WorkflowDefinition 사용 권장
 */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  states: string[];
  initialState?: string;
  finalStates?: string[];
  transitions: WorkflowTransition[];
}

/**
 * @deprecated v1.0 스키마 - v2.0 WorkflowsConfig 사용 권장
 */
export interface WorkflowsConfigV1 {
  $schema?: string;
  version: string;
  workflows: Workflow[];
}

// ============================================================
// Action (상태 내 액션) 타입 정의
// PRD 5.3 기반 상태 변경 없는 액션
// ============================================================

/**
 * 상태 내 액션 정의
 */
export interface Action {
  /** 액션 ID (고유 식별자) */
  id: string;
  /** 액션 표시명 */
  name: string;
  /** 액션 명령어 (wf:ui, wf:review 등) */
  command: string;
  /** 허용된 상태 코드 목록 */
  allowedStates: string[];
  /** 허용된 카테고리 ID 목록 */
  allowedCategories: string[];
  /** 생성할 문서 파일명 (null이면 문서 없음, 템플릿 문자열 포함 가능) */
  document: string | null;
  /** 액션 설명 */
  description: string;
}

/**
 * actions.json 설정 파일 스키마
 */
export interface ActionsConfig {
  /** JSON 스키마 참조 (선택) */
  $schema?: string;
  /** 설정 버전 */
  version: string;
  /** 액션 목록 */
  actions: Action[];
}

// ============================================================
// 통합 Settings 타입
// ============================================================

/**
 * 전체 설정 통합 인터페이스
 * - categories: workflows.workflows 키에서 파생
 * - actions: workflows.workflows[category].actions + workflows.commands에서 파생
 */
export interface Settings {
  /** 칸반 컬럼 설정 */
  columns: ColumnsConfig;
  /** 워크플로우 설정 (categories, actions 포함) */
  workflows: WorkflowsConfig;
}

// ============================================================
// 설정 타입 가드 및 유틸리티
// ============================================================

/**
 * 설정 파일 타입 열거형
 */
export type SettingsFileType = 'columns' | 'workflows';

/**
 * 설정 파일명 매핑
 */
export const SETTINGS_FILE_NAMES: Record<SettingsFileType, string> = {
  columns: 'columns.json',
  workflows: 'workflows.json',
} as const;
