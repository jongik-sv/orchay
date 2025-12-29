/**
 * workflowFilter - 워크플로우 명령어 필터링 로직 (서버 측)
 * Task: TSK-02-02
 * 상세설계: 020-detail-design.md 섹션 6
 *
 * 책임:
 * - Task 상태/카테고리에 따른 사용 가능 명령어 필터링 (UI 버튼용)
 * - 상태 코드 추출 (기존 statusUtils를 대괄호 포함 형태로 래핑)
 *
 * NOTE: 이 파일은 클라이언트의 app/utils/workflowCommands.ts와 동일한 구조를 제공하며,
 * UI 버튼 스타일링을 위한 정보를 포함합니다.
 * 실제 전이 가능 여부는 workflow/transitionService.ts의 getAvailableCommands()를 사용하세요.
 */

import type { TaskCategory } from '~/types/index'
import { extractStatusCode as extractCode } from './workflow/statusUtils'

// ============================================================
// Types
// ============================================================

/**
 * PrimeVue Button severity 타입
 */
export type ButtonSeverity = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger' | 'contrast'

/**
 * 워크플로우 명령어 인터페이스
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
 * app/utils/workflowCommands.ts와 동일한 구조
 */
const WORKFLOW_COMMANDS: WorkflowCommand[] = [
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
    name: 'approve',
    label: '승인',
    icon: 'pi-check-circle',
    severity: 'success',
    availableStatuses: ['[dd]'],
    categories: ['development'],
  },
  {
    name: 'build',
    label: '구현',
    icon: 'pi-wrench',
    severity: 'warning',
    availableStatuses: ['[ap]', '[ds]'],
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
 * 명령어 가용성 검사
 *
 * @param command - 검사할 명령어
 * @param status - Task 현재 상태 (예: '[ ]', '[bd]', '[dd]')
 * @param category - Task 카테고리
 * @returns 사용 가능 여부
 */
function isCommandAvailable(
  command: WorkflowCommand,
  status: string,
  category: TaskCategory
): boolean {
  const statusMatch = command.availableStatuses.includes(status)
  const categoryMatch = command.categories.includes(category)
  return statusMatch && categoryMatch
}

/**
 * 필터링된 명령어 목록 반환
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
    available: isCommandAvailable(command, status, category)
  }))
}

/**
 * 사용 가능한 명령어만 반환 (UI 버튼용)
 *
 * NOTE: 실제 전이 가능 여부는 workflow/transitionService.ts의 getAvailableCommands()를 사용하세요.
 * 이 함수는 UI 버튼 스타일링 정보를 포함한 필터링된 명령어 목록을 반환합니다.
 *
 * @param status - Task 현재 상태
 * @param category - Task 카테고리
 * @returns 사용 가능한 명령어 목록 (UI 버튼 정보 포함)
 */
export function getAvailableCommandsForUI(
  status: string,
  category: TaskCategory
): FilteredCommand[] {
  return getFilteredCommands(status, category).filter(cmd => cmd.available)
}

/**
 * 상태 코드 추출 (대괄호 포함 형태)
 * wbs.md의 status 필드에서 상태 코드 추출
 * 예: "implement [im]" → "[im]"
 *
 * NOTE: 내부적으로 workflow/statusUtils.ts의 extractStatusCode를 사용
 *
 * @param statusString - 전체 상태 문자열
 * @returns 상태 코드 (예: '[im]')
 */
export function extractStatusCodeWithBrackets(statusString: string): string {
  const code = extractCode(statusString)
  return code ? `[${code}]` : '[ ]'
}
