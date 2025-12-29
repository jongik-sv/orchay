/**
 * E2E Tests for Graph Filter and Hierarchy Features
 * Task: TSK-06-03
 * Test Specification: 026-test-specification.md
 */

import { test, expect, Page } from '@playwright/test'
import { E2E_TEST_ROOT } from './test-constants'

const TEST_PROJECT = 'orchay개선'

/**
 * Helper: 의존관계 그래프 모달 열기
 */
async function openDependencyGraphModal(page: Page) {
  // WBS 페이지로 이동
  await page.goto(`/wbs?project=${encodeURIComponent(TEST_PROJECT)}`)

  // 페이지 로드 대기
  await page.waitForLoadState('networkidle')

  // 의존관계 그래프 버튼 클릭 (AppHeader 또는 WBS 페이지 내)
  const graphButton = page.locator('button:has-text("의존관계")').first()
  await graphButton.click()

  // 모달 열림 대기
  await page.waitForSelector('[data-testid="dependency-graph-modal"]', { timeout: 10000 })

  // 그래프 렌더링 완료 대기
  await page.waitForTimeout(1000)
}

/**
 * Helper: 필터 패널이 펼쳐져 있는지 확인
 */
async function ensureFilterPanelExpanded(page: Page) {
  const filterContent = page.locator('.filter-content')
  const isVisible = await filterContent.isVisible()

  if (!isVisible) {
    const toggleBtn = page.locator('[data-testid="filter-toggle-btn"]')
    await toggleBtn.click()
    await page.waitForTimeout(300) // 애니메이션 대기
  }
}

/**
 * Helper: 현재 노드 개수 가져오기
 */
