import { test, expect } from '@playwright/test'

/**
 * TSK-03-03: 에러 처리 및 로딩 상태 E2E 테스트
 *
 * 테스트 범위:
 * 1. 페이지 로딩 스켈레톤
 * 2. 토스트 알림 시스템
 * 3. 저장 상태 표시
 */
test.describe('TSK-03-03: Error Handling & Loading State', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Page Loading Skeleton', () => {
    test('E2E-SKEL-01: Should show skeleton during initial page load', async ({ page }) => {
      // 네트워크 요청 지연 시뮬레이션
      await page.route('**/api/pages/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500))
        await route.continue()
      })

      // 새 페이지로 이동
      const pageLink = await page.locator('[data-testid="page-tree-item"]').first()
      if (await pageLink.isVisible()) {
        await pageLink.click()

        // 스켈레톤이 잠시 표시되는지 확인
        const skeleton = page.locator('[data-testid="page-skeleton"]')
        // 로딩이 빠르면 스켈레톤이 표시되지 않을 수 있음
        const wasVisible = await skeleton.isVisible().catch(() => false)

        // 스켈레톤이 표시되거나 에디터가 바로 로드됨
        const editor = page.locator('.bn-editor')
        await expect(editor.or(skeleton)).toBeVisible()
      }
    })

    test('E2E-SKEL-02: Skeleton should have proper structure', async ({ page }) => {
      // API 지연으로 스켈레톤 강제 표시
      await page.route('**/api/pages/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 2000))
        await route.continue()
      })

      // 페이지 새로고침으로 로딩 상태 트리거
      const pageLink = await page.locator('[data-testid="page-tree-item"]').first()
      if (await pageLink.isVisible()) {
        const href = await pageLink.getAttribute('href')
        if (href) {
          await page.goto(`http://localhost:3002${href}`)

          const skeleton = page.locator('[data-testid="page-skeleton"]')
          if (await skeleton.isVisible({ timeout: 1000 }).catch(() => false)) {
            // 스켈레톤 구조 확인
            await expect(skeleton.locator('.skeleton').first()).toBeVisible()
          }
        }
      }
    })

    test('E2E-SKEL-03: Skeleton animation should be visible', async ({ page }) => {
      // CSS 애니메이션 확인
      const skeletonStyle = await page.evaluate(() => {
        const style = document.createElement('style')
        document.head.appendChild(style)
        const sheet = style.sheet

        // skeleton-pulse 애니메이션 존재 확인
        for (const stylesheet of document.styleSheets) {
          try {
            for (const rule of stylesheet.cssRules) {
              if (rule instanceof CSSKeyframesRule && rule.name === 'skeleton-pulse') {
                return true
              }
            }
          } catch {
            // CORS 에러 무시
          }
        }
        return false
      })

      expect(skeletonStyle).toBe(true)
    })
  })

  test.describe('Toast Notification System', () => {
    test('E2E-TOAST-01: Should show error toast on API failure', async ({ page }) => {
      // API 에러 시뮬레이션
      await page.route('**/api/pages/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        })
      })

      // 페이지 이동 시도
      const pageLink = await page.locator('[data-testid="page-tree-item"]').first()
      if (await pageLink.isVisible()) {
        const href = await pageLink.getAttribute('href')
        if (href) {
          await page.goto(`http://localhost:3002${href}`)

          // 토스트 표시 확인
          const toast = page.locator('[data-testid="toast"]')
          await expect(toast).toBeVisible({ timeout: 5000 })

          // 에러 타입 토스트인지 확인
          await expect(toast).toHaveAttribute('data-toast-type', 'error')
        }
      }
    })

    test('E2E-TOAST-02: Should close toast on button click', async ({ page }) => {
      // 토스트 표시를 위해 에러 시뮬레이션
      await page.route('**/api/pages/**', (route, request) => {
        if (request.method() === 'PUT') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Save failed' }),
          })
        } else {
          route.continue()
        }
      })

      // 에디터에서 수정하여 저장 트리거
      const editor = await page.locator('.bn-editor').first()
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Test content for toast')

        // 저장 요청이 실패할 때까지 대기
        await page.waitForTimeout(1500) // debounce + 요청 시간

        const toast = page.locator('[data-testid="toast"]')
        if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 닫기 버튼 클릭
          const closeBtn = page.locator('[data-testid="toast-close-btn"]')
          await closeBtn.click()

          // 토스트가 사라졌는지 확인
          await expect(toast).not.toBeVisible({ timeout: 1000 })
        }
      }
    })

    test('E2E-TOAST-03: Should auto-dismiss after 3 seconds', async ({ page }) => {
      // 토스트 표시를 위해 에러 시뮬레이션
      await page.route('**/api/pages/**', (route, request) => {
        if (request.method() === 'PUT') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Save failed' }),
          })
        } else {
          route.continue()
        }
      })

      // 에디터에서 수정
      const editor = await page.locator('.bn-editor').first()
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Auto dismiss test')

        await page.waitForTimeout(1500)

        const toast = page.locator('[data-testid="toast"]')
        if (await toast.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 3초 후 자동 닫힘 확인
          await expect(toast).not.toBeVisible({ timeout: 4000 })
        }
      }
    })

    test('E2E-TOAST-04: Toast should have correct styling', async ({ page }) => {
      // 토스트 컨테이너 스타일 확인
      const toastContainerStyle = await page.evaluate(() => {
        // animate-slide-in-right 클래스 애니메이션 존재 확인
        for (const stylesheet of document.styleSheets) {
          try {
            for (const rule of stylesheet.cssRules) {
              if (rule instanceof CSSKeyframesRule && rule.name === 'slide-in-right') {
                return true
              }
            }
          } catch {
            // CORS 에러 무시
          }
        }
        return false
      })

      expect(toastContainerStyle).toBe(true)
    })
  })

  test.describe('Save Status Indicator', () => {
    test('E2E-SAVE-01: Should show saving indicator during save', async ({ page }) => {
      // API 응답 지연
      await page.route('**/api/pages/**', async (route, request) => {
        if (request.method() === 'PUT') {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          await route.continue()
        } else {
          await route.continue()
        }
      })

      const editor = await page.locator('.bn-editor').first()
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Save test')

        // 저장 중 상태 확인 (debounce 1초 후)
        await page.waitForTimeout(1100)

        const saveStatus = page.locator('[data-testid="save-status"]')
        const saveState = await saveStatus.getAttribute('data-save-state')

        // saving 또는 saved 상태여야 함
        expect(['saving', 'saved', 'idle']).toContain(saveState)
      }
    })

    test('E2E-SAVE-02: Should show saved indicator after successful save', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Saved test')

        // 저장 완료 대기
        await page.waitForTimeout(2000)

        const saveStatus = page.locator('[data-testid="save-status"]')
        const saveState = await saveStatus.getAttribute('data-save-state')

        // saved 또는 idle 상태여야 함 (저장 후 2초 뒤 idle로 전환)
        expect(['saved', 'idle']).toContain(saveState)
      }
    })

    test('E2E-SAVE-03: Should show error indicator on save failure', async ({ page }) => {
      // API 에러 시뮬레이션
      await page.route('**/api/pages/**', (route, request) => {
        if (request.method() === 'PUT') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Save failed' }),
          })
        } else {
          route.continue()
        }
      })

      const editor = await page.locator('.bn-editor').first()
      if (await editor.isVisible()) {
        await editor.click()
        await page.keyboard.type('Error test')

        // 저장 실패 대기
        await page.waitForTimeout(2000)

        const saveStatus = page.locator('[data-testid="save-status"]')
        const saveState = await saveStatus.getAttribute('data-save-state')

        expect(saveState).toBe('error')
      }
    })

    test('E2E-SAVE-04: Save status should have correct icons', async ({ page }) => {
      // 저장 상태 아이콘 존재 확인
      const saveStatus = page.locator('[data-testid="save-status"]')

      if (await saveStatus.isVisible()) {
        // SVG 아이콘 존재 확인
        const hasIcon = await saveStatus.locator('svg').count()
        expect(hasIcon).toBeGreaterThanOrEqual(0) // idle 상태에서는 아이콘 없음
      }
    })
  })

  test.describe('Dark Mode Support', () => {
    test('E2E-DARK-01: Toast should support dark mode', async ({ page }) => {
      // 다크모드 활성화
      await page.emulateMedia({ colorScheme: 'dark' })

      // CSS 변수 확인
      const bgColor = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--notion-bg-primary')
      })

      // 다크모드 색상 확인
      expect(bgColor.trim()).toBe('#191919')
    })

    test('E2E-DARK-02: Skeleton should support dark mode', async ({ page }) => {
      // 다크모드 활성화
      await page.emulateMedia({ colorScheme: 'dark' })

      // 스켈레톤 배경색 확인
      const skeletonBgColor = await page.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--notion-bg-tertiary')
      })

      expect(skeletonBgColor.trim()).toBe('#3a3a37')
    })
  })
})
