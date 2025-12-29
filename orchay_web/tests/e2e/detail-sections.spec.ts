/**
 * Task Detail Sections E2E Integration Tests
 * Task: TSK-05-02
 * 테스트 명세: .orchay/projects/orchay/tasks/TSK-05-02/026-test-specification.md
 *
 * 통합 테스트 범위:
 * - TaskWorkflow.vue - 워크플로우 흐름 시각화
 * - TaskRequirements.vue - 요구사항 편집
 * - TaskDocuments.vue - 문서 목록
 * - TaskHistory.vue - 이력 타임라인
 * - TaskDetailPanel.vue - 전체 통합
 */

import { test, expect } from '@playwright/test'
import { TEST_PROJECT_ID } from './test-constants'

// global-setup.ts에서 생성한 TEST_PROJECT_ID 사용
// TSK-01-01, TSK-01-02, TSK-01-03 데이터가 global-setup에서 준비됨

test.describe('TSK-05-02: Detail Sections Integration', () => {
  test.beforeEach(async ({ page }) => {
    // global-setup에서 이미 테스트 데이터가 준비되어 있음
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 5000 })

    // WBS 트리 노드 로딩 대기 (WP-01 노드가 보일 때까지)
    await page.getByTestId('wbs-tree-node-WP-01').waitFor({ state: 'visible', timeout: 5000 })

    // "전체 펼치기" 버튼 클릭하여 모든 노드 펼치기
    const expandAllBtn = page.getByTestId('expand-all-button')
    await expandAllBtn.waitFor({ state: 'visible', timeout: 3000 })
    await expandAllBtn.click()

    // 펼침 애니메이션 대기 후 Task 노드 표시 확인
    await page.waitForTimeout(1000)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').waitFor({ state: 'visible', timeout: 10000 })
  })

  /**
   * E2E-001: 워크플로우 흐름 표시
   * 요구사항: FR-001, FR-002, FR-003, BR-WF-01
   */
  test('E2E-001: 워크플로우 흐름이 올바르게 표시된다', async ({ page }) => {
    // Task 선택 - div.wbs-tree-node-label 클릭 (handleNodeClick 바인딩됨)
    const taskNodeLabel = page.locator('.wbs-tree-node-label', { hasText: 'TSK-01-01-02' })
    await taskNodeLabel.waitFor({ state: 'visible', timeout: 3000 })
    await taskNodeLabel.click()

    // Task 상세 패널 로딩 대기
    await page.waitForTimeout(500)

    // Task 워크플로우 패널 표시 대기
    await page.getByTestId('task-workflow-panel').waitFor({ state: 'visible', timeout: 10000 })

    // 워크플로우 패널 확인
    const workflowPanel = page.getByTestId('task-workflow-panel')
    await expect(workflowPanel).toBeVisible()

    // 워크플로우 노드 확인 (development: 6단계)
    const workflowNodes = page.locator('[data-testid^="workflow-node-"]')
    await expect(workflowNodes).toHaveCount(6)

    // 현재 상태 노드 확인 ([dd]는 3번째, 인덱스 2)
    const currentNode = page.getByTestId('workflow-node-current')
    await expect(currentNode).toBeVisible()
    await expect(currentNode).toContainText('Detail')
  })

  /**
   * E2E-002: 요구사항 목록 표시
   * 요구사항: FR-004, FR-005
   */
  test('E2E-002: 요구사항 목록과 PRD 참조가 표시된다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 요구사항 패널 확인
    const requirementsPanel = page.getByTestId('task-requirements-panel')
    await expect(requirementsPanel).toBeVisible()

    // PRD 참조 확인
    const prdReference = page.getByTestId('prd-reference')
    await expect(prdReference).toBeVisible()
    await expect(prdReference).toContainText('PRD 6.3')

    // 요구사항 목록 확인
    const requirementsList = page.getByTestId('requirements-list')
    await expect(requirementsList).toBeVisible()

    // 요구사항 항목 확인 (4개)
    const requirementItems = page.locator('[data-testid^="requirement-item-"]')
    await expect(requirementItems).toHaveCount(4)
  })

  /**
   * E2E-003: 요구사항 편집
   * 요구사항: FR-006
   */
  test('E2E-003: 요구사항을 편집할 수 있다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 편집 버튼 클릭
    const editButton = page.getByTestId('edit-requirements-btn')
    await expect(editButton).toBeVisible()
    await editButton.click()

    // 편집 모드 확인
    const requirementInput = page.getByTestId('requirement-input-0')
    await expect(requirementInput).toBeVisible()

    // 요구사항 수정
    await requirementInput.fill('TaskWorkflow 컴포넌트 (워크플로우 흐름 시각화) - 수정됨')

    // 저장 버튼 클릭
    const saveButton = page.getByTestId('save-requirements-btn')
    await expect(saveButton).toBeVisible()
    await saveButton.click()

    // 성공 토스트 메시지 확인
    const successToast = page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible({ timeout: 2000 })
    await expect(successToast).toContainText('요구사항')

    // 변경사항 확인 (편집 모드 종료 후)
    const requirementItem = page.getByTestId('requirement-item-0')
    await expect(requirementItem).toContainText('수정됨')
  })

  /**
   * E2E-004: 요구사항 추가/삭제
   * 요구사항: FR-006
   */
  test('E2E-004: 요구사항을 추가하고 삭제할 수 있다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 편집 모드 활성화
    await page.getByTestId('edit-requirements-btn').click()

    // 초기 개수 확인
    const initialInputs = page.locator('[data-testid^="requirement-input-"]')
    const initialCount = await initialInputs.count()

    // 요구사항 추가
    const addButton = page.getByTestId('add-requirement-btn')
    await expect(addButton).toBeVisible()
    await addButton.click()

    // 새 입력 필드 확인
    const newInput = page.getByTestId(`requirement-input-${initialCount}`)
    await expect(newInput).toBeVisible()
    await newInput.fill('새로운 요구사항')

    // 현재 개수 확인 (추가 후)
    await expect(page.locator('[data-testid^="requirement-input-"]')).toHaveCount(initialCount + 1)

    // 첫 번째 요구사항 삭제
    const deleteButton = page.getByTestId('delete-requirement-btn-0')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // 삭제 후 개수 확인
    await expect(page.locator('[data-testid^="requirement-input-"]')).toHaveCount(initialCount)

    // 저장
    await page.getByTestId('save-requirements-btn').click()

    // 성공 토스트 확인
    await expect(page.locator('.p-toast-message-success')).toBeVisible({ timeout: 2000 })
  })

  /**
   * E2E-005: 문서 목록 표시
   * 요구사항: FR-007, FR-008, FR-010
   */
  test('E2E-005: 문서 목록과 존재/예정 상태가 표시된다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 문서 패널 확인
    const documentsPanel = page.getByTestId('task-documents-panel')
    await expect(documentsPanel).toBeVisible()

    // 문서 카드 확인 (최소 1개 이상)
    const documentCards = page.locator('[data-testid^="document-card-"]')
    await expect(documentCards.first()).toBeVisible()

    // 존재하는 문서 확인 (010-basic-design.md)
    const existsDoc = page.locator('[data-testid*="010-basic-design"]').first()
    await expect(existsDoc).toBeVisible()

    // 예정 문서가 있을 경우 확인 (020-detail-design.md)
    const expectedDoc = page.locator('[data-testid*="020-detail-design"]').first()
    if (await expectedDoc.isVisible()) {
      await expect(expectedDoc).toContainText('예정')
    }
  })

  /**
   * E2E-006: 문서 클릭하여 뷰어 열기
   * 요구사항: FR-009
   * Note: TSK-05-04에서 DocumentViewer 구현 전이므로 토스트만 확인
   */
  test('E2E-006: 존재하는 문서를 클릭하면 뷰어가 열린다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 존재하는 문서 카드 클릭
    const documentCard = page.locator('[data-testid*="010-basic-design"]').first()
    await expect(documentCard).toBeVisible()
    await documentCard.click()

    // 문서 뷰어 토스트 확인 (TSK-05-04 구현 전 임시)
    const infoToast = page.locator('.p-toast-message')
    await expect(infoToast).toBeVisible({ timeout: 2000 })
    await expect(infoToast).toContainText('문서')
  })

  /**
   * E2E-007: 이력 타임라인 표시
   * 요구사항: FR-011, FR-012, FR-013, BR-HIST-01
   */
  test('E2E-007: 상태 변경 이력이 타임라인으로 표시된다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 이력 패널 확인
    const historyPanel = page.getByTestId('task-history-panel')
    await expect(historyPanel).toBeVisible()

    // 타임라인 확인
    const historyTimeline = page.getByTestId('history-timeline')
    await expect(historyTimeline).toBeVisible()

    // 이력 엔트리 확인 (최소 1개 이상)
    const historyEntries = page.locator('[data-testid^="history-entry-"]')
    await expect(historyEntries.first()).toBeVisible()

    // 최신 이력 확인 (인덱스 0)
    const firstEntry = page.getByTestId('history-entry-0')
    await expect(firstEntry).toBeVisible()

    // 타임스탬프 확인
    const timestamp = page.getByTestId('history-timestamp-0')
    await expect(timestamp).toBeVisible()
    await expect(timestamp).toContainText('2025-12-15')
  })

  /**
   * E2E-008: 카테고리별 워크플로우 단계 차이
   * 요구사항: BR-WF-01
   */
  test('E2E-008: 카테고리별로 다른 워크플로우 단계가 표시된다', async ({ page }) => {
    // Development Task (6단계) - beforeEach에서 ACT-01-01 펼침 완료
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    let workflowNodes = page.locator('[data-testid^="workflow-node-"]')
    await expect(workflowNodes).toHaveCount(6)

    // Defect Task (5단계)
    await page.getByTestId('wbs-tree-node-TSK-01-01-03').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    workflowNodes = page.locator('[data-testid^="workflow-node-"]')
    await expect(workflowNodes).toHaveCount(5)

    // Infrastructure Task (4단계)
    await page.getByTestId('wbs-tree-node-TSK-01-01-04').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    workflowNodes = page.locator('[data-testid^="workflow-node-"]')
    await expect(workflowNodes).toHaveCount(4)
  })

  /**
   * E2E-PERF-01: 섹션 렌더링 성능
   * 요구사항: NFR-001
   */
  test('E2E-PERF-01: 모든 섹션이 빠르게 렌더링된다', async ({ page }) => {
    // 성능 측정 시작 - beforeEach에서 ACT-01-01 펼침 완료
    const startTime = Date.now()

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()

    // 모든 섹션 표시 대기
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    await page.getByTestId('task-workflow-panel').waitFor({ state: 'visible', timeout: 1000 })
    await page.getByTestId('task-requirements-panel').waitFor({ state: 'visible', timeout: 1000 })
    await page.getByTestId('task-documents-panel').waitFor({ state: 'visible', timeout: 1000 })
    await page.getByTestId('task-history-panel').waitFor({ state: 'visible', timeout: 1000 })

    // 성능 측정 종료
    const endTime = Date.now()
    const duration = endTime - startTime

    // E2E는 네트워크 지연을 고려하여 여유있게 설정 (목표: 100ms, E2E 허용: 1000ms)
    expect(duration).toBeLessThan(1000)
  })

  /**
   * E2E-A11Y-01: 접근성 확인
   * 요구사항: NFR-003
   */
  test('E2E-A11Y-01: 모든 섹션이 접근 가능하다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // ARIA 라벨 확인
    const workflowPanel = page.getByTestId('task-workflow-panel')
    const ariaLabel = await workflowPanel.getAttribute('aria-label')
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
   * E2E-ERROR-01: 요구사항 편집 실패 시 롤백
   * 요구사항: FR-006 (에러 처리)
   */
  test('E2E-ERROR-01: 요구사항 편집 실패 시 롤백된다', async ({ page, context }) => {
    // API 모킹: 편집 실패
    await context.route('**/api/tasks/TSK-01-01-02', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 500,
            message: 'UPDATE_FAILED'
          })
        })
      } else {
        await route.continue()
      }
    })

    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 원본 텍스트 저장
    const originalText = await page.getByTestId('requirement-item-0').textContent()

    // 편집 시도
    await page.getByTestId('edit-requirements-btn').click()
    await page.getByTestId('requirement-input-0').fill('수정된 요구사항')
    await page.getByTestId('save-requirements-btn').click()

    // 에러 토스트 확인
    const errorToast = page.locator('.p-toast-message-error')
    await expect(errorToast).toBeVisible({ timeout: 2000 })

    // 롤백 확인 (원본 텍스트 유지)
    await page.waitForTimeout(500) // 롤백 대기
    const currentText = await page.getByTestId('requirement-item-0').textContent()
    expect(currentText).toBe(originalText)
  })

  /**
   * E2E-INTEGRATION-01: 전체 패널 로드 통합 테스트
   */
  test('E2E-INTEGRATION-01: WBS 페이지에서 Task 선택 시 모든 섹션이 표시된다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()

    // Task 상세 패널 확인
    const detailPanel = page.getByTestId('task-detail-panel')
    await expect(detailPanel).toBeVisible({ timeout: 2000 })

    // 기본 정보 (TSK-05-01)
    const taskTitle = page.getByTestId('task-title')
    await expect(taskTitle).toBeVisible()
    await expect(taskTitle).toContainText('Development Task')

    // 진행 상태 (TSK-05-01)
    const taskProgress = page.getByTestId('task-progress')
    await expect(taskProgress).toBeVisible()

    // 워크플로우 흐름 (TSK-05-02)
    const workflowPanel = page.getByTestId('task-workflow-panel')
    await expect(workflowPanel).toBeVisible()

    // 요구사항 (TSK-05-02)
    const requirementsPanel = page.getByTestId('task-requirements-panel')
    await expect(requirementsPanel).toBeVisible()

    // 관련 문서 (TSK-05-02)
    const documentsPanel = page.getByTestId('task-documents-panel')
    await expect(documentsPanel).toBeVisible()

    // 이력 (TSK-05-02)
    const historyPanel = page.getByTestId('task-history-panel')
    await expect(historyPanel).toBeVisible()

    // 빈 상태 메시지가 없는지 확인
    const emptyState = page.getByTestId('empty-state-message')
    await expect(emptyState).not.toBeVisible()
  })

  /**
   * E2E-THEME-01: TaskWorkflow 현재 단계가 강조 표시된다
   * @requirement TSK-08-06 Theme Integration
   */
  test('E2E-THEME-01: TaskWorkflow 현재 단계가 강조 표시된다', async ({ page }) => {
    // Task 선택 (beforeEach에서 ACT-01-01 펼침 완료)
    await page.getByTestId('wbs-tree-node-TSK-01-01-02').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 워크플로우 패널 확인
    const workflowPanel = page.getByTestId('task-workflow-panel')
    await expect(workflowPanel).toBeVisible()

    // 현재 단계 노드 확인
    const currentStep = page.getByTestId('workflow-node-current')
    await expect(currentStep).toBeVisible()

    // 배경색 검증
    await expect(currentStep).toHaveCSS('background-color', 'rgb(59, 130, 246)')
  })
})
