import { test, expect } from '@playwright/test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { E2E_TEST_ROOT } from './test-constants';

/**
 * Project Metadata Service E2E Tests
 *
 * @see TSK-02-03-03
 * @see 026-test-specification.md
 *
 * Test Coverage:
 * - E2E-001: 프로젝트 목록 조회 API
 * - E2E-002: 프로젝트 상세 조회 API
 * - E2E-003: 프로젝트 생성 플로우
 * - E2E-004: 프로젝트 수정 플로우
 * - E2E-005: 팀원 관리 플로우
 */

// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay');
// 고유 프로젝트 ID (테스트 파일별로 다른 ID 사용 → 병렬 실행 시 충돌 방지)
const TEST_PROJECT_ID = 'test-project-api';

test.describe.serial('Project Metadata Service API', () => {
  // 각 테스트 전 기본 데이터 리셋 (테스트 간 격리)
  test.beforeEach(async () => {
    // 이전 테스트 잔여물 정리
    const existingProjectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID);
    await rm(existingProjectPath, { recursive: true, force: true });
    const existingE2eProjectPath = join(ORCHAY_ROOT, 'projects', 'e2e-create-project');
    await rm(existingE2eProjectPath, { recursive: true, force: true });

    // settings 폴더 생성
    const settingsPath = join(ORCHAY_ROOT, 'settings');
    await mkdir(settingsPath, { recursive: true });

    // test-project 폴더 생성
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID);
    await mkdir(projectPath, { recursive: true });

    // project.json 생성
    const projectConfig = {
      id: TEST_PROJECT_ID,
      name: '테스트 프로젝트',
      description: 'E2E 테스트용 프로젝트',
      version: '0.1.0',
      status: 'active',
      wbsDepth: 4,
      createdAt: '2025-12-14T00:00:00.000Z',
      updatedAt: '2025-12-14T00:00:00.000Z',
      scheduledStart: '2025-01-01',
      scheduledEnd: '2025-12-31',
    };

    await writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify(projectConfig, null, 2),
      'utf-8'
    );

    // team.json 생성
    const teamConfig = {
      version: '1.0',
      members: [
        {
          id: 'hong',
          name: '홍길동',
          email: 'hong@test.com',
          role: 'Developer',
          active: true,
        },
      ],
    };

    await writeFile(
      join(projectPath, 'team.json'),
      JSON.stringify(teamConfig, null, 2),
      'utf-8'
    );

    // 폴더 스캔 방식이므로 projects.json 불필요 - project.json에 wbsDepth 추가 필요
  });

  // 각 테스트 후 데이터 정리
  test.afterEach(async () => {
    // test-project 폴더 삭제
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID);
    await rm(projectPath, { recursive: true, force: true });

    // e2e-create-project 폴더도 삭제 (E2E-003에서 생성)
    const e2eProjectPath = join(ORCHAY_ROOT, 'projects', 'e2e-create-project');
    await rm(e2eProjectPath, { recursive: true, force: true });

    // 폴더 스캔 방식이므로 projects.json 정리 불필요
  });

  /**
   * E2E-001: 프로젝트 목록 조회 API
   * @requirement FR-001
   */
  test('E2E-001: GET /api/projects returns project list', async ({ request }) => {
    const response = await request.get('/api/projects');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // 응답 구조 검증
    expect(data).toHaveProperty('projects');
    expect(data).toHaveProperty('defaultProject');
    expect(data).toHaveProperty('total');

    // projects 배열 검증
    expect(Array.isArray(data.projects)).toBe(true);
    expect(data.total).toBeGreaterThan(0);

    // 테스트 프로젝트 찾기
    const project = data.projects.find((p: { id: string }) => p.id === TEST_PROJECT_ID);
    expect(project).toBeTruthy();
    expect(project).toHaveProperty('id');
    expect(project).toHaveProperty('name');
    expect(project).toHaveProperty('status');
    expect(project.id).toBe(TEST_PROJECT_ID);
  });

  /**
   * E2E-002: 프로젝트 상세 조회 API
   * @requirement FR-002
   */
  test('E2E-002: GET /api/projects/:id returns project detail with team', async ({ request }) => {
    const response = await request.get(`/api/projects/${TEST_PROJECT_ID}`);

    expect(response.status()).toBe(200);

    const data = await response.json();

    // 응답 구조 검증
    expect(data).toHaveProperty('project');
    expect(data).toHaveProperty('team');

    // project 객체 검증
    expect(data.project.id).toBe(TEST_PROJECT_ID);
    expect(data.project.name).toBe('테스트 프로젝트');
    expect(data.project).toHaveProperty('description');
    expect(data.project).toHaveProperty('createdAt');
    expect(data.project).toHaveProperty('updatedAt');

    // team 배열 검증
    expect(Array.isArray(data.team)).toBe(true);
    expect(data.team.length).toBeGreaterThan(0);
    expect(data.team[0].name).toBe('홍길동');
  });

  /**
   * E2E-003: 프로젝트 생성 플로우
   * @requirement FR-003, BR-001, BR-004
   */
  test('E2E-003: POST /api/projects creates new project with folder structure', async ({
    request,
  }) => {
    const newProject = {
      id: 'e2e-create-project',
      name: 'E2E 테스트 프로젝트',
      description: '생성 테스트',
      wbsDepth: 4,
    };

    const response = await request.post('/api/projects', {
      data: newProject,
    });

    expect(response.status()).toBe(201);

    const data = await response.json();

    // 생성된 프로젝트 검증
    expect(data.project.id).toBe('e2e-create-project');
    expect(data.project.name).toBe('E2E 테스트 프로젝트');
    expect(data.team).toEqual([]);

    // 생성된 프로젝트 조회 확인
    const getResponse = await request.get('/api/projects/e2e-create-project');
    expect(getResponse.status()).toBe(200);

    const getData = await getResponse.json();
    expect(getData.project.id).toBe('e2e-create-project');
  });

  /**
   * E2E-004: 프로젝트 수정 플로우
   * @requirement FR-004, BR-002
   */
  test('E2E-004: PUT /api/projects/:id updates project fields', async ({ request }) => {
    const updateData = {
      name: '수정된 프로젝트명',
      description: '수정된 설명',
    };

    const response = await request.put(`/api/projects/${TEST_PROJECT_ID}`, {
      data: updateData,
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // 수정 내용 검증
    expect(data.project.name).toBe('수정된 프로젝트명');
    expect(data.project.description).toBe('수정된 설명');
    expect(data.project.id).toBe(TEST_PROJECT_ID); // ID는 불변

    // 수정 후 조회로 확인
    const getResponse = await request.get(`/api/projects/${TEST_PROJECT_ID}`);
    const getData = await getResponse.json();
    expect(getData.project.name).toBe('수정된 프로젝트명');
  });

  /**
   * E2E-005: 팀원 관리 플로우
   * @requirement FR-005, BR-003
   */
  test('E2E-005: team CRUD operations work correctly', async ({ request }) => {
    // 1. 팀원 목록 조회
    const getResponse = await request.get(`/api/projects/${TEST_PROJECT_ID}/team`);
    expect(getResponse.status()).toBe(200);

    const getData = await getResponse.json();
    expect(getData).toHaveProperty('members');
    expect(getData).toHaveProperty('total');
    expect(Array.isArray(getData.members)).toBe(true);

    // 2. 팀원 목록 수정
    const newTeam = [
      {
        id: 'hong',
        name: '홍길동',
        email: 'hong@test.com',
        role: 'Lead Developer',
        active: true,
      },
      {
        id: 'kim',
        name: '김철수',
        email: 'kim@test.com',
        role: 'Designer',
        active: true,
      },
    ];

    const putResponse = await request.put(`/api/projects/${TEST_PROJECT_ID}/team`, {
      data: { members: newTeam },
    });
    expect(putResponse.status()).toBe(200);

    const putData = await putResponse.json();
    expect(putData.total).toBe(2);

    // 3. 수정 확인
    const verifyResponse = await request.get(`/api/projects/${TEST_PROJECT_ID}/team`);
    const verifyData = await verifyResponse.json();
    expect(verifyData.total).toBe(2);
    expect(verifyData.members[1].name).toBe('김철수');
  });

  /**
   * E2E-006: 존재하지 않는 프로젝트 조회
   * @requirement FR-002
   */
  test('E2E-006: GET /api/projects/:id returns 404 for non-existent project', async ({
    request,
  }) => {
    const response = await request.get('/api/projects/non-existent-project');

    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data).toHaveProperty('statusCode');
    expect(data).toHaveProperty('statusMessage');
    expect(data.statusCode).toBe(404);
  });

  /**
   * E2E-007: 유효하지 않은 프로젝트 ID로 생성
   * @requirement BR-001
   */
  test('E2E-007: POST /api/projects rejects invalid project ID format', async ({ request }) => {
    const invalidProject = {
      id: 'Invalid_Project!', // 대문자, 언더스코어, 특수문자 불허
      name: 'Invalid Project',
    };

    const response = await request.post('/api/projects', {
      data: invalidProject,
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('statusCode');
    expect(data.statusCode).toBe(400);
  });

  /**
   * E2E-008: 중복 프로젝트 ID로 생성
   * @requirement FR-003
   */
  test('E2E-008: POST /api/projects rejects duplicate project ID', async ({ request }) => {
    const duplicateProject = {
      id: TEST_PROJECT_ID, // 이미 존재하는 ID
      name: 'Duplicate Project',
    };

    const response = await request.post('/api/projects', {
      data: duplicateProject,
    });

    expect(response.status()).toBe(409);

    const data = await response.json();
    expect(data).toHaveProperty('statusCode');
    expect(data.statusCode).toBe(409);
    expect(data.statusMessage).toBe('DUPLICATE_PROJECT_ID');
  });

  /**
   * E2E-009: 프로젝트 ID 변경 시도
   * @requirement BR-002
   */
  test('E2E-009: PUT /api/projects/:id rejects ID change attempt', async ({ request }) => {
    const updateWithId = {
      id: 'new-id', // ID 변경 시도
      name: 'New Name',
    };

    const response = await request.put(`/api/projects/${TEST_PROJECT_ID}`, {
      data: updateWithId,
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.statusCode).toBe(400);
  });

  /**
   * E2E-010: 중복 팀원 ID 거부
   * @requirement BR-003
   */
  test('E2E-010: PUT /api/projects/:id/team rejects duplicate member IDs', async ({ request }) => {
    const duplicateMembers = [
      { id: 'user1', name: 'User 1', active: true },
      { id: 'user1', name: 'User 1 Duplicate', active: true }, // 중복 ID
    ];

    const response = await request.put(`/api/projects/${TEST_PROJECT_ID}/team`, {
      data: { members: duplicateMembers },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.statusCode).toBe(400);
    expect(data.statusMessage).toBe('DUPLICATE_MEMBER_ID');
  });

  /**
   * E2E-011: 프로젝트 목록 상태 필터링
   * @requirement FR-001
   */
  test('E2E-011: GET /api/projects supports status filtering', async ({ request }) => {
    // active 프로젝트만 조회
    const response = await request.get('/api/projects?status=active');

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data.projects)).toBe(true);

    // 모든 프로젝트가 active 상태인지 확인
    data.projects.forEach((project: any) => {
      expect(project.status).toBe('active');
    });
  });
});
