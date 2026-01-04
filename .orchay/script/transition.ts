/**
 * 워크플로우 상태 전환 스크립트
 *
 * Usage:
 *   npx tsx .orchay/script/transition.ts <task-id> <command> [options]
 *
 * Arguments:
 *   task-id   Task ID (TSK-01-01 또는 project/TSK-01-01)
 *   command   워크플로우 명령 (start, design, draft, approve, build, verify, done, fix, skip)
 *
 * Options:
 *   -p, --project <id>  프로젝트 ID
 *   -f, --force         manual approval 시 확인 없이 실행
 *   -s, --start         전환 가능 여부 확인 후 execution 필드 설정
 *   -e, --end           execution 필드 제거
 *
 * Output (JSON):
 *   실행 모드: { success, taskId, previousStatus, newStatus, command, reason? }
 *   시작 모드: { success, canTransition, taskId, currentStatus, targetStatus, command, reason?, message? }
 */

import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

// ====================
// 에러 코드 타입
// ====================

type ErrorReason =
  | 'INVALID_ARGS'
  | 'PROJECT_REQUIRED'
  | 'WBS_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'INVALID_TRANSITION'
  | 'INVALID_ACTION'
  | 'WRITE_FAILED'
  | 'WORKFLOW_LOAD_FAILED'
  | 'UNEXPECTED_ERROR';

// ====================
// 워크플로우 타입 정의
// ====================

interface Transition {
  from: string;
  to: string;
  command: string;
}

interface Workflow {
  name: string;
  states: string[];
  transitions: Transition[];
  actions?: Record<string, string[]>;
}

interface StateConfig {
  id: string;
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  severity: string;
  progressWeight: number;
  phase: string;
}

interface CommandConfig {
  label: string;
  labelEn: string;
  icon: string;
  severity: string;
  isAction?: boolean;
}

interface ExecutionMode {
  label: string;
  labelEn: string;
  description: string;
  workflowScope: string;
  stopAfterCommand?: string;
  stopAtState: string | null;
  dependencyCheck: 'ignore' | 'check-implemented';
  manualCommands: string[];
  requiresSelection?: boolean;
  targetStatuses?: string[];
  color: string;
}

interface CategoryConfig {
  label: string;
  labelEn: string;
  icon: string;
  color: string;
  description: string;
}

interface WorkflowsConfig {
  $schema?: string;
  version: string;
  defaultCategory: string;
  states: Record<string, StateConfig>;
  commands: Record<string, CommandConfig>;
  executionModes: Record<string, ExecutionMode>;
  categories: Record<string, CategoryConfig>;
  workflows: Record<string, Workflow>;
}

// ====================
// 출력 타입 정의
// ====================

interface TransitionOutput {
  success: boolean;
  project?: string;
  taskId?: string;
  previousStatus?: string;
  newStatus?: string;
  command?: string;
  reason?: ErrorReason | string;
  message?: string;
}

interface CheckOutput {
  success: boolean;
  canTransition: boolean;
  project?: string;
  taskId?: string;
  currentStatus?: string;
  targetStatus?: string;
  command?: string;
  reason?: ErrorReason | string;
  message?: string;
}

interface TaskInfo {
  id: string;
  category: string;
  status: string;
  statusCode: string;
}

// ====================
// WBS YAML 타입 정의
// ====================

interface WbsTask {
  id: string;
  title: string;
  category: string;
  status: string;
  execution?: string;
  [key: string]: unknown;
}

interface WbsActivity {
  id: string;
  title?: string;
  tasks?: WbsTask[];
  [key: string]: unknown;
}

interface WbsWorkPackage {
  id: string;
  title: string;
  tasks?: WbsTask[];
  activities?: WbsActivity[];
  [key: string]: unknown;
}

interface WbsProject {
  id: string;
  name?: string;
  [key: string]: unknown;
}

interface WbsMeta {
  version: string;
  depth: number;
  [key: string]: unknown;
}

interface WbsYaml {
  project: WbsProject;
  wbs: WbsMeta;
  workPackages: WbsWorkPackage[];
}

// ====================
// 출력 헬퍼
// ====================

function output(result: TransitionOutput): void {
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.success ? 0 : 1;
}

function outputError(reason: string, message: string): void {
  output({ success: false, reason, message });
}

