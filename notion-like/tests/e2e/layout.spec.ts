import { test, expect } from '@playwright/test';

test.describe('MainLayout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('메인 레이아웃이 2컬럼으로 표시된다', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]');
    const editorArea = page.locator('[data-testid="editor-area"]');

    await expect(sidebar).toBeVisible();
    await expect(editorArea).toBeVisible();

    // 사이드바 너비 확인
    const sidebarBox = await sidebar.boundingBox();
    expect(sidebarBox?.width).toBe(240);

    await page.screenshot({ path: 'e2e-001-layout.png' });
  });

  test('사이드바를 토글할 수 있다', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]');
    const toggleBtn = page.locator('[data-testid="sidebar-toggle"]');
    const openBtn = page.locator('[data-testid="sidebar-open-btn"]');

    // 초기 상태: 사이드바 표시
    await expect(sidebar).toBeVisible();

    // 사이드바 내 토글 버튼 클릭하여 접기
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // 사이드바 숨김 확인
    await expect(sidebar).not.toBeVisible();
    await expect(openBtn).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-002-toggle-closed.png' });

    // 다시 열기 버튼 클릭
    await openBtn.click();
    await page.waitForTimeout(300);

    // 사이드바 표시 확인
    await expect(sidebar).toBeVisible();
    await page.screenshot({ path: 'test-results/e2e-002-toggle-open.png' });
  });
});
