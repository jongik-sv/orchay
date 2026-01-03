/**
 * WBS 테스트 결과 업데이트 API
 * Task: TSK-03-05
 * 상세설계: 020-detail-design.md
 *
 * PUT /api/projects/:id/wbs/tasks/:taskId/test-result
 * Task의 test-result 속성을 업데이트
 */

import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { promises as fs } from 'fs';
import { parse as parseYaml } from 'yaml';
import type { WbsNode, WbsMetadata } from '../../../../../../../types';
import { parseWbsYaml, type YamlWbsRoot } from '../../../../../../utils/wbs/yamlParser';
import { serializeWbsToYaml, type SerializeContext } from '../../../../../../utils/wbs/yamlSerializer';
import { findTaskInTree } from '../../../../../../utils/wbs/taskService';
import {
  fileExists,
  getWbsPath,
  getProjectPath,
} from '../../../../../../utils/file';
import {
  createBadRequestError,
  createNotFoundError,
  createInternalError,
} from '../../../../../../utils/errors/standardError';

/**
 * P1 반영: 테스트 결과 유효 값 타입 및 상수
 */
const VALID_TEST_RESULTS = ['none', 'pass', 'fail'] as const;
type TestResultValue = typeof VALID_TEST_RESULTS[number];

/**
 * 요청 Body 인터페이스
 */
interface TestResultUpdateRequest {
  testResult: TestResultValue;
}

/**
 * 응답 인터페이스
 */
interface TestResultUpdateResponse {
  success: boolean;
  testResult: string;
  updated: string;
}

/**
 * YAML 파일 읽기
 */
async function readYamlFile(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error(`Failed to read YAML file: ${path}`, error);
    }
    return null;
  }
}

/**
 * YAML 파일 쓰기
 */
async function writeYamlFile(path: string, content: string): Promise<boolean> {
  try {
    await fs.writeFile(path, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(`Failed to write YAML file: ${path}`, error);
    return false;
  }
}

/**
 * 프로젝트 ID 유효성 검증 (경로 순회 공격 방지)
 * C-01: projectId 형식 검증 추가
 */
function validateProjectId(projectId: string): void {
  // 경로 순회 공격 패턴 체크
  if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
    throw createBadRequestError(
      'INVALID_PROJECT_ID',
      '프로젝트 ID 형식이 올바르지 않습니다'
    );
  }

  const pattern = /^[a-z][a-z0-9-]{0,49}$/;
  if (!pattern.test(projectId)) {
    throw createBadRequestError(
      'INVALID_PROJECT_ID',
      '프로젝트 ID 형식이 올바르지 않습니다'
    );
  }
}

/**
 * Task ID 유효성 검증
 * FR-004: Task ID 형식 검증
 * BR-001: TSK-XX-XX 또는 TSK-XX-XX-XX 형식 (최소 2자리 숫자)
 */
function validateTaskId(taskId: string): void {
  // TSK-DD-DD or TSK-DD-DD-DD format (exactly 2 digits in each segment)
  const pattern = /^TSK-\d{2,}-\d{2,}(-\d{2,})?$/;
  if (!pattern.test(taskId)) {
    throw createBadRequestError(
      'INVALID_TASK_ID',
      'Task ID 형식이 유효하지 않습니다'
    );
  }
}

/**
 * test-result 값 유효성 검증
 * FR-003: test-result 값 검증
 * BR-002: none, pass, fail만 허용
 */
function validateTestResult(testResult: string): asserts testResult is TestResultValue {
  if (!VALID_TEST_RESULTS.includes(testResult as TestResultValue)) {
    throw createBadRequestError(
      'INVALID_TEST_RESULT',
      `test-result 값은 ${VALID_TEST_RESULTS.join(', ')} 중 하나여야 합니다`
    );
  }
}

