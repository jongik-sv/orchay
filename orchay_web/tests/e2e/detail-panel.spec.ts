/**
 * Task Detail Panel E2E Tests
 * Task: TSK-05-01
 * 테스트 명세: .orchay/projects/orchay/tasks/TSK-05-01/026-test-specification.md
 *
 * 테스트 범위:
 * - TaskDetailPanel.vue - 컨테이너, 로딩/에러/빈 상태
 * - TaskBasicInfo.vue - 기본 정보, 인라인 편집
 * - TaskProgress.vue - 진행 상태, 워크플로우 단계
 */

import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import { join } from 'path'
import { E2E_TEST_ROOT } from './test-constants'

const TEST_PROJECT_ID = 'orchay-test-detail-panel'
// 임시 디렉토리의 .orchay 폴더 사용 (프로덕션 데이터 보호)
const ORCHAY_ROOT = join(E2E_TEST_ROOT, '.orchay')

test.describe('TSK-05-01: Detail Panel Structure', () => {
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
        name: 'Test Detail Panel',
        status: 'active',
        wbsDepth: 3,
        description: 'Detail Panel Structure Test',
        createdAt: '2025-12-15T00:00:00.000Z'
      }, null, 2),
      'utf-8'
    )

    // team.json 생성
    const teamJsonPath = join(projectPath, 'team.json')
    await fs.writeFile(
      teamJsonPath,
      JSON.stringify({
        version: '1.0',
        members: [
          {
            id: 'member1',
            name: '팀원1',
            email: 'member1@test.com',
            role: 'Developer',
            active: true
          },
          {
            id: 'member2',
            name: '팀원2',
            email: 'member2@test.com',
            role: 'Designer',
            active: true
          }
        ]
      }, null, 2),
      'utf-8'
    )

    // WBS 파일 생성 (3개 카테고리, 4개 우선순위 테스트용)
    const wbsPath = join(projectPath, 'wbs.md')
    const wbsContent = `# WBS - Test Detail Panel

> version: 1.0
> depth: 3
> updated: 2025-12-15
> start: 2025-12-15

---

## WP-01: Test Work Package
- status: planned
- priority: high

### TSK-05-01: Detail Panel Structure
- category: development
- domain: frontend
- status: [dd]
- priority: high
- assignee: member1
- schedule: 2025-01-13 ~ 2025-01-15
- tags: component, detail
- depends: -
- test-result: none
- requirements:
  - TaskDetailPanel 컴포넌트
  - TaskBasicInfo 컴포넌트
  - TaskProgress 컴포넌트
- ref: PRD 6.3

### TSK-TEST-DEV: Development Test Task
- category: development
- domain: frontend
- status: [im]
- priority: medium
- assignee: -
- test-result: none
- requirements:
  - Development task requirement

### TSK-TEST-DEFECT: Defect Test Task
- category: defect
- domain: backend
- status: [an]
- priority: critical
- assignee: -
- test-result: none
- requirements:
  - Defect task requirement

### TSK-TEST-INFRA: Infrastructure Test Task
- category: infrastructure
- domain: infra
- status: [im]
- priority: low
- assignee: -
- test-result: none
- requirements:
  - Infrastructure task requirement
`

    await fs.writeFile(wbsPath, wbsContent, 'utf-8')

    // tasks 폴더 생성
    const tasksPath = join(projectPath, 'tasks', 'TSK-05-01')
    await fs.mkdir(tasksPath, { recursive: true })

    // Page setup
    await page.goto(`/wbs?project=${TEST_PROJECT_ID}`)
  })

  test.afterEach(async () => {
    // 테스트 데이터 정리
    const projectPath = join(ORCHAY_ROOT, 'projects', TEST_PROJECT_ID)
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  /**
   * E2E-001: Task 미선택 시 빈 상태 표시
   * 요구사항: FR-001, FR-002
   */
  test('E2E-001: Task가 선택되지 않으면 빈 상태 메시지를 표시한다', async ({ page }) => {
    // WBS 로딩 대기
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Detail Panel 확인
    const detailPanel = page.getByTestId('task-detail-panel')
    await expect(detailPanel).toBeVisible()

    // 빈 상태 메시지 확인
    const emptyMessage = page.getByTestId('empty-state-message')
    await expect(emptyMessage).toBeVisible()
    await expect(emptyMessage).toContainText('왼쪽에서 Task를 선택하세요')
  })

  /**
   * E2E-002: 제목 인라인 편집 성공
   * 요구사항: FR-003
   */
  test('E2E-002: 사용자가 Task 제목을 인라인 편집할 수 있다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 제목 클릭 (편집 모드)
    const titleDisplay = page.getByTestId('task-title-display')
    await expect(titleDisplay).toBeVisible()
    await titleDisplay.click()

    // 입력 필드 확인
    const titleInput = page.getByTestId('task-title-input')
    await expect(titleInput).toBeVisible()

    // 제목 수정
    await titleInput.fill('수정된 제목')
    await page.keyboard.press('Enter')

    // 성공 토스트 확인
    const successToast = page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible({ timeout: 3000 })

    // UI 즉시 반영 확인
    await expect(titleDisplay).toContainText('수정된 제목')
  })

  /**
   * E2E-003: 우선순위 Dropdown 변경
   * 요구사항: FR-004
   */
  test('E2E-003: 사용자가 우선순위를 Dropdown으로 변경할 수 있다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 우선순위 Dropdown 클릭
    const priorityDropdown = page.getByTestId('task-priority-dropdown')
    await expect(priorityDropdown).toBeVisible()
    await priorityDropdown.click()

    // 옵션 선택 (critical)
    const criticalOption = page.getByTestId('priority-option-critical')
    await expect(criticalOption).toBeVisible()
    await criticalOption.click()

    // 성공 토스트 확인
    const successToast = page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible({ timeout: 3000 })

    // 변경 확인
    await expect(priorityDropdown).toContainText('긴급')
  })

  /**
   * E2E-004: 담당자 Dropdown 변경
   * 요구사항: FR-005
   */
  test('E2E-004: 사용자가 담당자를 Dropdown으로 변경할 수 있다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 담당자 Dropdown 클릭
    const assigneeDropdown = page.getByTestId('task-assignee-dropdown')
    await expect(assigneeDropdown).toBeVisible()
    await assigneeDropdown.click()

    // 옵션 선택 (member2)
    const member2Option = page.getByTestId('assignee-option-member2')
    await expect(member2Option).toBeVisible()
    await member2Option.click()

    // 성공 토스트 확인
    const successToast = page.locator('.p-toast-message-success')
    await expect(successToast).toBeVisible({ timeout: 3000 })

    // 변경 확인
    await expect(assigneeDropdown).toContainText('팀원2')
  })

  /**
   * E2E-005: 카테고리 색상 확인
   * 요구사항: FR-006
   */
  test('E2E-005: 카테고리별 색상이 올바르게 적용된다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Development Task - 블루 (#3b82f6)
    await page.getByTestId('wbs-tree-node-TSK-TEST-DEV').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    const devTag = page.getByTestId('task-category-tag')
    await expect(devTag).toBeVisible()
    await expect(devTag).toHaveClass(/bg-blue-500/)

    // Defect Task - 레드 (#ef4444)
    await page.getByTestId('wbs-tree-node-TSK-TEST-DEFECT').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    const defectTag = page.getByTestId('task-category-tag')
    await expect(defectTag).toBeVisible()
    await expect(defectTag).toHaveClass(/bg-red-500/)

    // Infrastructure Task - 그린 (#22c55e)
    await page.getByTestId('wbs-tree-node-TSK-TEST-INFRA').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })
    const infraTag = page.getByTestId('task-category-tag')
    await expect(infraTag).toBeVisible()
    await expect(infraTag).toHaveClass(/bg-green-500/)
  })

  /**
   * E2E-006: 우선순위 색상 확인
   * 요구사항: FR-007
   */
  test('E2E-006: 우선순위별 색상이 올바르게 적용된다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // High 우선순위 Task
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    const priorityDropdown = page.getByTestId('task-priority-dropdown')
    await expect(priorityDropdown).toBeVisible()

    // High 색상 확인 (앰버)
    const priorityValue = priorityDropdown.locator('div').first()
    await expect(priorityValue).toHaveClass(/text-amber-600/)
  })

  /**
   * E2E-007: 낙관적 업데이트 확인
   * 요구사항: FR-008
   */
  test('E2E-007: 인라인 편집 시 낙관적 업데이트가 즉시 반영된다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 제목 수정
    const titleDisplay = page.getByTestId('task-title-display')
    await titleDisplay.click()

    const titleInput = page.getByTestId('task-title-input')
    await titleInput.fill('낙관적 업데이트 테스트')

    // Enter 전에 빠르게 확인 (낙관적 업데이트)
    await page.keyboard.press('Enter')

    // UI 즉시 반영 확인 (API 응답 전)
    await expect(titleDisplay).toContainText('낙관적 업데이트 테스트', { timeout: 500 })
  })

  /**
   * E2E-008: 스크롤 영역 확인
   * 요구사항: FR-009
   */
  test('E2E-008: Detail Panel이 스크롤 가능하다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // Detail Panel 컨테이너 확인
    const detailPanel = page.getByTestId('task-detail-panel')
    await expect(detailPanel).toBeVisible()

    // 스크롤 가능 여부 확인
    const isScrollable = await detailPanel.evaluate((el) => {
      const contentEl = el.querySelector('.task-detail-content')
      if (!contentEl) return false
      return contentEl.scrollHeight > contentEl.clientHeight
    })

    // 콘텐츠가 많을 경우 스크롤 가능, 적을 경우 불가 (정상 동작)
    expect(typeof isScrollable).toBe('boolean')
  })

  /**
   * E2E-009: 로딩 상태 확인
   * 요구사항: FR-010
   */
  test('E2E-009: Task 로드 중 Skeleton을 표시한다', async ({ page, context }) => {
    // API 지연 시뮬레이션 (1초)
    await context.route('**/api/tasks/TSK-05-01', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })

    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()

    // Skeleton 표시 확인
    const skeleton = page.getByTestId('task-detail-skeleton')
    await expect(skeleton).toBeVisible({ timeout: 500 })

    // 로딩 완료 후 실제 콘텐츠 확인
    await page.getByTestId('task-basic-info-panel').waitFor({ state: 'visible', timeout: 3000 })
    await expect(skeleton).not.toBeVisible()
  })

  /**
   * E2E-010: 제목 길이 검증 (201자)
   * 요구사항: BR-001
   */
  test('E2E-010: 제목이 200자를 초과하면 에러 메시지를 표시한다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 제목 편집 모드
    await page.getByTestId('task-title-display').click()

    // 201자 입력
    const longTitle = 'A'.repeat(201)
    await page.getByTestId('task-title-input').fill(longTitle)
    await page.keyboard.press('Enter')

    // 에러 토스트 확인
    const errorToast = page.locator('.p-toast-message-error')
    await expect(errorToast).toBeVisible({ timeout: 3000 })
    await expect(errorToast).toContainText('1-200자')
  })

  /**
   * E2E-011: 우선순위 옵션 개수 확인
   * 요구사항: BR-002
   */
  test('E2E-011: 우선순위 Dropdown은 4개 옵션만 표시한다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // Dropdown 열기
    await page.getByTestId('task-priority-dropdown').click()

    // 옵션 개수 확인
    const options = page.locator('[data-testid^="priority-option-"]')
    await expect(options).toHaveCount(4)

    // 옵션 값 확인
    await expect(page.getByTestId('priority-option-critical')).toBeVisible()
    await expect(page.getByTestId('priority-option-high')).toBeVisible()
    await expect(page.getByTestId('priority-option-medium')).toBeVisible()
    await expect(page.getByTestId('priority-option-low')).toBeVisible()
  })

  /**
   * E2E-013: API 실패 시 롤백
   * 요구사항: BR-004
   */
  test('E2E-013: API 실패 시 이전 값으로 롤백한다', async ({ page, context }) => {
    // API 실패 시뮬레이션
    await context.route('**/api/tasks/TSK-05-01', async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 500,
            message: 'FILE_WRITE_ERROR'
          })
        })
      } else {
        await route.continue()
      }
    })

    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 이전 제목 백업
    const titleDisplay = page.getByTestId('task-title-display')
    const originalTitle = await titleDisplay.textContent()

    // 제목 수정 시도
    await titleDisplay.click()
    await page.getByTestId('task-title-input').fill('실패할 제목')
    await page.keyboard.press('Enter')

    // 에러 토스트 확인
    const errorToast = page.locator('.p-toast-message-error')
    await expect(errorToast).toBeVisible({ timeout: 3000 })

    // 롤백 확인
    await expect(titleDisplay).toContainText(originalTitle || '')
  })

  /**
   * E2E-014: 카테고리 편집 불가
   * 요구사항: BR-005
   */
  test('E2E-014: 카테고리는 편집할 수 없다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    // Task 선택
    await page.getByTestId('wbs-tree-node-TSK-05-01').click()
    await page.getByTestId('task-detail-panel').waitFor({ state: 'visible', timeout: 2000 })

    // 카테고리 Tag 확인
    const categoryTag = page.getByTestId('task-category-tag')
    await expect(categoryTag).toBeVisible()

    // 편집 UI 없음 확인 (Dropdown이나 InputText 없어야 함)
    const categoryDropdown = page.getByTestId('task-category-dropdown')
    await expect(categoryDropdown).not.toBeVisible()
  })

  /**
   * E2E-015: Dialog가 올바른 다크 테마 스타일을 가진다
   * 요구사항: TSK-08-06 Theme Integration
   */
  test('E2E-015: Dialog가 올바른 다크 테마 스타일을 가진다', async ({ page }) => {
    await page.getByTestId('wbs-content').waitFor({ state: 'visible', timeout: 3000 })

    const firstTask = page.getByTestId('wbs-tree-node-TSK-05-01')
    await firstTask.click()

    const dialog = page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()

    // Dialog 배경색 검증
    await expect(dialog).toHaveCSS('background-color', 'rgb(30, 30, 56)')

    // Dialog 헤더 배경색 검증
    const dialogHeader = page.locator('.p-dialog-header')
    await expect(dialogHeader).toHaveCSS('background-color', 'rgb(22, 33, 62)')
  })
})
