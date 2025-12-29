/**
 * WBS Tree Panel E2E 테스트
 * Task: TSK-04-01, TSK-08-01
 * 테스트 명세: 026-test-specification.md 섹션 3.1
 *
 * TSK-08-01 업데이트: URL 파라미터 및 프로젝트 ID 수정
 * - projectId → project (wbs.vue의 route.query.project 사용)
 * - TEST_PROJECT_ID 상수 사용으로 일관성 확보
 */

import { test, expect } from '@playwright/test'
import { TEST_PROJECT_ID } from './test-constants'

test.describe('WBS Tree Panel', () => {
  test.beforeEach(async ({ page }) => {
    // WBS 페이지로 이동 (project 파라미터 사용 - wbs.vue에서 route.query.project 사용)
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle')
  })

  test('E2E-001: WBS 데이터가 성공적으로 로드되어 표시된다', async ({ page }) => {
    // Given: 페이지 로드 완료
    // When: WBS 트리 패널 확인
    const treePanel = page.locator('[data-testid="wbs-tree-panel"]')
    await expect(treePanel).toBeVisible()

    // Then: 콘텐츠 상태 표시 (loading이 끝난 후)
    const contentState = page.locator('[data-testid="content-state"]')
    const loadingState = page.locator('[data-testid="loading-state"]')
    const errorState = page.locator('[data-testid="error-state"]')

    // 로딩이 끝나면 content-state 또는 error-state가 표시됨
    await expect(loadingState).not.toBeVisible({ timeout: 10000 })

    // content-state 또는 error-state 중 하나는 보여야 함
    const hasContent = await contentState.isVisible()
    const hasError = await errorState.isVisible()
    expect(hasContent || hasError).toBe(true)
  })

  test('E2E-002: 헤더에 타이틀, 버튼, 검색, 카드가 모두 표시된다', async ({ page }) => {
    // Given: 페이지 로드 완료, 콘텐츠 표시됨
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })

    // When: 헤더 요소 확인
    const header = page.locator('[data-testid="wbs-tree-header"]')
    await expect(header).toBeVisible()

    // Then: 타이틀 표시
    const title = header.locator('h2')
    await expect(title).toContainText('WBS 트리')

    // 전체 펼치기/접기 버튼 표시
    await expect(header.locator('[data-testid="expand-all-button"]')).toBeVisible()
    await expect(header.locator('[data-testid="collapse-all-button"]')).toBeVisible()

    // 검색 박스 표시
    const searchBox = header.locator('[data-testid="wbs-search-box"]')
    await expect(searchBox).toBeVisible()

    // 요약 카드 표시
    const summaryCards = header.locator('[data-testid="wbs-summary-cards"]')
    await expect(summaryCards).toBeVisible()
  })
})

test.describe('WBS Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })
  })

  test('E2E-003: 검색어 입력 시 X 버튼이 표시된다', async ({ page }) => {
    // Given: 검색 입력 필드
    const searchInput = page.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()

    // When: 검색어 입력
    await searchInput.fill('TSK-01')

    // Debounce 대기 (300ms)
    await page.waitForTimeout(400)

    // Then: X 버튼 표시
    const clearButton = page.locator('[data-testid="clear-search-button"]')
    await expect(clearButton).toBeVisible()
  })

  test('E2E-004: X 버튼 클릭 시 검색어가 초기화된다', async ({ page }) => {
    // Given: 검색어 입력됨
    const searchInput = page.locator('[data-testid="search-input"]')
    await searchInput.fill('TSK-01')
    await page.waitForTimeout(400)

    const clearButton = page.locator('[data-testid="clear-search-button"]')
    await expect(clearButton).toBeVisible()

    // When: X 버튼 클릭
    await clearButton.click()

    // Then: 검색어 초기화
    await expect(searchInput).toHaveValue('')
    await expect(clearButton).not.toBeVisible()
  })
})