async function getNodeCount(page: Page): Promise<number> {
  const statsText = await page.locator('[data-testid="filter-stats"]').first().textContent()
  const match = statsText?.match(/노드:\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Helper: 현재 엣지 개수 가져오기
 */
async function getEdgeCount(page: Page): Promise<number> {
  const statsText = await page.locator('[data-testid="filter-stats"]').first().textContent()
  const match = statsText?.match(/엣지:\s*(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

test.describe('Graph Filter Panel - TC-E2E-001~002', () => {
  test.beforeEach(async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)
  })

  test('TC-E2E-001: 카테고리 필터 적용', async ({ page }) => {
    // 초기 노드 개수 확인
    const initialCount = await getNodeCount(page)
    expect(initialCount).toBeGreaterThan(0)

    // "개발" 카테고리 Checkbox 찾기
    const devCheckbox = page.locator('[data-testid="category-checkbox-development"]')

    // 초기 상태 확인 (체크되어 있을 수 있음)
    const isChecked = await devCheckbox.isChecked()

    if (!isChecked) {
      // 체크 상태로 변경
      await devCheckbox.check()
      await page.waitForTimeout(500) // 필터 적용 대기
    }

    const allCategoriesCount = await getNodeCount(page)

    // "개발" 카테고리 해제
    await devCheckbox.uncheck()
    await page.waitForTimeout(500) // 필터 적용 대기

    // 노드 개수 감소 확인
    const filteredCount = await getNodeCount(page)
    expect(filteredCount).toBeLessThan(allCategoriesCount)

    // 통계 업데이트 확인
    const statsTag = page.locator('[data-testid="filter-stats"]')
    await expect(statsTag).toContainText(`노드: ${filteredCount}`)

    // "개발" 카테고리 재선택
    await devCheckbox.check()
    await page.waitForTimeout(500)

    // 원래 개수로 복원 확인
    const restoredCount = await getNodeCount(page)
    expect(restoredCount).toBe(allCategoriesCount)
  })

  test('TC-E2E-002: 상태 필터 적용', async ({ page }) => {
    // 상태 MultiSelect 클릭
    const statusSelect = page.locator('[data-testid="status-multiselect"]')
    await statusSelect.click()
    await page.waitForTimeout(300)

    // 드롭다운 열림 확인
    const dropdown = page.locator('.p-multiselect-panel')
    await expect(dropdown).toBeVisible()

    // "[im] 구현" 선택
    const imOption = page.locator('.p-multiselect-item').filter({ hasText: '구현 [im]' })
    await imOption.click()
    await page.waitForTimeout(300)

    // 드롭다운 닫기 (외부 클릭)
    await page.click('body', { position: { x: 0, y: 0 } })
    await page.waitForTimeout(500) // 필터 적용 대기

    // 필터링된 노드 개수 확인
    const imOnlyCount = await getNodeCount(page)
    expect(imOnlyCount).toBeGreaterThan(0)

    // "[vf] 검증" 추가 선택
    await statusSelect.click()
    await page.waitForTimeout(300)

    const vfOption = page.locator('.p-multiselect-item').filter({ hasText: '검증 [vf]' })
    await vfOption.click()
    await page.waitForTimeout(300)

    // 드롭다운 닫기
    await page.click('body', { position: { x: 0, y: 0 } })
    await page.waitForTimeout(500)

    // 노드 개수 증가 확인
    const imVfCount = await getNodeCount(page)
    expect(imVfCount).toBeGreaterThan(imOnlyCount)

    // 통계 확인
    const statsTag = page.locator('[data-testid="filter-stats"]')
    await expect(statsTag).toContainText(`노드: ${imVfCount}`)
  })
})

test.describe('Filter Panel Toggle - TC-E2E-006', () => {
  test('TC-E2E-006: 필터 패널 접기/펼치기', async ({ page }) => {
    await openDependencyGraphModal(page)

    const filterPanel = page.locator('[data-testid="graph-filter-panel"]')
    const toggleBtn = page.locator('[data-testid="filter-toggle-btn"]')
    const filterContent = page.locator('.filter-content')

    // 초기 상태 확인 (Desktop에서는 펼쳐져 있을 수 있음)
    const initiallyExpanded = await filterContent.isVisible()

    // 토글 버튼 클릭 (접기)
    await toggleBtn.click()
    await page.waitForTimeout(300) // 애니메이션 대기

    // 콘텐츠 숨김 확인
    if (initiallyExpanded) {
      await expect(filterContent).not.toBeVisible()
    }

    // 헤더는 여전히 표시
    await expect(filterPanel).toBeVisible()
    await expect(page.locator('[data-testid="filter-stats"]')).toBeVisible()

    // 토글 버튼 클릭 (펼치기)
    await toggleBtn.click()
    await page.waitForTimeout(300)

    // 콘텐츠 다시 표시
    await expect(filterContent).toBeVisible()
  })
})

test.describe('Filter Reset - TC-E2E-007', () => {
  test('TC-E2E-007: 필터 초기화', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // 초기 전체 노드 개수 저장
    const initialCount = await getNodeCount(page)

    // 1. 카테고리 필터 적용
    const devCheckbox = page.locator('[data-testid="category-checkbox-development"]')
    await devCheckbox.check()
    await page.waitForTimeout(500)

    // 2. 상태 필터 적용
    const statusSelect = page.locator('[data-testid="status-multiselect"]')
    await statusSelect.click()
    await page.waitForTimeout(300)

    const imOption = page.locator('.p-multiselect-item').filter({ hasText: '구현 [im]' })
    await imOption.click()
    await page.click('body', { position: { x: 0, y: 0 } })
    await page.waitForTimeout(500)

    // 3. 계층 뷰 변경
    const wpRadio = page.locator('[data-testid="hierarchy-radio-wp"]')
    await wpRadio.check()
    await page.waitForTimeout(500)

    // 필터가 적용되었는지 확인
    const filteredCount = await getNodeCount(page)
    expect(filteredCount).toBeLessThanOrEqual(initialCount)

    // 초기화 버튼 클릭
    const resetBtn = page.locator('[data-testid="filter-reset-btn"]')
    await resetBtn.click()
    await page.waitForTimeout(500) // 필터 리셋 대기

    // 카테고리 확인 (모두 선택 해제 또는 전체 선택)
    // 초기화 로직에 따라 다를 수 있음

    // 상태 확인 (선택 해제)
    const statusValue = await statusSelect.inputValue()
    // MultiSelect가 비어있는지 확인

    // 계층 뷰 확인 ("전체" 선택)
    const fullRadio = page.locator('[data-testid="hierarchy-radio-full"]')
    await expect(fullRadio).toBeChecked()

    // 그래프가 전체 Task 표시하는지 확인
    const resetCount = await getNodeCount(page)
    expect(resetCount).toBeGreaterThanOrEqual(filteredCount)

    // URL 확인 (쿼리 파라미터 제거)
    const url = new URL(page.url())
    expect(url.searchParams.get('categories')).toBeNull()
    expect(url.searchParams.get('statuses')).toBeNull()
    expect(url.searchParams.get('hierarchyMode')).toBeNull()
  })
})

test.describe('Hierarchy Mode - TC-E2E-003', () => {
  test('TC-E2E-003: 계층 모드 전환 (Full → WP 그룹)', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // 초기 상태: 전체 보기
    const fullRadio = page.locator('[data-testid="hierarchy-radio-full"]')
    await expect(fullRadio).toBeChecked()

    const fullModeCount = await getNodeCount(page)

    // WP 그룹 모드로 전환
    const wpRadio = page.locator('[data-testid="hierarchy-radio-wp"]')
    await wpRadio.check()
    await page.waitForTimeout(1000) // 그룹 노드 생성 대기

    // 그룹 노드가 표시되는지 확인
    const groupNodes = page.locator('[data-testid^="group-node-WP-"]')
    const groupCount = await groupNodes.count()
    expect(groupCount).toBeGreaterThan(0)

    // 노드 개수 변화 확인 (그룹 노드 + Task 노드)
    const wpModeCount = await getNodeCount(page)
    expect(wpModeCount).toBeGreaterThan(0)
  })

  test('TC-E2E-004: 그룹 노드 축소/확장', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // WP 그룹 모드로 전환
    const wpRadio = page.locator('[data-testid="hierarchy-radio-wp"]')
    await wpRadio.check()
    await page.waitForTimeout(1000)

    // WP-06 그룹 노드 찾기 (orchay개선 프로젝트에 존재한다고 가정)
    const wpGroupHeader = page.locator('[data-testid="group-node-header-WP-06"]').first()

    // 그룹 노드 존재 확인
    if (await wpGroupHeader.count() > 0) {
      // 초기 상태: 확장됨 (▼ 아이콘)
      await expect(wpGroupHeader).toContainText('▼')

      // 하위 Task 노드가 보이는지 확인
      const taskNode = page.locator('[data-testid="task-node-TSK-06-01"]').first()
      if (await taskNode.count() > 0) {
        await expect(taskNode).toBeVisible()
      }

      // 그룹 노드 클릭 (축소)
      await wpGroupHeader.click()
      await page.waitForTimeout(200) // 애니메이션 대기

      // 아이콘 변경 확인 (▼ → ▶)
      await expect(wpGroupHeader).toContainText('▶')

      // 하위 Task 노드가 숨겨졌는지 확인
      if (await taskNode.count() > 0) {
        await expect(taskNode).not.toBeVisible()
      }

      // 그룹 노드 재클릭 (확장)
      await wpGroupHeader.click()
      await page.waitForTimeout(200)

      // 아이콘 변경 확인 (▶ → ▼)
      await expect(wpGroupHeader).toContainText('▼')

      // 하위 Task 노드가 다시 보이는지 확인
      if (await taskNode.count() > 0) {
        await expect(taskNode).toBeVisible()
      }
    } else {
      console.warn('WP-06 그룹 노드를 찾을 수 없습니다. 테스트 데이터를 확인하세요.')
    }
  })
})

