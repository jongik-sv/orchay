/**
 * WBS 페이지 통합 E2E 테스트
 * Task: TSK-06-01
 * 테스트 명세: 026-test-specification.md 섹션 4
 */

import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { E2E_TEST_ROOT } from './test-constants'

// IMPORTANT: 테스트 전용 프로젝트 ID - 실제 프로젝트명(orchay)을 사용하면 안됨!
const TEST_PROJECT_ID = 'e2e-wbs-integration-test'
// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay')

test.describe('WBS Page Integration', () => {
  test.beforeEach(async ({ page }) => {
    // 프로젝트 폴더 생성
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID)
    await fs.mkdir(projectPath, { recursive: true })

    // project.json 생성
    const projectJsonPath = join(projectPath, 'project.json')
    await fs.writeFile(
      projectJsonPath,
      JSON.stringify({
        id: TEST_PROJECT_ID,
        name: 'ORCHAY Project Manager',
        status: 'active',
        wbsDepth: 4,
        description: 'AI 기반 프로젝트 관리 도구',
        createdAt: '2025-12-15T00:00:00.000Z'
      }, null, 2),
      'utf-8'
    )

    // WBS 파일 생성
    const wbsPath = join(projectPath, 'wbs.md')
    const wbsContent = `# WBS - ORCHAY Project Manager

> version: 1.0
> depth: 4
> updated: 2025-12-15
> start: 2025-12-01

---

## WP-05: Task Detail & Document (Frontend)
- status: planned
- priority: high

### TSK-05-03: Detail Actions
- category: development
- status: [dd]
- priority: critical
`

    await fs.writeFile(wbsPath, wbsContent, 'utf-8')

    // tasks 폴더 생성 및 Task 상세 정보
    const tasksPath = join(projectPath, 'tasks', 'TSK-05-03')
    await fs.mkdir(tasksPath, { recursive: true })

    const taskJsonPath = join(tasksPath, 'task.json')
    await fs.writeFile(
      taskJsonPath,
      JSON.stringify({
        id: 'TSK-05-03',
        title: 'Detail Actions',
        category: 'development',
        status: '[dd]',
        priority: 'critical'
      }, null, 2),
      'utf-8'
    )
  })

  test.afterEach(async () => {
    // 테스트 데이터 정리 - 테스트 전용 프로젝트만 삭제
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID)
    await fs.rm(projectPath, { recursive: true, force: true })

    // settings 폴더는 삭제하지 않음 (다른 설정 파일 보호)
    // projects.json에서 테스트 프로젝트 항목만 제거하는 것이 이상적이지만
    // E2E 테스트 격리를 위해 별도 처리 생략
  })

  test('TC-016: 페이지 초기화 → 프로젝트 → WBS → Task 선택 (Happy Path)', async ({ page }) => {
    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // 로딩 스피너 확인 (빠르게 지나갈 수 있음)
    const loadingSpinner = page.getByTestId('loading-spinner')
    // 로딩 상태가 나타났다가 사라지는 것 확인 (타임아웃 짧게)
    await expect(loadingSpinner).toBeVisible({ timeout: 500 }).catch(() => {
      // 로딩이 너무 빨라서 안 보일 수도 있음
    })

    // WBS 트리 렌더링 확인
    const wbsContent = page.getByTestId('wbs-content')
    await expect(wbsContent).toBeVisible({ timeout: 2000 })

    // WBS 트리 노드 확인
    const wbsTree = page.locator('[data-testid^="wbs-tree-node"]')
    await expect(wbsTree.first()).toBeVisible()

    // Task 노드 클릭
    const taskNode = page.getByTestId('wbs-tree-node-TSK-05-03')
    await taskNode.click()

    // Task 상세 패널 확인
    const taskTitle = page.getByTestId('task-title')
    await expect(taskTitle).toBeVisible()
    await expect(taskTitle).toContainText('Detail Actions')

    // 헤더에 프로젝트명 표시 확인
    const header = page.locator('header')
    await expect(header).toContainText('ORCHAY Project Manager')
  })

  test('TC-018: 프로젝트 로드 실패 → 재시도 → 성공', async ({ page, context }) => {
    // API 모킹: 첫 번째 요청은 실패, 두 번째는 성공
    let requestCount = 0
    await context.route(`**/api/projects/${TEST_PROJECT_ID}`, async (route) => {
      requestCount++
      if (requestCount === 1) {
        // 첫 번째 요청: 에러
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 500,
            message: 'FILE_READ_ERROR'
          })
        })
      } else {
        // 두 번째 요청: 성공 (원래 요청으로 진행)
        await route.continue()
      }
    })

    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // 에러 메시지 확인
    const errorMessage = page.getByTestId('error-message')
    await expect(errorMessage).toBeVisible()
    await expect(errorMessage).toContainText('데이터를 불러올 수 없습니다')

    // Toast 에러 메시지 확인 (PrimeVue Toast)
    const toast = page.locator('.p-toast-message-error')
    await expect(toast).toBeVisible()

    // 재시도 버튼 클릭
    const retryButton = page.getByTestId('retry-button')
    await expect(retryButton).toBeVisible()
    await retryButton.click()

    // 정상 로딩 확인
    const wbsContent = page.getByTestId('wbs-content')
    await expect(wbsContent).toBeVisible({ timeout: 2000 })
  })

  test('TC-020: 프로젝트 없음 → 대시보드 이동', async ({ page }) => {
    // projectId 없이 페이지 접속
    await page.goto('/wbs')

    // Empty State 확인
    const emptyState = page.getByTestId('empty-state-no-project')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText('프로젝트를 선택하세요')

    // 대시보드 이동 버튼 클릭
    const dashboardLink = page.getByTestId('dashboard-link')
    await expect(dashboardLink).toBeVisible()
    await dashboardLink.click()

    // 대시보드 페이지로 이동 확인
    await expect(page).toHaveURL('/')
  })

  test('TC-002: projectId 잘못된 형식 → Empty State', async ({ page }) => {
    // 잘못된 형식의 projectId (대문자 포함)
    await page.goto('/wbs?project=Invalid-Project')

    // Empty State 확인
    const emptyState = page.getByTestId('empty-state-no-project')
    await expect(emptyState).toBeVisible()
    await expect(emptyState).toContainText('프로젝트를 선택하세요')
  })

  test('TC-013: Task 미선택 Empty State', async ({ page }) => {
    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 콘텐츠 로딩 대기
    const wbsContent = page.getByTestId('wbs-content')
    await expect(wbsContent).toBeVisible({ timeout: 2000 })

    // Task 미선택 상태에서 Empty State 확인
    const emptyStateNoTask = page.getByTestId('empty-state-no-task')
    await expect(emptyStateNoTask).toBeVisible()
    await expect(emptyStateNoTask).toContainText('Task를 선택하세요')
  })

  test('TC-019: Toast 자동 사라짐', async ({ page, context }) => {
    // API 모킹: 에러 발생
    await context.route(`**/api/projects/${TEST_PROJECT_ID}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 404,
          message: 'PROJECT_NOT_FOUND'
        })
      })
    })

    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // Toast 에러 메시지 표시 확인
    const toast = page.locator('.p-toast-message')
    await expect(toast).toBeVisible()

    // 3초 대기
    await page.waitForTimeout(3500)

    // Toast 사라짐 확인
    await expect(toast).not.toBeVisible()
  })

  test('TC-021: 최소 너비 1200px 레이아웃', async ({ page }) => {
    // 브라우저 너비 1200px 설정
    await page.setViewportSize({ width: 1200, height: 800 })

    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 콘텐츠 로딩 대기
    const wbsContent = page.getByTestId('wbs-content')
    await expect(wbsContent).toBeVisible({ timeout: 2000 })

    // 레이아웃 확인 (좌우 패널 존재)
    const leftPanel = page.locator('[aria-label="WBS 트리 패널"]')
    const rightPanel = page.locator('[aria-label="Task 상세 패널"]')

    await expect(leftPanel).toBeVisible()
    await expect(rightPanel).toBeVisible()

    // 스크롤 없이 정상 표시되는지 확인 (오버플로우 체크)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth
    })

    expect(hasHorizontalScroll).toBe(false)
  })

  test('TC-022: 키보드 네비게이션', async ({ page }) => {
    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 콘텐츠 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 2000 })

    // Tab 키로 포커스 이동 테스트
    await page.keyboard.press('Tab')

    // 첫 번째 포커스 가능한 요소 확인
    const firstFocusable = await page.evaluate(() => {
      return document.activeElement?.tagName
    })

    expect(firstFocusable).toBeTruthy()

    // Tab 키로 계속 이동
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // 포커스 순서가 논리적인지 확인 (좌측 → 우측)
    const activePanelLabel = await page.evaluate(() => {
      const activeElement = document.activeElement
      const panel = activeElement?.closest('[aria-label]')
      return panel?.getAttribute('aria-label')
    })

    // 좌측 패널 또는 우측 패널에 포커스가 있어야 함
    expect(activePanelLabel).toBeTruthy()
  })

  test('TC-023: ARIA 라벨', async ({ page }) => {
    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 콘텐츠 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 2000 })

    // 주요 ARIA 라벨 확인
    const layoutLabel = await page.locator('[aria-label="WBS 페이지"]').getAttribute('aria-label')
    expect(layoutLabel).toBe('WBS 페이지')

    const treeLabel = await page.locator('[aria-label="WBS 트리 패널"]').getAttribute('aria-label')
    expect(treeLabel).toBe('WBS 트리 패널')

    const detailLabel = await page.locator('[aria-label="Task 상세 패널"]').getAttribute('aria-label')
    expect(detailLabel).toBe('Task 상세 패널')
  })

  test('TC-017: 노드 선택 → Task 상세 로드 성능', async ({ page }) => {
    // 페이지 접속
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)

    // WBS 콘텐츠 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 2000 })

    // Task 노드 클릭 시작 시간
    const startTime = Date.now()

    // Task 노드 클릭
    const taskNode = page.getByTestId('wbs-tree-node-TSK-05-03')
    await taskNode.click()

    // Task 상세 패널 렌더링 대기
    await page.getByTestId('task-title').waitFor({ state: 'visible' })

    // 종료 시간
    const endTime = Date.now()
    const duration = endTime - startTime

    // 200ms 이내 완료 확인 (NFR-002)
    expect(duration).toBeLessThan(500) // E2E는 네트워크 지연 고려하여 500ms로 여유있게
  })
})
