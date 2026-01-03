import { test, expect } from '@playwright/test';

test.describe('반응형 레이아웃', () => {
  // Chromium만 사용 (다른 브라우저 스킵)
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only');

  // 타임아웃 설정
  test.setTimeout(60000);

  test.describe('모바일 (768px 미만)', () => {
    test.beforeEach(async ({ page }) => {
      // 모바일 뷰포트 설정 (375px - iPhone SE)
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/', { waitUntil: 'networkidle' });
      // 페이지 로드 완료 대기
      await page.waitForSelector('[data-testid="main-layout"]', { timeout: 30000 });
    });

    test('E2E-01: 모바일에서 햄버거 메뉴가 표시됨', async ({ page }) => {
      // 모바일에서 사이드바는 숨겨지고 햄버거 메뉴가 표시됨
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await expect(mobileMenuBtn).toBeVisible();

      // 사이드바는 초기에 숨겨져 있음
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).not.toBeVisible();
    });

    test('E2E-02: 햄버거 메뉴 클릭 시 사이드바가 오버레이로 열림', async ({ page }) => {
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await mobileMenuBtn.click();
      await page.waitForTimeout(300); // 트랜지션 대기

      // 사이드바가 표시됨
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).toBeVisible();

      // 배경 오버레이가 DOM에 존재함 (CSS 애니메이션 무관하게)
      const backdrop = page.getByTestId('sidebar-backdrop');
      await expect(backdrop).toBeAttached();

      // 닫기 버튼이 표시됨
      const closeBtn = page.getByTestId('mobile-close-btn');
      await expect(closeBtn).toBeVisible();
    });

    test('E2E-03: 배경 오버레이 클릭 시 사이드바가 닫힘', async ({ page }) => {
      // 사이드바 열기
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await mobileMenuBtn.click();
      await page.waitForTimeout(300); // 트랜지션 대기

      // 배경 오버레이 클릭 (force 옵션으로 숨김 요소 클릭 허용)
      const backdrop = page.getByTestId('sidebar-backdrop');
      await backdrop.click({ force: true });
      await page.waitForTimeout(300); // 닫힘 트랜지션 대기

      // 사이드바가 닫힘
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).not.toBeVisible();

      // 햄버거 메뉴가 다시 표시됨
      await expect(mobileMenuBtn).toBeVisible();
    });

    test('E2E-04: X 버튼 클릭 시 사이드바가 닫힘', async ({ page }) => {
      // 사이드바 열기
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await mobileMenuBtn.click();
      await page.waitForTimeout(300); // 트랜지션 대기

      // X 버튼 클릭
      const closeBtn = page.getByTestId('mobile-close-btn');
      await closeBtn.click();
      await page.waitForTimeout(300); // 닫힘 트랜지션 대기

      // 사이드바가 닫힘
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).not.toBeVisible();
    });

    test('E2E-05: Esc 키로 사이드바가 닫힘', async ({ page }) => {
      // 사이드바 열기
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await mobileMenuBtn.click();
      await page.waitForTimeout(300); // 트랜지션 대기

      // Esc 키 누르기
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300); // 닫힘 트랜지션 대기

      // 사이드바가 닫힘
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).not.toBeVisible();
    });
  });

  test.describe('데스크톱 (768px 이상)', () => {
    test.beforeEach(async ({ page }) => {
      // 데스크톱 뷰포트 설정
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="main-layout"]', { timeout: 30000 });
    });

    test('E2E-06: 데스크톱에서 사이드바가 고정으로 표시됨', async ({ page }) => {
      // 사이드바가 표시됨
      const sidebar = page.getByTestId('sidebar');
      await expect(sidebar).toBeVisible();

      // 배경 오버레이가 DOM에 없음 (데스크톱에서는 렌더링되지 않음)
      const backdrop = page.getByTestId('sidebar-backdrop');
      await expect(backdrop).not.toBeAttached();

      // 모바일 햄버거 메뉴가 표시되지 않음
      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await expect(mobileMenuBtn).not.toBeVisible();
    });

    test('E2E-07: 사이드바가 에디터와 함께 표시됨', async ({ page }) => {
      const sidebar = page.getByTestId('sidebar');
      const editorArea = page.getByTestId('editor-area');

      await expect(sidebar).toBeVisible();
      await expect(editorArea).toBeVisible();

      // 사이드바 너비 확인 (240px)
      const sidebarBox = await sidebar.boundingBox();
      expect(sidebarBox?.width).toBeCloseTo(240, 0);
    });
  });

  test.describe('뷰포트 전환', () => {
    test('E2E-08: 데스크톱에서 모바일로 전환 시 레이아웃 변경', async ({ page }) => {
      // 데스크톱으로 시작
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/', { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-testid="main-layout"]', { timeout: 30000 });

      // 데스크톱에서 사이드바 표시 확인
      let sidebar = page.getByTestId('sidebar');
      await expect(sidebar).toBeVisible();

      // 모바일로 전환
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300); // 트랜지션 대기

      // 모바일에서 사이드바 숨김, 햄버거 메뉴 표시 확인
      sidebar = page.getByTestId('sidebar');
      await expect(sidebar).not.toBeVisible();

      const mobileMenuBtn = page.getByTestId('mobile-menu-btn');
      await expect(mobileMenuBtn).toBeVisible();
    });
  });
});
