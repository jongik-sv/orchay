import { test, expect } from '@playwright/test';

/**
 * TSK-03-02: 다크모드 지원 E2E 테스트
 *
 * 테스트 시나리오:
 * 1. 시스템 다크모드 설정에 따른 자동 테마 전환
 * 2. 다크모드 시 올바른 색상 적용 확인
 * 3. 테마 전환 시 콘텐츠 손실 없음 확인
 */

test.describe('다크모드 지원', () => {
  test.describe('시스템 다크모드 자동 감지', () => {
    test('다크모드 활성화 시 어두운 배경 표시', async ({ browser }) => {
      // 다크모드로 브라우저 컨텍스트 생성
      const context = await browser.newContext({
        colorScheme: 'dark'
      });
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // body 배경색 확인 (다크모드: #191919)
      const bodyBgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });

      // rgb(25, 25, 25) = #191919
      expect(bodyBgColor).toBe('rgb(25, 25, 25)');

      await context.close();
    });

    test('라이트모드 활성화 시 밝은 배경 표시', async ({ browser }) => {
      // 라이트모드로 브라우저 컨텍스트 생성
      const context = await browser.newContext({
        colorScheme: 'light'
      });
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // body 배경색 확인 (라이트모드: #ffffff)
      const bodyBgColor = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });

      // rgb(255, 255, 255) = #ffffff
      expect(bodyBgColor).toBe('rgb(255, 255, 255)');

      await context.close();
    });
  });

  test.describe('사이드바 다크모드 스타일', () => {
    test('다크모드에서 사이드바 배경색 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'dark'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // 사이드바 요소 확인
      const sidebar = page.locator('[data-testid="sidebar"]');
      if (await sidebar.count() > 0) {
        const sidebarBgColor = await sidebar.evaluate((el) => {
          return getComputedStyle(el).backgroundColor;
        });

        // rgb(42, 42, 42) = #2a2a2a (다크모드 secondary)
        expect(sidebarBgColor).toBe('rgb(42, 42, 42)');
      }

      await context.close();
    });

    test('라이트모드에서 사이드바 배경색 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'light'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // 사이드바 요소 확인
      const sidebar = page.locator('[data-testid="sidebar"]');
      if (await sidebar.count() > 0) {
        const sidebarBgColor = await sidebar.evaluate((el) => {
          return getComputedStyle(el).backgroundColor;
        });

        // rgb(247, 246, 243) = #f7f6f3 (라이트모드 secondary)
        expect(sidebarBgColor).toBe('rgb(247, 246, 243)');
      }

      await context.close();
    });
  });

  test.describe('텍스트 색상 대비', () => {
    test('다크모드에서 텍스트 가독성 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'dark'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // body 텍스트 색상 확인 (다크모드: #e6e6e4)
      const textColor = await page.evaluate(() => {
        return getComputedStyle(document.body).color;
      });

      // rgb(230, 230, 228) = #e6e6e4
      expect(textColor).toBe('rgb(230, 230, 228)');

      await context.close();
    });

    test('라이트모드에서 텍스트 가독성 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'light'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // body 텍스트 색상 확인 (라이트모드: #37352f)
      const textColor = await page.evaluate(() => {
        return getComputedStyle(document.body).color;
      });

      // rgb(55, 53, 47) = #37352f
      expect(textColor).toBe('rgb(55, 53, 47)');

      await context.close();
    });
  });

  test.describe('CSS 변수 적용 확인', () => {
    test('다크모드 CSS 변수 정의 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'dark'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // CSS 변수 값 확인
      const cssVariables = await page.evaluate(() => {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        return {
          bgPrimary: style.getPropertyValue('--notion-bg-primary').trim(),
          bgSecondary: style.getPropertyValue('--notion-bg-secondary').trim(),
          textPrimary: style.getPropertyValue('--notion-text-primary').trim(),
          borderLight: style.getPropertyValue('--notion-border-light').trim()
        };
      });

      expect(cssVariables.bgPrimary).toBe('#191919');
      expect(cssVariables.bgSecondary).toBe('#2a2a2a');
      expect(cssVariables.textPrimary).toBe('#e6e6e4');
      expect(cssVariables.borderLight).toBe('#3d3d3a');

      await context.close();
    });

    test('라이트모드 CSS 변수 정의 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'light'
      });
      const page = await context.newPage();

      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // CSS 변수 값 확인
      const cssVariables = await page.evaluate(() => {
        const root = document.documentElement;
        const style = getComputedStyle(root);
        return {
          bgPrimary: style.getPropertyValue('--notion-bg-primary').trim(),
          bgSecondary: style.getPropertyValue('--notion-bg-secondary').trim(),
          textPrimary: style.getPropertyValue('--notion-text-primary').trim(),
          borderLight: style.getPropertyValue('--notion-border-light').trim()
        };
      });

      expect(cssVariables.bgPrimary).toBe('#ffffff');
      expect(cssVariables.bgSecondary).toBe('#f7f6f3');
      expect(cssVariables.textPrimary).toBe('#37352f');
      expect(cssVariables.borderLight).toBe('#e9e9e7');

      await context.close();
    });
  });

  test.describe('색상 전환 트랜지션', () => {
    test('전환 스타일 정의 확인', async ({ page }) => {
      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // body의 transition 스타일 확인
      const hasTransition = await page.evaluate(() => {
        const body = document.body;
        const transition = getComputedStyle(body).transition;
        return transition.includes('background-color') || transition.includes('color');
      });

      // 전환 효과가 정의되어 있는지 확인
      expect(hasTransition).toBe(true);
    });
  });

  test.describe('컴포넌트별 다크모드 적용', () => {
    test('페이지 헤더 다크모드 스타일 확인', async ({ browser }) => {
      const context = await browser.newContext({
        colorScheme: 'dark'
      });
      const page = await context.newPage();

      // 기존 페이지로 이동
      await page.goto('/wbs');
      await page.waitForLoadState('networkidle');

      // 페이지 헤더가 존재하는 경우 스타일 확인
      const pageHeader = page.locator('[data-testid="page-header"]');
      if (await pageHeader.count() > 0) {
        const headerBgColor = await pageHeader.evaluate((el) => {
          return getComputedStyle(el).backgroundColor;
        });

        // rgb(25, 25, 25) = #191919 (다크모드 primary)
        expect(headerBgColor).toBe('rgb(25, 25, 25)');
      }

      await context.close();
    });
  });
});
