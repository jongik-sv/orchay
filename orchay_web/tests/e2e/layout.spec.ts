import { test, expect } from '@playwright/test'

/**
 * AppLayout E2E 테스트
 *
 * @see TSK-01-02-01
 * @see 026-test-specification.md
 */
test.describe('AppLayout 컴포넌트', () => {
  /**
   * E2E-001: 레이아웃 구조 표시
   * @requirement FR-001
   */
  test('E2E-001: AppLayout이 Header + Content 구조로 표시된다', async ({ page }) => {
    await page.goto('/wbs')

    // 레이아웃 컨테이너 확인
    await expect(page.locator('[data-testid="app-layout"]')).toBeVisible()

    // Header 컨테이너 영역 확인
    await expect(page.locator('[data-testid="app-header-container"]')).toBeVisible()

    // Content 영역 확인
    await expect(page.locator('[data-testid="app-content"]')).toBeVisible()

    // 좌측 패널 확인
    await expect(page.locator('[data-testid="left-panel"]')).toBeVisible()

    // 우측 패널 확인
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible()

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-001-layout-structure.png', fullPage: true })
  })

  /**
   * E2E-002: 패널 비율 확인
   * @requirement FR-002, BR-004
   */
  test('E2E-002: 좌우 패널이 60:40 비율로 분할된다', async ({ page }) => {
    // 충분한 화면 너비 설정
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/wbs')

    const leftPanel = page.locator('[data-testid="left-panel"]')
    const rightPanel = page.locator('[data-testid="right-panel"]')

    const leftBox = await leftPanel.boundingBox()
    const rightBox = await rightPanel.boundingBox()

    expect(leftBox).not.toBeNull()
    expect(rightBox).not.toBeNull()

    if (leftBox && rightBox) {
      const totalWidth = leftBox.width + rightBox.width
      const leftRatio = (leftBox.width / totalWidth) * 100
      const rightRatio = (rightBox.width / totalWidth) * 100

      // 60:40 비율 검증 (오차 범위 5%)
      expect(leftRatio).toBeGreaterThan(55)
      expect(leftRatio).toBeLessThan(65)
      expect(rightRatio).toBeGreaterThan(35)
      expect(rightRatio).toBeLessThan(45)
    }

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-002-panel-ratio.png', fullPage: true })
  })

  /**
   * E2E-003: 반응형 동작 확인
   * @requirement FR-003
   */
  test('E2E-003: 1200px 미만에서 가로 스크롤이 발생한다', async ({ page }) => {
    // 1200px 미만으로 화면 설정
    await page.setViewportSize({ width: 1100, height: 800 })
    await page.goto('/wbs')

    // 가로 스크롤 존재 확인
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth
    })

    expect(hasHorizontalScroll).toBe(true)

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-003-responsive.png', fullPage: true })
  })

  /**
   * E2E-004: Header/Content 높이 확인
   * @requirement BR-001, BR-002
   */
  test('E2E-004: Header는 56px, Content는 나머지 높이를 차지한다', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/wbs')

    const header = page.locator('[data-testid="app-header-container"]')
    const content = page.locator('[data-testid="app-content"]')

    const headerBox = await header.boundingBox()
    const contentBox = await content.boundingBox()

    expect(headerBox).not.toBeNull()
    expect(contentBox).not.toBeNull()

    if (headerBox && contentBox) {
      // Header 높이 56px 검증
      expect(headerBox.height).toBe(56)

      // Content 높이 = 뷰포트 높이 - Header 높이
      const expectedContentHeight = 1080 - 56
      expect(contentBox.height).toBe(expectedContentHeight)
    }

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-004-heights.png', fullPage: true })
  })

  /**
   * E2E-005: 패널 최소 너비 확인
   * @requirement BR-003
   */
  test('E2E-005: 패널은 최소 너비를 유지한다', async ({ page }) => {
    // 1200px 경계값으로 설정
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.goto('/wbs')

    const leftPanel = page.locator('[data-testid="left-panel"]')
    const rightPanel = page.locator('[data-testid="right-panel"]')

    const leftBox = await leftPanel.boundingBox()
    const rightBox = await rightPanel.boundingBox()

    expect(leftBox).not.toBeNull()
    expect(rightBox).not.toBeNull()

    if (leftBox && rightBox) {
      // 좌측 패널 최소 너비 400px 검증
      expect(leftBox.width).toBeGreaterThanOrEqual(400)

      // 우측 패널 최소 너비 300px 검증
      expect(rightBox.width).toBeGreaterThanOrEqual(300)
    }

    // 스크린샷 캡처
    await page.screenshot({ path: 'test-results/screenshots/e2e-005-min-width.png', fullPage: true })
  })

  /**
   * E2E-006: 시맨틱 HTML 태그 확인
   * @requirement 접근성
   */
  test('E2E-006: 시맨틱 HTML 태그가 올바르게 적용된다', async ({ page }) => {
    await page.goto('/wbs')

    // header 태그 확인 (app-header-container)
    const header = page.locator('[data-testid="app-header-container"]')
    expect(await header.evaluate(el => el.tagName.toLowerCase())).toBe('header')
    expect(await header.getAttribute('role')).toBe('banner')

    // main 태그 확인
    const content = page.locator('[data-testid="app-content"]')
    expect(await content.evaluate(el => el.tagName.toLowerCase())).toBe('main')
    expect(await content.getAttribute('role')).toBe('main')

    // aside 태그 확인 (좌측 패널)
    const leftPanel = page.locator('[data-testid="left-panel"]')
    expect(await leftPanel.evaluate(el => el.tagName.toLowerCase())).toBe('aside')
    expect(await leftPanel.getAttribute('role')).toBe('complementary')

    // section 태그 확인 (우측 패널)
    const rightPanel = page.locator('[data-testid="right-panel"]')
    expect(await rightPanel.evaluate(el => el.tagName.toLowerCase())).toBe('section')
    expect(await rightPanel.getAttribute('role')).toBe('region')
  })

  /**
   * E2E-007: Splitter Gutter가 올바른 다크 테마 스타일을 가진다
   * @requirement TSK-08-06 Theme Integration
   */
  test('E2E-007: Splitter Gutter가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/wbs')

    const gutter = page.locator('.p-splitter-gutter').first()
    await expect(gutter).toBeVisible()

    // Gutter 기본 배경색 검증
    await expect(gutter).toHaveCSS('background-color', 'rgb(61, 61, 92)')

    // Cursor 스타일 검증
    await expect(gutter).toHaveCSS('cursor', 'col-resize')
  })
})
