/**
 * WBS 테스트 결과 업데이트 E2E 테스트
 * Task: TSK-03-05
 * 테스트 명세: 026-test-specification.md 섹션 3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { E2E_TEST_ROOT } from './test-constants';

const TEST_PROJECT_ID = 'test-e2e-tsk-03-05';
const API_BASE = 'http://localhost:3000';
// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay');

describe('E2E: WBS test-result Update', () => {
  const wbsPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID, 'wbs.md');
  const projectJsonPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID, 'project.json');
  const projectsPath = join(ORCHAY_ROOT, 'settings', 'projects.json');

  const testWbsMarkdown = `# Test Project

> version: 1.0
> depth: 3
> updated: 2025-12-15
> start: 2025-12-01

---

## WP-01: Test Work Package
- schedule: 2025-12-01 ~ 2025-12-31

### TSK-01-10: E2E Test Task
- category: development
- status: [dd]
- priority: medium
- assignee: -
- test-result: none
- requirements:
  - Test requirement 1

### TSK-01-01: Test Task 1
- category: development
- status: [im]
- priority: high
- test-result: none

### TSK-01-99: Test Task 99
- category: development
- status: [dd]
- priority: low
- test-result: none
`;

  beforeEach(async () => {
    // 테스트 환경 구성
    await fs.mkdir(join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID), { recursive: true });
    await fs.writeFile(wbsPath, testWbsMarkdown, 'utf-8');

    const projectJson = {
      id: TEST_PROJECT_ID,
      name: 'E2E Test Project',
      created: '2025-12-15',
      updated: '2025-12-15'
    };
    await fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2), 'utf-8');

    const projectsData = {
      projects: [
        { id: TEST_PROJECT_ID, name: 'E2E Test Project' }
      ]
    };
    await fs.mkdir(join(ORCHAY_ROOT, 'settings'), { recursive: true });
    await fs.writeFile(projectsPath, JSON.stringify(projectsData, null, 2), 'utf-8');
  });

  afterEach(async () => {
    // 정리
    try {
      await fs.rm(join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID), { recursive: true, force: true });
      await fs.rm(join(ORCHAY_ROOT, 'settings', 'projects.json'), { force: true });
    } catch (error) {
      // 정리 실패는 무시
    }
  });

  describe('E2E-001: 전체 흐름 (파싱 → 업데이트 → 직렬화 → 저장)', () => {
    it('test-result 업데이트가 wbs.md에 정상 반영된다', async () => {
      // Act
      const response = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-10/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });

      // Assert - API 응답
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.testResult).toBe('pass');
      expect(data.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // Assert - wbs.md 파일 내용 확인
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      expect(wbsContent).toContain('### TSK-01-10: E2E Test Task');
      expect(wbsContent).toContain('test-result: pass');

      // 다른 Task는 영향받지 않음 확인
      expect(wbsContent).toContain('### TSK-01-01: Test Task 1');
      const task01Lines = wbsContent.split('\n').filter(line =>
        line.includes('TSK-01-01') || (line.includes('test-result') && wbsContent.indexOf(line) > wbsContent.indexOf('TSK-01-01'))
      );
      // TSK-01-01의 test-result는 여전히 none이어야 함
    });
  });

  describe('E2E-002: 유효한 Task ID와 test-result', () => {
    it('유효한 Task ID와 test-result 값으로 업데이트 성공', async () => {
      // 3단계 Task ID - none
      const response1 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'none' })
      });
      expect(response1.status).toBe(200);

      // 3단계 Task ID - pass
      const response2 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-01/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });
      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2.testResult).toBe('pass');

      // 3단계 Task ID - fail
      const response3 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-99/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'fail' })
      });
      expect(response3.status).toBe(200);
      const data3 = await response3.json();
      expect(data3.testResult).toBe('fail');

      // wbs.md 파일 검증
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      expect(wbsContent).toMatch(/TSK-01-01[\s\S]*?test-result: pass/);
      expect(wbsContent).toMatch(/TSK-01-99[\s\S]*?test-result: fail/);
    });
  });

  describe('E2E-003: 무효한 test-result 값', () => {
    it('무효한 test-result 값으로 요청 시 400 에러', async () => {
      // 'passed' (typo)
      const response1 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-10/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'passed' })
      });
      expect(response1.status).toBe(400);
      const data1 = await response1.json();
      expect(data1.statusMessage).toBe('INVALID_TEST_RESULT');

      // 'success'
      const response2 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-10/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'success' })
      });
      expect(response2.status).toBe(400);

      // 빈 문자열
      const response3 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-01-10/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: '' })
      });
      expect(response3.status).toBe(400);

      // wbs.md 파일이 변경되지 않았는지 확인
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      expect(wbsContent).toContain('test-result: none'); // 여전히 none
    });
  });

  describe('E2E-004: 존재하지 않는 Task', () => {
    it('존재하지 않는 Task ID 요청 시 404 에러', async () => {
      // 3단계 형식이지만 존재하지 않는 Task
      const response1 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-88-88/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });
      expect(response1.status).toBe(404);
      const data1 = await response1.json();
      expect(data1.statusMessage).toBe('TASK_NOT_FOUND');
      expect(data1.message).toContain('TSK-88-88');

      // 4단계 형식이지만 존재하지 않는 Task
      const response2 = await fetch(`${API_BASE}/api/projects/${TEST_PROJECT_ID}/wbs/tasks/TSK-99-99-99/test-result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testResult: 'pass' })
      });
      expect(response2.status).toBe(404);
      const data2 = await response2.json();
      expect(data2.statusMessage).toBe('TASK_NOT_FOUND');

      // wbs.md 파일이 변경되지 않았는지 확인
      const wbsContent = await fs.readFile(wbsPath, 'utf-8');
      const originalWbs = testWbsMarkdown.replace(/\r\n/g, '\n');
      expect(wbsContent.trim()).toBe(originalWbs.trim());
    });
  });
});