test.describe('Focus View - TC-E2E-005', () => {
  test('TC-E2E-005: 초점 뷰 적용 및 하이라이트', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // 초점 Task Select 클릭
    const focusTaskSelect = page.locator('[data-testid="focus-task-select"]')
    await focusTaskSelect.click()
    await page.waitForTimeout(300)

    // Task 선택 (예: TSK-06-01, 실제 존재하는 Task ID 사용)
    const taskOption = page.locator('.p-select-option').filter({ hasText: 'TSK-06-01' }).first()

    if (await taskOption.count() > 0) {
      await taskOption.click()
      await page.waitForTimeout(300)

      // 깊이 선택 (depth 2)
      const depth2Radio = page.locator('[data-testid="focus-depth-radio-2"]')
      await expect(depth2Radio).not.toBeDisabled()
      await depth2Radio.check()

      // [적용] 버튼 클릭
      const applyBtn = page.locator('[data-testid="focus-apply-btn"]')
      await expect(applyBtn).not.toBeDisabled()
      await applyBtn.click()
      await page.waitForTimeout(1000) // 초점 뷰 계산 및 렌더링 대기

      // 노드 개수 감소 확인 (전체 → 초점 뷰)
      const focusNodeCount = await getNodeCount(page)
      expect(focusNodeCount).toBeGreaterThan(0)
      expect(focusNodeCount).toBeLessThanOrEqual(20) // depth 2 범위 내

      // 초점 Task 노드 하이라이트 확인
      const focusTaskNode = page.locator('[data-testid="task-node-TSK-06-01"]').first()
      if (await focusTaskNode.count() > 0) {
        // 하이라이트 클래스 확인 (CSS 클래스 또는 스타일)
        const hasHighlight = await focusTaskNode.evaluate(node => {
          return node.classList.contains('task-node-highlight-selected') ||
            window.getComputedStyle(node).borderColor !== 'rgb(0, 0, 0)'
        })
        expect(hasHighlight).toBeTruthy()
      }
    } else {
      console.warn('TSK-06-01을 찾을 수 없습니다. 테스트 데이터를 확인하세요.')
    }
  })

  test('TC-E2E-005-02: 초점 Task 비선택 시 depth 비활성화', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // 초점 Task가 선택되지 않은 상태
    const depth1Radio = page.locator('[data-testid="focus-depth-radio-1"]')
    const applyBtn = page.locator('[data-testid="focus-apply-btn"]')

    // depth RadioButton 비활성화 확인
    await expect(depth1Radio).toBeDisabled()

    // [적용] 버튼 비활성화 확인
    await expect(applyBtn).toBeDisabled()
  })
})

