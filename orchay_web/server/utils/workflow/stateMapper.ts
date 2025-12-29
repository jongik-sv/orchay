/**
 * 상태 코드 ↔ 상태명 매핑 유틸리티
 * Task: TSK-03-04
 * 상세설계: 020-detail-design.md 섹션 4
 *
 * status code ([bd]) ↔ state name (basic-design) 양방향 매핑
 */

import type { TaskCategory } from '../../../types';
import type { WorkflowDefinition } from '../../../types/settings';
import { getWorkflows } from '../settings';
import { createNotFoundError } from '../errors/standardError';

/**
 * 카테고리별 워크플로우 조회 (공통 헬퍼)
 * @param category - Task 카테고리
 * @param throwOnNotFound - 없을 때 에러 발생 여부 (기본: false)
 * @returns WorkflowDefinition 또는 null
 * @throws WORKFLOW_NOT_FOUND (throwOnNotFound가 true일 때)
 */
async function getWorkflowByCategory(
  category: TaskCategory,
  throwOnNotFound = false
): Promise<WorkflowDefinition | null> {
  const workflows = await getWorkflows();
  // v2.0: Record 접근
  const workflow = workflows.workflows[category];

  if (!workflow && throwOnNotFound) {
    throw createNotFoundError(
      `카테고리 '${category}'에 해당하는 워크플로우를 찾을 수 없습니다`
    );
  }

  return workflow || null;
}

/**
 * 상태 코드를 상태명으로 변환
 * @param category - Task 카테고리
 * @param statusCode - 상태 코드 (예: "bd", "[ ]")
 * @returns 상태명 (예: "basic-design", "todo")
 */
export async function statusCodeToName(
  category: TaskCategory,
  statusCode: string
): Promise<string | null> {
  const workflow = await getWorkflowByCategory(category);

  if (!workflow) {
    return null;
  }

  // statusCode가 "[ ]" 형태면 중괄호 제거
  const cleanCode = statusCode.replace(/[\[\]]/g, '').trim();

  // todo 상태는 빈 문자열 또는 공백
  if (!cleanCode || cleanCode === ' ') {
    return 'todo';
  }

  // transitions에서 to 필드가 일치하는 상태명 찾기 (괄호 제거 후 비교)
  const transition = workflow.transitions.find((t) => {
    const cleanTo = t.to.replace(/[\[\]]/g, '').trim();
    return cleanTo === cleanCode;
  });
  if (transition) {
    // 괄호 제거된 상태 코드 반환
    return transition.to.replace(/[\[\]]/g, '').trim();
  }

  // states 배열에서 직접 찾기 (괄호 제거 후 비교)
  const state = workflow.states.find((s) => {
    const cleanState = s.replace(/[\[\]]/g, '').trim();
    return cleanState === cleanCode;
  });
  if (state) {
    return state.replace(/[\[\]]/g, '').trim();
  }

  return null;
}

/**
 * 상태명을 상태 코드로 변환
 * @param category - Task 카테고리
 * @param stateName - 상태명 (예: "basic-design")
 * @returns 상태 코드 (예: "[bd]")
 */
export async function nameToStatusCode(
  category: TaskCategory,
  stateName: string
): Promise<string> {
  const workflow = await getWorkflowByCategory(category);

  if (!workflow) {
    return '[ ]';
  }

  // todo는 "[ ]"
  if (stateName === 'todo') {
    return '[ ]';
  }

  // transitions에서 to 필드가 stateName인 전이 찾기 (괄호 제거 후 비교)
  const transition = workflow.transitions.find((t) => {
    const cleanTo = t.to.replace(/[\[\]]/g, '').trim();
    return cleanTo === stateName;
  });
  if (transition) {
    return transition.to.startsWith('[') ? transition.to : `[${transition.to}]`;
  }

  return '[ ]';
}

/**
 * 워크플로우의 모든 상태 코드 매핑 조회
 * @param category - Task 카테고리
 * @returns Record<상태코드, 상태명>
 */
export async function getAllStateMappings(
  category: TaskCategory
): Promise<Record<string, string>> {
  const workflow = await getWorkflowByCategory(category);

  if (!workflow) {
    return {};
  }

  const mappings: Record<string, string> = {
    '[ ]': 'todo',
  };

  // transitions에서 모든 상태 추출 (괄호 제거된 상태명 사용)
  for (const transition of workflow.transitions) {
    const cleanTo = transition.to.replace(/[\[\]]/g, '').trim();
    const statusCode = transition.to.startsWith('[') ? transition.to : `[${transition.to}]`;
    mappings[statusCode] = cleanTo;
  }

  return mappings;
}
