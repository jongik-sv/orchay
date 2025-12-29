/**
 * Playwright Global Setup
 *
 * 서버 시작 전에 테스트 데이터를 준비합니다.
 * playwright.config.ts의 globalSetup에서 호출됩니다.
 *
 * 주요 변경사항:
 * - 실제 .orchay 폴더 대신 임시 디렉토리 사용
 * - 테스트 간 격리 보장
 * - 프로덕션 데이터 보호
 */

import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { E2E_TEST_ROOT, TEST_PROJECT_ID, TEST_PROJECT_NAME } from './test-constants';

async function globalSetup() {
  console.log('[Global Setup] Preparing E2E test environment...');

  // 기존 테스트 디렉토리가 있으면 삭제 (이전 테스트 잔여물 정리)
  try {
    await rm(E2E_TEST_ROOT, { recursive: true, force: true });
  } catch {
    // 폴더가 없으면 무시
  }

  const orchayRoot = join(E2E_TEST_ROOT, '.orchay');

  console.log('[Global Setup] Test root directory:', E2E_TEST_ROOT);

  // 테스트 프로젝트 폴더 생성
  const projectPath = join(orchayRoot, 'projects', TEST_PROJECT_ID);
  await mkdir(projectPath, { recursive: true });

  // Task 폴더 생성 (TSK-01-01-01)
  const taskPath = join(projectPath, 'tasks', 'TSK-01-01-01');
  await mkdir(taskPath, { recursive: true });

  // Detail Sections 테스트용 Task 폴더 생성 (TSK-01-01-02)
  const detailTaskPath = join(projectPath, 'tasks', 'TSK-01-01-02');
  await mkdir(detailTaskPath, { recursive: true });

  // project.json 생성 (폴더 스캔 방식이므로 projects.json 불필요)
  const projectConfig = {
    id: TEST_PROJECT_ID,
    name: TEST_PROJECT_NAME,
    description: 'E2E 테스트용 프로젝트',
    version: '0.1.0',
    status: 'active',
    wbsDepth: 4,  // 폴더 스캔 시 필요
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
        id: 'dev-001',
        name: 'Developer 1',
        email: 'dev1@test.com',
        role: 'Backend Developer',
        active: true,
      },
    ],
  };

  await writeFile(
    join(projectPath, 'team.json'),
    JSON.stringify(teamConfig, null, 2),
    'utf-8'
  );

  // wbs.md 생성 (상태 코드 형식: [bd] - 대괄호만 사용)
  // detail-sections 테스트를 위해 Task들을 ACT-01-01 아래에 배치 (4단계 구조)
  const wbsContent = `# WBS - ${TEST_PROJECT_NAME}

> version: 1.0
> depth: 4
> updated: 2025-12-14
> start: 2025-12-13

---

## WP-01: Test Work Package
- status: planned
- priority: high

### ACT-01-01: Test Activity
- status: todo

#### TSK-01-01-01: Test Task
- category: development
- status: [bd]
- priority: critical
- assignee: dev-001

#### TSK-01-01-02: Development Task
- category: development
- domain: frontend
- status: [dd]
- priority: high
- assignee: dev-001
- schedule: 2025-12-15 ~ 2025-12-16
- tags: test, detail
- depends: -
- test-result: none
- requirements:
  - TaskWorkflow 컴포넌트 (워크플로우 흐름 시각화)
  - TaskRequirements 컴포넌트 (요구사항 목록, 인라인 편집)
  - TaskDocuments 컴포넌트 (문서 목록, 존재/예정 구분)
  - TaskHistory 컴포넌트 (상태 변경 이력, 타임라인)
- ref: PRD 6.3.2, 6.3.3, 6.3.4, 6.3.6

#### TSK-01-01-03: Defect Task
- category: defect
- domain: backend
- status: [an]
- priority: medium
- assignee: -
- test-result: none
- requirements:
  - Defect workflow test requirement

#### TSK-01-01-04: Infrastructure Task
- category: infrastructure
- domain: infra
- status: [im]
- priority: low
- assignee: -
- test-result: none
- requirements:
  - Infrastructure workflow test requirement
`;

  await writeFile(join(projectPath, 'wbs.md'), wbsContent, 'utf-8');

  // Task 문서 생성 (TSK-01-01-01)
  await writeFile(
    join(taskPath, '010-basic-design.md'),
    '# Basic Design\n\nTest content',
    'utf-8'
  );

  // Detail Sections 테스트용 문서 및 이력 생성 (TSK-01-01)
  await writeFile(
    join(detailTaskPath, '010-basic-design.md'),
    '# 기본설계\n\nThis is a test basic design document.',
    'utf-8'
  );

  // history.json 생성
  const historyData = {
    version: '1.0',
    taskId: 'TSK-01-01-02',
    entries: [
      {
        timestamp: '2025-12-15T09:00:00.000Z',
        action: 'transition',
        previousStatus: '[ ]',
        newStatus: '[bd]',
        command: '/wf:start',
        documentCreated: '010-basic-design.md',
        userId: 'dev-001'
      },
      {
        timestamp: '2025-12-15T13:12:00.000Z',
        action: 'transition',
        previousStatus: '[bd]',
        newStatus: '[dd]',
        command: '/wf:draft',
        documentCreated: '020-detail-design.md',
        userId: 'dev-001'
      }
    ]
  };
  await writeFile(
    join(detailTaskPath, 'history.json'),
    JSON.stringify(historyData, null, 2),
    'utf-8'
  );

  console.log('[Global Setup] E2E test data prepared at:', orchayRoot);
  console.log('[Global Setup] Environment ready. ORCHAY_BASE_PATH:', E2E_TEST_ROOT);
}

export default globalSetup;
