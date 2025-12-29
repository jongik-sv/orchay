/**
 * Workflow Commands - 워크플로우 명령어 정의
 * Task: TSK-02-01
 * 상세설계: 020-detail-design.md 섹션 2, 4
 *
 * @deprecated This file is being phased out in favor of useWorkflowConfig() composable
 * which reads from .orchay/settings/workflows.json for dynamic configuration.
 *
 * Migration guide:
 * - WORKFLOW_COMMANDS → useWorkflowConfig().getAvailableTransitions() + getStateActions()
 * - isCommandAvailable() → useWorkflowConfig().getAvailableTransitions() includes check
 * - getFilteredCommands() → useWorkflowConfig().getAvailableTransitions() + getStateActions()
 */

import type { TaskCategory } from '~/types/index'

// ============================================================
// Types
// ============================================================

/**
 * PrimeVue Button severity 타입
 */
export type ButtonSeverity = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'contrast'

/**
 * 워크플로우 명령어 인터페이스
 * 상세설계 섹션 2.1
 */
export interface WorkflowCommand {
  /** 명령어 식별자 (예: 'start', 'build') */
  name: string
  /** 버튼 표시 텍스트 */
  label: string
  /** PrimeIcons 클래스명 */
  icon: string
  /** PrimeVue Button severity */
  severity: ButtonSeverity
  /** 사용 가능한 상태 코드 목록 */
  availableStatuses: string[]
  /** 사용 가능한 카테고리 목록 */
  categories: TaskCategory[]
}

/**
 * 필터링된 명령어 인터페이스
 * 상세설계 섹션 3.1 FilteredCommand
 */
export interface FilteredCommand extends WorkflowCommand {
  /** 현재 상태/카테고리에서 사용 가능 여부 */
  available: boolean
}

// ============================================================
// Constants
// ============================================================

/**
 * 모든 카테고리를 포함하는 배열
 */
const ALL_CATEGORIES: TaskCategory[] = ['development', 'defect', 'infrastructure']

/**
 * 워크플로우 명령어 배열
 * 상세설계 섹션 4.1
 */
export const WORKFLOW_COMMANDS: WorkflowCommand[] = [
  {
    name: 'start',
    label: '시작',
    icon: 'pi-play',
    severity: 'primary',
    availableStatuses: ['[ ]'],
    categories: ALL_CATEGORIES,
  },
  {
    name: 'ui',
    label: 'UI설계',
    icon: 'pi-palette',
    severity: 'info',
    availableStatuses: ['[bd]'],
    categories: ['development'],
  },
  {
    name: 'draft',
    label: '상세설계',
    icon: 'pi-pencil',
    severity: 'info',
    availableStatuses: ['[bd]'],
    categories: ['development'],
  },
  {
    name: 'review',
    label: '리뷰',
    icon: 'pi-eye',
    severity: 'secondary',
    availableStatuses: ['[dd]'],
    categories: ['development'],
  },
  {
    name: 'apply',
    label: '적용',
    icon: 'pi-check',
    severity: 'secondary',
    availableStatuses: ['[dd]'],
    categories: ['development'],
  },
  {
    name: 'build',
    label: '구현',
    icon: 'pi-wrench',
    severity: 'warning',
    availableStatuses: ['[dd]', '[ds]'],
    categories: ['development', 'infrastructure'],
  },
  {
    name: 'test',
    label: '테스트',
    icon: 'pi-bolt',
    severity: 'secondary',
    availableStatuses: ['[im]'],
    categories: ['development'],
  },
  {
    name: 'audit',
    label: '코드리뷰',
    icon: 'pi-search',
    severity: 'secondary',
    availableStatuses: ['[im]', '[fx]'],
    categories: ALL_CATEGORIES,
  },
  {
    name: 'patch',
    label: '패치',
    icon: 'pi-file-edit',
    severity: 'secondary',
    availableStatuses: ['[im]', '[fx]'],
    categories: ALL_CATEGORIES,
  },
  {
    name: 'verify',
    label: '검증',
    icon: 'pi-verified',
    severity: 'success',
    availableStatuses: ['[im]', '[fx]'],
    categories: ['development', 'defect'],
  },
  {
    name: 'done',
    label: '완료',
    icon: 'pi-check-circle',
    severity: 'success',
    availableStatuses: ['[vf]', '[im]'],
    categories: ALL_CATEGORIES,
  },
  {
    name: 'fix',
    label: '수정',
    icon: 'pi-wrench',
    severity: 'danger',
    availableStatuses: ['[an]'],
    categories: ['defect'],
  },
  {
    name: 'skip',
    label: '생략',
    icon: 'pi-forward',
    severity: 'secondary',
    availableStatuses: ['[ ]'],
    categories: ['infrastructure'],
  },
]

// ============================================================
// Functions
// ============================================================

/**
 * 명령어 가용성 검사 함수
 * 상세설계 섹션 4.2
 *
 * @param command - 검사할 명령어
 * @param status - Task 현재 상태 (예: '[ ]', '[bd]', '[dd]')
 * @param category - Task 카테고리
 * @returns 사용 가능 여부
 */
export function isCommandAvailable(
  command: WorkflowCommand,
  status: string,
  category: TaskCategory
): boolean {
  // 1. command.availableStatuses에 status 포함 여부 확인
  const statusMatch = command.availableStatuses.includes(status)

  // 2. command.categories에 category 포함 여부 확인
  const categoryMatch = command.categories.includes(category)

  // 3. 둘 다 true일 때만 true 반환
  return statusMatch && categoryMatch
}

/**
 * Task 상태와 카테고리에 맞게 필터링된 명령어 목록 반환
 *
 * @param status - Task 현재 상태
 * @param category - Task 카테고리
 * @returns 가용성 정보가 포함된 명령어 목록
 */
export function getFilteredCommands(
  status: string,
  category: TaskCategory
): FilteredCommand[] {
  return WORKFLOW_COMMANDS.map(command => ({
    ...command,
    available: isCommandAvailable(command, status, category),
  }))
}

/**
 * 상태 코드 추출 함수
 * wbs.md의 status 필드에서 상태 코드 추출
 * 예: "implement [im]" → "[im]"
 *
 * @param statusString - 전체 상태 문자열
 * @returns 상태 코드 (예: '[im]')
 */
export function extractStatusCode(statusString: string): string {
  const match = statusString.match(/\[([^\]]+)\]/)
  return match ? `[${match[1]}]` : '[ ]'
}
