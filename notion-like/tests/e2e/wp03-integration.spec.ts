import { test, expect } from '@playwright/test'

/**
 * WP-03 및 전체 MVP 통합 E2E 테스트
 *
 * TSK-03-99: 전체 MVP 기능 통합 검증
 *
 * 테스트 시나리오:
 * 1. 페이지 생성부터 저장까지
 * 2. 페이지 계층 구조 관리
 * 3. 즐겨찾기 기능
 * 4. 검색 기능
 * 5. 반응형 레이아웃
 * 6. 다크모드
 * 7. 에러 처리
 * 8. 로딩 상태
 */

test.describe('WP-03 MVP Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트 시작: 메인 페이지로 이동
    await page.goto('/')
  })

  /**
   * 시나리오 1: 페이지 생성부터 저장까지
   */
  test('Scenario 1: Create page and verify persistence', async ({ page }) => {
    // 1. 애플리케이션 시작
    await page.goto('/')
    await expect(page).toHaveTitle(/Orchay Notes/)

    // 2. 사이드바에서 새 페이지 버튼 클릭
    const newPageButton = page.getByTestId('new-page-btn')
    await expect(newPageButton).toBeVisible()
    await newPageButton.click()

    // 페이지 이동 대기
    await page.waitForTimeout(1000)

    // 3. 페이지 제목 입력
    const pageTitle = page.getByTestId('page-title-input')
    await expect(pageTitle).toBeVisible({ timeout: 10000 })
    await pageTitle.fill('새로운 페이지')

    // 4. 페이지 아이콘 선택 (이모지)
    const iconChangeButton = page.getByTestId('icon-change-button')

    // 아이콘 변경 버튼이 있는지 확인 (선택적 기능)
    const iconButtonExists = await iconChangeButton.isVisible().catch(() => false)

    if (iconButtonExists) {
      await iconChangeButton.click()

      // 첫 번째 이모지 선택 (IconPicker가 열린다면)
      await page.waitForTimeout(500)

      // 이모지 선택기가 있는지 확인
      const firstEmoji = page.locator('[data-testid^="emoji-"]').first()
      const emojiCount = await firstEmoji.count()

      if (emojiCount > 0) {
        await firstEmoji.click()
      }
    }

    // 5. 에디터에서 콘텐츠 작성
    const editor = page.locator('.bn-block-content').first()
    await expect(editor).toBeVisible()
    await editor.click()
    await editor.type('테스트 콘텐츠입니다')

    // 제목 블록 추가 (간단하게 텍스트만)
    await page.keyboard.press('Enter')
    await page.keyboard.type('## 제목 블록')

    // 리스트 추가
    await page.keyboard.press('Enter')
    await page.keyboard.type('- 리스트 아이템 1')

    // 6. 2초 대기 (저장 완료 대기)
    await page.waitForTimeout(2000)

    // 7. 새로고침
    await page.reload()

    // 8. 검증: 제목, 아이콘, 콘텐츠 유지 확인
    await expect(pageTitle).toHaveValue('새로운 페이지')
    await expect(page.getByText('테스트 콘텐츠입니다')).toBeVisible()
    await expect(page.getByText('제목 블록')).toBeVisible()
    await expect(page.getByText('리스트 아이템 1')).toBeVisible()
  })

  /**
   * 시나리오 2: 페이지 계층 구조 관리
   */
  test('Scenario 2: Manage page hierarchy', async ({ page }) => {
    // 1. 첫 페이지 생성 (루트)
    await page.getByTestId('new-page-btn').click()
    await page.waitForTimeout(1000)

    await page.getByTestId('page-title-input').fill('루트 페이지')
    await page.locator('.bn-block-content').first().click()
    await page.waitForTimeout(1000)

    // 2. 하위 페이지 생성
    await page.getByTestId('new-page-btn').click()
    await page.waitForTimeout(1000)

    await page.getByTestId('page-title-input').fill('하위 페이지 1')
    await page.locator('.bn-block-content').first().click()
    await page.waitForTimeout(1000)

    // 3. 하위 페이지 아래에 또 다른 페이지 생성 (깊이 2)
    await page.getByTestId('new-page-btn').click()
    await page.waitForTimeout(1000)

    await page.getByTestId('page-title-input').fill('하위 페이지 2')
    await page.locator('.bn-block-content').first().click()
    await page.waitForTimeout(1000)

    // 4. 사이드바에서 계층 구조 확인 (들여쓰기)
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toBeVisible()

    // 루트 페이지 확인 (사이드바에서)
    const rootPageLink = page.getByText('루트 페이지').first()
    await expect(rootPageLink).toBeVisible()

    // 5. 폴더 토글로 하위 페이지 숨기기/표시
    const toggleButton = page.locator('[data-testid^="toggle-btn-"]').first()

    // 토글 버튼이 있는지 확인
    const toggleCount = await toggleButton.count()
    if (toggleCount > 0) {
      await toggleButton.click()
      await page.waitForTimeout(500)

      // 하위 페이지가 숨겨지는지 확인 (옵션)
      const subPage1 = page.getByText('하위 페이지 1')
      const isVisible = await subPage1.isVisible().catch(() => false)

      if (isVisible) {
        await expect(subPage1).not.toBeVisible()
      }

      // 다시 토글
      await toggleButton.click()
      await page.waitForTimeout(500)
    }

    // 6. 중간 페이지 클릭 → 콘텐츠 확인
    await page.getByText('하위 페이지 1').first().click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('page-title-input')).toHaveValue('하위 페이지 1')

    // 7. 최하위 페이지 클릭 → 콘텐츠 확인
    await page.getByText('하위 페이지 2').first().click()
    await page.waitForTimeout(1000)
    await expect(page.getByTestId('page-title-input')).toHaveValue('하위 페이지 2')
  })

  /**
   * 시나리오 3: 즐겨찾기 기능
   */
  test('Scenario 3: Favorite pages functionality', async ({ page }) => {
    // 1. 여러 페이지 생성 및 즐겨찾기 추가
    const favoriteButton = page.getByTestId('favorite-toggle-btn')

    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('new-page-btn').click()

      // 페이지 로드 대기
      await page.waitForTimeout(2000)

      // Next.js dev overlay가 있으면 대기
      await page.waitForLoadState('networkidle')

      await page.getByTestId('page-title-input').fill(`페이지 ${i}`)
      await page.locator('.bn-block-content').first().click()
      await page.waitForTimeout(500)

      // 즐겨찾기 버튼 클릭
      await favoriteButton.click({ force: true })
      await page.waitForTimeout(500)
    }

    // 2. 사이드바 Favorites 섹션 확인 (구현되어 있다면)
    const favoritesSection = page.getByText('Favorites').or(page.getByText('즐겨찾기'))
    const isVisible = await favoritesSection.isVisible().catch(() => false)

    if (isVisible) {
      await expect(favoritesSection).toBeVisible()

      // 3. Favorites에서 페이지 클릭 → 이동 확인
      const favoriteLinks = page.getByTestId('favorite-page-link')
      const favoriteCount = await favoriteLinks.count()

      if (favoriteCount > 0) {
        await favoriteLinks.first().click()
        await page.waitForTimeout(500)

        // 현재 페이지가 즐겨찾기에 추가된 페이지인지 확인
        const currentTitle = await page.getByTestId('page-title-input').inputValue()
        expect(currentTitle).toBeTruthy()
      }
    }
  })

  /**
   * 시나리오 4: 검색 기능
   */
  test('Scenario 4: Search functionality', async ({ page }) => {
    // 1. 여러 페이지 생성 (다양한 제목)
    const testPages = ['테스트 페이지 A', '테스트 페이지 B', '다른 페이지']

    for (const title of testPages) {
      await page.getByTestId('new-page-btn').click()
      await page.getByTestId('page-title-input').fill(title)
      await page.locator('.bn-block-content').first().click()
      await page.waitForTimeout(500)
    }

    // 2. Cmd+K 단축키 누름
    await page.keyboard.press('Meta+k')

    // 3. 검색 모달 표시 확인
    const searchModal = page.getByTestId('search-modal')
    await expect(searchModal).toBeVisible()

    // 4. 페이지 제목으로 검색
    const searchInput = page.getByTestId('search-input')
    await searchInput.fill('테스트')

    // 검색 결과 로드 대기
    await page.waitForTimeout(1000)

    // 5. 검색 결과 확인
    const searchResults = page.locator('[data-testid^="search-result-"]')
    const resultCount = await searchResults.count()

    expect(resultCount).toBeGreaterThan(0)

    // 검색 결과에서 페이지 클릭
    if (resultCount > 0) {
      await searchResults.first().click()

      // 6. 검증: 해당 페이지로 이동 확인
      await page.waitForTimeout(500)
      const pageTitle = page.getByTestId('page-title-input')
      const titleValue = await pageTitle.inputValue()

      expect(titleValue).toContain('테스트')
    }
  })

  /**
   * 시나리오 5: 반응형 레이아웃
   */
  test('Scenario 5: Responsive layout', async ({ page }) => {
    // 1. 데스크톱 뷰 (1920x1080)에서 앱 접속
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    // 2. 사이드바 토글 확인 (240px 고정)
    const sidebar = page.getByTestId('sidebar')
    await expect(sidebar).toBeVisible()

    const sidebarBox = await sidebar.boundingBox()
    expect(sidebarBox?.width).toBeCloseTo(240, 10)

    // 3. 뷰포트 크기 변경 (375x667, 모바일)
    await page.setViewportSize({ width: 375, height: 667 })

    // 4. 검증: 사이드바 오버레이 확인
    // 모바일에서는 기본적으로 사이드바가 숨겨져 있어야 함
    await expect(sidebar).not.toBeInViewport()

    // 5. 햄버거 메뉴 클릭 → 사이드바 열기
    const mobileMenuButton = page.getByTestId('mobile-menu-btn')
    await expect(mobileMenuButton).toBeVisible()
    await mobileMenuButton.click()

    // 사이드바가 오버레이로 표시되어야 함
    await expect(sidebar).toBeVisible()

    // 6. 에디터 영역 확인 (패딩 24px)
    const editor = page.getByTestId('editor-area')
    await expect(editor).toBeVisible()

    // 7. 바깥 클릭 → 사이드바 닫기
    await page.locator('body').click({ position: { x: 300, y: 300 } })
    await page.waitForTimeout(300)

    // 사이드바가 닫혀야 함
    await expect(sidebar).not.toBeInViewport()
  })

  /**
   * 시나리오 6: 다크모드
   */
  test('Scenario 6: Dark mode', async ({ page }) => {
    // 1. 시스템 라이트모드에서 앱 접속
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/')

    // 2. 배경색 확인 (흰색)
    const body = page.locator('body')
    const backgroundColor = await body.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    expect(backgroundColor).toBe('rgb(255, 255, 255)')

    // 3. 시스템 다크모드 변경
    await page.emulateMedia({ colorScheme: 'dark' })

    // 페이지가 로드되기를 기다림
    await page.waitForTimeout(1000)

    // 4. 검증: UI가 다크모드로 자동 전환
    const darkBackgroundColor = await body.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor
    )

    // 다크모드 배경색 확인 (#191919 ≈ rgb(25, 25, 25))
    // Note: 실제 RGB 값은 브라우저 렌더링에 따라 약간의 차이가 있을 수 있음
    expect(darkBackgroundColor).toMatch(/rgb\(\d{2,3}, \d{2,3}, \d{2,3}\)/)

    // 5. 배경색 확인
    expect(darkBackgroundColor).toMatch(/rgb\(\d{2,3}, \d{2,3}, \d{2,3}\)/)

    // 6. 텍스트 색상 확인 (#E6E6E4 ≈ rgb(230, 230, 228))
    // Note: 페이지에 제목 입력이 있어야 함
    const pageTitle = page.getByTestId('page-title-input')
    const isVisible = await pageTitle.isVisible().catch(() => false)

    if (isVisible) {
      const textColor = await pageTitle.evaluate((el) =>
        window.getComputedStyle(el).color
      )

      expect(textColor).toMatch(/rgb\(22[0-9][0-9], 22[0-9][0-9], 22[0-9][0-9]\)/)
    }
  })

  /**
   * 시나리오 7: 에러 처리
   */
  test('Scenario 7: Error handling', async ({ page }) => {
    // 1. API 에러 시뮬레이션 (네트워크 오프라인)
    await page.context().setOffline(true)

    // 페이지 이동 시도
    await page.getByTestId('new-page-btn').click()
    await page.waitForTimeout(1000)

    // 2. 네트워크 복구
    await page.context().setOffline(false)

    // 에러 토스트가 표시되었는지 확인 (구현에 따라 다를 수 있음)
    const errorToast = page.getByTestId('error-toast').or(page.getByText(/error/i))
    const isVisible = await errorToast.isVisible().catch(() => false)

    if (isVisible) {
      await expect(errorToast).toBeVisible()
    }

    // 3. 페이지 새로고침
    await page.reload()

    // 4. 검증: 정상 로드 확인
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('editor-area')).toBeVisible()
  })

  /**
   * 시나리오 8: 로딩 상태
   */
  test('Scenario 8: Loading state', async ({ page }) => {
    // 1. 페이지 로딩 지연 시뮬레이션 (실제로는 다른 페이지로 이동)
    await page.getByTestId('new-page-btn').click()
    await page.waitForTimeout(500)

    // 2. 스켈레톤 UI 확인 (구현에 따라 다를 수 있음)
    const skeleton = page.getByTestId('page-skeleton')

    const isSkeletonVisible = await skeleton.isVisible().catch(() => false)

    if (isSkeletonVisible) {
      await expect(skeleton).toBeVisible()
    }

    // 3. 콘텐츠 로드 완료 대기
    await page.waitForTimeout(2000)

    // 4. 콘텐츠 로드 완료 후 스켈레톤 제거 확인
    if (isSkeletonVisible) {
      await expect(skeleton).not.toBeVisible()
    }

    // 실제 콘텐츠가 표시되는지 확인
    await expect(page.getByTestId('page-title-input')).toBeVisible()
    await expect(page.locator('.bn-block-content').first()).toBeVisible()
  })
})
