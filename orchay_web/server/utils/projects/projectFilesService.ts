/**
 * 프로젝트 파일 서비스
 * Task: TSK-09-01
 * 상세설계: 020-detail-design.md 섹션 1.3
 *
 * 프로젝트 폴더 내 파일 목록 조회
 * 보안: Path Traversal 방어, 심볼릭 링크 차단
 */

import { readdir, stat } from 'fs/promises';
import { join, resolve } from 'path';
import { realpathSync } from 'fs';
import type { ProjectFile } from '../../../types';
import { getProjectDir } from './paths';
import { fileExists } from '../file';
import { createNotFoundError, createInternalError } from '../errors/standardError';

/**
 * 프로젝트 폴더 내 파일 목록 조회
 * @param projectId 프로젝트 ID
 * @returns 파일 목록
 * @throws PROJECT_NOT_FOUND - 프로젝트 폴더 없음
 * @throws FILE_ACCESS_ERROR - 파일 시스템 접근 실패
 */
export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const projectPath = getProjectDir(projectId);

  // 프로젝트 폴더 존재 확인
  const exists = await fileExists(projectPath);
  if (!exists) {
    throw createNotFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  }

  try {
    const entries = await readdir(projectPath, { withFileTypes: true });
    const files: ProjectFile[] = [];

    for (const entry of entries) {
      // tasks 폴더는 제외
      if (entry.isDirectory() && entry.name === 'tasks') {
        continue;
      }

      // 심볼릭 링크 필터링 (보안)
      if (entry.isSymbolicLink()) {
        continue;
      }

      if (entry.isFile()) {
        const filePath = join(projectPath, entry.name);

        // 보안: Path Traversal 검증
        if (!validateFilePath(filePath, projectId)) {
          console.warn(`[getProjectFiles] Invalid file path detected: ${filePath}`);
          continue;
        }

        const stats = await stat(filePath);

        files.push({
          name: entry.name,
          path: filePath,
          relativePath: entry.name,
          type: getFileType(entry.name),
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
        });
      }
    }

    // 파일명 정렬
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    throw createInternalError(
      'FILE_ACCESS_ERROR',
      `파일 목록을 읽을 수 없습니다: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * 파일 경로 보안 검증 (Path Traversal 방어)
 * H-02: 다층 방어 메커니즘
 * @param filePath 검증할 파일 경로
 * @param projectId 프로젝트 ID
 * @returns 검증 통과 여부
 */
function validateFilePath(filePath: string, projectId: string): boolean {
  try {
    // 1. 절대 경로 정규화 (../ 제거)
    const normalizedPath = resolve(filePath);
    const projectPath = resolve(getProjectDir(projectId));

    // 2. 프로젝트 폴더 내부인지 확인
    if (!normalizedPath.startsWith(projectPath)) {
      return false;
    }

    // 3. 실제 파일 시스템 경로 확인 (심볼릭 링크 추적)
    const realFilePath = realpathSync(normalizedPath);
    const realProjectPath = realpathSync(projectPath);

    return realFilePath.startsWith(realProjectPath);
  } catch (error) {
    // realpath 실패 시 (파일 없음 등) false 반환
    return false;
  }
}

/**
 * 파일 확장자로 타입 결정
 */
function getFileType(filename: string): ProjectFile['type'] {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'md') return 'markdown';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) return 'image';
  if (ext === 'json') return 'json';
  return 'other';
}
