/**
 * 프로젝트 서비스 통합 테스트
 * Task: TSK-02-03-03
 * 테스트 명세: 026-test-specification.md
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir } from 'fs/promises';
import { join } from 'path';
import { createProjectWithRegistration } from '../../../server/utils/projects/projectFacade';
import { getProject } from '../../../server/utils/projects/projectService';
import { getTeam, updateTeam } from '../../../server/utils/projects/teamService';
import { getProjectsList } from '../../../server/utils/projects/projectsListService';
import type { TeamMember } from '../../../server/utils/projects/types';

const TEST_BASE = join(process.cwd(), 'tests', 'fixtures', 'projects-integration');

describe('Project Services Integration', () => {
  beforeAll(async () => {
    // 테스트 환경 설정
    process.env.orchay_BASE_PATH = TEST_BASE;

    // .orchay/settings 폴더 생성
    await mkdir(join(TEST_BASE, '.orchay', 'settings'), { recursive: true });
    await mkdir(join(TEST_BASE, '.orchay', 'projects'), { recursive: true });
  });

  afterAll(async () => {
    // 테스트 폴더 정리
    try {
      await rm(TEST_BASE, { recursive: true, force: true });
    } catch (error) {
      // 정리 실패는 무시
    }

    delete process.env.orchay_BASE_PATH;
  });

  it('should create project with folder structure', async () => {
    const dto = {
      id: 'test-project-1',
      name: 'Test Project 1',
      description: 'Integration test project',
      wbsDepth: 4 as 3 | 4,
    };

    const result = await createProjectWithRegistration(dto);

    expect(result.project.id).toBe('test-project-1');
    expect(result.project.name).toBe('Test Project 1');
    expect(result.team).toEqual([]);
  });

  it('should retrieve created project', async () => {
    const project = await getProject('test-project-1');

    expect(project.id).toBe('test-project-1');
    expect(project.name).toBe('Test Project 1');
  });

  it('should manage team members', async () => {
    const members: TeamMember[] = [
      {
        id: 'user1',
        name: '홍길동',
        email: 'hong@test.com',
        role: 'Developer',
        active: true,
      },
      {
        id: 'user2',
        name: '김철수',
        email: 'kim@test.com',
        role: 'Designer',
        active: true,
      },
    ];

    await updateTeam('test-project-1', members);

    const team = await getTeam('test-project-1');
    expect(team).toHaveLength(2);
    expect(team[0].name).toBe('홍길동');
  });

  it('should list all projects', async () => {
    const list = await getProjectsList();

    expect(list.projects).toHaveLength(1);
    expect(list.projects[0].id).toBe('test-project-1');
  });

  it('should reject duplicate team member IDs', async () => {
    const members: TeamMember[] = [
      { id: 'user1', name: 'User 1', active: true },
      { id: 'user1', name: 'User 1 Duplicate', active: true },
    ];

    await expect(updateTeam('test-project-1', members)).rejects.toThrow('중복');
  });

  it('should reject invalid project ID format', async () => {
    const dto = {
      id: 'Invalid_Project', // 언더스코어 불허
      name: 'Invalid Project',
      wbsDepth: 4 as const,
    };

    await expect(createProjectWithRegistration(dto)).rejects.toThrow();
  });
});
