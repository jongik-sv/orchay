/**
 * 프로젝트 서비스
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 5.1
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import type { ProjectConfig, CreateProjectDto, UpdateProjectDto } from './types';
import { getProjectDir, getProjectFilePath } from './paths';
import {
  createNotFoundError,
  createBadRequestError,
  createInternalError,
} from '../errors/standardError';

/**
 * 프로젝트 조회
 * FR-002
 */
export async function getProject(projectId: string): Promise<ProjectConfig> {
  const filePath = getProjectFilePath(projectId, 'project.json');

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as ProjectConfig;
  } catch (error: unknown) {
    // CR-002: 타입 가드를 사용한 안전한 에러 핸들링
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw createNotFoundError('요청한 프로젝트를 찾을 수 없습니다');
    }
    throw createInternalError('FILE_READ_ERROR', '프로젝트 정보를 읽는 중 오류가 발생했습니다');
  }
}

/**
 * 프로젝트 생성
 * FR-003, BR-004
 */
export async function createProject(dto: CreateProjectDto): Promise<ProjectConfig> {
  const projectDir = getProjectDir(dto.id);
  const now = new Date().toISOString();

  const project: ProjectConfig = {
    id: dto.id,
    name: dto.name,
    description: dto.description || '',
    version: '0.1.0',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    scheduledStart: dto.scheduledStart,
    scheduledEnd: dto.scheduledEnd,
  };

  try {
    // BR-004: 폴더 생성
    await mkdir(projectDir, { recursive: true });

    // project.json 생성
    await writeFile(
      getProjectFilePath(dto.id, 'project.json'),
      JSON.stringify(project, null, 2),
      'utf-8'
    );

    // team.json 생성 (빈 팀)
    await writeFile(
      getProjectFilePath(dto.id, 'team.json'),
      JSON.stringify({ version: '1.0', members: [] }, null, 2),
      'utf-8'
    );

    return project;
  } catch (error) {
    throw createInternalError('FILE_WRITE_ERROR', '프로젝트 생성 중 오류가 발생했습니다');
  }
}

/**
 * 프로젝트 수정
 * FR-004, BR-002
 */
export async function updateProject(
  projectId: string,
  dto: UpdateProjectDto
): Promise<ProjectConfig> {
  // BR-002: ID 변경 불가
  if ('id' in dto && dto.id !== undefined) {
    throw createBadRequestError('ID_IMMUTABLE', '프로젝트 ID는 변경할 수 없습니다');
  }

  const project = await getProject(projectId);

  const updated: ProjectConfig = {
    ...project,
    ...dto,
    id: projectId, // ID 불변
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeFile(
      getProjectFilePath(projectId, 'project.json'),
      JSON.stringify(updated, null, 2),
      'utf-8'
    );
    return updated;
  } catch (error) {
    throw createInternalError('FILE_WRITE_ERROR', '프로젝트 수정 중 오류가 발생했습니다');
  }
}
