/**
 * Document Service
 * TSK-05-04: Document Viewer
 *
 * 책임: 파일 시스템 접근, 파일 읽기, 에러 처리
 */

import { readFile, stat } from 'fs/promises';
import path from 'path';
import type { DocumentContent } from '~/types';
import { getProjectPath } from './file';

/**
 * Task 문서 읽기 (텍스트)
 */
export async function readTaskDocument(
  projectId: string,
  taskId: string,
  filename: string
): Promise<DocumentContent> {
  // 파일 경로 구성
  const filePath = path.join(
    getProjectPath(projectId),
    'tasks',
    taskId,
    filename
  );

  try {
    // 파일 읽기
    const content = await readFile(filePath, 'utf-8');

    // 파일 통계 정보
    const stats = await stat(filePath);

    return {
      content,
      filename,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('DOCUMENT_NOT_FOUND');
    }
    throw new Error('FILE_READ_ERROR');
  }
}

/**
 * Task 문서 읽기 (바이너리 - 이미지 등)
 */
export async function readTaskBinaryDocument(
  projectId: string,
  taskId: string,
  filename: string
): Promise<{ buffer: Buffer; size: number; lastModified: string }> {
  // 파일 경로 구성 (서브폴더 포함 가능)
  const filePath = path.join(
    getProjectPath(projectId),
    'tasks',
    taskId,
    filename
  );

  try {
    // 바이너리로 파일 읽기
    const buffer = await readFile(filePath);

    // 파일 통계 정보
    const stats = await stat(filePath);

    return {
      buffer,
      size: stats.size,
      lastModified: stats.mtime.toISOString()
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error('DOCUMENT_NOT_FOUND');
    }
    throw new Error('FILE_READ_ERROR');
  }
}

/**
 * 파일이 이미지인지 확인
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

/**
 * 파일 MIME 타입 반환
 */
export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
