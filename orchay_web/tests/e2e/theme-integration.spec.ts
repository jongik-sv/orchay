import { test, expect } from '@playwright/test';
import { waitForPageReady, waitForWbsLoaded } from '../helpers/e2e-helpers';
import { calculateContrast, verifyColorContrast } from '../helpers/accessibility-helpers';
import { TEST_TIMEOUTS } from '../helpers/constants';
import { TEST_PROJECT_ID } from './test-constants';

test.describe('Theme Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`);
    await waitForPageReady(page);
    await waitForWbsLoaded(page);
  });

  test('TC-01: Tree 컴포넌트가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    const tree = page.locator('.p-tree').first();
    await expect(tree).toBeVisible();

    // Tree 배경색 검증
    await expect(tree).toHaveCSS('background-color', 'rgb(15, 15, 35)');

    // 노드 호버 배경색 검증 (첫 번째 노드에 호버)
    const firstNode = page.locator('.p-treenode-content').first();
    await firstNode.hover();
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

    // 호버 시 배경색 (노드 요소에서 직접 확인)
    const hoverBg = await firstNode.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(hoverBg).toBe('rgb(22, 33, 62)');

    // 노드 선택 배경색 검증
    await firstNode.click();
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

    const selectedNode = page.locator('.p-treenode-content.p-highlight').first();
    const selectedBg = await selectedNode.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    // rgba(59, 130, 246, 0.2) 검증
    expect(selectedBg).toMatch(/rgba?\(59,\s*130,\s*246/);

    // 노드 텍스트 색상 검증
    const nodeLabel = page.locator('.p-treenode-label').first();
    await expect(nodeLabel).toHaveCSS('color', 'rgb(232, 232, 232)');

    // 토글 아이콘 색상 검증
    const toggleIcon = page.locator('.p-tree-toggler-icon').first();
    await expect(toggleIcon).toHaveCSS('color', 'rgb(136, 136, 136)');
  });

  test('TC-02: Splitter Gutter가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    const gutter = page.locator('.p-splitter-gutter').first();
    await expect(gutter).toBeVisible();

    // Gutter 기본 배경색 검증
    await expect(gutter).toHaveCSS('background-color', 'rgb(61, 61, 92)');

    // Gutter 너비 검증
    const gutterWidth = await gutter.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.width;
    });
    expect(gutterWidth).toBe('4px');

    // Cursor 스타일 검증
    await expect(gutter).toHaveCSS('cursor', 'col-resize');

    // Gutter 호버 배경색 검증
    await gutter.hover();
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);
    const hoverBg = await gutter.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(hoverBg).toBe('rgb(77, 77, 108)');
  });

  test('TC-03: Menubar가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    const menubar = page.locator('.p-menubar');
    await expect(menubar).toBeVisible();

    // Menubar 배경색 검증
    await expect(menubar).toHaveCSS('background-color', 'rgb(22, 33, 62)');

    // 활성 메뉴 항목 스타일 검증 (WBS 메뉴가 활성화된 상태)
    const activeMenu = page.locator('.p-menuitem-link.router-link-active').first();

    if (await activeMenu.count() > 0) {
      // 활성 메뉴 텍스트 색상
      await expect(activeMenu).toHaveCSS('color', 'rgb(59, 130, 246)');

      // 활성 메뉴 배경색
      const activeBg = await activeMenu.evaluate(el =>
        window.getComputedStyle(el).backgroundColor
      );
      expect(activeBg).toMatch(/rgba?\(59,\s*130,\s*246/);
    }

    // 비활성 메뉴 검증 (disabled 상태)
    const disabledMenu = page.locator('.p-menuitem.p-disabled .p-menuitem-link').first();

    if (await disabledMenu.count() > 0) {
      await expect(disabledMenu).toHaveCSS('color', 'rgb(102, 102, 102)');

      const opacity = await disabledMenu.evaluate(el =>
        window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBe(0.5);
    }
  });

  test('TC-04: Dialog가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    // Task 클릭하여 Dialog 열기
    const firstTask = page.locator('[data-testid^="wbs-tree-node-TSK-"]').first();
    await firstTask.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Dialog 배경색 검증
    await expect(dialog).toHaveCSS('background-color', 'rgb(30, 30, 56)');

    // Dialog 헤더 배경색 검증
    const dialogHeader = page.locator('.p-dialog-header');
    await expect(dialogHeader).toHaveCSS('background-color', 'rgb(22, 33, 62)');

    // Dialog 헤더 텍스트 색상 검증
    const headerTitle = page.locator('.p-dialog-title');
    await expect(headerTitle).toHaveCSS('color', 'rgb(232, 232, 232)');

    // Dialog 경계선 색상 검증
    const borderColor = await dialog.evaluate(el =>
      window.getComputedStyle(el).borderColor
    );
    expect(borderColor).toBe('rgb(61, 61, 92)');
  });

  test('TC-05: 기존 컴포넌트가 정상 표시된다 (회귀 검증)', async ({ page }) => {
    // Tree 컴포넌트 표시 확인
    const tree = page.locator('.p-tree').first();
    await expect(tree).toBeVisible();

    // Splitter 컴포넌트 표시 확인
    const splitter = page.locator('.p-splitter').first();
    await expect(splitter).toBeVisible();

    // Menubar 컴포넌트 표시 확인
    const menubar = page.locator('.p-menubar');
    await expect(menubar).toBeVisible();

    // 전체 레이아웃 구조 확인
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();

    // 헤더 표시 확인
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // WBS 트리 콘텐츠 표시 확인
    const wbsContent = page.locator('[data-testid="wbs-tree-content"]');
    await expect(wbsContent).toBeVisible();
  });

  test('TC-06: 색상 대비가 WCAG 2.1 AA 기준을 만족한다', async ({ page }) => {
    // Tree 노드 텍스트와 배경 대비 검증
    const treeNode = page.locator('.p-treenode-label').first();
    const treeBackground = page.locator('.p-tree').first();

    const treeTextColor = await treeNode.evaluate(el =>
      window.getComputedStyle(el).color
    );
    const treeBgColor = await treeBackground.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    const treeContrast = calculateContrast(treeTextColor, treeBgColor);
    expect(treeContrast).toBeGreaterThanOrEqual(4.5);

    // Menubar 텍스트와 배경 대비 검증
    const menuItem = page.locator('.p-menuitem-link').first();
    const menubar = page.locator('.p-menubar');

    const menuTextColor = await menuItem.evaluate(el =>
      window.getComputedStyle(el).color
    );
    const menuBgColor = await menubar.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );

    const menuContrast = calculateContrast(menuTextColor, menuBgColor);
    expect(menuContrast).toBeGreaterThanOrEqual(4.5);

    // 활성 메뉴 아이템 대비 검증 (있을 경우)
    const activeMenu = page.locator('.p-menuitem-link.router-link-active').first();
    if (await activeMenu.count() > 0) {
      const activeTextColor = await activeMenu.evaluate(el =>
        window.getComputedStyle(el).color
      );
      const activeContrast = calculateContrast(activeTextColor, menuBgColor);
      expect(activeContrast).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('TC-07: 키보드로 전체 UI에 접근할 수 있다', async ({ page }) => {
    // Tab 키로 첫 번째 포커스 가능한 요소로 이동
    await page.keyboard.press('Tab');
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

    // 포커스된 요소가 존재하는지 확인
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    expect(focusedElement).toBeTruthy();

    // 여러 번 Tab을 눌러 네비게이션 가능 확인
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(50);

      const currentFocus = await page.evaluate(() => {
        return document.activeElement?.tagName;
      });
      expect(currentFocus).toBeTruthy();
    }

    // Shift+Tab으로 역방향 네비게이션 확인
    await page.keyboard.press('Shift+Tab');
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

    const reverseFocus = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });
    expect(reverseFocus).toBeTruthy();

    // Enter 키로 Tree 노드 선택 가능 확인
    const firstTreeNode = page.locator('.p-treenode-content').first();
    await firstTreeNode.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

    // 노드가 선택되었는지 확인
    const isSelected = await firstTreeNode.evaluate(el =>
      el.classList.contains('p-highlight')
    );
    expect(isSelected).toBe(true);
  });

  test('TC-08: ARIA 속성이 적절하게 설정되어 있다', async ({ page }) => {
    // Dialog role 확인
    const firstTask = page.locator('[data-testid^="wbs-tree-node-TSK-"]').first();
    await firstTask.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    const dialogRole = await dialog.getAttribute('role');
    expect(dialogRole).toBe('dialog');

    // Dialog가 aria-modal 속성을 가지는지 확인
    const ariaModal = await dialog.getAttribute('aria-modal');
    expect(ariaModal).toBe('true');

    // Dialog 닫기
    const closeButton = page.locator('.p-dialog-header-close');
    await closeButton.click();
    await page.waitForTimeout(TEST_TIMEOUTS.ANIMATION);

    // Tree role 확인
    const tree = page.locator('.p-tree').first();
    const treeRole = await tree.getAttribute('role');
    expect(treeRole).toBe('tree');

    // Treeitem role 확인
    const treeItems = await page.locator('[role="treeitem"]').count();
    expect(treeItems).toBeGreaterThan(0);

    // Menubar role 확인
    const menubar = page.locator('.p-menubar');
    const menubarRole = await menubar.evaluate(el => {
      // Menubar는 내부에 role="menubar"를 가진 요소가 있을 수 있음
      const menubarElement = el.querySelector('[role="menubar"]');
      return menubarElement?.getAttribute('role') || null;
    });
    expect(menubarRole).toBe('menubar');

    // Button ARIA labels 확인 (최소 1개 이상)
    const buttonsWithLabel = await page.locator('button[aria-label]').count();
    expect(buttonsWithLabel).toBeGreaterThan(0);
  });
});
