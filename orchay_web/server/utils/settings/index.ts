/**
 * 설정 서비스 모듈
 * Task: TSK-02-03-01, TSK-02-03-02
 *
 * 설정 파일 로드, 캐싱, 조회 기능을 제공합니다.
 */

import type {
  Settings,
  SettingsFileType,
  ColumnsConfig,
  WorkflowsConfig,
  StateDefinition,
  CommandDefinition,
} from '../../../types/settings';
import { SETTINGS_FILE_NAMES } from '../../../types/settings';
import { loadSettings as loadSettingsFromCache } from './_cache';
import type { WorkflowStep, TaskCategory } from '../../../types';
// ============================================================
// 서비스 함수
// ============================================================

/**
 * 전체 설정 로드 (캐시 사용)
 * Note: cache.ts의 loadSettings와 중복 방지를 위해 getSettings로 노출
 * @returns Promise<Settings>
 */
export async function getSettings(): Promise<Settings> {
  return loadSettingsFromCache();
}

/**
 * 칸반 컬럼 설정 조회
 * @returns Promise<ColumnsConfig>
 */
export async function getColumns(): Promise<ColumnsConfig> {
  const settings = await getSettings();
  return settings.columns;
}

/**
 * 카테고리 목록 조회 (workflows.workflows 키에서 파생)
 * @returns Promise<string[]> 카테고리 ID 목록
 */
export async function getCategories(): Promise<string[]> {
  const settings = await getSettings();
  return Object.keys(settings.workflows.workflows);
}

/**
 * 워크플로우 설정 조회
 * @returns Promise<WorkflowsConfig>
 */
export async function getWorkflows(): Promise<WorkflowsConfig> {
  const settings = await getSettings();
  return settings.workflows;
}

/**
 * 액션 명령어 목록 조회 (workflows.commands에서 isAction=true인 것들)
 * @returns Promise<string[]> 액션 명령어 목록
 */
export async function getActionCommands(): Promise<string[]> {
  const settings = await getSettings();
  return Object.entries(settings.workflows.commands)
    .filter(([_, cmd]) => cmd.isAction === true)
    .map(([name]) => name);
}

/**
 * 타입별 설정 조회
 * @param type 설정 파일 타입
 * @returns 해당 타입의 설정
 */
export async function getSettingsByType(
  type: SettingsFileType
): Promise<ColumnsConfig | WorkflowsConfig> {
  const settings = await getSettings();
  return settings[type];
}

/**
 * 설정 타입 유효성 검사
 * BR-004: 설정 타입은 2가지로 제한 (columns, workflows)
 * ISS-CR-006: SETTINGS_FILE_NAMES와 동기화하여 Magic Number 제거
 * @param type 검사할 타입 문자열
 * @returns 유효한 SettingsFileType이면 true
 */
export function isValidSettingsType(type: string): type is SettingsFileType {
  return type in SETTINGS_FILE_NAMES;
}

// ============================================================
// Phase 3: 워크플로우 설정 헬퍼 함수
// ============================================================

/**
 * 상태 코드로 상태 정의 조회
 * @param code 상태 코드 (예: '[ ]', '[bd]', '[xx]')
 * @returns StateDefinition 또는 undefined
 */
export async function getStateDefinition(code: string): Promise<StateDefinition | undefined> {
  const workflows = await getWorkflows();
  return workflows.states[code];
}

/**
 * 명령어로 명령어 정의 조회
 * @param cmd 명령어 (예: 'start', 'draft', 'done')
 * @returns CommandDefinition 또는 undefined
 */
export async function getCommandDefinition(cmd: string): Promise<CommandDefinition | undefined> {
  const workflows = await getWorkflows();
  return workflows.commands[cmd];
}

/**
 * 모든 유효한 상태 코드 목록 반환
 * @returns 유효한 상태 코드 배열
 */
export async function getValidStatusCodes(): Promise<string[]> {
  const workflows = await getWorkflows();
  return Object.keys(workflows.states);
}

/**
 * 카테고리별 워크플로우 단계 조회 (WORKFLOW_STEPS 대체)
 * @param category Task 카테고리
 * @returns WorkflowStep[] 배열
 */
export async function getWorkflowSteps(category: TaskCategory): Promise<WorkflowStep[]> {
  const workflows = await getWorkflows();
  const workflow = workflows.workflows[category];

  if (!workflow) {
    throw new Error(`Workflow not found for category: ${category}`);
  }

  return workflow.states.map((stateCode) => {
    const state = workflows.states[stateCode];
    if (!state) {
      throw new Error(`State definition not found for code: ${stateCode}`);
    }
    return {
      code: stateCode,
      name: state.labelEn,
      description: state.label,
    };
  });
}

/**
 * 특정 상태에서 사용 가능한 명령어 목록 조회
 * @param category Task 카테고리
 * @param currentState 현재 상태 코드
 * @returns 사용 가능한 명령어 배열
 */
export async function getAvailableCommandsForState(
  category: TaskCategory,
  currentState: string
): Promise<string[]> {
  const workflows = await getWorkflows();
  const workflow = workflows.workflows[category];

  if (!workflow) {
    return [];
  }

  // 상태 전이 명령어
  const transitionCommands = workflow.transitions
    .filter((t) => t.from === currentState)
    .map((t) => t.command);

  // 상태 내 액션
  const actions = workflow.actions?.[currentState] || [];

  return [...transitionCommands, ...actions];
}