// ====================
// 상태 코드 유틸리티
// ====================

function extractStatusCode(status: string | undefined): string {
  if (!status) return '';
  const match = status.match(/\[([^\]]*)\]/);
  return match ? match[1] : '';
}

function formatStatusCode(code: string): string {
  return `[${code}]`;
}

// ====================
// 워크플로우 로딩
// ====================

const __dirname = dirname(fileURLToPath(import.meta.url));

async function loadWorkflows(): Promise<WorkflowsConfig> {
  const workflowsPath = join(__dirname, '../settings/workflows.json');
  const content = await readFile(workflowsPath, 'utf-8');
  return JSON.parse(content);
}

function findTransition(
  workflows: WorkflowsConfig,
  category: string,
  currentStatus: string,
  command: string
): Transition | null {
  const workflow = workflows.workflows[category];
  if (!workflow) return null;
  return workflow.transitions.find(
    t => t.from === currentStatus && t.command === command
  ) || null;
}

/**
 * 현재 상태에서 액션 실행 가능 여부 확인
 * workflows.json의 actions 참조: { "[dd]": ["review", "apply"], "[im]": ["audit", "patch"], ... }
 */
function isActionAllowed(
  workflows: WorkflowsConfig,
  category: string,
  currentStatus: string,
  command: string
): boolean {
  const workflow = workflows.workflows[category];
  if (!workflow || !workflow.actions) return false;

  const allowedCommands = workflow.actions[currentStatus];
  if (!allowedCommands) return false;

  return allowedCommands.includes(command);
}

/**
 * 명령어가 액션인지 확인 (isAction: true)
 */
function isActionCommand(workflows: WorkflowsConfig, command: string): boolean {
  const cmd = workflows.commands[command];
  return cmd != null && cmd.isAction === true;
}

/**
 * 특정 명령어에 대해 targetStatuses가 정의되어 있는지 조회
 * executionModes에서 해당 명령어와 연관된 모드의 targetStatuses 반환
 */
function getTargetStatuses(
  workflows: WorkflowsConfig,
  command: string
): string[] | null {
  for (const [modeKey, mode] of Object.entries(workflows.executionModes)) {
    if (modeKey === command && mode.targetStatuses) {
      return mode.targetStatuses;
    }
  }
  return null;
}

/**
 * 명령어가 targetStatuses를 가진 특수 액션인지 확인
 */
function hasTargetStatuses(workflows: WorkflowsConfig, command: string): boolean {
  return getTargetStatuses(workflows, command) !== null;
}

/**
 * 특정 상태에서 명령어 실행 가능 여부 확인 (targetStatuses 기반)
 * workflows.json의 executionModes.[command].targetStatuses 참조
 */
function isTargetStatusAllowed(
  workflows: WorkflowsConfig,
  command: string,
  currentStatus: string
): boolean {
  const targetStatuses = getTargetStatuses(workflows, command);
  if (!targetStatuses) return false;
  return targetStatuses.includes(currentStatus);
}

/**
 * 특정 액션이 허용되는 상태 목록 조회
 */
function getStatesForAction(
  workflows: WorkflowsConfig,
  category: string,
  command: string
): string[] {
  const workflow = workflows.workflows[category];
  if (!workflow?.actions) return [];

  const states: string[] = [];
  for (const [state, commands] of Object.entries(workflow.actions)) {
    if (commands.includes(command)) {
      states.push(state);
    }
  }
  return states;
}

// ====================
// WBS YAML 파일 조작
// ====================

function getWbsPath(projectId: string): string {
  return join(__dirname, `../projects/${projectId}/wbs.yaml`);
}

async function readWbsYaml(projectId: string): Promise<WbsYaml> {
  const wbsPath = getWbsPath(projectId);
  const content = await readFile(wbsPath, 'utf-8');
  return yaml.load(content) as WbsYaml;
}

async function writeWbsYaml(projectId: string, wbsData: WbsYaml): Promise<void> {
  const wbsPath = getWbsPath(projectId);
  const content = yaml.dump(wbsData, {
    indent: 2,
    lineWidth: -1,  // 줄 바꿈 방지
    quotingType: '"',
    forceQuotes: false,
  });
  await writeFile(wbsPath, content, 'utf-8');
}

