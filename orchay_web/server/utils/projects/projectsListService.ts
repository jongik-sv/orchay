/**
 * 프로젝트 목록 서비스
 * Task: TSK-02-03-03
 *
 * projects/ 폴더를 스캔하여 프로젝트 목록 생성
 * - 각 project.json에서 정보 읽기
 * - projects.json, settings.json 미사용
 */

import { readFile, readdir } from 'fs/promises';
import type { ProjectsConfig, ProjectListItem, ProjectConfig } from './types';
import { getProjectsBasePath, getProjectFilePath } from './paths';
import { createConflictError, createNotFoundError } from '../errors/standardError';

// ============================================================
// 프로젝트 목록 (폴더 스캔 방식)
// ============================================================

/**
 * 프로젝트 폴더 스캔하여 목록 생성
 * projects/ 폴더의 하위 폴더를 스캔하고 각 project.json 읽기
 */
async function scanProjects(): Promise<ProjectListItem[]> {
  const projectsBasePath = getProjectsBasePath();
  const projects: ProjectListItem[] = [];

  try {
    const entries = await readdir(projectsBasePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const projectId = entry.name;
      const projectJsonPath = getProjectFilePath(projectId, 'project.json');

      try {
        const content = await readFile(projectJsonPath, 'utf-8');
        const projectConfig = JSON.parse(content) as ProjectConfig;

        // ProjectConfig → ProjectListItem 변환
        projects.push({
          id: projectConfig.id,
          name: projectConfig.name,
          path: projectId,  // 폴더명 = ID
          status: projectConfig.status || 'active',
          wbsDepth: projectConfig.wbsDepth || 4,
          createdAt: projectConfig.createdAt,
        });
      } catch (error) {
        // project.json이 없거나 읽기 실패 → 해당 폴더 무시
        console.warn(`[ProjectsList] Skipping ${projectId}: project.json not found or invalid`);
      }
    }
  } catch (error: unknown) {
    // projects 폴더가 없으면 빈 목록 반환
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  // 생성일 기준 정렬 (최신순)
  return projects.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * 프로젝트 목록 조회
 * FR-001
 */
export async function getProjectsList(
  statusFilter?: 'active' | 'archived'
): Promise<ProjectsConfig> {
  const projects = await scanProjects();

  const filteredProjects = statusFilter
    ? projects.filter(p => p.status === statusFilter)
    : projects;

  return {
    version: '1.0',
    projects: filteredProjects,
    defaultProject: null,
  };
}

/**
 * 프로젝트 ID 중복 확인
 * @param id 프로젝트 ID
 * @returns 중복이면 true
 */
export async function isProjectIdDuplicate(id: string): Promise<boolean> {
  const projects = await scanProjects();
  return projects.some(p => p.id === id);
}

/**
 * 프로젝트 목록에 추가
 * 참고: 폴더 스캔 방식에서는 실제로 폴더와 project.json을 생성하면 자동으로 목록에 포함됨
 * 이 함수는 호환성을 위해 유지하되, 중복 확인만 수행
 *
 * @param project 프로젝트 항목
 */
export async function addProjectToList(project: ProjectListItem): Promise<void> {
  // 중복 확인
  const isDuplicate = await isProjectIdDuplicate(project.id);
  if (isDuplicate) {
    throw createConflictError(
      'DUPLICATE_PROJECT_ID',
      '이미 존재하는 프로젝트 ID입니다'
    );
  }

  // 실제 추가는 projectFacade에서 폴더 생성 시 수행됨
  // 이 함수는 중복 확인 역할만 함
}

/**
 * 프로젝트 목록 항목 수정
 * 참고: 폴더 스캔 방식에서는 project.json을 직접 수정하면 됨
 * 이 함수는 호환성을 위해 유지
 *
 * @param id 프로젝트 ID
 * @param updates 수정 내용
 */
export async function updateProjectInList(
  id: string,
  updates: Partial<ProjectListItem>
): Promise<void> {
  // 프로젝트 존재 확인
  const projects = await scanProjects();
  const exists = projects.some(p => p.id === id);

  if (!exists) {
    throw createNotFoundError('프로젝트를 찾을 수 없습니다');
  }

  // 실제 업데이트는 project.json에 직접 수행됨
  // 이 함수는 존재 확인 역할만 함
}
