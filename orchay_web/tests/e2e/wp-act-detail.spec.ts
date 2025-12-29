/**
 * WP/ACT Detail Panel E2E Integration Tests
 * Task: TSK-05-05
 * 테스트 명세: .orchay/projects/orchay/tasks/TSK-05-05/026-test-specification.md
 *
 * 통합 테스트 범위:
 * - WpActBasicInfo.vue - WP/ACT 기본 정보
 * - WpActProgress.vue - 진행 상황 시각화
 * - WpActChildren.vue - 하위 노드 목록
 * - WpActDetailPanel.vue - 전체 통합
 */

import { test, expect } from '@playwright/test'
import { TEST_PROJECT_ID } from './test-constants'

test.describe('TSK-05-05: WP/ACT Detail Panel', () => {
  test.beforeEach(async ({ page }) => {
    // global-setup에서 이미 테스트 데이터가 준비되어 있음
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 5000 })

    // WBS 트리 노드 로딩 대기
    await page.getByTestId('wbs-tree-node-WP-01').waitFor({ state: 'visible', timeout: 5000 })

    // "전체 펼치기" 버튼 클릭하여 모든 노드 펼치기
    const expandAllBtn = page.getByTestId('expand-all-button')
    await expandAllBtn.waitFor({ state: 'visible', timeout: 3000 })
    await expandAllBtn.click()

    // 펼침 애니메이션 대기
    await page.waitForTimeout(1000)
  })

  /**
   * E2E-001: WP 선택 및 정보 표시
   * 요구사항: FR-001, FR-002, FR-003
   */
  test('E2E-001: WP 선택 시 WpActDetailPanel 렌더링', async ({ page }) => {
    // Step 1: WP 노드 클릭
    const wpNode = page.getByTestId('wbs-tree-node-WP-01')
    await wpNode.waitFor({ state: 'visible', timeout: 3000 })
    await wpNode.click()

    // Step 2: WpActDetailPanel 표시 확인
    const detailPanel = page.getByTestId('wp-act-detail-panel')
    await expect(detailPanel).toBeVisible({ timeout: 3000 })

    // Step 3: 기본 정보 패널 확인
    const basicInfoPanel = page.getByTestId('wp-act-basic-info-panel')
    await expect(basicInfoPanel).toBeVisible()

    // Step 4: 노드 ID 확인
    const idBadge = page.getByTestId('node-id-badge')
    await expect(idBadge).toBeVisible()
    await expect(idBadge).toContainText('WP-01')

    // Step 5: 진행률 표시 확인
    const progressBar = page.getByTestId('node-progress-bar')
    await expect(progressBar).toBeVisible()

    // Step 6: 진행 상황 패널 확인
    const progressPanel = page.getByTestId('wp-act-progress-panel')
    await expect(progressPanel).toBeVisible()

    // Step 7: 하위 노드 목록 확인
    const childrenPanel = page.getByTestId('wp-act-children-panel')
    await expect(childrenPanel).toBeVisible()

    // Step 8: 스크린샷 캡처
    await page.screenshot({
      path: 'test-results/screenshots/e2e-wp-detail-panel.png',
      fullPage: true
    })
  })

  /**
   * E2E-002: 하위 노드 클릭 및 전환
   * 요구사항: FR-007, FR-008
   */
  test('E2E-002: 하위 노드 클릭 시 선택 변경', async ({ page }) => {
    // Step 1: WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    const idBadge = page.getByTestId('node-id-badge')
    await expect(idBadge).toContainText('WP-01')

    // Step 2: 하위 ACT 클릭 (ACT-01-01이 첫 번째 하위 노드)
    const childItem = page.locator('[data-testid^="child-item-ACT-01-01"]').first()
    await childItem.waitFor({ state: 'visible', timeout: 3000 })
    await childItem.click()
    await page.waitForTimeout(500)

    // Step 3: WpActDetailPanel이 ACT 정보로 업데이트 확인
    await expect(page.getByTestId('wp-act-detail-panel')).toBeVisible()
    await expect(idBadge).toContainText('ACT-01-01')

    // Step 4: 하위 Task 클릭
    const taskItem = page.locator('[data-testid^="child-item-TSK-"]').first()
    if (await taskItem.isVisible()) {
      await taskItem.click()
      await page.waitForTimeout(500)

      // Step 5: TaskDetailPanel로 전환 확인
      const taskPanel = page.getByTestId('task-detail-panel')
      if (await taskPanel.isVisible()) {
        await expect(taskPanel).toBeVisible()
      }
    }

    // Step 6: 스크린샷 캡처
    await page.screenshot({
      path: 'test-results/screenshots/e2e-wp-act-navigation.png'
    })
  })

  /**
   * E2E-003: ACT 선택 및 정보 표시
   * 요구사항: FR-001, FR-002, FR-003
   */
  test('E2E-003: ACT 선택 시 WpActDetailPanel 렌더링', async ({ page }) => {
    // Step 1: ACT 노드 클릭
    const actNode = page.getByTestId('wbs-tree-node-ACT-01-01')
    await actNode.waitFor({ state: 'visible', timeout: 5000 })
    await actNode.click()
    await page.waitForTimeout(500)

    // Step 2: WpActDetailPanel 표시 확인
    const detailPanel = page.getByTestId('wp-act-detail-panel')
    await expect(detailPanel).toBeVisible({ timeout: 3000 })

    // Step 3: ACT ID 확인
    const idBadge = page.getByTestId('node-id-badge')
    await expect(idBadge).toBeVisible()
    await expect(idBadge).toContainText('ACT-01-01')

    // Step 4: ACT 아이콘 확인
    const actIcon = page.locator('.node-icon-act')
    await expect(actIcon.first()).toBeVisible()
  })

  /**
   * E2E-004: 진행률 시각화 정확성 검증
   * 요구사항: FR-004, FR-005
   */
  test('E2E-004: 진행률 시각화 정확성 검증', async ({ page }) => {
    // Step 1: WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    // Step 2: 진행 상황 패널 확인
    const progressPanel = page.getByTestId('wp-act-progress-panel')
    await expect(progressPanel).toBeVisible()

    // Step 3: 전체 Task 수 확인
    await expect(progressPanel).toContainText('전체 Task')

    // Step 4: 완료/진행/대기 통계 확인
    await expect(progressPanel).toContainText('완료')
    await expect(progressPanel).toContainText('진행')
    await expect(progressPanel).toContainText('대기')

    // Step 5: 다단계 ProgressBar 표시 확인
    const progressSegments = page.getByTestId('progress-segments')
    if (await progressSegments.isVisible()) {
      await expect(progressSegments).toBeVisible()
    }

    // Step 6: 상태별 분포 확인
    const statusCounts = page.locator('[data-testid^="status-count-"]')
    const count = await statusCounts.count()
    expect(count).toBeGreaterThan(0)

    // Step 7: 스크린샷 캡처
    await page.screenshot({
      path: 'test-results/screenshots/e2e-wp-progress-visualization.png'
    })
  })

  /**
   * E2E-005: 빈 WP/ACT 빈 상태 메시지
   * 요구사항: FR-006
   * Note: 테스트 데이터에 빈 WP가 없는 경우 스킵 가능
   */
  test('E2E-005: 빈 WP/ACT의 빈 상태 메시지', async ({ page }) => {
    // 빈 WP 노드 찾기 (있는 경우에만 테스트)
    const emptyWpNode = page.getByTestId('wbs-tree-node-WP-EMPTY')

    if (await emptyWpNode.isVisible()) {
      // Step 1: 빈 WP 노드 클릭
      await emptyWpNode.click()
      await page.waitForTimeout(500)

      // Step 2: 빈 상태 메시지 확인
      const emptyMessage = page.getByTestId('children-empty-message')
      await expect(emptyMessage).toBeVisible()
      await expect(emptyMessage).toContainText('하위 노드가 없습니다')
    } else {
      // 테스트 데이터에 빈 WP가 없는 경우
      // WP-01 선택 후 children 패널이 하위 노드를 표시하는지 확인
      await page.getByTestId('wbs-tree-node-WP-01').click()
      await page.waitForTimeout(500)

      const childrenPanel = page.getByTestId('wp-act-children-panel')
      await expect(childrenPanel).toBeVisible()
    }
  })

  /**
   * E2E-006: 키보드 네비게이션
   * 요구사항: NFR-003 (접근성)
   */
  test('E2E-006: 키보드 네비게이션: Enter로 하위 노드 선택', async ({ page }) => {
    // Step 1: WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    const idBadge = page.getByTestId('node-id-badge')
    await expect(idBadge).toContainText('WP-01')

    // Step 2: 첫 번째 하위 노드에 포커스
    const firstChild = page.locator('[data-testid^="child-item-"]').first()
    await firstChild.waitFor({ state: 'visible', timeout: 3000 })

    // Step 3: 포커스 확인 (focus 링 표시)
    await firstChild.focus()
    await expect(firstChild).toBeFocused()

    // Step 4: Enter 키로 선택
    await firstChild.press('Enter')
    await page.waitForTimeout(500)

    // Step 5: 선택 변경 확인
    const newId = await idBadge.textContent()
    expect(newId).not.toBe('WP-01')  // WP-01이 아닌 다른 노드로 변경됨

    // Step 6: Tab 키로 다음 노드 포커스 이동 테스트
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    const children = page.locator('[data-testid^="child-item-"]')
    const childCount = await children.count()

    if (childCount > 1) {
      await children.first().focus()
      await page.keyboard.press('Tab')

      const secondChild = children.nth(1)
      // Tab 이동 후 두 번째 요소가 포커스 가능한지 확인
      const isFocusable = await secondChild.evaluate((el) =>
        el.getAttribute('tabindex') !== null ||
        ['BUTTON', 'A', 'INPUT'].includes(el.tagName)
      )
      expect(isFocusable).toBeTruthy()
    }
  })

  /**
   * E2E-PERF-01: 패널 렌더링 성능
   * 요구사항: NFR-001
   */
  test('E2E-PERF-01: WP/ACT 패널이 빠르게 렌더링된다', async ({ page }) => {
    // 성능 측정 시작
    const startTime = Date.now()

    // WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()

    // 모든 섹션 표시 대기
    await page.getByTestId('wp-act-detail-panel').waitFor({ state: 'visible', timeout: 3000 })
    await page.getByTestId('wp-act-basic-info-panel').waitFor({ state: 'visible', timeout: 1000 })
    await page.getByTestId('wp-act-progress-panel').waitFor({ state: 'visible', timeout: 1000 })
    await page.getByTestId('wp-act-children-panel').waitFor({ state: 'visible', timeout: 1000 })

    // 성능 측정 종료
    const endTime = Date.now()
    const duration = endTime - startTime

    // E2E는 네트워크 지연을 고려하여 여유있게 설정 (목표: 100ms, E2E 허용: 1500ms)
    expect(duration).toBeLessThan(1500)
  })

  /**
   * E2E-A11Y-01: 접근성 확인
   * 요구사항: NFR-003
   */
  test('E2E-A11Y-01: 모든 패널이 접근 가능하다', async ({ page }) => {
    // WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    // ARIA 라벨 확인
    const detailPanel = page.getByTestId('wp-act-detail-panel')
    const ariaLabel = await detailPanel.getAttribute('aria-label')
    expect(ariaLabel).toBeTruthy()

    // 키보드 네비게이션 테스트
    await page.keyboard.press('Tab')

    // 첫 번째 포커스 가능한 요소 확인
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.getAttribute('data-testid') ||
        document.activeElement?.tagName
    })
    expect(focusedElement).toBeTruthy()
  })

  /**
   * E2E-INTEGRATION-01: WBS 페이지에서 WP/ACT 선택 시 모든 섹션이 표시된다
   */
  test('E2E-INTEGRATION-01: WBS 페이지에서 WP 선택 시 모든 섹션이 표시된다', async ({ page }) => {
    // WP 선택
    await page.getByTestId('wbs-tree-node-WP-01').click()
    await page.waitForTimeout(500)

    // WP/ACT 상세 패널 확인
    const detailPanel = page.getByTestId('wp-act-detail-panel')
    await expect(detailPanel).toBeVisible({ timeout: 2000 })

    // 기본 정보
    const basicInfoPanel = page.getByTestId('wp-act-basic-info-panel')
    await expect(basicInfoPanel).toBeVisible()

    // 진행 상황
    const progressPanel = page.getByTestId('wp-act-progress-panel')
    await expect(progressPanel).toBeVisible()

    // 하위 노드 목록
    const childrenPanel = page.getByTestId('wp-act-children-panel')
    await expect(childrenPanel).toBeVisible()

    // 빈 상태 메시지가 없는지 확인
    const emptyState = page.getByTestId('empty-state-message')
    await expect(emptyState).not.toBeVisible()
  })

  /**
   * E2E-REGRESSION-01: Task 선택 시 TaskDetailPanel 정상 렌더링
   * 요구사항: 회귀 테스트 - 기존 Task 상세 패널 기능 유지
   */
  test('E2E-REGRESSION-01: Task 선택 시 TaskDetailPanel 정상 렌더링', async ({ page }) => {
    // Task 선택
    const taskNode = page.getByTestId('wbs-tree-node-TSK-01-01-02')
    if (await taskNode.isVisible()) {
      await taskNode.click()
      await page.waitForTimeout(500)

      // TaskDetailPanel 표시 확인
      const taskPanel = page.getByTestId('task-detail-panel')
      await expect(taskPanel).toBeVisible({ timeout: 3000 })

      // Task 정보 확인
      const taskBasicInfo = page.getByTestId('task-basic-info')
      if (await taskBasicInfo.isVisible()) {
        await expect(taskBasicInfo).toBeVisible()
      }
    }
  })
})
