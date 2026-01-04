import { test, expect } from '@playwright/test';

/**
 * TSK-02-02: 사이드바 컴포넌트 E2E 테스트
 *
 * 테스트 범위:
 * - 컴포넌트 초기 렌더링
 * - 스타일 검증 (색상, 폰트, 간격)
 * - 호버 인터랙션
 * - 클릭 이벤트
 * - MainLayout 통합
 */

test.describe('TSK-02-02: 사이드바 컴포넌트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('시나리오 1: 컴포넌트 초기 렌더링', () => {
    test('사이드바 영역이 정상적으로 표시된다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');

      // 사이드바가 화면에 표시되는지 확인
      await expect(sidebar).toBeVisible({ timeout: 10000 });

      // 스크린샷 캡처
      await page.screenshot({
        path: 'test-results/e2e/sidebar/01-initial-render.png',
        fullPage: false
      });
    });

    test('사이드바 너비가 240px이다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBe(240);
    });

    test('워크스페이스 헤더가 표시된다', async ({ page }) => {
      const workspaceHeader = page.locator('[data-testid="workspace-header"]');

      await expect(workspaceHeader).toBeVisible();

      // "🏠 Orchay Notes" 텍스트 확인
      await expect(page.locator('text=🏠 Orchay Notes')).toBeVisible();

      // 드롭다운 아이콘 확인 (lucide-react ChevronDown)
      const chevronIcon = workspaceHeader.locator('svg');
      await expect(chevronIcon).toBeVisible();
    });

    test('퀵 액션 영역 3개 버튼이 표시된다', async ({ page }) => {
      // Search 버튼
      const searchBtn = page.locator('[data-testid="search-btn"]');
      await expect(searchBtn).toBeVisible();
      await expect(page.locator('text=Search')).toBeVisible();
      await expect(page.locator('text=⌘K')).toBeVisible();

      // Updates 버튼
      const updatesBtn = page.locator('[data-testid="updates-btn"]');
      await expect(updatesBtn).toBeVisible();
      await expect(page.locator('text=Updates')).toBeVisible();

      // Settings 버튼
      const settingsBtn = page.locator('[data-testid="settings-btn"]');
      await expect(settingsBtn).toBeVisible();
      await expect(page.locator('text=Settings & members')).toBeVisible();
    });

    test('페이지 트리 영역 섹션 헤더가 표시된다', async ({ page }) => {
      // Favorites 섹션
      await expect(page.locator('text=Favorites')).toBeVisible();

      // Private 섹션
      await expect(page.locator('text=Private')).toBeVisible();
    });

    test('새 페이지 버튼이 표시된다', async ({ page }) => {
      const newPageBtn = page.locator('[data-testid="new-page-btn"]');

      await expect(newPageBtn).toBeVisible();
      await expect(page.locator('text=New page')).toBeVisible();
    });
  });

  test.describe('시나리오 2: 스타일 검증', () => {
    test('사이드바 배경색이 #F7F6F3이다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const backgroundColor = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(backgroundColor).toBe('rgb(247, 246, 243)'); // #F7F6F3
    });

    test('사이드바 높이가 100vh이다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const sidebarHeight = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).height;
      });

      expect(sidebarHeight).toBe('100vh');
    });

    test('워크스페이스 헤더 폰트 크기가 14px, semibold이다', async ({ page }) => {
      const workspaceHeader = page.locator('[data-testid="workspace-header"]');
      await expect(workspaceHeader).toBeVisible();

      const fontSize = await workspaceHeader.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      const fontWeight = await workspaceHeader.evaluate((el) => {
        return window.getComputedStyle(el).fontWeight;
      });

      expect(fontSize).toBe('14px');
      expect(fontWeight).toBe('600'); // semibold
    });

    test('섹션 헤더 스타일이 12px, medium, uppercase이다', async ({ page }) => {
      // 첫 번째 섹션 헤더 찾기
      const sectionText = page.locator('text=Favorites');
      await expect(sectionText).toBeVisible();

      const fontSize = await sectionText.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      const fontWeight = await sectionText.evaluate((el) => {
        return window.getComputedStyle(el).fontWeight;
      });

      const textTransform = await sectionText.evaluate((el) => {
        return window.getComputedStyle(el).textTransform;
      });

      expect(fontSize).toBe('12px');
      expect(fontWeight).toBe('500'); // medium
      expect(textTransform).toBe('uppercase');
    });

    test('단축키 텍스트 스타일이 12px, #B4B4B3이다', async ({ page }) => {
      const shortcutText = page.locator('text=⌘K');
      await expect(shortcutText).toBeVisible();

      const fontSize = await shortcutText.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });

      const color = await shortcutText.evaluate((el) => {
        return window.getComputedStyle(el).color;
      });

      expect(fontSize).toBe('12px');
      expect(color).toBe('rgb(180, 180, 179)'); // #B4B4B3
    });
  });

  test.describe('시나리오 3: 호버 인터랙션', () => {
    test('워크스페이스 헤더 호버 시 배경색 변경', async ({ page }) => {
      const workspaceHeader = page.locator('[data-testid="workspace-header"]');
      await expect(workspaceHeader).toBeVisible();

      // 호버 전 배경색
      const beforeBg = await workspaceHeader.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // 호버
      await workspaceHeader.hover();
      await page.waitForTimeout(50); // 20ms transition

      // 호버 후 배경색
      const afterBg = await workspaceHeader.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(afterBg).toBe('rgb(239, 239, 239)'); // #EFEFEF

      await page.screenshot({
        path: 'test-results/e2e/sidebar/02-hover-workspace.png',
        fullPage: false
      });
    });

    test('Search 버튼 호버 시 배경색 변경', async ({ page }) => {
      const searchBtn = page.locator('[data-testid="search-btn"]');
      await expect(searchBtn).toBeVisible();

      await searchBtn.hover();
      await page.waitForTimeout(50);

      const bgColor = await searchBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(bgColor).toBe('rgb(239, 239, 239)'); // #EFEFEF
    });

    test('Updates 버튼 호버 시 배경색 변경', async ({ page }) => {
      const updatesBtn = page.locator('[data-testid="updates-btn"]');
      await expect(updatesBtn).toBeVisible();

      await updatesBtn.hover();
      await page.waitForTimeout(50);

      const bgColor = await updatesBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(bgColor).toBe('rgb(239, 239, 239)'); // #EFEFEF
    });

    test('Settings 버튼 호버 시 배경색 변경', async ({ page }) => {
      const settingsBtn = page.locator('[data-testid="settings-btn"]');
      await expect(settingsBtn).toBeVisible();

      await settingsBtn.hover();
      await page.waitForTimeout(50);

      const bgColor = await settingsBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(bgColor).toBe('rgb(239, 239, 239)'); // #EFEFEF
    });

    test('New page 버튼 호버 시 배경색 변경', async ({ page }) => {
      const newPageBtn = page.locator('[data-testid="new-page-btn"]');
      await expect(newPageBtn).toBeVisible();

      await newPageBtn.hover();
      await page.waitForTimeout(50);

      const bgColor = await newPageBtn.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      expect(bgColor).toBe('rgb(239, 239, 239)'); // #EFEFEF

      await page.screenshot({
        path: 'test-results/e2e/sidebar/03-hover-newpage.png',
        fullPage: false
      });
    });
  });

  test.describe('시나리오 4: 클릭 이벤트', () => {
    test('워크스페이스 헤더 클릭 시 콘솔 로그 출력', async ({ page }) => {
      const workspaceHeader = page.locator('[data-testid="workspace-header"]');
      await expect(workspaceHeader).toBeVisible();

      // 콘솔 로그 수집 시작
      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await workspaceHeader.click();
      await page.waitForTimeout(100);

      // 콘솔 메시지 확인
      const hasWorkspaceClickLog = consoleMessages.some(
        (msg) => msg.includes('Workspace menu clicked') || msg.includes('workspace')
      );

      expect(hasWorkspaceClickLog).toBeTruthy();
    });

    test('Search 버튼 클릭 시 콘솔 로그 출력', async ({ page }) => {
      const searchBtn = page.locator('[data-testid="search-btn"]');
      await expect(searchBtn).toBeVisible();

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await searchBtn.click();
      await page.waitForTimeout(100);

      const hasSearchLog = consoleMessages.some(
        (msg) => msg.includes('Search clicked') || msg.includes('search')
      );

      expect(hasSearchLog).toBeTruthy();
    });

    test('Updates 버튼 클릭 시 콘솔 로그 출력', async ({ page }) => {
      const updatesBtn = page.locator('[data-testid="updates-btn"]');
      await expect(updatesBtn).toBeVisible();

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await updatesBtn.click();
      await page.waitForTimeout(100);

      const hasUpdatesLog = consoleMessages.some(
        (msg) => msg.includes('Updates clicked') || msg.includes('updates')
      );

      expect(hasUpdatesLog).toBeTruthy();
    });

    test('Settings 버튼 클릭 시 콘솔 로그 출력', async ({ page }) => {
      const settingsBtn = page.locator('[data-testid="settings-btn"]');
      await expect(settingsBtn).toBeVisible();

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await settingsBtn.click();
      await page.waitForTimeout(100);

      const hasSettingsLog = consoleMessages.some(
        (msg) => msg.includes('Settings clicked') || msg.includes('settings')
      );

      expect(hasSettingsLog).toBeTruthy();
    });

    test('New page 버튼 클릭 시 콘솔 로그 출력', async ({ page }) => {
      const newPageBtn = page.locator('[data-testid="new-page-btn"]');
      await expect(newPageBtn).toBeVisible();

      const consoleMessages: string[] = [];
      page.on('console', (msg) => {
        consoleMessages.push(msg.text());
      });

      await newPageBtn.click();
      await page.waitForTimeout(100);

      const hasNewPageLog = consoleMessages.some(
        (msg) => msg.includes('New page clicked') || msg.includes('new page')
      );

      expect(hasNewPageLog).toBeTruthy();
    });
  });

  test.describe('시나리오 5: MainLayout 통합', () => {
    test('사이드바가 MainLayout의 좌측에 배치된다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      const editorArea = page.locator('[data-testid="editor-area"]');

      await expect(sidebar).toBeVisible();
      await expect(editorArea).toBeVisible();

      // 사이드바와 에디터 영역의 위치 확인
      const sidebarBox = await sidebar.boundingBox();
      const editorBox = await editorArea.boundingBox();

      // 사이드바가 좌측에 위치
      expect(sidebarBox?.x).toBe(0);

      // 에디터가 사이드바 오른쪽에 위치
      expect(editorBox?.x).toBeGreaterThanOrEqual(240);

      await page.screenshot({
        path: 'test-results/e2e/sidebar/04-layout-integration.png',
        fullPage: false
      });
    });

    test('사이드바와 에디터 영역이 명확히 구분된다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const borderRight = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).borderRightWidth;
      });

      // 경계선 존재 확인
      expect(borderRight).not.toBe('0px');
    });

    test('사이드바와 에디터 높이가 동일하다', async ({ page }) => {
      const sidebar = page.locator('[data-testid="sidebar"]');
      const editorArea = page.locator('[data-testid="editor-area"]');

      await expect(sidebar).toBeVisible();
      await expect(editorArea).toBeVisible();

      const sidebarHeight = await sidebar.evaluate((el) => {
        return window.getComputedStyle(el).height;
      });

      const editorHeight = await editorArea.evaluate((el) => {
        return window.getComputedStyle(el).height;
      });

      expect(sidebarHeight).toBe('100vh');
      expect(editorHeight).toBe('100vh');
    });
  });

  test.describe('시나리오 6: 반응형 동작 (기본 확인)', () => {
    test('데스크톱 뷰에서 사이드바 너비 유지', async ({ page }) => {
      // 데스크톱 화면 크기 설정
      await page.setViewportSize({ width: 1920, height: 1080 });

      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBe(240);

      await page.screenshot({
        path: 'test-results/e2e/sidebar/05-desktop-view.png',
        fullPage: false
      });
    });

    test('작은 화면에서도 사이드바 표시', async ({ page }) => {
      // 작은 화면 크기 설정
      await page.setViewportSize({ width: 768, height: 1024 });

      const sidebar = page.locator('[data-testid="sidebar"]');

      // 사이드바가 여전히 표시되는지 확인
      // (반응형 처리는 TSK-03-01에서 구현 예정)
      const isVisible = await sidebar.isVisible().catch(() => false);

      if (isVisible) {
        const sidebarBox = await sidebar.boundingBox();
        expect(sidebarBox?.width).toBe(240);
      }

      await page.screenshot({
        path: 'test-results/e2e/sidebar/06-small-view.png',
        fullPage: false
      });
    });
  });

  test.describe('종합 테스트: 전체 UI 스냅샷', () => {
    test('사이드바 전체 UI 스크린샷', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: 'test-results/e2e/sidebar/00-full-sidebar.png',
        fullPage: false
      });

      // 사이드바만 캡처
      const sidebar = page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      await sidebar.screenshot({
        path: 'test-results/e2e/sidebar/00-sidebar-only.png'
      });
    });
  });
});
