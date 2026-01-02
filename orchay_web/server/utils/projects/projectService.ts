/**
 * 프로젝트 서비스
 * Task: TSK-02-03-03
 * 상세설계: 020-detail-design.md 섹션 5.1
 *
 * wbs.yaml의 project 섹션을 읽고 쓰는 서비스
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ProjectConfig, CreateProjectDto, UpdateProjectDto, WbsYaml, WbsConfig } from './types';
import { getProjectDir, getProjectFilePath } from './paths';
import {
  createNotFoundError,
  createBadRequestError,
  createInternalError,
} from '../errors/standardError';

/**
 * wbs.yaml 전체 읽기
 */
async function readWbsYaml(projectId: string): Promise<WbsYaml> {
  const filePath = getProjectFilePath(projectId, 'wbs.yaml');

  try {
    const content = await readFile(filePath, 'utf-8');
    return parseYaml(content) as WbsYaml;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw createNotFoundError('요청한 프로젝트를 찾을 수 없습니다');
    }
    throw createInternalError('FILE_READ_ERROR', '프로젝트 정보를 읽는 중 오류가 발생했습니다');
  }
}

/**
 * wbs.yaml 전체 쓰기
 */
async function writeWbsYaml(projectId: string, wbsYaml: WbsYaml): Promise<void> {
  const filePath = getProjectFilePath(projectId, 'wbs.yaml');

  try {
    const content = stringifyYaml(wbsYaml, {
      indent: 2,
      lineWidth: 0, // 줄바꿈 없이
    });
    await writeFile(filePath, content, 'utf-8');
  } catch (error) {
    throw createInternalError('FILE_WRITE_ERROR', '프로젝트 정보를 저장하는 중 오류가 발생했습니다');
  }
}

/**
 * 프로젝트 조회
 * FR-002
 */
export async function getProject(projectId: string): Promise<ProjectConfig> {
  const wbsYaml = await readWbsYaml(projectId);
  return wbsYaml.project;
}

/**
 * 프로젝트 생성
 * FR-003, BR-004
 */
export async function createProject(dto: CreateProjectDto): Promise<ProjectConfig> {
  const projectDir = getProjectDir(dto.id);
  const now = new Date().toISOString();
  const today = now.split('T')[0]; // YYYY-MM-DD

  const project: ProjectConfig = {
    id: dto.id,
    name: dto.name,
    description: dto.description || '',
    version: '0.1.0',
    status: 'active',
    wbsDepth: dto.wbsDepth || 3,
    createdAt: now,
    updatedAt: now,
    scheduledStart: dto.scheduledStart || today,
    scheduledEnd: dto.scheduledEnd,
  };

  const wbsConfig: WbsConfig = {
    version: '1.0',
    depth: dto.wbsDepth || 3,
    projectRoot: dto.id,
  };

  const wbsYaml: WbsYaml = {
    project,
    wbs: wbsConfig,
    workPackages: [],
  };

  try {
    // BR-004: 폴더 생성
    await mkdir(projectDir, { recursive: true });

    // wbs.yaml 생성
    await writeWbsYaml(dto.id, wbsYaml);

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
  if ('id' in dto && (dto as { id?: string }).id !== undefined) {
    throw createBadRequestError('ID_IMMUTABLE', '프로젝트 ID는 변경할 수 없습니다');
  }

  const wbsYaml = await readWbsYaml(projectId);

  const updatedProject: ProjectConfig = {
    ...wbsYaml.project,
    ...dto,
    id: projectId, // ID 불변
    updatedAt: new Date().toISOString(),
  };

  // wbsDepth가 변경되면 wbs 섹션도 업데이트
  if (dto.wbsDepth) {
    wbsYaml.wbs.depth = dto.wbsDepth;
  }

  wbsYaml.project = updatedProject;

  await writeWbsYaml(projectId, wbsYaml);
  return updatedProject;
}
