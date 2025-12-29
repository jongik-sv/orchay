/**
 * 문서 서비스
 * Task: TSK-03-03
 * 상세설계: 020-detail-design.md 섹션 2.2
 *
 * Task 문서 목록 조회 (존재 + 예정)
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import type { DocumentInfo } from '../../../types';
import { findTaskById } from '../wbs/taskService';
import {
  getTaskFolderPath,
  listFiles,
  fileExists,
} from '../file';
import { createNotFoundError } from '../errors/standardError';

// ============================================================
// 문서 타입 상수
// ============================================================

/** 문서 파일명 → 타입 직접 매핑 */
const DOCUMENT_TYPE_MAPPING: Record<string, DocumentInfo['type']> = {
  '010-basic-design.md': 'design',
  '011-ui-design.md': 'design',
  '020-detail-design.md': 'design',
  '030-implementation.md': 'implementation',
  '010-analysis.md': 'analysis',
  '020-fix.md': 'implementation',
  '070-integration-test.md': 'test',
  '080-manual.md': 'manual',
};

/** 문서 번호 접두사 → 타입 매핑 */
const PREFIX_TYPE_MAPPING: Record<string, DocumentInfo['type']> = {
  '010': 'design',
  '011': 'design',
  '020': 'design',
  '021': 'review',    // design-review
  '030': 'implementation',
  '031': 'review',    // code-review
  '070': 'test',
  '080': 'manual',
};

/** 문서 타입 기본값 */
const DEFAULT_DOCUMENT_TYPE: DocumentInfo['type'] = 'design';

// ============================================================
// 문서 타입 결정 함수
// ============================================================

/**
 * 문서 타입 결정
 * @param fileName - 파일명
 * @returns DocumentInfo type
 */
function determineDocumentType(fileName: string): DocumentInfo['type'] {
  // 1. 정확한 매칭 우선
  if (DOCUMENT_TYPE_MAPPING[fileName]) {
    return DOCUMENT_TYPE_MAPPING[fileName];
  }

  // 2. 패턴 매칭 (review 파일)
  if (fileName.includes('review')) {
    return 'review';
  }

  // 3. 접두사 기반 매칭
  const prefix = fileName.substring(0, 3);
  if (PREFIX_TYPE_MAPPING[prefix]) {
    return PREFIX_TYPE_MAPPING[prefix];
  }

  return DEFAULT_DOCUMENT_TYPE;
}

/**
 * Task의 존재 문서 목록 조회
 * @param projectId - 프로젝트 ID
 * @param taskId - Task ID
 * @returns 존재 문서 목록
 */
export async function getExistingDocuments(
  projectId: string,
  taskId: string
): Promise<DocumentInfo[]> {
  const taskFolderPath = getTaskFolderPath(projectId, taskId);
  const folderExists = await fileExists(taskFolderPath);

  if (!folderExists) {
    return [];
  }

  const files = await listFiles(taskFolderPath, '.md');
  const documents: DocumentInfo[] = [];

  for (const file of files) {
    const filePath = join(taskFolderPath, file);
    const type = determineDocumentType(file);

    try {
      const stat = await fs.stat(filePath);
      documents.push({
        name: file,
        path: `tasks/${taskId}/${file}`,
        exists: true,
        type,
        stage: 'current',
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        updatedAt: stat.mtime.toISOString(),
      });
    } catch (error) {
      // 파일 stat 실패 시 기본 정보만 포함
      documents.push({
        name: file,
        path: `tasks/${taskId}/${file}`,
        exists: true,
        type,
        stage: 'current',
      });
    }
  }

  return documents;
}

/**
 * Task의 예정 문서 목록 조회 (비활성화됨)
 * @deprecated 문서 생성은 슬래시 명령어에서 처리
 * @returns 빈 배열
 */
export async function getExpectedDocuments(
  _projectId: string,
  _taskId: string,
  _currentStatus: string
): Promise<DocumentInfo[]> {
  // 예정 문서 기능 비활성화 - 문서 생성은 슬래시 명령어에서 처리
  return [];
}

/**
 * 존재/예정 문서 병합 조회
 * @param projectId - 프로젝트 ID
 * @param taskId - Task ID
 * @returns 병합된 문서 목록
 */
export async function getTaskDocuments(
  projectId: string,
  taskId: string
): Promise<DocumentInfo[]> {
  // Task 조회
  const taskResult = await findTaskById(taskId);
  if (!taskResult) {
    throw createNotFoundError(`Task를 찾을 수 없습니다: ${taskId}`);
  }

  const { task } = taskResult;
  const currentStatus = task.status || '[ ]';

  // 존재 문서 조회
  const existingDocs = await getExistingDocuments(projectId, taskId);

  // 예정 문서 조회
  const expectedDocs = await getExpectedDocuments(projectId, taskId, currentStatus);

  // 중복 제거: 존재 문서의 name이 예정 문서에 있으면 제외
  const existingNames = new Set(existingDocs.map((d) => d.name));
  const filteredExpectedDocs = expectedDocs.filter(
    (d) => !existingNames.has(d.name)
  );

  // 병합 및 정렬 (current 먼저, 그 다음 expected)
  const allDocuments = [...existingDocs, ...filteredExpectedDocs];

  // stage로 정렬
  allDocuments.sort((a, b) => {
    if (a.stage === 'current' && b.stage === 'expected') return -1;
    if (a.stage === 'expected' && b.stage === 'current') return 1;
    return 0;
  });

  return allDocuments;
}
