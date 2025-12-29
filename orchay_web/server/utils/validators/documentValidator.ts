/**
 * Document Validator
 * TSK-05-04: Document Viewer
 *
 * 책임: 문서 파일명 및 경로 검증
 */

import { stat } from 'fs/promises';
import path from 'path';
import { decodePathSegment } from '../../../app/utils/urlPath';

// 파일명 패턴:
// 1. 표준 문서: 숫자3자리-이름.md (예: 010-basic-design.md)
// 2. 일반 마크다운: 알파벳/한글로 시작하는 .md 파일 (예: IMPLEMENTATION-SUMMARY.md, README.md)
const STANDARD_PATTERN = /^\d{3}-[가-힣\w\s()[\]-]+\.md$/;
const GENERAL_MD_PATTERN = /^[가-힣A-Za-z][가-힣\w\s()[\].-]*\.md$/;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

export interface DocumentValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

/**
 * 파일명 패턴 검증 (BR-001)
 * 허용 패턴:
 * - 표준 문서: \d{3}-[\w-]+\.md (예: 010-basic-design.md)
 * - 일반 마크다운: 알파벳/한글로 시작하는 .md 파일 (예: IMPLEMENTATION-SUMMARY.md)
 */
export function validateFilename(filename: string): DocumentValidationResult {
  const isStandard = STANDARD_PATTERN.test(filename);
  const isGeneral = GENERAL_MD_PATTERN.test(filename);

  if (!isStandard && !isGeneral) {
    return {
      valid: false,
      error: '유효하지 않은 파일명 형식입니다',
      code: 'INVALID_FILENAME'
    };
  }
  return { valid: true };
}

/**
 * 경로 탐색 금지 검증 (BR-002)
 * ../ 포함 불가 + URL 인코딩 우회 방지
 */
export function validatePathTraversal(filename: string): DocumentValidationResult {
  // URL 디코딩 후 체크 (한글, 공백, 괄호 등 특수문자 지원)
  const decoded = decodePathSegment(filename);

  // 다양한 경로 탐색 패턴 차단
  const dangerousPatterns = [
    /\.\./,           // ..
    /%2e%2e/i,        // URL encoded ..
    /\.\\/,           // .\ (Windows)
    /%5c/i,           // URL encoded \
    /\0/              // Null byte
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(decoded) || pattern.test(filename)) {
      return {
        valid: false,
        error: '잘못된 파일 경로입니다',
        code: 'INVALID_PATH'
      };
    }
  }

  // 정규화 후 상위 디렉토리 접근 차단
  const normalized = path.normalize(decoded);
  if (normalized.includes('..') || path.isAbsolute(decoded)) {
    return {
      valid: false,
      error: '잘못된 파일 경로입니다',
      code: 'INVALID_PATH'
    };
  }

  return { valid: true };
}

/**
 * 파일 크기 제한 검증 (BR-004)
 * 최대 1MB
 */
export async function validateFileSize(filePath: string): Promise<DocumentValidationResult> {
  try {
    const stats = await stat(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: '파일이 너무 큽니다 (최대 1MB)',
        code: 'FILE_TOO_LARGE'
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: '파일 정보를 읽을 수 없습니다',
      code: 'FILE_STAT_ERROR'
    };
  }
}

/**
 * 전체 문서 검증
 */
export async function validateDocument(filename: string, filePath: string): Promise<DocumentValidationResult> {
  // 1. 파일명 패턴 검증
  const filenameResult = validateFilename(filename);
  if (!filenameResult.valid) {
    return filenameResult;
  }

  // 2. 경로 탐색 검증
  const pathResult = validatePathTraversal(filename);
  if (!pathResult.valid) {
    return pathResult;
  }

  // 3. 파일 크기 검증
  const sizeResult = await validateFileSize(filePath);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true };
}
