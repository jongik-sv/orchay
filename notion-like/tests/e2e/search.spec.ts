import { test, expect } from '@playwright/test';

test.describe('검색 기능 (Cmd+K)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 메인 레이아웃이 로드될 때까지 대기
    await page.waitForSelector('[data-testid="main-layout"]', { timeout: 15000 });
    // 사이드바 로딩 완료 대기
    await page.waitForTimeout(1000);
  });

  test('UC-01: Cmd+K로 검색 모달이 열린다', async ({ page }) => {
    // 검색 모달이 처음에는 표시되지 않음
    await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible();

    // Ctrl+K 입력
    await page.keyboard.press('Control+k');

    // 검색 모달이 표시됨
    await expect(page.locator('[data-testid="search-modal"]')).toBeVisible();

    // 검색 입력창에 자동으로 포커스가 이동
    const searchInput = page.locator('[data-testid="search-input"]');
    await expect(searchInput).toBeFocused();

    await page.screenshot({ path: 'test-results/e2e/e2e-search-001-open-modal.png' });
  });

  test('UC-01: Search 버튼 클릭으로 검색 모달이 열린다', async ({ page }) => {
    // 사이드바의 Search 버튼 찾기
    const searchButton = page.getByRole('button', { name: /search/i });
    await searchButton.click();

    // 검색 모달이 표시됨
    await expect(page.locator('[data-testid="search-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-input"]')).toBeFocused();

    await page.screenshot({ path: 'test-results/e2e/e2e-search-002-open-via-button.png' });
  });

  test('UC-02: 검색 결과가 없을 때 메시지 표시', async ({ page }) => {
    // 검색 모달 열기
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-testid="search-modal"]')).toBeVisible();

    // 존재하지 않는 검색어 입력
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('xyz123nonexistent');

    // "검색 결과가 없습니다" 메시지 확인
    await expect(page.getByText('검색 결과가 없습니다')).toBeVisible();

    await page.screenshot({ path: 'test-results/e2e/e2e-search-003-no-results.png' });
  });

  test('Esc로 검색 모달 닫기', async ({ page }) => {
    // 검색 모달 열기
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-testid="search-modal"]')).toBeVisible();

    // Esc로 닫기
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible();

    await page.screenshot({ path: 'test-results/e2e/e2e-search-004-close-esc.png' });
  });

  test('외부 클릭으로 검색 모달 닫기', async ({ page }) => {
    // 검색 모달 열기
    await page.keyboard.press('Control+k');
    await expect(page.locator('[data-testid="search-modal"]')).toBeVisible();

    // 오버레이 클릭 (모달 외부)
    await page.locator('[data-testid="search-modal-overlay"]').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('[data-testid="search-modal"]')).not.toBeVisible();

    await page.screenshot({ path: 'test-results/e2e/e2e-search-005-close-overlay.png' });
  });

  test('검색어 입력 후 초기화 확인', async ({ page }) => {
    // 검색 모달 열기
    await page.keyboard.press('Control+k');
    const searchInput = page.locator('[data-testid="search-input"]');

    // 검색어 입력
    await searchInput.fill('test');
    await expect(searchInput).toHaveValue('test');

    // 모달 닫기
    await page.keyboard.press('Escape');

    // 다시 열면 검색어가 초기화되어 있어야 함
    await page.keyboard.press('Control+k');
    await expect(searchInput).toHaveValue('');

    await page.screenshot({ path: 'test-results/e2e/e2e-search-006-reset-on-reopen.png' });
  });
});
