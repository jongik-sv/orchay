import { test, expect } from '@playwright/test'

/**
 * AppHeader E2E 테스트
 *
 * @see TSK-01-02-02
 * @see 026-test-specification.md
 */
test.describe('AppHeader 컴포넌트', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
  })

  /**
   * E2E-001: 로고 클릭 시 WBS 이동
   * @requirement FR-001, BR-004
   */
  test('E2E-001: 로고 클릭 시 /wbs 페이지로 이동한다', async ({ page }) => {
    await page.goto('/wbs')

    // 로고 확인
    const logo = page.locator('[data-testid="app-logo"]')
    await expect(logo).toBeVisible()
    await expect(logo).toHaveText('orchay')

    // 로고 클릭
    await logo.click()

    // /wbs 페이지 확인
    await expect(page).toHaveURL('/wbs')

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-001-logo-click.png', fullPage: true })
  })

  /**
   * E2E-002: WBS 메뉴 클릭
   * @requirement FR-002, BR-001
   */
  test('E2E-002: WBS 메뉴 클릭 시 /wbs 페이지로 이동한다', async ({ page }) => {
    await page.goto('/wbs')

    // WBS 메뉴 확인
    const wbsMenu = page.locator('[data-testid="nav-menu-wbs"]')
    await expect(wbsMenu).toBeVisible()
    await expect(wbsMenu).toHaveText('WBS')

    // WBS 메뉴 클릭
    await wbsMenu.click()

    // /wbs 페이지 확인
    await expect(page).toHaveURL('/wbs')

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-002-wbs-menu.png', fullPage: true })
  })

  /**
   * E2E-003: 비활성 메뉴 클릭
   * @requirement FR-002, BR-002
   */
  test('E2E-003: 비활성 메뉴 클릭 시 Toast가 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 페이지 로드 완료 대기 (ToastService 초기화 대기)
    await page.waitForLoadState('networkidle')

    // 대시보드 메뉴 확인 (비활성)
    const dashboardMenu = page.locator('[data-testid="nav-menu-dashboard"]')
    await expect(dashboardMenu).toBeVisible()

    // 대시보드 메뉴 클릭 - handleItemClick에서 처리
    await dashboardMenu.click()

    // Toast 알림 표시 확인 (PrimeVue Toast)
    const toast = page.locator('.p-toast-message').first()
    await expect(toast).toBeVisible({ timeout: 10000 })
    await expect(toast).toContainText('준비 중')

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-003-disabled-menu-toast.png', fullPage: true })
  })

  /**
   * E2E-004: 프로젝트명 표시
   * @requirement FR-003
   */
  test('E2E-004: 프로젝트명이 헤더에 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 프로젝트명 영역 확인
    const projectName = page.locator('[data-testid="project-name"]')
    await expect(projectName).toBeVisible()

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-004-project-name.png', fullPage: true })
  })

  /**
   * E2E-005: 현재 페이지 메뉴 강조
   * @requirement FR-002, BR-003
   * @updated TSK-08-04: PrimeVue Menubar 활성 스타일
   */
  test('E2E-005: 현재 페이지에 해당하는 메뉴가 강조 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // WBS 메뉴 확인
    const wbsMenu = page.locator('[data-testid="nav-menu-wbs"]')
    await expect(wbsMenu).toBeVisible()

    // WBS 메뉴가 활성 상태인지 확인 (menubar-item-active 클래스)
    await expect(wbsMenu).toHaveClass(/menubar-item-active/)

    // aria-current="page" 속성 확인
    await expect(wbsMenu).toHaveAttribute('aria-current', 'page')

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-005-active-menu.png', fullPage: true })
  })

  /**
   * E2E-006: 프로젝트 미선택 시
   * @requirement FR-003
   */
  test('E2E-006: 프로젝트 미선택 시 안내 텍스트가 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 프로젝트명 영역 확인
    const projectName = page.locator('[data-testid="project-name"]')
    await expect(projectName).toBeVisible()

    // 프로젝트 미선택 시 안내 텍스트 확인
    await expect(projectName).toContainText('프로젝트를 선택하세요')

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-006-no-project.png', fullPage: true })
  })

  /**
   * E2E-007: 네비게이션 메뉴 구조 확인
   * @requirement FR-002
   * @updated TSK-08-04: PrimeVue Menubar 적용
   */
  test('E2E-007: 3개의 네비게이션 메뉴가 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 3개 메뉴 확인
    await expect(page.locator('[data-testid="nav-menu-dashboard"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-menu-kanban"]')).toBeVisible()
    await expect(page.locator('[data-testid="nav-menu-wbs"]')).toBeVisible()

    // 메뉴 텍스트 확인
    await expect(page.locator('[data-testid="nav-menu-dashboard"]')).toHaveText('대시보드')
    await expect(page.locator('[data-testid="nav-menu-kanban"]')).toHaveText('칸반')
    await expect(page.locator('[data-testid="nav-menu-wbs"]')).toHaveText('WBS')
  })

  /**
   * E2E-008: 비활성 메뉴 스타일 확인
   * @requirement BR-001
   * @updated TSK-08-04: PrimeVue Menubar disabled 스타일
   */
  test('E2E-008: 비활성 메뉴는 opacity가 낮게 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 비활성 메뉴들 확인
    const disabledMenus = ['dashboard', 'kanban']

    for (const menuId of disabledMenus) {
      const menu = page.locator(`[data-testid="nav-menu-${menuId}"]`)
      await expect(menu).toBeVisible()

      // aria-disabled 속성 확인
      await expect(menu).toHaveAttribute('aria-disabled', 'true')

      // menubar-item-disabled 클래스 확인 (opacity-50 포함)
      await expect(menu).toHaveClass(/menubar-item-disabled/)
    }
  })

  /**
   * E2E-009: 로고 키보드 접근성
   * @requirement 접근성
   */
  test('E2E-009: 로고가 키보드로 접근 가능하다', async ({ page }) => {
    await page.goto('/wbs')

    const logo = page.locator('[data-testid="app-logo"]')

    // NuxtLink는 기본적으로 키보드 접근 가능 (a 태그)
    // href 속성 확인 (NuxtLink로 변경됨)
    await expect(logo).toHaveAttribute('href', '/wbs')

    // aria-label 확인
    await expect(logo).toHaveAttribute('aria-label', '홈으로 이동')
  })

  /**
   * E2E-010: 네비게이션 시맨틱 확인
   * @requirement 접근성
   * @updated TSK-08-04: PrimeVue Menubar 존재 확인
   */
  test('E2E-010: PrimeVue Menubar 컴포넌트가 렌더링된다', async ({ page }) => {
    await page.goto('/wbs')

    // PrimeVue Menubar 컴포넌트 확인
    const menubar = page.locator('.p-menubar')
    await expect(menubar).toBeVisible()

    // 메뉴 아이템들이 올바른 ARIA 속성을 가지는지 확인
    const wbsMenu = page.locator('[data-testid="nav-menu-wbs"]')
    await expect(wbsMenu).toHaveAttribute('aria-current', 'page')

    // header banner role 확인
    const header = page.locator('[data-testid="app-header"]')
    await expect(header).toHaveAttribute('role', 'banner')
  })

  /**
   * E2E-011: Menubar가 올바른 다크 테마 스타일을 가진다
   * @requirement TSK-08-06 Theme Integration
   */
  test('E2E-011: Menubar가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    await page.goto('/wbs')

    const menubar = page.locator('.p-menubar')
    await expect(menubar).toBeVisible()

    // Menubar 배경색 검증
    await expect(menubar).toHaveCSS('background-color', 'rgb(22, 33, 62)')

    // 활성 메뉴 항목 스타일 검증
    const activeMenu = page.locator('.p-menuitem-link.router-link-active').first()

    if (await activeMenu.count() > 0) {
      // 활성 메뉴 텍스트 색상
      await expect(activeMenu).toHaveCSS('color', 'rgb(59, 130, 246)')
    }
  })
})
