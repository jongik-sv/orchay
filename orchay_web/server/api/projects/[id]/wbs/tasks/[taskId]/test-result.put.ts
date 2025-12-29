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
import type { WbsNode, WbsMetadata } from '../../../../../../../types';
import { parseWbsMarkdown } from '../../../../../../utils/wbs/parser/index';
import { serializeWbs } from '../../../../../../utils/wbs/serializer';
import { findTaskInTree } from '../../../../../../utils/wbs/taskService';
import {
  readMarkdownFile,
  writeMarkdownFile,
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
 * Markdown에서 메타데이터 섹션 파싱
 */
function parseMetadata(markdown: string): WbsMetadata {
  const lines = markdown.split('\n');
  const metadata: Partial<WbsMetadata> = {
    version: '1.0',
    depth: 4,
    updated: new Date().toISOString().split('T')[0],
    start: '',
  };

  let inMetadataSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('>')) {
      inMetadataSection = true;
      const content = trimmed.substring(1).trim();

      if (content.startsWith('version:')) {
        metadata.version = content.substring(8).trim();
      } else if (content.startsWith('depth:')) {
        const depth = parseInt(content.substring(6).trim());
        metadata.depth = (depth === 3 || depth === 4 ? depth : 4) as 3 | 4;
      } else if (content.startsWith('updated:')) {
        metadata.updated = content.substring(8).trim();
      } else if (content.startsWith('start:')) {
        metadata.start = content.substring(6).trim();
      }
    } else if (trimmed === '---' && inMetadataSection) {
      break;
    }
  }

  return metadata as WbsMetadata;
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

  const markdown = await readMarkdownFile(wbsPath);
  if (markdown === null) {
    throw createInternalError(
      'FILE_ACCESS_ERROR',
      'WBS 파일을 읽을 수 없습니다'
    );
  }

  // 8. 메타데이터 파싱
  const metadata = parseMetadata(markdown);

  // 9. WBS 트리 파싱
  let tree: WbsNode[];
  try {
    tree = parseWbsMarkdown(markdown);
  } catch (error) {
    throw createInternalError(
      'PARSE_ERROR',
      `WBS 파일을 파싱할 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 10. Task 노드 탐색 (H-01: 탐색 결과 재사용)
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

  // 11. test-result 업데이트
  if (!taskNode.attributes) {
    taskNode.attributes = {};
  }
  taskNode.attributes['test-result'] = body.testResult;

  // 12. 백업 생성 (FR-005, C-02)
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

  // 13. 시리얼라이즈
  let updatedMarkdown: string;
  try {
    updatedMarkdown = serializeWbs(tree, metadata, { updateDate: true });
  } catch (error) {
    throw createInternalError(
      'SERIALIZATION_ERROR',
      `WBS 트리 직렬화에 실패했습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // 14. 파일 쓰기
  const writeSuccess = await writeMarkdownFile(wbsPath, updatedMarkdown);
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

  // 15. 백업 파일 삭제
  await fs.unlink(backupPath).catch(() => {
    // 백업 파일 삭제 실패는 무시
  });

  // 16. 새로운 updated 날짜 추출
  const savedMarkdown = await readMarkdownFile(wbsPath);
  const savedMetadata = savedMarkdown ? parseMetadata(savedMarkdown) : metadata;

  // 17. 성공 응답
  return {
    success: true,
    testResult: body.testResult,
    updated: savedMetadata.updated,
  };
});
