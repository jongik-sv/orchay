import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_TIMEOUTS, VALID_ARIA_ROLES } from './constants';

/**
 * 페이지 로드 및 안정화 대기
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: TEST_TIMEOUTS.PAGE_READY });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * WBS 데이터 로딩 완료 대기 (안정성 강화 버전)
 */
export async function waitForWbsLoaded(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = TEST_TIMEOUTS.WBS_LOAD } = options;

  try {
    // 1. 로딩 스피너 사라질 때까지 대기
    await page.waitForSelector('[data-testid="wbs-loading"]', {
      state: 'hidden',
      timeout
    }).catch(() => {
      // 로딩 스피너가 없을 수도 있음 (이미 로딩 완료)
    });

    // 2. API 응답 완료 대기
    await page.waitForResponse(
      (response) => response.url().includes('/api/projects/') &&
                    response.url().includes('/wbs') &&
                    response.status() < 400,
      { timeout: timeout / 2 }
    ).catch(() => {
      // API가 이미 완료되었을 수 있음
    });

    // 3. 트리 콘텐츠 또는 에러/빈 상태 표시 대기
    await Promise.race([
      page.waitForSelector('[data-testid="wbs-tree-content"]', {
        state: 'visible',
        timeout
      }),
      page.waitForSelector('[data-testid="wbs-error"]', {
        state: 'visible',
        timeout
      }),
      page.waitForSelector('[data-testid="wbs-empty"]', {
        state: 'visible',
        timeout
      })
    ]);

    // 4. 렌더링 안정화 대기 (애니메이션)
    await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);
  } catch (error) {
    console.error('waitForWbsLoaded failed:', error);
    throw error;
  }
}

/**
 * API 응답 모킹
 */
export async function mockWbsApi(
  page: Page,
  response: any,
  status: number = 200
): Promise<void> {
  await page.route('**/api/projects/*/wbs', async route => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(response)
    });
  });
}

/**
 * API 오류 모킹
 */
export async function mockWbsApiError(
  page: Page,
  statusCode: number = 500,
  message: string = 'Internal Server Error'
): Promise<void> {
  await page.route('**/api/projects/*/wbs', async route => {
    await route.fulfill({
      status: statusCode,
      contentType: 'application/json',
      body: JSON.stringify({ error: message })
    });
  });
}

/**
 * 접근성 검증 (강화된 ARIA 체크)
 */
export async function checkAccessibility(page: Page): Promise<void> {
  // 1. ARIA role 존재 여부 확인
  await checkAriaRoles(page);

  // 2. 버튼 레이블 엄격 검증
  await checkButtonLabels(page);

  // 3. 폼 요소 레이블 검증
  await checkInputLabels(page);

  // 4. 포커스 가능 요소 존재 확인
  await checkFocusableElements(page);
}

/**
 * ARIA role 유효성 검증
 */
async function checkAriaRoles(page: Page): Promise<void> {
  const elementsWithRole = await page.locator('[role]').all();

  // role 속성이 있는 요소가 최소 1개 이상 존재해야 함
  expect(elementsWithRole.length).toBeGreaterThan(0);

  // 유효하지 않은 role 검증
  for (const element of elementsWithRole) {
    const role = await element.getAttribute('role');
    if (role) {
      const isValidRole = VALID_ARIA_ROLES.includes(role as any);
      expect(isValidRole, `Invalid ARIA role: ${role}`).toBe(true);
    }
  }
}

/**
 * 버튼 레이블 엄격 검증
 */
async function checkButtonLabels(page: Page): Promise<void> {
  const buttons = await page.locator('button').all();

  for (const button of buttons) {
    const hasValidLabel = await button.evaluate((el) => {
      const ariaLabel = el.getAttribute('aria-label');
      const textContent = el.textContent?.trim();
      const ariaLabelledBy = el.getAttribute('aria-labelledby');

      // aria-label이 존재하고 비어있지 않음
      if (ariaLabel && ariaLabel.trim().length > 0) {
        return true;
      }

      // aria-labelledby가 존재하고 참조하는 요소가 있음
      if (ariaLabelledBy) {
        const labelElement = document.getElementById(ariaLabelledBy);
        if (labelElement && labelElement.textContent?.trim().length) {
          return true;
        }
      }

      // textContent가 존재하고 의미있는 값임
      if (textContent && textContent.length > 0) {
        return true;
      }

      // 아이콘 버튼의 경우 title 속성 확인
      if (el.hasAttribute('title') && el.getAttribute('title')?.trim().length) {
        return true;
      }

      return false;
    });

    expect(hasValidLabel, 'Button must have accessible label').toBe(true);
  }
}

/**
 * 입력 요소 레이블 검증
 */
async function checkInputLabels(page: Page): Promise<void> {
  const inputs = await page.locator('input[type="text"], input[type="search"], input[type="email"], input[type="password"], textarea').all();

  for (const input of inputs) {
    const hasValidLabel = await input.evaluate((el) => {
      const id = el.id;
      const ariaLabel = el.getAttribute('aria-label');
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      const placeholder = el.getAttribute('placeholder');

      // aria-label이 존재하고 비어있지 않음
      if (ariaLabel && ariaLabel.trim().length > 0) {
        return true;
      }

      // aria-labelledby가 존재하고 참조하는 요소가 있음
      if (ariaLabelledBy) {
        const labelElement = document.getElementById(ariaLabelledBy);
        if (labelElement && labelElement.textContent?.trim().length) {
          return true;
        }
      }

      // 연결된 label 요소가 존재
      if (id) {
        const labelElement = document.querySelector(`label[for="${id}"]`);
        if (labelElement && labelElement.textContent?.trim().length) {
          return true;
        }
      }

      // placeholder가 존재 (차선책)
      if (placeholder && placeholder.trim().length > 0) {
        return true;
      }

      return false;
    });

    expect(hasValidLabel, 'Input must have accessible label').toBe(true);
  }
}

/**
 * 포커스 가능 요소 존재 확인
 */
async function checkFocusableElements(page: Page): Promise<void> {
  const focusableSelector = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusableElements = await page.locator(focusableSelector).all();

  expect(focusableElements.length, 'Page should have focusable elements').toBeGreaterThan(0);
}

/**
 * 키보드 네비게이션 테스트
 */
export async function testKeyboardNavigation(
  page: Page,
  startSelector: string,
  targetSelector: string
): Promise<void> {
  await page.locator(startSelector).focus();
  await page.keyboard.press('Tab');

  // 포커스 확인 (약간의 대기 후)
  await page.waitForTimeout(TEST_TIMEOUTS.RENDER_STABILIZATION);

  const focused = await page.locator(targetSelector).evaluate(
    el => el === document.activeElement
  );
  expect(focused).toBe(true);
}
