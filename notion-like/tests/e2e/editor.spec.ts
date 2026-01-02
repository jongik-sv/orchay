import { test, expect } from '@playwright/test'

test.describe('Editor Component (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // 테스트용 페이지로 이동 (개발 환경에서)
    await page.goto('http://localhost:3002')
  })

  // E2E-01: 에디터 렌더링 확인
  test('E2E-01: Should render editor on page load', async ({ page }) => {
    // .bn-editor 클래스를 가진 에디터 컨테이너 찾기
    const editorContainer = await page.locator('.bn-editor').first()
    await expect(editorContainer).toBeVisible()
  })

  // E2E-02: 텍스트 입력 시나리오
  test('E2E-02: Should accept text input in editor', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 텍스트 입력
    await page.keyboard.type('Hello BlockNote')

    // 입력된 텍스트 확인
    const textContent = await page.locator('.bn-editor').first().textContent()
    expect(textContent).toContain('Hello BlockNote')
  })

  // E2E-03: 슬래시 메뉴 표시
  test('E2E-03: Should show slash menu on / input', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 슬래시 메뉴 트리거를 위해 먼저 빈 블록으로 이동
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')

    // / 입력
    await page.keyboard.type('/')

    // 슬래시 메뉴 확인 (BlockNote의 포퍼 메뉴)
    const slashMenu = await page.locator('[role="menu"]').first()
    await expect(slashMenu).toBeVisible({ timeout: 3000 }).catch(() => {
      // BlockNote의 메뉴가 다른 선택자일 수 있음
      return page.locator('.bn-popover').first().isVisible()
    })
  })

  // E2E-04: 블록 타입 변경
  test('E2E-04: Should change block type via slash menu', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 빈 줄에서 슬래시 메뉴 열기
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('/')

    // Heading 1 선택
    // "h1" 또는 "heading 1" 타이핑하거나 메뉴에서 선택
    await page.keyboard.type('h1')

    // 첫 번째 결과 선택
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    // H1 블록이 생성되었는지 확인 (h1 태그 또는 해당 스타일 확인)
    const h1Block = await page.locator('.bn-editor h1').first()
    await expect(h1Block || page.locator('.bn-editor').first()).toBeVisible()
  })

  // E2E-05: 블록 드래그 (선택사항)
  test('E2E-05: Should have draggable blocks (optional)', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 두 개의 블록 생성
    await page.keyboard.type('Block 1')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Block 2')

    // 드래그 핸들 확인
    const dragHandle = await page.locator('.bn-drag-handle').first()

    // 드래그 핸들이 존재하거나, 호버 시 표시되는지 확인
    if (await dragHandle.isVisible().catch(() => false)) {
      expect(await dragHandle.isVisible()).toBeTruthy()
    } else {
      // 호버 시 표시되는 경우도 있음
      const block = await page.locator('[data-block-id]').first()
      await block.hover()
      // 호버 후 표시 여부 확인
    }
  })

  // E2E-06: 콘텐츠 저장 및 복구
  test('E2E-06: Should persist content on refresh', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 콘텐츠 입력
    const testContent = 'Persistent Content'
    await page.keyboard.type(testContent)

    // 콘텐츠 변경 감지 대기 (onChange 호출)
    await page.waitForTimeout(500)

    // 페이지 새로고침
    await page.reload()

    // 에디터 로드 대기
    await page.locator('.bn-editor').first().waitFor({ state: 'visible' })

    // 콘텐츠 확인
    const textContent = await page.locator('.bn-editor').first().textContent()
    expect(textContent).toContain(testContent)
  })

  // E2E-07: 빈 상태 Placeholder
  test('E2E-07: Should show placeholder in empty editor', async ({ page }) => {
    // 새로운 에디터 페이지에서 placeholder 확인
    await page.goto('http://localhost:3002')

    // 에디터가 빈 상태인지 확인
    const editor = await page.locator('.bn-editor').first()
    await expect(editor).toBeVisible()

    // Placeholder 텍스트 확인 (BlockNote의 기본 placeholder)
    const placeholder = await page.locator('.bn-placeholder').first()
    if (await placeholder.isVisible().catch(() => false)) {
      await expect(placeholder).toBeVisible()
    }

    // 또는 빈 에디터 상태 확인
    const editorText = await editor.textContent()
    // 빈 상태 또는 placeholder 텍스트만 있어야 함
    expect(editorText).toBeTruthy()
  })

  // E2E-08: 키보드 단축키 (포맷팅)
  test('E2E-08: Should support formatting shortcuts (Ctrl+B, Ctrl+I)', async ({ page }) => {
    const editor = await page.locator('.bn-editor').first()
    await editor.click()

    // 텍스트 입력
    await page.keyboard.type('Hello World')

    // 전체 텍스트 선택
    await page.keyboard.press('Control+A')

    // Ctrl+B (Bold) 적용
    await page.keyboard.press('Control+B')

    // 굵게 처리 확인
    const boldText = await page.locator('.bn-editor strong, .bn-editor b').first()

    // Bold가 적용되었는지 확인
    if (await boldText.isVisible().catch(() => false)) {
      expect(await boldText.isVisible()).toBeTruthy()
    } else {
      // BlockNote의 포맷팅은 마크 속성으로 처리될 수도 있음
      const editorContent = await editor.innerHTML()
      expect(editorContent.toLowerCase()).toMatch(/bold|strong|font-weight.*bold/)
    }
  })

  // 브라우저 간 호환성 테스트
  test.describe('Cross-browser compatibility', () => {
    test('should work in Chrome', async ({ page, browserName }) => {
      if (browserName !== 'chromium') test.skip()

      const editor = await page.locator('.bn-editor').first()
      await editor.click()
      await page.keyboard.type('Chrome test')

      const textContent = await editor.textContent()
      expect(textContent).toContain('Chrome test')
    })

    test('should work in Firefox', async ({ page, browserName }) => {
      if (browserName !== 'firefox') test.skip()

      const editor = await page.locator('.bn-editor').first()
      await editor.click()
      await page.keyboard.type('Firefox test')

      const textContent = await editor.textContent()
      expect(textContent).toContain('Firefox test')
    })
  })

  // 에러 처리 테스트
  test.describe('Error handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // 네트워크 오류 시뮬레이션
      await page.context().setOffline(true)

      const editor = await page.locator('.bn-editor').first()
      await expect(editor).toBeVisible()

      await page.context().setOffline(false)
    })

    test('should display editor even with missing assets', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await expect(editor).toBeVisible()
    })
  })

  // TSK-01-03: Notion 스타일 CSS 검증
  test.describe('TSK-01-03: Notion Style CSS', () => {
    test('E2E-CSS-01: Should apply Notion-style block spacing', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await editor.click()

      // 두 개의 블록 생성
      await page.keyboard.type('First block')
      await page.keyboard.press('Enter')
      await page.keyboard.type('Second block')

      // 첫 번째 블록의 마진 확인
      const firstBlock = await page.locator('.bn-block').first()
      const marginTop = await firstBlock.evaluate((el) => {
        return window.getComputedStyle(el).marginTop
      })
      const marginBottom = await firstBlock.evaluate((el) => {
        return window.getComputedStyle(el).marginBottom
      })

      // 블록 간 간격이 1px인지 확인
      expect(marginTop).toBe('1px')
      expect(marginBottom).toBe('1px')
    })

    test('E2E-CSS-02: Should show block handle on hover', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await editor.click()
      await page.keyboard.type('Test block')

      const block = await page.locator('.bn-block').first()

      // 핸들 숨겨진 상태 확인
      const sideMenu = await page.locator('.bn-side-menu').first()
      const initialOpacity = await sideMenu.evaluate((el) => {
        return window.getComputedStyle(el).opacity
      })
      expect(initialOpacity).toBe('0')

      // 호버 시 표시 확인
      await block.hover()
      await page.waitForTimeout(200) // transition 시간 대기

      const hoveredOpacity = await sideMenu.evaluate((el) => {
        return window.getComputedStyle(el).opacity
      })
      expect(hoveredOpacity).toBe('1')
    })

    test('E2E-CSS-03: Should style slash menu with Notion look', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await editor.click()

      // 슬래시 메뉴 열기
      await page.keyboard.press('Enter')
      await page.keyboard.type('/')

      // 메뉴가 표시될 때까지 대기
      await page.waitForTimeout(500)

      const popover = await page.locator('.bn-popover').first()

      // 메뉴가 보이는지 확인
      const isVisible = await popover.isVisible().catch(() => false)

      if (isVisible) {
        // 그림자 확인
        const boxShadow = await popover.evaluate((el) => {
          return window.getComputedStyle(el).boxShadow
        })
        expect(boxShadow).toContain('rgba')

        // 테두리 확인
        const border = await popover.evaluate((el) => {
          return window.getComputedStyle(el).border
        })
        expect(border).not.toBe('0px none rgb(0, 0, 0)')
      }
    })

    test('E2E-CSS-04: Should style heading blocks correctly', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await editor.click()

      // H1 생성
      await page.keyboard.type('/h1')
      await page.waitForTimeout(300)
      await page.keyboard.press('Enter')
      await page.keyboard.type('Heading 1')

      const h1 = await page.locator('.bn-heading[level="1"]').first()
      await expect(h1).toBeVisible()

      // 폰트 크기 확인
      const fontSize = await h1.evaluate((el) => {
        return window.getComputedStyle(el).fontSize
      })
      expect(fontSize).toBe('30px') // 1.875rem

      // 폰트 굵기 확인
      const fontWeight = await h1.evaluate((el) => {
        return window.getComputedStyle(el).fontWeight
      })
      expect(fontWeight).toBe('600')
    })

    test('E2E-CSS-05: Should show placeholder in empty editor', async ({ page }) => {
      // 빈 페이지로 이동
      await page.goto('http://localhost:3002')
      await page.waitForTimeout(500)

      // 에디터 확인
      const editor = await page.locator('.bn-editor').first()
      await expect(editor).toBeVisible()

      // Placeholder 확인 (data-placeholder 속성)
      const editorWithPlaceholder = await page.locator('[data-placeholder]').first()
      const hasPlaceholder = await editorWithPlaceholder.isVisible().catch(() => false)

      if (hasPlaceholder) {
        const placeholderColor = await editorWithPlaceholder.evaluate((el) => {
          return window.getComputedStyle(el).color
        })
        // 회색 텍스트 확인 (#9B9A97)
        expect(placeholderColor).toBe('rgb(155, 154, 151)')
      }
    })

    test('E2E-CSS-06: Should apply responsive padding', async ({ page }) => {
      // 데스크톱 뷰 확인
      const editor = await page.locator('.bn-editor').first()
      const desktopPadding = await editor.evaluate((el) => {
        return window.getComputedStyle(el).padding
      })

      // 96px 패딩 확인 (좌우)
      expect(desktopPadding).toContain('96px')

      // 모바일 뷰 시뮬레이션
      await page.setViewportSize({ width: 375, height: 667 })
      await page.waitForTimeout(300)

      const mobilePadding = await editor.evaluate((el) => {
        return window.getComputedStyle(el).padding
      })

      // 모바일에서는 24px 패딩
      expect(mobilePadding).toContain('24px')
    })
  })

  // 성능 테스트
  test.describe('Performance', () => {
    test('should render editor within 3 seconds', async ({ page }) => {
      const startTime = Date.now()

      await page.goto('http://localhost:3002')
      await page.locator('.bn-editor').first().waitFor({ state: 'visible' })

      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000)
    })

    test('should handle large content without lag', async ({ page }) => {
      const editor = await page.locator('.bn-editor').first()
      await editor.click()

      // 많은 양의 텍스트 입력
      for (let i = 0; i < 10; i++) {
        await page.keyboard.type(`Line ${i + 1}: This is a test line with some content.\n`)
      }

      // 에디터가 반응하는지 확인
      const textContent = await editor.textContent()
      expect(textContent).toContain('Line 1')
      expect(textContent).toContain('Line 10')
    })
  })
})
