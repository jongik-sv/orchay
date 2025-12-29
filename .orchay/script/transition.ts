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
 *
 * Output (JSON):
 *   { success, taskId, previousStatus, newStatus, command, reason? }
 */

import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  taskId?: string;
  previousStatus?: string;
  newStatus?: string;
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

// ====================
// WBS 파일 직접 조작
// ====================

function getWbsPath(projectId: string): string {
  return join(__dirname, `../projects/${projectId}/wbs.md`);
}

async function readWbsFile(projectId: string): Promise<string> {
  const wbsPath = getWbsPath(projectId);
  return await readFile(wbsPath, 'utf-8');
}

async function writeWbsFile(projectId: string, content: string): Promise<void> {
  const wbsPath = getWbsPath(projectId);
  await writeFile(wbsPath, content, 'utf-8');
}

/**
 * wbs.md에서 Task 정보 추출
 *
 * 형식:
 * ### TSK-01-01: 제목
 * - category: development
 * - status: todo [ ]
 */
function findTaskInContent(content: string, taskId: string): TaskInfo | null {
  // Task 블록 시작 패턴: ### TSK-XX-XX: 또는 ### TSK-XX-XX-XX:
  const taskHeaderPattern = new RegExp(
    `###\\s*${escapeRegex(taskId)}\\s*:`,
    'i'
  );

  const headerMatch = content.match(taskHeaderPattern);
  if (!headerMatch || headerMatch.index === undefined) {
    return null;
  }

  // Task 블록 추출 (다음 ### 또는 ## 전까지)
  const startIndex = headerMatch.index;
  const nextSectionMatch = content.slice(startIndex + 1).match(/\n#{2,3}\s/);
  const endIndex = nextSectionMatch
    ? startIndex + 1 + nextSectionMatch.index!
    : content.length;

  const taskBlock = content.slice(startIndex, endIndex);

  // category 추출
  const categoryMatch = taskBlock.match(/^-\s*category:\s*(\S+)/m);
  const category = categoryMatch ? categoryMatch[1] : 'development';

  // status 추출: "- status: todo [ ]" 또는 "- status: done [xx]"
  const statusMatch = taskBlock.match(/^-\s*status:\s*(\S+)\s*(\[[^\]]*\])/m);
  if (!statusMatch) {
    return null;
  }

  const statusLabel = statusMatch[1]; // "todo", "done", etc.
  const statusCode = statusMatch[2];  // "[ ]", "[xx]", etc.

  return {
    id: taskId,
    category,
    status: `${statusLabel} ${statusCode}`,
    statusCode: extractStatusCode(statusCode),
  };
}

/**
 * wbs.md에서 Task 상태 업데이트
 *
 * "- status: todo [ ]" → "- status: detail-design [dd]"
 */
function updateTaskStatusInContent(
  content: string,
  taskId: string,
  newStatusCode: string,
  workflows: WorkflowsConfig
): string {
  // 상태 코드 → 라벨 매핑 (workflows.json의 states에서)
  const stateInfo = Object.entries(workflows.states).find(
    ([code]) => extractStatusCode(code) === newStatusCode.replace(/[\[\]]/g, '')
  );
  const newLabel = stateInfo ? stateInfo[1].id.replace(/-/g, '-') : 'unknown';

  // Task 블록 시작 찾기
  const taskHeaderPattern = new RegExp(
    `(###\\s*${escapeRegex(taskId)}\\s*:[^]*?)(-\\s*status:\\s*)(\\S+)\\s*(\\[[^\\]]*\\])`,
    'i'
  );

  const match = content.match(taskHeaderPattern);
  if (!match) {
    return content; // 변경 없음
  }

  // 상태 라인 교체
  const fullMatch = match[0];
  const prefix = match[1];      // "### TSK-01-01: ... - status: "
  const statusKey = match[2];   // "- status: "
  const oldLabel = match[3];    // "todo"
  const oldCode = match[4];     // "[ ]"

  // 새 상태 문자열: workflows.json의 states에서 id 사용
  const stateEntry = Object.entries(workflows.states).find(
    ([code]) => code === newStatusCode
  );
  const newLabelFromState = stateEntry ? stateEntry[1].id : newLabel;

  const newStatusLine = `${statusKey}${newLabelFromState} ${newStatusCode}`;
  const replacement = prefix + newStatusLine;

  return content.replace(fullMatch, replacement);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
// 상태 전환 실행
// ====================

async function executeTransition(
  taskId: string,
  command: string,
  projectId: string,
  workflows: WorkflowsConfig
): Promise<TransitionOutput> {
  // 1. WBS 파일 읽기
  let content: string;
  try {
    content = await readWbsFile(projectId);
  } catch (error) {
    return {
      success: false,
      reason: 'WBS_NOT_FOUND',
      message: `WBS 파일을 찾을 수 없습니다: ${projectId}`
    };
  }

  // 2. Task 정보 추출
  const taskInfo = findTaskInContent(content, taskId);
  if (!taskInfo) {
    return {
      success: false,
      reason: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`
    };
  }

  const { category, statusCode } = taskInfo;
  const currentStatus = formatStatusCode(statusCode);

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
  const newContent = updateTaskStatusInContent(
    content,
    taskId,
    transition.to,
    workflows
  );

  // 5. WBS 파일 저장
  try {
    await writeWbsFile(projectId, newContent);
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
    previousStatus: statusCode,
    newStatus: extractStatusCode(transition.to),
    command,
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
    },
    allowPositionals: true,
  });

  // 필수 인자 확인
  if (positionals.length < 2) {
    outputError('INVALID_ARGS', 'Usage: npx tsx transition.ts <task-id> <command> [-p project] [-f]');
    return;
  }

  const [taskIdInput, command] = positionals;
  const projectOption = values.project;

  // 워크플로우 로드
  let workflows: WorkflowsConfig;
  try {
    workflows = await loadWorkflows();
  } catch (error) {
    outputError('WORKFLOW_LOAD_FAILED', 'workflows.json을 로드할 수 없습니다');
    return;
  }

  // 프로젝트 ID 해석
  const resolved = await resolveProjectId(taskIdInput, projectOption);
  if (!resolved) {
    outputError('PROJECT_REQUIRED', `-p 옵션으로 프로젝트를 지정하거나 project/TSK-XX-XX 형식을 사용하세요`);
    return;
  }

  const { projectId, taskId } = resolved;

  // 상태 전환 실행
  try {
    const result = await executeTransition(taskId, command, projectId, workflows);
    output(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    outputError('TRANSITION_FAILED', message);
  }
}

// 실행
main().catch((error) => {
  outputError('UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unexpected error');
});
