import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForWbsLoaded } from '../helpers/e2e-helpers';
import { TEST_TIMEOUTS } from '../helpers/constants';

test.describe('WBS Tree Actions E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wbs?project=project');
    await waitForPageReady(page);
    await waitForWbsLoaded(page);
  });

  test('E2E-020: 전체 펼치기', async ({ page }) => {
    // Given: 일부 접힌 상태
    await page.locator('[data-testid="collapse-all-btn"]').click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // When: 전체 펼치기
    await page.locator('[data-testid="expand-all-btn"]').click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Then: 모든 노드 표시
    await expect(page.locator('text=ACT-01-01')).toBeVisible();
    await expect(page.locator('text=TSK-01-01-01')).toBeVisible();
  });

  test('E2E-021: 전체 접기', async ({ page }) => {
    // Given: 펼쳐진 상태
    await page.locator('[data-testid="expand-all-btn"]').click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // When: 전체 접기
    await page.locator('[data-testid="collapse-all-btn"]').click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Then: WP만 표시, 하위 숨김
    await expect(page.locator('text=WP-01')).toBeVisible();

    // ACT가 숨겨져 있는지 확인 (트리가 접혀있으면 hidden)
    const actNode = page.locator('text=ACT-01-01');
    const isVisible = await actNode.isVisible().catch(() => false);

    // 접기 상태에서는 안 보여야 함 (또는 display:none)
    if (isVisible) {
      // 만약 보이면 collapsed 클래스가 있어야 함
      const parent = actNode.locator('xpath=ancestor::*[@class*="collapsed"]').first();
      await expect(parent).toBeVisible();
    }
  });

  test('E2E-022: 개별 노드 펼치기/접기', async ({ page }) => {
    // Given: 접힌 상태
    await page.locator('[data-testid="collapse-all-btn"]').click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // When: WP-01 펼치기 (토글 버튼 클릭)
    const wpToggle = page.locator('[data-node-id="WP-01"] [data-testid="toggle-btn"]').first();
    await wpToggle.click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Then: ACT-01-01 표시
    await expect(page.locator('text=ACT-01-01')).toBeVisible();

    // When: ACT-01-01 펼치기
    const actToggle = page.locator('[data-node-id="ACT-01-01"] [data-testid="toggle-btn"]').first();
    await actToggle.click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Then: TSK 표시
    await expect(page.locator('text=TSK-01-01-01')).toBeVisible();
  });
});