/**
 * WBS YAML에서 Task 찾기
 * depth 3: workPackages[].tasks[]
 * depth 4: workPackages[].activities[].tasks[]
 */
function findTaskInWbs(wbsData: WbsYaml, taskId: string): WbsTask | null {
  for (const wp of wbsData.workPackages) {
    // depth 3: 직접 tasks
    if (wp.tasks) {
      const task = wp.tasks.find(t => t.id === taskId);
      if (task) return task;
    }
    // depth 4: activities 내 tasks
    if (wp.activities) {
      for (const act of wp.activities) {
        if (act.tasks) {
          const task = act.tasks.find(t => t.id === taskId);
          if (task) return task;
        }
      }
    }
  }
  return null;
}

/**
 * WBS YAML에서 Task 정보 추출
 */
function getTaskInfo(
  wbsData: WbsYaml,
  taskId: string,
  workflows: WorkflowsConfig
): TaskInfo | null {
  const task = findTaskInWbs(wbsData, taskId);
  if (!task) return null;

  return {
    id: task.id,
    category: task.category || workflows.defaultCategory,
    status: task.status,
    statusCode: extractStatusCode(task.status),
  };
}

/**
 * WBS YAML에서 Task 상태 업데이트
 */
function updateTaskStatus(wbsData: WbsYaml, taskId: string, newStatus: string): boolean {
  for (const wp of wbsData.workPackages) {
    // depth 3: 직접 tasks
    if (wp.tasks) {
      const task = wp.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = newStatus;
        return true;
      }
    }
    // depth 4: activities 내 tasks
    if (wp.activities) {
      for (const act of wp.activities) {
        if (act.tasks) {
          const task = act.tasks.find(t => t.id === taskId);
          if (task) {
            task.status = newStatus;
            return true;
          }
        }
      }
    }
  }
  return false;
}

// ====================
// Execution 필드 관리
// ====================

/**
 * Task에 execution 필드 설정 (실행 중인 명령어만 저장)
 */
function setTaskExecution(task: WbsTask, command: string): void {
  task.execution = command;
}

/**
 * Task의 execution 필드 제거
 */
function clearTaskExecution(task: WbsTask): void {
  delete task.execution;
}

// ====================
// 프로젝트 ID 해석
// ====================

async function resolveProjectId(
  taskIdInput: string,
  projectOption?: string
): Promise<{ projectId: string; taskId: string } | null> {
  // -p 옵션이 있으면 사용
  if (projectOption) {
    return { projectId: projectOption, taskId: taskIdInput };
  }

  // project/TSK-01-01 형식
  if (taskIdInput.includes('/')) {
    const [projectId, taskId] = taskIdInput.split('/');
    return { projectId, taskId };
  }

  // 프로젝트 ID 없으면 에러 (findTaskById 대체 불가)
  return null;
}

// ====================
// 상태 검증 (check-only 모드)
// ====================