export default defineEventHandler(async (event): Promise<TestResultUpdateResponse> => {
  // 1. 파라미터 추출
  const projectId = getRouterParam(event, 'id');
  const taskId = getRouterParam(event, 'taskId');

  if (!projectId || !taskId) {
    throw createBadRequestError(
      'INVALID_REQUEST',
      '프로젝트 ID와 Task ID가 필요합니다'
    );
  }

  // 2. 프로젝트 ID 검증 (C-01)
  validateProjectId(projectId);

  // 3. Task ID 검증 (BR-001)
  validateTaskId(taskId);

  // 4. 요청 Body 파싱
  const body = await readBody<TestResultUpdateRequest>(event).catch(() => null);
  if (!body || typeof body.testResult !== 'string') {
    throw createBadRequestError(
      'INVALID_REQUEST_BODY',
      '요청 본문이 없거나 형식이 잘못되었습니다'
    );
  }

  // 5. test-result 값 검증 (BR-002)
  validateTestResult(body.testResult);

  // 6. 프로젝트 존재 확인
  const projectPath = getProjectPath(projectId);
  const projectExists = await fileExists(projectPath);
  if (!projectExists) {
    throw createNotFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }

  // 7. WBS 파일 읽기
  const wbsPath = getWbsPath(projectId);
  const wbsExists = await fileExists(wbsPath);
  if (!wbsExists) {
    throw createNotFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }

  const yamlContent = await readYamlFile(wbsPath);
  if (yamlContent === null) {
    throw createInternalError(
      'FILE_ACCESS_ERROR',
      'WBS 파일을 읽을 수 없습니다'
    );
  }

  // 8. YAML 파싱
  let metadata: WbsMetadata;
  let tree: WbsNode[];
  let context: SerializeContext = {};

  try {
    const result = parseWbsYaml(yamlContent);
    metadata = result.metadata;
    tree = result.tree;

    // 기존 project/wbs 섹션 유지용
    const yamlRoot = parseYaml(yamlContent) as YamlWbsRoot;
    context.existingProject = yamlRoot.project;
    context.existingWbsConfig = yamlRoot.wbs;
  } catch (error) {
    throw createInternalError(
      'PARSE_ERROR',
      `WBS 파일을 파싱할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 9. Task 노드 탐색 (H-01: 탐색 결과 재사용)
  const result = findTaskInTree(tree, taskId);
  if (!result) {
    // TSK-03-05: Task not found should return TASK_NOT_FOUND, not PROJECT_NOT_FOUND
    throw createError({
      statusCode: 404,
      statusMessage: 'TASK_NOT_FOUND',
      message: `Task를 찾을 수 없습니다: ${taskId}`,
      data: {
        timestamp: new Date().toISOString()
      }
    });
  }

  const taskNode = result.task;

  // 10. test-result 업데이트
  if (!taskNode.attributes) {
    taskNode.attributes = {};
  }
  taskNode.attributes['test-result'] = body.testResult;

  // 11. 백업 생성 (FR-005, C-02)
  const backupPath = `${wbsPath}.bak`;
  try {
    await fs.copyFile(wbsPath, backupPath);
  } catch (error) {
    // C-02: 백업 실패 시 BACKUP_FAILED 에러 발생, 업데이트 중단
    throw createInternalError(
      'BACKUP_FAILED',
      `백업 생성에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 12. YAML 시리얼라이즈
  let updatedYaml: string;
  try {
    updatedYaml = serializeWbsToYaml(tree, metadata, { updateDate: true }, context);
  } catch (error) {
    throw createInternalError(
      'SERIALIZATION_ERROR',
      `WBS 트리 직렬화에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 13. 파일 쓰기
  const writeSuccess = await writeYamlFile(wbsPath, updatedYaml);
  if (!writeSuccess) {
    // 롤백 시도 (H-02)
    try {
      await fs.copyFile(backupPath, wbsPath);
    } catch (rollbackError) {
      // H-02: 롤백 실패 시 ROLLBACK_FAILED 치명적 에러 발생
      throw createInternalError(
        'ROLLBACK_FAILED',
        `파일 쓰기 및 롤백에 모두 실패했습니다: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`
      );
    }
    throw createInternalError(
      'FILE_WRITE_ERROR',
      '데이터 저장에 실패했습니다'
    );
  }

  // 14. 백업 파일 삭제
  await fs.unlink(backupPath).catch(() => {
    // 백업 파일 삭제 실패는 무시
  });

  // 15. 새로운 updated 날짜 반환
  const newUpdated = new Date().toISOString().split('T')[0];

  // 16. 성공 응답
  return {
    success: true,
    testResult: body.testResult,
    updated: newUpdated,
  };
});