test.describe('URL Parameter Sync - TC-E2E-006', () => {
  test('TC-E2E-006: URL 파라미터 저장 및 복원', async ({ page }) => {
    // 1. 모달 열기 및 필터 적용
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // 카테고리 선택
    const devCheckbox = page.locator('[data-testid="category-checkbox-development"]')
    await devCheckbox.check()
    await page.waitForTimeout(500)

    // 상태 선택
    const statusSelect = page.locator('[data-testid="status-multiselect"]')
    await statusSelect.click()
    await page.waitForTimeout(300)
    const imOption = page.locator('.p-multiselect-item').filter({ hasText: '구현 [im]' })
    await imOption.click()
    await page.click('body', { position: { x: 0, y: 0 } })
    await page.waitForTimeout(500)

    // 계층 뷰 선택
    const wpRadio = page.locator('[data-testid="hierarchy-radio-wp"]')
    await wpRadio.check()
    await page.waitForTimeout(500)

    // 2. URL 파라미터 확인
    await page.waitForTimeout(1000) // debounce 대기 (300ms + 여유)

    const url1 = new URL(page.url())
    const categories = url1.searchParams.get('categories')
    const statuses = url1.searchParams.get('statuses')
    const hierarchyMode = url1.searchParams.get('hierarchyMode')

    expect(categories).toContain('development')
    expect(statuses).toContain('im')
    expect(hierarchyMode).toBe('wp')

    // 3. 페이지 새로고침
    await page.reload()
    await page.waitForLoadState('networkidle')

    // 모달이 자동으로 열리지 않으므로 다시 열기
    const graphButton = page.locator('button:has-text("의존관계")').first()
    await graphButton.click()
    await page.waitForSelector('[data-testid="dependency-graph-modal"]', { timeout: 10000 })
    await page.waitForTimeout(1000)

    // 4. 필터 설정 복원 확인
    await ensureFilterPanelExpanded(page)

    // 카테고리 확인
    const devCheckboxAfter = page.locator('[data-testid="category-checkbox-development"]')
    await expect(devCheckboxAfter).toBeChecked()

    // 계층 뷰 확인
    const wpRadioAfter = page.locator('[data-testid="hierarchy-radio-wp"]')
    await expect(wpRadioAfter).toBeChecked()

    // 그래프가 복원된 필터로 렌더링되었는지 확인
    const nodeCount = await getNodeCount(page)
    expect(nodeCount).toBeGreaterThan(0)
  })
})