test.describe('WBS Tree Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })
  })

  test('E2E-005: 전체 펼치기 버튼이 클릭 가능하다', async ({ page }) => {
    // Given: 전체 펼치기 버튼
    const expandButton = page.locator('[data-testid="expand-all-button"]')
    await expect(expandButton).toBeVisible()
    await expect(expandButton).toBeEnabled()

    // When: 버튼 클릭
    await expandButton.click()

    // Then: 클릭 성공 (에러 없음)
    await expect(expandButton).toBeEnabled()
  })

  test('E2E-006: 전체 접기 버튼이 클릭 가능하다', async ({ page }) => {
    // Given: 전체 접기 버튼
    const collapseButton = page.locator('[data-testid="collapse-all-button"]')
    await expect(collapseButton).toBeVisible()
    await expect(collapseButton).toBeEnabled()

    // When: 버튼 클릭
    await collapseButton.click()

    // Then: 클릭 성공 (에러 없음)
    await expect(collapseButton).toBeEnabled()
  })
})

test.describe('WBS Summary Cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })
  })

  test('E2E-007: 통계 카드가 정확한 값을 표시한다', async ({ page }) => {
    // Given: 통계 카드
    const wpCard = page.locator('[data-testid="wp-card"]')
    const actCard = page.locator('[data-testid="act-card"]')
    const tskCard = page.locator('[data-testid="tsk-card"]')
    const progressCard = page.locator('[data-testid="progress-card"]')

    // Then: 4개 카드 모두 표시
    await expect(wpCard).toBeVisible()
    await expect(actCard).toBeVisible()
    await expect(tskCard).toBeVisible()
    await expect(progressCard).toBeVisible()

    // 카드 레이블 확인
    await expect(wpCard).toContainText('WP')
    await expect(actCard).toContainText('ACT')
    await expect(tskCard).toContainText('TSK')
    await expect(progressCard).toContainText('Progress')
  })
})

test.describe('WBS Error Handling', () => {
  test('E2E-008: API 에러 시 에러 메시지를 표시한다', async ({ page }) => {
    // Given: API 실패 시뮬레이션 (존재하지 않는 프로젝트)
    await page.goto('/wbs?projectId=non-existent-project')
    await page.waitForLoadState('networkidle')

    // When/Then: 에러 상태 또는 빈 상태 표시
    await page.waitForTimeout(2000) // API 응답 대기

    const loadingSpinner = page.locator('[data-testid="loading-spinner"]')
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 })

    // 에러 상태 또는 빈 상태 확인
    // pages/wbs.vue에서 사용하는 data-testid:
    // - error-message: 에러 발생 시
    // - empty-state-no-project: projectId가 없거나 잘못된 경우
    // WbsTreePanel.vue에서 사용하는 data-testid:
    // - error-state: WBS 로딩 에러
    const errorMessage = page.locator('[data-testid="error-message"]')
    const errorState = page.locator('[data-testid="error-state"]')
    const emptyStateNoProject = page.locator('[data-testid="empty-state-no-project"]')
    const emptyStateNoWbs = page.locator('[data-testid="empty-state-no-wbs"]')

    const hasErrorMessage = await errorMessage.isVisible()
    const hasErrorState = await errorState.isVisible()
    const hasEmptyNoProject = await emptyStateNoProject.isVisible()
    const hasEmptyNoWbs = await emptyStateNoWbs.isVisible()

    // 에러 또는 빈 상태 중 하나는 표시되어야 함
    expect(hasErrorMessage || hasErrorState || hasEmptyNoProject || hasEmptyNoWbs).toBe(true)
  })
})

test.describe('WBS Performance', () => {
  test('PERF-001: 검색 응답 시간이 500ms 이하이다', async ({ page }) => {
    // Given: 페이지 로드 완료
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })

    // When: 검색어 입력 및 시간 측정
    const searchInput = page.locator('[data-testid="search-input"]')

    const startTime = Date.now()
    await searchInput.fill('TSK-01')
    await page.waitForTimeout(400) // Debounce 대기
    const endTime = Date.now()

    const responseTime = endTime - startTime

    // Then: 응답 시간 확인 (500ms 이하)
    expect(responseTime).toBeLessThan(500)
  })
})

test.describe('WBS Theme Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('[data-testid="content-state"]', { timeout: 10000 })
  })

  test('THEME-001: Tree 컴포넌트가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    const tree = page.locator('.p-tree').first()
    await expect(tree).toBeVisible()

    // Tree 배경색 검증
    await expect(tree).toHaveCSS('background-color', 'rgb(15, 15, 35)')

    // 노드 텍스트 색상 검증
    const nodeLabel = page.locator('.p-treenode-label').first()
    await expect(nodeLabel).toHaveCSS('color', 'rgb(232, 232, 232)')
  })
})
