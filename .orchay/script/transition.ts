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
 *   -d, --desc <text>   execution.description 업데이트
 *   -w, --worker <id>   Worker ID (--start와 함께 사용)
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
// 타입 정의
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

interface WorkflowsConfig {
  version: string;
  states: Record<string, { id: string; label: string }>;
  commands: Record<string, unknown>;
  workflows: Record<string, Workflow>;
}

interface TransitionOutput {
  success: boolean;
  project?: string;
  taskId?: string;
  previousStatus?: string;
  newStatus?: string;
  command?: string;
  reason?: string;
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
  reason?: string;
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

interface ExecutionInfo {
  command: string;
  description?: string;
  startedAt: string;
  worker?: number;
}

interface WbsTask {
  id: string;
  title: string;
  category: string;
  status: string;
  execution?: ExecutionInfo;
  [key: string]: unknown;
}

interface WbsWorkPackage {
  id: string;
  title: string;
  tasks?: WbsTask[];
  activities?: { id: string; tasks?: WbsTask[] }[];
  [key: string]: unknown;
}

interface WbsYaml {
  project: { id: string; [key: string]: unknown };
  wbs: { version: string; depth: number; [key: string]: unknown };
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
  return cmd && typeof cmd === 'object' && 'isAction' in cmd && cmd.isAction === true;
}

/**
 * test 명령어 특수 처리: [im] 이후 상태에서 모두 실행 가능
 */
function isTestAllowed(currentStatus: string): boolean {
  const allowedStatuses = ['[im]', '[vf]', '[xx]'];
  return allowedStatuses.includes(currentStatus);
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
function getTaskInfo(wbsData: WbsYaml, taskId: string): TaskInfo | null {
  const task = findTaskInWbs(wbsData, taskId);
  if (!task) return null;

  return {
    id: task.id,
    category: task.category || 'development',
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
 * Task에 execution 필드 설정
 */
function setTaskExecution(task: WbsTask, command: string, worker?: number): void {
  task.execution = {
    command,
    startedAt: new Date().toISOString(),
    ...(worker !== undefined && { worker }),
  };
}

/**
 * Task의 execution 필드 제거
 */
function clearTaskExecution(task: WbsTask): void {
  delete task.execution;
}

/**
 * Task의 execution.description 업데이트
 */
function updateTaskDescription(task: WbsTask, description: string): boolean {
  if (task.execution) {
    task.execution.description = description;
    return true;
  }
  return false;
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
  const taskInfo = getTaskInfo(wbsData, taskId);
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
    // test 명령어 특수 처리: [im] 이후 상태에서 모두 허용
    if (command === 'test') {
      if (isTestAllowed(currentStatus)) {
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
        return {
          success: true,
          canTransition: false,
          project: projectId,
          taskId,
          currentStatus,
          command,
          reason: 'INVALID_ACTION',
          message: `현재 상태 ${currentStatus}에서 '${command}' 액션을 실행할 수 없습니다. 필요 상태: [im], [vf], [xx]`,
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
      // 허용된 상태 목록 조회
      const workflow = workflows.workflows[category];
      const allowedStates = workflow?.actions
        ? Object.keys(workflow.actions).filter(state =>
            workflow.actions![state].includes(command)
          )
        : [];

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

  const category = task.category || 'development';
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
  workflows: WorkflowsConfig,
  worker?: number
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

  setTaskExecution(task, command, worker);

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

/**
 * --desc 모드: execution.description 업데이트
 */
async function updateDescription(
  taskId: string,
  projectId: string,
  description: string
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

  // 3. execution.description 업데이트
  if (!updateTaskDescription(task, description)) {
    return {
      success: false,
      reason: 'NO_EXECUTION',
      message: `Task에 실행 중인 작업이 없습니다. --start로 먼저 시작하세요.`,
    };
  }

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
    message: `description이 업데이트되었습니다: ${description}`,
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
      desc: { type: 'string', short: 'd' },
      worker: { type: 'string', short: 'w' },
    },
    allowPositionals: true,
  });

  const [taskIdInput, command] = positionals;
  const projectOption = values.project;
  const startMode = values.start;
  const endMode = values.end;
  const descValue = values.desc;
  const workerValue = values.worker ? parseInt(values.worker, 10) : undefined;

  // --end 또는 --desc 모드: command 없이도 실행 가능
  if (endMode || descValue !== undefined) {
    if (!taskIdInput) {
      outputError('INVALID_ARGS', 'Usage: npx tsx transition.ts <task-id> [-p project] [--end | --desc "text"]');
      return;
    }
  } else {
    // 일반 모드: task-id와 command 필수
    if (positionals.length < 2) {
      outputError('INVALID_ARGS', 'Usage: npx tsx transition.ts <task-id> <command> [-p project] [-s] [-w worker]');
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

    // --desc 모드: execution.description 업데이트
    if (descValue !== undefined) {
      const result = await updateDescription(taskId, projectId, descValue);
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
      const result = await startExecution(taskId, command, projectId, workflows, workerValue);
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