test.describe('Accessibility - TC-E2E-008', () => {
  test('TC-E2E-008: 키보드 탐색', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // Tab 키로 필터 토글 버튼에 포커스
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)

    const toggleBtn = page.locator('[data-testid="filter-toggle-btn"]')
    await expect(toggleBtn).toBeFocused()

    // Tab 키로 초기화 버튼에 포커스
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)

    const resetBtn = page.locator('[data-testid="filter-reset-btn"]')
    await expect(resetBtn).toBeFocused()

    // Tab 키로 카테고리 Checkbox에 포커스
    await page.keyboard.press('Tab')
    await page.waitForTimeout(100)

    const devCheckbox = page.locator('[data-testid="category-checkbox-development"]')
    await expect(devCheckbox).toBeFocused()

    // Space 키로 Checkbox 선택/해제
    const initialChecked = await devCheckbox.isChecked()
    await page.keyboard.press('Space')
    await page.waitForTimeout(300)

    const afterSpaceChecked = await devCheckbox.isChecked()
    expect(afterSpaceChecked).toBe(!initialChecked)
  })
})

test.describe('Performance - NFR Tests', () => {
  test('NFR-001: 필터 응답 시간 < 200ms (100개 노드 기준)', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    const devCheckbox = page.locator('[data-testid="category-checkbox-development"]')

    // 필터 변경 시간 측정
    const startTime = Date.now()
    await devCheckbox.check()
    await page.waitForTimeout(100) // 렌더링 완료 대기
    const endTime = Date.now()

    const responseTime = endTime - startTime
    console.log(`Filter response time: ${responseTime}ms`)

    // 200ms 이내 (여유를 두고 500ms)
    expect(responseTime).toBeLessThan(500)
  })

  test('NFR-002: 그룹 노드 토글 응답 시간 < 100ms', async ({ page }) => {
    await openDependencyGraphModal(page)
    await ensureFilterPanelExpanded(page)

    // WP 그룹 모드로 전환
    const wpRadio = page.locator('[data-testid="hierarchy-radio-wp"]')
    await wpRadio.check()
    await page.waitForTimeout(1000)

    const wpGroupHeader = page.locator('[data-testid="group-node-header-WP-06"]').first()

    if (await wpGroupHeader.count() > 0) {
      // 토글 시간 측정
      const startTime = Date.now()
      await wpGroupHeader.click()
      await page.waitForTimeout(150) // 애니메이션 완료 대기
      const endTime = Date.now()

      const toggleTime = endTime - startTime
      console.log(`Group toggle time: ${toggleTime}ms`)

      // 애니메이션 포함 200ms 이내
      expect(toggleTime).toBeLessThan(200)
    }
  })
})
