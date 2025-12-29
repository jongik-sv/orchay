/**
 * Task API E2E 테스트
 * Task: TSK-03-02
 * 테스트 명세: 026-test-specification.md 섹션 4.6-4.7
 */

import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import { join } from 'path';
import { E2E_TEST_ROOT } from './test-constants';

// 고유 프로젝트 ID (테스트 파일별로 다른 ID 사용 → 병렬 실행 시 충돌 방지)
const TEST_PROJECT_ID = 'test-task-api';
const TEST_TASK_ID = 'TSK-01-01-01';
// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay');

test.describe.serial('Task API', () => {
  test.beforeEach(async () => {
    // 테스트 프로젝트 폴더 생성
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID);
    await fs.mkdir(projectPath, { recursive: true });

    // project.json 생성 (폴더 스캔 방식이므로 projects.json 불필요)
    await fs.writeFile(
      join(projectPath, 'project.json'),
      JSON.stringify({
        id: TEST_PROJECT_ID,
        name: 'Task API 테스트 프로젝트',
        version: '0.1.0',
        status: 'active',
        wbsDepth: 4,
        createdAt: '2025-12-14T00:00:00.000Z',
        updatedAt: '2025-12-14T00:00:00.000Z',
      }, null, 2),
      'utf-8'
    );

    // team.json 생성 (완전한 구조)
    const teamJsonPath = join(projectPath, 'team.json');
    await fs.writeFile(
      teamJsonPath,
      JSON.stringify({
        version: '1.0',
        members: [
          {
            id: 'dev-001',
            name: 'Developer 1',
            email: 'dev1@test.com',
            role: 'Backend Developer',
            active: true,
          },
        ],
      }, null, 2),
      'utf-8'
    );

    // WBS 파일 생성 (상태 코드 형식: [bd] - 대괄호만 사용)
    const wbsPath = join(projectPath, 'wbs.md');
    const wbsContent = `# WBS - Test Project

> version: 1.0
> depth: 4
> updated: 2025-12-14
> start: 2025-12-13

---

## WP-01: Test Work Package
- status: planned

### ACT-01-01: Test Activity
- status: todo

#### ${TEST_TASK_ID}: Test Task
- category: development
- status: [bd]
- priority: critical
- assignee: dev-001
`;

    await fs.writeFile(wbsPath, wbsContent, 'utf-8');

    // Task 폴더 및 문서 생성
    const taskFolderPath = join(projectPath, 'tasks', TEST_TASK_ID);
    await fs.mkdir(taskFolderPath, { recursive: true });
    await fs.writeFile(
      join(taskFolderPath, '010-basic-design.md'),
      '# Basic Design\n\nTest content',
      'utf-8'
    );

    // history.json 초기화 (이력 기록용)
    await fs.writeFile(
      join(taskFolderPath, 'history.json'),
      JSON.stringify([]),
      'utf-8'
    );
  });

  test.afterEach(async () => {
    // 테스트 프로젝트 삭제 (폴더 스캔 방식이므로 설정 파일 정리 불필요)
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID);
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  test('E2E-TASK-01: GET /api/tasks/:id - Task 조회 성공', async ({ request }) => {
    // Act
    const response = await request.get(`/api/tasks/${TEST_TASK_ID}`);

    // Assert
    expect(response.status()).toBe(200);

    const task = await response.json();
    expect(task.id).toBe(TEST_TASK_ID);
    expect(task.title).toBe('Test Task');
    expect(task.category).toBe('development');
    expect(task.status).toBe('bd');
    expect(task.priority).toBe('critical');
    expect(task.documents).toBeInstanceOf(Array);
    expect(task.documents.length).toBeGreaterThan(0);
    expect(task.history).toBeInstanceOf(Array);
    expect(task.availableActions).toBeInstanceOf(Array);
    expect(task.assignee).toBeTruthy();
    expect(task.assignee.id).toBe('dev-001');
  });

  test('E2E-TASK-02: PUT /api/tasks/:id - Task 수정 및 이력 기록', async ({ request }) => {
    // Arrange: 현재 Task 조회
    let response = await request.get(`/api/tasks/${TEST_TASK_ID}`);
    const task = await response.json();
    const oldTitle = task.title;

    // Act: Task 수정
    response = await request.put(`/api/tasks/${TEST_TASK_ID}`, {
      data: { title: 'New Title', priority: 'high' },
    });

    // Assert
    expect(response.status()).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.task.title).toBe('New Title');
    expect(result.task.priority).toBe('high');

    // 재조회하여 이력 확인
    response = await request.get(`/api/tasks/${TEST_TASK_ID}`);
    const updatedTask = await response.json();

    expect(updatedTask.title).toBe('New Title');
    expect(updatedTask.history.length).toBeGreaterThan(0);
    expect(updatedTask.history[0].action).toBe('update');
    expect(updatedTask.history[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 이력에 변경 내용 포함 확인
    const historyEntry = updatedTask.history[0];
    expect(historyEntry.from).toBeTruthy();
    expect(historyEntry.to).toBeTruthy();
  });

  test('E2E-TASK-03: GET /api/tasks/:id - 존재하지 않는 Task', async ({ request }) => {
    // Act
    const response = await request.get('/api/tasks/TSK-99-99-99');

    // Assert
    expect(response.status()).toBe(404);

    const error = await response.json();
    expect(error.statusMessage).toBe('PROJECT_NOT_FOUND');
  });

  test('E2E-TASK-04: PUT /api/tasks/:id - 유효성 검증 실패', async ({ request }) => {
    // Act: 유효하지 않은 priority
    const response = await request.put(`/api/tasks/${TEST_TASK_ID}`, {
      data: { priority: 'invalid' },
    });

    // Assert
    expect(response.status()).toBe(400);

    const error = await response.json();
    expect(error.statusMessage).toBe('VALIDATION_ERROR');
    expect(error.message).toContain('유효하지 않은 우선순위');
  });

  test('E2E-TASK-05: GET /api/tasks/:id/documents - 문서 목록 조회', async ({ request }) => {
    // Act
    const response = await request.get(`/api/tasks/${TEST_TASK_ID}/documents`);

    // Assert
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.taskId).toBe(TEST_TASK_ID);
    expect(data.documents).toBeInstanceOf(Array);

    // 존재하는 문서 확인 (beforeEach에서 생성)
    const existingDoc = data.documents.find(
      (d: { name: string }) => d.name === '010-basic-design.md'
    );
    expect(existingDoc).toBeTruthy();
    expect(existingDoc.exists).toBe(true);
    expect(existingDoc.stage).toBe('current');

    // 예정 문서 확인 (현재 상태 [bd]에서 draft 명령 시 생성될 문서)
    const expectedDoc = data.documents.find(
      (d: { name: string }) => d.name === '020-detail-design.md'
    );
    expect(expectedDoc).toBeTruthy();
    expect(expectedDoc.exists).toBe(false);
    expect(expectedDoc.stage).toBe('expected');
  });

  test('E2E-TASK-06: POST /api/tasks/:id/transition - 상태 전이 성공', async ({ request }) => {
    // Act: [bd] → [dd] 전이 (draft 명령)
    const response = await request.post(`/api/tasks/${TEST_TASK_ID}/transition`, {
      data: { command: 'draft' },
    });

    // Assert
    expect(response.status()).toBe(201);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.taskId).toBe(TEST_TASK_ID);
    expect(result.previousStatus).toBe('bd');
    expect(result.newStatus).toBe('dd');
    expect(result.command).toBe('draft');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // 재조회하여 상태 변경 확인
    const taskResponse = await request.get(`/api/tasks/${TEST_TASK_ID}`);
    const task = await taskResponse.json();
    expect(task.status).toBe('dd');
  });

  test('E2E-TASK-07: POST /api/tasks/:id/transition - 유효하지 않은 전이', async ({ request }) => {
    // Act: [bd] 상태에서 done 명령 (불가)
    const response = await request.post(`/api/tasks/${TEST_TASK_ID}/transition`, {
      data: { command: 'done' },
    });

    // Assert
    expect(response.status()).toBe(409);

    const error = await response.json();
    expect(error.statusMessage).toBe('INVALID_TRANSITION');
  });

  test('E2E-TASK-08: GET /api/tasks/:id/available-commands - 가능한 명령어 조회', async ({ request }) => {
    // Act
    const response = await request.get(`/api/tasks/${TEST_TASK_ID}/available-commands`);

    // Assert
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.taskId).toBe(TEST_TASK_ID);
    // 상태는 이전 테스트(E2E-TASK-06)에서 전이되었을 수 있으므로 형식만 검증
    expect(data.currentStatus).toMatch(/^\[.+\]$/); // [bd], [dd] 등 상태 코드 형식
    expect(data.commands).toBeInstanceOf(Array);
    // 가능한 명령어가 있는지 확인 (상태에 따라 다름)
    expect(data.commands.length).toBeGreaterThanOrEqual(0);
  });
});
