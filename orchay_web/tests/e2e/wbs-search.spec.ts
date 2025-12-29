import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForWbsLoaded } from '../helpers/e2e-helpers';
import { TEST_TIMEOUTS } from '../helpers/constants';

test.describe('WBS Search E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wbs?project=project');
    await waitForPageReady(page);
    await waitForWbsLoaded(page);
  });

  test('E2E-010: 검색어 입력 → 필터링 결과', async ({ page }) => {
    // Given: 검색 박스
    const searchInput = page.locator('[data-testid="search-input"]');

    // When: 검색어 입력
    await searchInput.fill('TSK-01');

    // Wait: debounce (350ms + safety margin)
    await page.waitForTimeout(TEST_TIMEOUTS.DEBOUNCE_WAIT + TEST_TIMEOUTS.DEBOUNCE_SAFETY_MARGIN);

    // Then: 필터링된 결과 (TSK-01-01-01이 보여야 함)
    const taskNode = page.locator('text=TSK-01-01-01');
    await expect(taskNode).toBeVisible();
  });

  test('E2E-011: X 버튼 → 초기화', async ({ page }) => {
    // Given: 검색어 입력
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('Search');
    await page.waitForTimeout(TEST_TIMEOUTS.DEBOUNCE_WAIT + TEST_TIMEOUTS.DEBOUNCE_SAFETY_MARGIN);

    // When: X 버튼 클릭
    const clearBtn = page.locator('[data-testid="search-clear"]');
    await clearBtn.click();

    // Then: 검색어 초기화, 전체 트리 표시
    await expect(searchInput).toHaveValue('');
    const wp01 = page.locator('text=WP-01');
    await expect(wp01).toBeVisible();
  });

  test('E2E-012: 대소문자 무시 검색', async ({ page }) => {
    // Given: 검색 박스
    const searchInput = page.locator('[data-testid="search-input"]');

    // When: 소문자 검색어
    await searchInput.fill('test task');
    await page.waitForTimeout(TEST_TIMEOUTS.DEBOUNCE_WAIT + TEST_TIMEOUTS.DEBOUNCE_SAFETY_MARGIN);

    // Then: 'Test Task' 매칭 (대소문자 무시)
    const taskNode = page.locator('text=Test Task');
    await expect(taskNode).toBeVisible();
  });
});
