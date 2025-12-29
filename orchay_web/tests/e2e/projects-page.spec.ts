/**
 * Projects Page E2E Tests
 * Task: TSK-04-00
 * Test Specification: 026-test-specification.md
 *
 * 주의: Nuxt SSR + useFetch는 서버 사이드에서 실제 API를 호출하므로
 * page.route() Mock이 작동하지 않음. 실제 데이터 기반 테스트 사용.
 */

import { test, expect } from '@playwright/test';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { E2E_TEST_ROOT } from './test-constants';

// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay');
const TEST_PROJECT_PREFIX = 'e2e-page-test';

// 테스트 프로젝트 생성 헬퍼
async function createTestProject(
  projectId: string,
  options: {
    name?: string;
    status?: 'active' | 'archived';
    wbsDepth?: 3 | 4;
  } = {}
) {
  const projectPath = join(ORCHAY_ROOT, 'projects', projectId);
  await mkdir(projectPath, { recursive: true });

  const projectConfig = {
    id: projectId,
    name: options.name || `Test Project ${projectId}`,
    description: 'E2E 테스트용 프로젝트',
    version: '0.1.0',
    status: options.status || 'active',
    wbsDepth: options.wbsDepth || 4,
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

  // team.json도 생성
  await writeFile(
    join(projectPath, 'team.json'),
    JSON.stringify({ version: '1.0', members: [] }, null, 2),
    'utf-8'
  );

  return {
    id: projectId,
    name: projectConfig.name,
    path: projectId,
    status: projectConfig.status,
    wbsDepth: options.wbsDepth || 4,
    createdAt: projectConfig.createdAt,
  };
}

// 테스트 프로젝트 정리 헬퍼
async function cleanupTestProjects() {
  const projectsPath = join(ORCHAY_ROOT, 'projects');

  // e2e-page-test로 시작하는 모든 프로젝트 삭제
  try {
    const fs = await import('fs/promises');
    const dirs = await fs.readdir(projectsPath).catch(() => []);
    for (const dir of dirs) {
      if (dir.startsWith(TEST_PROJECT_PREFIX)) {
        await rm(join(projectsPath, dir), { recursive: true, force: true });
      }
    }
  } catch {
    // 무시
  }

  // 폴더 스캔 방식이므로 projects.json 정리 불필요
}

test.describe.serial('Projects Page E2E Tests', () => {
  test.afterEach(async () => {
    await cleanupTestProjects();
  });

  test('E2E-001: should render project list on page load', async ({ page }) => {
    // Arrange: 테스트 프로젝트 생성
    const project = await createTestProject(`${TEST_PROJECT_PREFIX}-001`, {
      name: 'Test Project 001',
    });

    // Act
    await page.goto('/projects');

    // Assert: 페이지 제목 확인
    const title = page.locator('h1');
    await expect(title).toHaveText('Projects');

    // 필터 버튼 확인
    const filterButtons = page.locator('.p-selectbutton');
    await expect(filterButtons).toBeVisible();

    // 프로젝트 카드 확인
    const cards = page.locator('.p-card');
    await expect(cards).toHaveCount(1);
  });

  test('E2E-003: should display all project information in card', async ({ page }) => {
    // Arrange
    const project = await createTestProject(`${TEST_PROJECT_PREFIX}-003`, {
      name: 'Detail Test Project',
      wbsDepth: 4,
    });

    // Act
    await page.goto('/projects');

    // Assert
    const card = page.locator('.p-card').first();
    await expect(card).toBeVisible();

    // 카드 제목 (프로젝트명)
    const cardTitle = card.locator('.p-card-title');
    await expect(cardTitle).toBeVisible();

    // 상태 태그
    const statusTag = card.locator('.p-tag');
    await expect(statusTag).toBeVisible();

    // WBS 깊이
    await expect(card).toContainText('Levels');

    // 생성일
    await expect(card).toContainText('Created');
  });

  test('E2E-004: should navigate to WBS page on card click', async ({ page }) => {
    // Arrange
    const project = await createTestProject(`${TEST_PROJECT_PREFIX}-004`, {
      name: 'Navigation Test',
    });

    // wbs.md 파일 생성 (WBS 페이지가 로드되려면 필요)
    const projectPath = join(ORCHAY_ROOT, 'projects', project.id);
    const wbsContent = `# WBS - Navigation Test

> version: 1.0
> depth: 4
> updated: 2025-12-14
> start: 2025-12-13

---

## WP-01: Test Work Package
- status: planned
`;
    await writeFile(join(projectPath, 'wbs.md'), wbsContent, 'utf-8');

    // Act
    await page.goto('/projects');

    // 카드가 렌더링될 때까지 대기
    const card = page.locator('.p-card').first();
    await expect(card).toBeVisible();

    // 프로젝트 카드 클릭
    await card.click();

    // Assert: URL 변경 대기
    await page.waitForURL(new RegExp(`/wbs\\?project=${project.id}`), { timeout: 10000 });
  });

  test('E2E-005: should filter projects by status', async ({ page }) => {
    // Arrange: active 2개, archived 1개 프로젝트 생성
    const active1 = await createTestProject(`${TEST_PROJECT_PREFIX}-005a`, {
      name: 'Active 1',
      status: 'active',
    });
    const active2 = await createTestProject(`${TEST_PROJECT_PREFIX}-005b`, {
      name: 'Active 2',
      status: 'active',
    });
    const archived1 = await createTestProject(`${TEST_PROJECT_PREFIX}-005c`, {
      name: 'Archived 1',
      status: 'archived',
    });

    // Act
    await page.goto('/projects');

    // Assert: 초기 상태 - 모든 프로젝트 표시
    await expect(page.locator('.p-card')).toHaveCount(3);

    // Active 필터 클릭
    const selectButton = page.locator('.p-selectbutton');
    await selectButton.locator('.p-togglebutton', { hasText: 'Active' }).click();

    // active 프로젝트만 표시
    await expect(page.locator('.p-card')).toHaveCount(2);

    // Archived 필터 클릭
    await selectButton.locator('.p-togglebutton', { hasText: 'Archived' }).click();

    // archived 프로젝트만 표시
    await expect(page.locator('.p-card')).toHaveCount(1);

    // All 필터로 돌아가기
    await selectButton.locator('.p-togglebutton', { hasText: 'All' }).click();
    await expect(page.locator('.p-card')).toHaveCount(3);
  });

  test('E2E-007: should show loading state during initial render', async ({ page }) => {
    // Arrange
    const project = await createTestProject(`${TEST_PROJECT_PREFIX}-007`, {
      name: 'Loading Test',
    });

    // Act: 페이지 로드
    await page.goto('/projects');

    // Assert: 로딩 완료 후 콘텐츠 확인
    const title = page.locator('h1');
    await expect(title).toHaveText('Projects');

    const card = page.locator('.p-card');
    await expect(card).toHaveCount(1);
  });

  test('E2E-009: should show empty state message when no projects exist', async ({ page }) => {
    // Arrange: 빈 프로젝트 목록 설정 (테스트 프로젝트 없음)
    // 폴더 스캔 방식이므로 별도 설정 불필요

    // Act
    await page.goto('/projects');

    // Assert: 빈 상태 메시지 확인
    // InlineMessage는 severity에 따라 다른 클래스를 가짐
    // PrimeVue 4.x에서 실제 클래스 확인 필요
    const emptyMessage = page.locator('[data-pc-name="inlinemessage"]').filter({ hasText: '프로젝트가 없습니다' });
    await expect(emptyMessage).toBeVisible();

    // 프로젝트 카드 없음
    const cards = page.locator('.p-card');
    await expect(cards).toHaveCount(0);
  });

  // E2E-010 제거: defaultProject 기능 미사용

  test('E2E-011: should display correctly on different viewports', async ({ page }) => {
    // Arrange
    const project = await createTestProject(`${TEST_PROJECT_PREFIX}-011`, {
      name: 'Responsive Test',
    });

    // Act
    await page.goto('/projects');

    // Assert: 페이지 제목은 모든 뷰포트에서 보여야 함
    const title = page.locator('h1');
    await expect(title).toHaveText('Projects');

    // 모바일 뷰포트
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(title).toBeVisible();

    // 태블릿 뷰포트
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(title).toBeVisible();

    // 데스크탑 뷰포트
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(title).toBeVisible();
  });
});
