/**
 * GET /api/files/content?path={filePath}
 * Task: TSK-09-01
 * 상세설계: 020-detail-design.md 섹션 1.2
 *
 * 파일 컨텐츠 조회 (텍스트 및 이미지 지원)
 * 보안: Path Traversal 방어, 파일 크기 제한, .orchay 폴더 내로 제한
 */

import { defineEventHandler, getQuery, setHeader } from 'h3';
import { readFile, stat } from 'fs/promises';
import { resolve, extname } from 'path';
import type { FileContentResponse } from '../../../types';
import { fileExists } from '../../utils/file';
import {
  createBadRequestError,
  createForbiddenError,
  createNotFoundError,
  createInternalError,
} from '../../utils/errors/standardError';

// 파일 크기 제한 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 이미지 확장자 목록
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];

// MIME 타입 매핑
const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
};

function isImageFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export default defineEventHandler(async (event): Promise<FileContentResponse | Buffer> => {
  const query = getQuery(event);
  const filePath = query.path as string;

  // 1. 경로 검증 (필수)
  if (!filePath || typeof filePath !== 'string') {
    throw createBadRequestError('FILE_PATH_REQUIRED', '파일 경로가 필요합니다');
  }

  // 2. 보안: Path Traversal 방어
  const normalizedPath = resolve(filePath);

  // Path Traversal 방어 (.. 포함 불가)
  if (filePath.includes('..')) {
    throw createForbiddenError('ACCESS_DENIED', '잘못된 경로입니다');
  }

  // .orchay 폴더 내부인지만 확인 (어느 프로젝트든 상관없이)
  // Windows/Unix 경로 모두 지원
  const hasOrchayPath = normalizedPath.includes('/.orchay/') || normalizedPath.includes('\\.orchay\\');
  if (!hasOrchayPath) {
    throw createForbiddenError('ACCESS_DENIED', '.orchay 폴더 외부 접근 불가');
  }

  // 3. 파일 존재 확인
  const exists = await fileExists(normalizedPath);
  if (!exists) {
    throw createNotFoundError('파일을 찾을 수 없습니다');
  }

  // 4. 파일 크기 제한
  let fileStats;
  try {
    fileStats = await stat(normalizedPath);
    if (fileStats.size > MAX_FILE_SIZE) {
      throw createBadRequestError('FILE_TOO_LARGE', '파일 크기가 10MB를 초과합니다');
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }
    throw createInternalError(
      'FILE_STAT_ERROR',
      '파일 정보를 읽을 수 없습니다'
    );
  }

  // 5. 이미지 파일인 경우 바이너리로 응답
  if (isImageFile(normalizedPath)) {
    try {
      const buffer = await readFile(normalizedPath);
      const mimeType = getMimeType(normalizedPath);

      setHeader(event, 'Content-Type', mimeType);
      setHeader(event, 'Content-Length', fileStats.size);
      setHeader(event, 'Cache-Control', 'public, max-age=86400');

      return buffer;
    } catch (error) {
      throw createInternalError(
        'FILE_READ_ERROR',
        `이미지를 읽을 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // 6. 텍스트 파일 읽기
  try {
    const content = await readFile(normalizedPath, 'utf-8');
    return { content };
  } catch (error) {
    throw createInternalError(
      'FILE_READ_ERROR',
      `파일을 읽을 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
});
