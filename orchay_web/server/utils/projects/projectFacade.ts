/**
 * 프로젝트 Facade 서비스
 * Task: TSK-02-03-03
 * DR-002: 서비스 간 결합도 개선
 * CRIT-001: 트랜잭션 롤백 메커니즘 추가
 *
 * 여러 서비스를 조율하여 복합 작업 수행
 */

import { rm } from 'fs/promises';
import type {
  ProjectDetail,
  CreateProjectDto,
} from './types';
import { createProject } from './projectService';
import { getTeam } from './teamService';
import { isProjectIdDuplicate } from './projectsListService';
import { getProjectDir } from './paths';
import { createConflictError } from '../errors/standardError';

/**
 * 프로젝트 생성 롤백
 * CRIT-001: 실패 시 생성된 폴더 정리
 *
 * @param projectId 롤백할 프로젝트 ID
 */
async function rollbackProjectCreation(projectId: string): Promise<void> {
  try {
    const projectDir = getProjectDir(projectId);
    await rm(projectDir, { recursive: true, force: true });
    console.warn(`[Rollback] Project folder deleted: ${projectId}`);
  } catch (rollbackError) {
    console.error(`[Rollback] Failed to delete project folder: ${projectId}`, rollbackError);
  }
}

/**
 * 프로젝트 생성 + 목록 등록
 * FR-003, BR-004, CRIT-001
 *
 * @param dto 프로젝트 생성 정보
 * @returns 생성된 프로젝트 상세 (project + team)
 * @throws 실패 시 롤백 후 에러 전파
 */
export async function createProjectWithRegistration(
  dto: CreateProjectDto
): Promise<ProjectDetail> {
  let projectCreated = false;

  try {
    // 1. 중복 확인 (폴더 생성 전에 수행)
    const isDuplicate = await isProjectIdDuplicate(dto.id);
    if (isDuplicate) {
      throw createConflictError(
        'DUPLICATE_PROJECT_ID',
        '이미 존재하는 프로젝트 ID입니다'
      );
    }

    // 2. 프로젝트 생성 (폴더 + wbs.yaml + team.json)
    const project = await createProject(dto);
    projectCreated = true;

    // 3. 팀원 정보 조회 (빈 배열)
    const team = await getTeam(project.id);

    return { project, team };
  } catch (error) {
    // CRIT-001: 롤백 처리
    if (projectCreated) {
      await rollbackProjectCreation(dto.id);
    }
    throw error;
  }
}