async function checkTransition(
  taskId: string,
  command: string,
  projectId: string,
  workflows: WorkflowsConfig
): Promise<CheckOutput> {
  // 1. WBS YAML 파일 읽기
  let wbsData: WbsYaml;
  try {
    wbsData = await readWbsYaml(projectId);
  } catch (error) {
    return {
      success: true,
      canTransition: false,
      project: projectId,
      reason: 'WBS_NOT_FOUND',
      message: `WBS 파일을 찾을 수 없습니다: ${projectId}/wbs.yaml`
    };
  }

  // 2. Task 정보 추출
  const taskInfo = getTaskInfo(wbsData, taskId, workflows);
  if (!taskInfo) {
    return {
      success: true,
      canTransition: false,
      project: projectId,
      taskId,
      reason: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`
    };
  }

  const { category, status } = taskInfo;
  const currentStatus = status; // 이미 "[xx]" 형식

  // 3. 전환 규칙 검색
  const transition = findTransition(workflows, category, currentStatus, command);

  if (transition) {
    // 전환 가능
    return {
      success: true,
      canTransition: true,
      project: projectId,
      taskId,
      currentStatus,
      targetStatus: transition.to,
      command,
    };
  }

  // 4. 액션 명령어 검증 (상태 전환 없음)
  if (isActionCommand(workflows, command)) {
    // targetStatuses가 있는 특수 액션 (예: test)
    if (hasTargetStatuses(workflows, command)) {
      if (isTargetStatusAllowed(workflows, command, currentStatus)) {
        return {
          success: true,
          canTransition: true,
          project: projectId,
          taskId,
          currentStatus,
          targetStatus: currentStatus, // 상태 변경 없음
          command,
        };
      } else {
        const targetStatuses = getTargetStatuses(workflows, command);
        const allowedStr = targetStatuses?.join(', ') || 'N/A';
        return {
          success: true,
          canTransition: false,
          project: projectId,
          taskId,
          currentStatus,
          command,
          reason: 'INVALID_ACTION',
          message: `현재 상태 ${currentStatus}에서 '${command}' 액션을 실행할 수 없습니다. 필요 상태: ${allowedStr}`,
        };
      }
    }

    // 일반 액션: workflows.json의 actions 참조
    if (isActionAllowed(workflows, category, currentStatus, command)) {
      return {
        success: true,
        canTransition: true,
        project: projectId,
        taskId,
        currentStatus,
        targetStatus: currentStatus, // 상태 변경 없음
        command,
      };
    } else {
      const allowedStates = getStatesForAction(workflows, category, command);
      return {
        success: true,
        canTransition: false,
        project: projectId,
        taskId,
        currentStatus,
        command,
        reason: 'INVALID_ACTION',
        message: `현재 상태 ${currentStatus}에서 '${command}' 액션을 실행할 수 없습니다. 필요 상태: ${allowedStates.join(', ') || 'N/A'}`,
      };
    }
  }

  // 5. 전환도 액션도 아닌 경우
  return {
    success: true,
    canTransition: false,
    project: projectId,
    taskId,
    currentStatus,
    command,
    reason: 'INVALID_TRANSITION',
    message: `현재 상태 ${currentStatus}에서 명령어 '${command}'를 사용할 수 없습니다 (category: ${category})`,
  };
}

// ====================
// 상태 전환 실행
// ====================

async function executeTransition(
  taskId: string,
  command: string,
  projectId: string,
  workflows: WorkflowsConfig
): Promise<TransitionOutput> {
  // 1. WBS YAML 파일 읽기
  let wbsData: WbsYaml;
  try {
    wbsData = await readWbsYaml(projectId);
  } catch (error) {
    return {
      success: false,
      reason: 'WBS_NOT_FOUND',
      message: `WBS 파일을 찾을 수 없습니다: ${projectId}/wbs.yaml`
    };
  }

  // 2. Task 정보 추출
  const task = findTaskInWbs(wbsData, taskId);
  if (!task) {
    return {
      success: false,
      reason: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`
    };
  }

  const category = task.category || workflows.defaultCategory;
  const currentStatus = task.status;

  // 3. 전환 규칙 검색
  const transition = findTransition(workflows, category, currentStatus, command);
  if (!transition) {
    return {
      success: false,
      reason: 'INVALID_TRANSITION',
      message: `현재 상태 ${currentStatus}에서 명령어 '${command}'를 사용할 수 없습니다 (category: ${category})`,
    };
  }

  // 4. 상태 업데이트
  task.status = transition.to;

  // 5. execution 필드 제거 (상태 전환 시 자동 제거)
  clearTaskExecution(task);

  // 6. WBS YAML 파일 저장
  try {
    await writeWbsYaml(projectId, wbsData);
  } catch (error) {
    return {
      success: false,
      reason: 'WRITE_FAILED',
      message: `WBS 파일 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  return {
    success: true,
    taskId,
    previousStatus: extractStatusCode(currentStatus),
    newStatus: extractStatusCode(transition.to),
    command,
  };
}

// ====================
// Execution 모드 함수들
// ====================

/**
 * --start 모드: 검증 후 execution 필드 설정
 */
async function startExecution(
  taskId: string,
  command: string,
  projectId: string,
  workflows: WorkflowsConfig
): Promise<CheckOutput> {
  // 1. 검증 수행
  const checkResult = await checkTransition(taskId, command, projectId, workflows);

  // 검증 실패 시 그대로 반환
  if (!checkResult.canTransition) {
    return checkResult;
  }

  // 2. WBS YAML 파일 읽기
  let wbsData: WbsYaml;
  try {
    wbsData = await readWbsYaml(projectId);
  } catch (error) {
    return {
      success: true,
      canTransition: false,
      project: projectId,
      reason: 'WBS_NOT_FOUND',
      message: `WBS 파일을 찾을 수 없습니다: ${projectId}/wbs.yaml`
    };
  }

  // 3. Task 찾기 및 execution 필드 설정
  const task = findTaskInWbs(wbsData, taskId);
  if (!task) {
    return {
      success: true,
      canTransition: false,
      project: projectId,
      taskId,
      reason: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`
    };
  }

  setTaskExecution(task, command);

  // 4. WBS YAML 파일 저장
  try {
    await writeWbsYaml(projectId, wbsData);
  } catch (error) {
    return {
      success: true,
      canTransition: false,
      project: projectId,
      taskId,
      reason: 'WRITE_FAILED',
      message: `WBS 파일 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  return checkResult;
}

/**
 * --end 모드: execution 필드 제거
 */
async function endExecution(
  taskId: string,
  projectId: string
): Promise<TransitionOutput> {
  // 1. WBS YAML 파일 읽기
  let wbsData: WbsYaml;
  try {
    wbsData = await readWbsYaml(projectId);
  } catch (error) {
    return {
      success: false,
      reason: 'WBS_NOT_FOUND',
      message: `WBS 파일을 찾을 수 없습니다: ${projectId}/wbs.yaml`
    };
  }

  // 2. Task 찾기
  const task = findTaskInWbs(wbsData, taskId);
  if (!task) {
    return {
      success: false,
      reason: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`
    };
  }

  // 3. execution 필드 제거
  clearTaskExecution(task);

  // 4. WBS YAML 파일 저장
  try {
    await writeWbsYaml(projectId, wbsData);
  } catch (error) {
    return {
      success: false,
      reason: 'WRITE_FAILED',
      message: `WBS 파일 저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  return {
    success: true,
    project: projectId,
    taskId,
    message: 'execution 필드가 제거되었습니다',
  };
}

// ====================
// 메인 함수
// ====================

async function main(): Promise<void> {
  // 인자 파싱
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      project: { type: 'string', short: 'p' },
      force: { type: 'boolean', short: 'f', default: false },
      start: { type: 'boolean', short: 's', default: false },
      end: { type: 'boolean', short: 'e', default: false },
    },
    allowPositionals: true,
  });

  const [taskIdInput, command] = positionals;
  const projectOption = values.project;
  const startMode = values.start;
  const endMode = values.end;

  // --end 모드: command 없이도 실행 가능
  if (endMode) {
    if (!taskIdInput) {
      outputError('INVALID_ARGS', 'Usage: npx tsx transition.ts <task-id> [-p project] --end');
      return;
    }
  } else {
    // 일반 모드: task-id와 command 필수
    if (positionals.length < 2) {
      outputError('INVALID_ARGS', 'Usage: npx tsx transition.ts <task-id> <command> [-p project] [-s]');
      return;
    }
  }

  // 프로젝트 ID 해석
  const resolved = await resolveProjectId(taskIdInput, projectOption);
  if (!resolved) {
    outputError('PROJECT_REQUIRED', `-p 옵션으로 프로젝트를 지정하거나 project/TSK-XX-XX 형식을 사용하세요`);
    return;
  }

  const { projectId, taskId } = resolved;

  try {
    // --end 모드: execution 필드 제거
    if (endMode) {
      const result = await endExecution(taskId, projectId);
      output(result);
      return;
    }

    // 워크플로우 로드
    let workflows: WorkflowsConfig;
    try {
      workflows = await loadWorkflows();
    } catch (error) {
      outputError('WORKFLOW_LOAD_FAILED', 'workflows.json을 로드할 수 없습니다');
      return;
    }

    if (startMode) {
      // --start 모드: 검증 + execution 필드 설정
      const result = await startExecution(taskId, command, projectId, workflows);
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.canTransition ? 0 : 1;
    } else {
      // 상태 전환 실행 모드 (execution 자동 제거)
      const result = await executeTransition(taskId, command, projectId, workflows);
      output(result);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    outputError('TRANSITION_FAILED', message);
  }
}

// 실행
main().catch((error) => {
  outputError('UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unexpected error');
});
