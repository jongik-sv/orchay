/**
 * Workflow Configuration Types
 * Schema v2.0 from .orchay/settings/workflows.json
 */

import type { TaskCategory } from './index'

/**
 * Workflow state definition (e.g., [ ], [bd], [dd], etc.)
 */
export interface WorkflowStateConfig {
  id: string              // 상태 ID (e.g., "todo", "basic-design")
  label: string          // 한국어 레이블 (e.g., "", "기본설계")
  labelEn: string        // 영문 레이블 (e.g., "Todo", "Basic Design")
  icon: string           // PrimeIcons 클래스 (e.g., "pi-inbox")
  color: string          // HEX 색상 (e.g., "#6b7280")
  severity: string       // PrimeVue severity (e.g., "secondary", "info", "success")
  progressWeight: number // 진행률 가중치 (0-100)
}

/**
 * Workflow command definition (e.g., start, draft, build, etc.)
 */
export interface WorkflowCommandConfig {
  label: string          // 한국어 레이블 (e.g., "시작", "상세설계")
  labelEn: string        // 영문 레이블 (e.g., "Start", "Draft")
  icon: string           // PrimeIcons 클래스 (e.g., "pi-play")
  severity: string       // PrimeVue severity
  isAction?: boolean     // 액션 여부 (상태 전이 외 작업)
}

/**
 * State transition definition
 */
export interface WorkflowTransition {
  from: string           // 시작 상태 코드 (e.g., "[ ]")
  to: string             // 종료 상태 코드 (e.g., "[bd]")
  command: string        // 전이 명령어 (e.g., "start")
}

/**
 * Workflow definition for a category
 */
export interface WorkflowDefinition {
  name: string                                  // 워크플로우 이름
  states: string[]                              // 상태 코드 배열 (순서 중요)
  transitions: WorkflowTransition[]             // 허용된 전이 목록
  actions: Record<string, string[]>             // 상태별 액션 매핑 (e.g., { "[bd]": ["ui"] })
}

/**
 * Complete workflows configuration (v2.0)
 */
export interface WorkflowsConfig {
  version: string                                      // 설정 버전 (e.g., "2.0")
  states: Record<string, WorkflowStateConfig>          // 상태 코드 → 설정 매핑
  commands: Record<string, WorkflowCommandConfig>      // 명령어 → 설정 매핑
  workflows: Record<TaskCategory, WorkflowDefinition>  // 카테고리별 워크플로우
}

/**
 * Workflow step with full information (for UI rendering)
 */
export interface WorkflowStepInfo {
  code: string                    // 상태 코드 (e.g., "[bd]")
  label: string                   // 레이블 (한국어)
  labelEn: string                 // 레이블 (영문)
  icon: string                    // 아이콘
  color: string                   // 색상
  severity: string                // PrimeVue severity
  progressWeight: number          // 진행률 가중치
}

/**
 * Command with full information (for button rendering)
 */
export interface WorkflowCommandInfo {
  command: string                 // 명령어 키 (e.g., "start")
  label: string                   // 레이블 (한국어)
  labelEn: string                 // 레이블 (영문)
  icon: string                    // 아이콘
  severity: string                // PrimeVue severity
  isAction: boolean               // 액션 여부
}
