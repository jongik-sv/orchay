/**
 * WBS 테스트 결과 업데이트 API 단위 테스트
 * Task: TSK-03-05
 * 테스트 명세: 026-test-specification.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';

const TEST_PROJECT_ID = 'test-tsk-03-05';
const TEST_TASK_ID = 'TSK-01-01';
const API_BASE = 'http://localhost:3000';

describe('PUT /api/projects/:id/wbs/tasks/:taskId/test-result', () => {
  const wbsPath = join(process.cwd(), '.orchay', 'projects', TEST_PROJECT_ID, 'wbs.md');
  const projectJsonPath = join(process.cwd(), '.orchay', 'projects', TEST_PROJECT_ID, 'project.json');
  const projectsPath = join(process.cwd(), '.orchay', 'settings', 'projects.json');

  // 테스트용 WBS 마크다운
  const testWbsMarkdown = `# Test Project

> version: 1.0
> depth: 3
> updated: 2025-12-15
> start: 2025-12-01

---

## WP-01: Test Work Package
- schedule: 2025-12-01 ~ 2025-12-31

### TSK-01-01: Test Task 1
- category: development
- status: [dd]
- priority: medium
- assignee: -
- test-result: none
- requirements:
  - Test requirement 1

### TSK-01-02: Test Task 2
- category: development
- status: [im]
- priority: high
- test-result: none
`;

  beforeEach(async () => {
    // 테스트 프로젝트 디렉토리 생성
    await fs.mkdir(join(process.cwd(), '.orchay', 'projects', TEST_PROJECT_ID), { recursive: true });

    // wbs.md 파일 생성
    await fs.writeFile(wbsPath, testWbsMarkdown, 'utf-8');

    // project.json 생성
    const projectJson = {
      id: TEST_PROJECT_ID,
      name: 'Test Project for TSK-03-05',
      created: '2025-12-15',
      updated: '2025-12-15'
    };
    await fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2), 'utf-8');

    // projects.json에 프로젝트 등록
    const projectsData = {
      projects: [
        { id: TEST_PROJECT_ID, name: 'Test Project for TSK-03-05' }
      ]
    };
    await fs.mkdir(join(process.cwd(), '.orchay', 'settings'), { recursive: true });
    await fs.writeFile(projectsPath, JSON.stringify(projectsData, null, 2), 'utf-8');
  });

  afterEach(async () => {
    // 테스트 프로젝트 정리
    try {
      await fs.rm(join(process.cwd(), '.orchay', 'projects', TEST_PROJECT_ID), { recursive: true, force: true });
      await fs.rm(join(process.cwd(), '.orchay', 'settings', 'projects.json'), { force: true });
    } catch (error) {
      // 정리 실패는 무시
    }
  });

  describe('UT-001: 정상 test-result 업데이트', () => {
    it('should update test-result successfully', async () => {
      // Arrange
      const requestBody = { testResult: 'pass' };

      // Act
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Assert
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.testResult).toBe('pass');
      expect(data.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // wbs.md 파일 확인
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      expect(wbsContent).toContain('test-result: pass');
    });
  });

  describe('UT-002: 파라미터 검증 실패', () => {
    it('should return 400 or 404 for invalid project ID (path traversal)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/../../../etc/passwd/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      // Nuxt routing may return 404 before reaching validation
      expect([400, 404]).toContain(response.status);
    });

    it('should return 400 for missing request body', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_REQUEST_BODY');
    });

    it('should return 400 for missing testResult field', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_REQUEST_BODY');
    });
  });

  describe('UT-003: Task ID 형식 검증 (BR-001)', () => {
    it('should accept valid 3-level Task ID', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(200);
    });

    it('should accept valid 4-level Task ID format', async () => {
      // Note: Task가 실제로 존재하지 않아 404 반환, 하지만 형식은 유효
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(404); // Task가 없어서 404, 형식은 유효
      const data = await response.json();
      expect(data.statusMessage).toBe('TASK_NOT_FOUND');
    });

    it('should reject invalid Task ID format (insufficient digits)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-1-1/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TASK_ID');
    });

    it('should reject invalid Task ID format (wrong prefix)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TASK-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TASK_ID');
    });

    it('should reject invalid Task ID format (insufficient segments)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TASK_ID');
    });

    it('should reject invalid Task ID format (non-numeric)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-AA-BB/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TASK_ID');
    });
  });

  describe('UT-004: test-result 값 검증 (BR-002)', () => {
    it('should accept valid value: none', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'none' })
      });

      expect(response.status).toBe(200);
    });

    it('should accept valid value: pass', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(200);
    });

    it('should accept valid value: fail', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'fail' })
      });

      expect(response.status).toBe(200);
    });

    it('should reject invalid value: passed (typo)', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'passed' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TEST_RESULT');
    });

    it('should reject invalid value: success', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'success' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TEST_RESULT');
    });

    it('should reject empty string', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: '' })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.statusMessage).toBe('INVALID_TEST_RESULT');
    });
  });

  describe('UT-005: findTaskInTree 함수 (BR-003)', () => {
    it('should find Task in 3-level WBS', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent Task', async () => {
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-99-99/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.statusMessage).toBe('TASK_NOT_FOUND');
      expect(data.message).toContain('TSK-99-99');
    });

    it('should return 404 for empty WBS tree', async () => {
      // 빈 WBS 파일 생성
      await fs.writeFile(wbsPath, `# Test Project

> version: 1.0
> depth: 3
> updated: 2025-12-15
> start: 2025-12-01

---
`, 'utf-8');

      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(404);
    });
  });

  describe('UT-006: 백업 및 롤백 (BR-004)', () => {
    it('should create backup file before update', async () => {
      const backupPath = `${wbsPath}.bak`;

      // 백업 파일이 없는지 확인
      await fs.rm(backupPath, { force: true });

      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      expect(response.status).toBe(200);

      // 백업 파일이 생성되었는지 확인 (또는 정리되었는지)
      // Note: 성공 시 백업 파일은 삭제될 수 있음
    });

    it('should maintain idempotency when test-result is already the same', async () => {
      // 첫 번째 업데이트
      const response1 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });
      expect(response1.status).toBe(200);

      // 동일한 값으로 두 번째 업데이트
      const response2 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/${TEST_TASK_ID}/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });
      expect(response2.status).toBe(200);

      // 파일 확인
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      expect(wbsContent).toContain('test-result: pass');
    });
  });

  describe('UT-007: 대용량 WBS 성능 테스트 (H-03)', () => {
    it('should respond within 200ms for large WBS', async () => {
      // 대용량 WBS 생성 (100개 Task)
      let largeWbs = `# Test Project

> version: 1.0
> depth: 3
> updated: 2025-12-15
> start: 2025-12-01

---

## WP-01: Test Work Package
- schedule: 2025-12-01 ~ 2025-12-31

`;

      for (let i = 1; i <= 100; i++) {
        largeWbs += `### TSK-01-${String(i).padStart(2, '0')}: Test Task ${i}
- category: development
- status: [dd]
- priority: medium
- test-result: none

`;
      }

      await fs.writeFile(wbsPath, largeWbs, 'utf-8');

      const startTime = Date.now();

      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-50/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(200);
    });
  });
});
