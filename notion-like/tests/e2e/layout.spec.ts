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
    const openBtn = page.locator('[data-testid="sidebar-open-btn"]');

    // 초기 상태: 사이드바 표시
    await expect(sidebar).toBeVisible();

    // 사이드바를 접기 위해 상태 변경 (E2E에서는 UI를 통해 토글)
    // 주의: 현재 설계에서는 사이드바 내 토글 버튼이 아직 구현되지 않았으므로
    // 우선 상태 변경으로 테스트 진행
    await page.evaluate(() => {
      // Zustand store 직접 접근 (테스트 목적)
      const store = (window as any).__appStore;
      if (store) {
        store.toggleSidebar();
      }
    });

    await page.waitForTimeout(300);

    // 사이드바 숨김 확인
    await expect(sidebar).not.toBeVisible();
    await expect(openBtn).toBeVisible();
    await page.screenshot({ path: 'e2e-002-toggle-closed.png' });

    // 다시 열기 버튼 클릭
    await openBtn.click();
    await page.waitForTimeout(300);

    // 사이드바 표시 확인
    await expect(sidebar).toBeVisible();
    await page.screenshot({ path: 'e2e-002-toggle-open.png' });
  });
});
