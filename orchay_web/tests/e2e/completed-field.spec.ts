/**
 * E2E 테스트: completed 필드 지원 (TSK-03-06)
 * 테스트 명세: 026-test-specification.md (E2E-001 ~ E2E-005)
 */

import { test, expect } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { E2E_TEST_ROOT } from './test-constants';

const TEST_COMPLETED_PROJECT = 'test-completed-field';
const TEST_COMPLETED_PATH = join(E2E_TEST_ROOT, '.orchay', 'projects', TEST_COMPLETED_PROJECT);

test.describe('completed 필드 지원 E2E 테스트', () => {
  test.beforeAll(() => {
    // 테스트 프로젝트 폴더 생성
    if (!existsSync(TEST_COMPLETED_PATH)) {
      mkdirSync(TEST_COMPLETED_PATH, { recursive: true });
    }

    // 프로젝트 메타 파일 생성
    const projectMeta = {
      id: TEST_COMPLETED_PROJECT,
      name: 'Completed Field Test',
      description: 'Test project for completed field functionality',
      status: 'active',
      wbsDepth: 4,
      createdAt: '2025-12-15',
    };
    writeFileSync(
      join(TEST_COMPLETED_PATH, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    // 팀 파일 생성
    const team = {
      members: [
        { id: 'test-user', name: 'Test User', role: 'developer' },
      ],
    };
    writeFileSync(
      join(TEST_COMPLETED_PATH, 'team.json'),
      JSON.stringify(team, null, 2)
    );
  });

  /**
   * E2E-002: 상태 전이 후 completed 확인
   */
  test('E2E-002: 상태 전이 시 completed 필드에 타임스탬프가 자동으로 기록된다', async ({ request }) => {
    // Arrange: wbs.md 파일 생성
    const wbsContent = `# WBS

- version: 1.0
- depth: 4
- updated: 2025-12-15
- start: 2025-12-01

## WP-01: Test Work Package

### TSK-E2E-02: Test Task for Completed Field
- category: development
- status: todo [ ]
- priority: high
- assignee: Test User
- schedule: 2025-12-15 ~ 2025-12-16
`;

    writeFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), wbsContent);

    // Act: 상태 전이 실행
    const response = await request.post(`http://localhost:3000/api/tasks/TSK-E2E-02/transition`, {
      data: {
        command: 'start',
      },
    });

    // Assert: API 응답 확인
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);

    // WBS 조회하여 completed 필드 확인
    const wbsResponse = await request.get(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`);
    expect(wbsResponse.ok()).toBeTruthy();

    const wbsData = await wbsResponse.json();
    const task = wbsData.tree[0].children[0]; // TSK-E2E-02

    // completed.bd 존재 확인
    expect(task.completed).toBeDefined();
    expect(task.completed.bd).toBeDefined();

    // 타임스탬프 형식 검증 (YYYY-MM-DD HH:mm)
    expect(task.completed.bd).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);

    // 현재 시각과 유사한지 확인 (±5분 이내)
    const now = new Date();
    const [datePart, timePart] = task.completed.bd.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    const completedDate = new Date(year, month - 1, day, hour, minute);

    const diffMinutes = Math.abs((now.getTime() - completedDate.getTime()) / 1000 / 60);
    expect(diffMinutes).toBeLessThan(5);
  });

  /**
   * E2E-003: 연속 전이 후 completed 누적
   */
  test('E2E-003: 여러 상태 전이 후 completed 필드에 모든 단계가 누적된다', async ({ request }) => {
    // Arrange
    const wbsContent = `# WBS

- version: 1.0
- depth: 4
- updated: 2025-12-15
- start: 2025-12-01

## WP-01: Test Work Package

### TSK-E2E-03: Test Task for Multiple Transitions
- category: development
- status: todo [ ]
- priority: high
- assignee: Test User
- schedule: 2025-12-15 ~ 2025-12-16
`;

    writeFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), wbsContent);

    // Act: 여러 전이 실행
    const transitions = [
      { command: 'start', expectedStatus: 'bd' },
      { command: 'draft', expectedStatus: 'dd' },
      { command: 'build', expectedStatus: 'im' },
    ];

    for (const transition of transitions) {
      const response = await request.post(`http://localhost:3000/api/tasks/TSK-E2E-03/transition`, {
        data: { command: transition.command },
      });
      expect(response.ok()).toBeTruthy();
    }

    // Assert: WBS 조회하여 누적된 completed 확인
    const wbsResponse = await request.get(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`);
    expect(wbsResponse.ok()).toBeTruthy();

    const wbsData = await wbsResponse.json();
    const task = wbsData.tree[0].children[0]; // TSK-E2E-03

    // 모든 단계의 completed 항목 존재 확인
    expect(task.completed).toBeDefined();
    expect(task.completed.bd).toBeDefined();
    expect(task.completed.dd).toBeDefined();
    expect(task.completed.im).toBeDefined();

    // 타임스탬프가 순차적으로 증가하는지 확인 (같은 날짜일 경우)
    const bdTime = new Date(`2025-12-15 ${task.completed.bd.split(' ')[1]}`);
    const ddTime = new Date(`2025-12-15 ${task.completed.dd.split(' ')[1]}`);
    const imTime = new Date(`2025-12-15 ${task.completed.im.split(' ')[1]}`);

    expect(ddTime.getTime()).toBeGreaterThanOrEqual(bdTime.getTime());
    expect(imTime.getTime()).toBeGreaterThanOrEqual(ddTime.getTime());
  });

  /**
   * E2E-004: development 롤백 시나리오
   */
  test('E2E-004: development 워크플로우에서 롤백 시 이후 단계 completed가 삭제된다', async ({ request }) => {
    // Arrange: [im] 상태의 Task 생성
    const wbsContent = `# WBS

- version: 1.0
- depth: 4
- updated: 2025-12-15
- start: 2025-12-01

## WP-01: Test Work Package

### TSK-E2E-04: Test Task for Rollback
- category: development
- status: implement [im]
- priority: high
- assignee: Test User
- schedule: 2025-12-15 ~ 2025-12-16
- completed:
  - bd: 2025-12-15 10:00
  - dd: 2025-12-15 12:00
  - im: 2025-12-15 14:00
`;

    writeFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), wbsContent);

    // Act: [im] → [dd] 롤백 실행
    const response = await request.post(`http://localhost:3000/api/tasks/TSK-E2E-04/transition`, {
      data: { command: 'draft' },
    });

    // Assert: API 응답 확인
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);

    // WBS 조회하여 completed 확인
    const wbsResponse = await request.get(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`);
    expect(wbsResponse.ok()).toBeTruthy();

    const wbsData = await wbsResponse.json();
    const task = wbsData.tree[0].children[0]; // TSK-E2E-04

    // 롤백 이전 단계 유지
    expect(task.completed.bd).toBe('2025-12-15 10:00');

    // 롤백 대상 단계 갱신됨
    expect(task.completed.dd).toBeDefined();
    expect(task.completed.dd).not.toBe('2025-12-15 12:00'); // 새 타임스탬프

    // 롤백 이후 단계 삭제됨
    expect(task.completed.im).toBeUndefined();
    expect(task.completed.vf).toBeUndefined();
    expect(task.completed.xx).toBeUndefined();

    // wbs.md 파일 내용 확인
    const wbsFileContent = readFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), 'utf-8');
    expect(wbsFileContent).toContain('- bd: 2025-12-15 10:00');
    expect(wbsFileContent).not.toContain('- im: 2025-12-15 14:00');
  });

  /**
   * E2E-005: defect 롤백 시나리오
   */
  test('E2E-005: defect 워크플로우에서 롤백 시 이후 단계 completed가 삭제된다', async ({ request }) => {
    // Arrange: [fx] 상태의 defect Task 생성
    const wbsContent = `# WBS

- version: 1.0
- depth: 4
- updated: 2025-12-15
- start: 2025-12-01

## WP-01: Test Work Package

### TSK-E2E-05: Test Defect Task for Rollback
- category: defect
- status: fix [fx]
- priority: high
- assignee: Test User
- schedule: 2025-12-15 ~ 2025-12-16
- completed:
  - an: 2025-12-15 09:00
  - fx: 2025-12-15 11:00
`;

    writeFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), wbsContent);

    // Act: [fx] → [an] 롤백 실행
    const response = await request.post(`http://localhost:3000/api/tasks/TSK-E2E-05/transition`, {
      data: { command: 'start' },
    });

    // Assert: API 응답 확인
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.success).toBe(true);

    // WBS 조회하여 completed 확인
    const wbsResponse = await request.get(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`);
    expect(wbsResponse.ok()).toBeTruthy();

    const wbsData = await wbsResponse.json();
    const task = wbsData.tree[0].children[0]; // TSK-E2E-05

    // an 갱신됨
    expect(task.completed.an).toBeDefined();
    expect(task.completed.an).not.toBe('2025-12-15 09:00'); // 새 타임스탬프

    // fx, vf, xx 삭제됨
    expect(task.completed.fx).toBeUndefined();
    expect(task.completed.vf).toBeUndefined();
    expect(task.completed.xx).toBeUndefined();

    // wbs.md 파일 내용 확인
    const wbsFileContent = readFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), 'utf-8');
    expect(wbsFileContent).not.toContain('- fx: 2025-12-15 11:00');
  });

  /**
   * E2E-001: 파싱 및 직렬화 왕복 변환
   */
  test('E2E-001: completed 필드가 파싱 및 직렬화 왕복 변환에서 정확히 유지된다', async ({ request }) => {
    // Arrange: completed 필드가 있는 wbs.md 생성
    const originalContent = `# WBS

- version: 1.0
- depth: 4
- updated: 2025-12-15
- start: 2025-12-01

## WP-01: Test Work Package

### TSK-E2E-01: Test Task with Completed Field
- category: development
- status: detail-design [dd]
- priority: high
- assignee: Test User
- schedule: 2025-12-15 ~ 2025-12-16
- completed:
  - bd: 2025-12-15 10:30
  - dd: 2025-12-15 14:20
`;

    writeFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), originalContent);

    // Act: 파싱 (GET)
    const getResponse = await request.get(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`);
    expect(getResponse.ok()).toBeTruthy();

    const wbsData = await getResponse.json();
    const task = wbsData.tree[0].children[0]; // TSK-E2E-01

    // Assert: 파싱된 데이터 확인
    expect(task.completed).toBeDefined();
    expect(task.completed.bd).toBe('2025-12-15 10:30');
    expect(task.completed.dd).toBe('2025-12-15 14:20');

    // Act: 직렬화 (PUT)
    const putResponse = await request.put(`http://localhost:3000/api/projects/${TEST_COMPLETED_PROJECT}/wbs`, {
      data: {
        metadata: wbsData.metadata,
        tree: wbsData.tree,
      },
    });
    expect(putResponse.ok()).toBeTruthy();

    // Assert: 파일 내용 확인
    const savedContent = readFileSync(join(TEST_COMPLETED_PATH, 'wbs.md'), 'utf-8');

    // completed 필드 존재 확인
    expect(savedContent).toContain('- completed:');
    expect(savedContent).toContain('  - bd: 2025-12-15 10:30');
    expect(savedContent).toContain('  - dd: 2025-12-15 14:20');

    // 들여쓰기 확인 (2칸 공백)
    const lines = savedContent.split('\n');
    const completedLine = lines.find(line => line.includes('- completed:'));
    const bdLine = lines.find(line => line.includes('- bd: 2025-12-15 10:30'));

    expect(completedLine).toBeDefined();
    expect(bdLine).toBeDefined();
    expect(bdLine).toMatch(/^  - bd: 2025-12-15 10:30$/);
  });
});
