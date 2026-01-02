import { test, expect } from '@playwright/test';

test.describe('PageHeader Component (E2E)', () => {
  test.beforeEach(async ({ page }) => {
    // 기존 페이지로 이동 (playwright.config.ts의 baseURL 사용)
    await page.goto('/');
    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');
  });

  // E2E-001: 페이지 헤더 표시
  test('E2E-001: Should display page header with icon and title', async ({ page }) => {
    // 페이지 헤더 확인
    const pageHeader = page.locator('[data-testid="page-header"]');
    await expect(pageHeader).toBeVisible({ timeout: 10000 });

    // 페이지 아이콘 확인
    const pageIcon = page.locator('[data-testid="page-icon"]');
    await expect(pageIcon).toBeVisible();

    // 페이지 제목 입력 확인
    const pageTitleInput = page.locator('[data-testid="page-title-input"]');
    await expect(pageTitleInput).toBeVisible();
  });

  // E2E-002: 아이콘 변경
  test('E2E-002: Should change icon when emoji selected', async ({ page }) => {
    // 아이콘 변경 버튼 찾기
    const iconChangeButton = page.locator('[data-testid="icon-change-button"]');

    // 버튼 호버하여 표시되게 함
    const pageIcon = page.locator('[data-testid="page-icon"]');
    await pageIcon.hover();

    // 버튼 클릭
    await iconChangeButton.click({ force: true });

    // IconPicker 표시 확인
    const iconPicker = page.locator('[data-testid="icon-picker"]');
    await expect(iconPicker).toBeVisible({ timeout: 5000 });

    // 첫 번째 이모지 버튼 클릭
    const emojiButton = page.locator('[data-testid^="emoji-button-"]').first();
    const selectedEmoji = await emojiButton.textContent();
    await emojiButton.click();

    // IconPicker가 닫힘
    await expect(iconPicker).not.toBeVisible({ timeout: 3000 });

    // 아이콘이 변경되었는지 확인
    const newIcon = await pageIcon.textContent();
    expect(newIcon).toBe(selectedEmoji);
  });

  // E2E-003: 제목 편집
  test('E2E-003: Should edit title and save on blur', async ({ page }) => {
    const pageTitleInput = page.locator('[data-testid="page-title-input"]');

    // 현재 제목 가져오기
    const originalTitle = await pageTitleInput.inputValue();

    // 제목 클릭하고 새로운 제목 입력
    await pageTitleInput.click();
    await pageTitleInput.fill('E2E Test Title');

    // blur 트리거 (다른 요소 클릭)
    await page.locator('[data-testid="page-icon"]').click();

    // 잠시 대기 (API 호출)
    await page.waitForTimeout(1500);

    // 새로고침 후에도 제목 유지 확인
    await page.reload();
    await page.waitForLoadState('networkidle');

    const savedTitle = await page.locator('[data-testid="page-title-input"]').inputValue();
    expect(savedTitle).toBe('E2E Test Title');

    // 원래 제목으로 복원
    await page.locator('[data-testid="page-title-input"]').fill(originalTitle || 'Untitled');
    await page.locator('[data-testid="page-icon"]').click();
    await page.waitForTimeout(1000);
  });

  // E2E-004: 커버 이미지 표시 (커버가 있는 경우)
  test('E2E-004: Should display cover image when available', async ({ page }) => {
    // 참고: 커버 이미지가 있는 페이지가 있어야 테스트 가능
    // 여기서는 커버 이미지가 없는 경우도 처리

    const coverImage = page.locator('[data-testid="page-cover-image"]');

    // 커버 이미지 존재 여부 확인
    const hasCover = await coverImage.isVisible().catch(() => false);

    if (hasCover) {
      // 커버 이미지가 있으면 속성 확인
      await expect(coverImage).toHaveClass(/object-cover/);
      const src = await coverImage.getAttribute('src');
      expect(src).toBeTruthy();
    } else {
      // 커버가 없으면 요소가 없어야 함
      await expect(coverImage).not.toBeVisible();
    }
  });

  // 페이지 헤더 Placeholder 테스트
  test('Should show Untitled placeholder for empty title', async ({ page }) => {
    const pageTitleInput = page.locator('[data-testid="page-title-input"]');

    // placeholder 속성 확인
    await expect(pageTitleInput).toHaveAttribute('placeholder', 'Untitled');
  });

  // 반응형 레이아웃 테스트
  test('Should apply responsive padding', async ({ page }) => {
    const pageHeader = page.locator('[data-testid="page-header"]');
    await expect(pageHeader).toBeVisible();

    // 데스크톱에서 px-[96px] 클래스 확인
    const iconTitleArea = page.locator('.px-\\[96px\\]');
    await expect(iconTitleArea).toBeVisible();

    // 모바일 뷰포트로 변경
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(300);

    // 페이지 헤더가 여전히 보이는지 확인
    await expect(pageHeader).toBeVisible();
  });

  // 아이콘 변경 버튼 접근성 테스트
  test('Icon change button should have proper accessibility', async ({ page }) => {
    const iconChangeButton = page.locator('[data-testid="icon-change-button"]');

    // aria-label 확인
    await expect(iconChangeButton).toHaveAttribute('aria-label', 'Change page icon');

    // title 확인
    await expect(iconChangeButton).toHaveAttribute('title', 'Change page icon');
  });

  // 즐겨찾기 버튼 테스트
  test('Should toggle favorite status', async ({ page }) => {
    const favoriteButton = page.locator('[data-testid="favorite-toggle-btn"]');
    await expect(favoriteButton).toBeVisible();

    // 현재 즐겨찾기 상태 확인
    const starIcon = favoriteButton.locator('svg');
    const isFavorite = await starIcon.evaluate((el) => {
      return el.classList.contains('fill-[#E9B44C]');
    });

    // 즐겨찾기 토글
    await favoriteButton.click();
    await page.waitForTimeout(1000);

    // 상태가 변경되었는지 확인
    const newIsFavorite = await starIcon.evaluate((el) => {
      return el.classList.contains('fill-[#E9B44C]');
    });

    expect(newIsFavorite).not.toBe(isFavorite);

    // 원래 상태로 복원
    await favoriteButton.click();
    await page.waitForTimeout(500);
  });

  // ESC 키로 IconPicker 닫기
  test('Should close IconPicker on ESC key', async ({ page }) => {
    const iconChangeButton = page.locator('[data-testid="icon-change-button"]');
    const pageIcon = page.locator('[data-testid="page-icon"]');

    await pageIcon.hover();
    await iconChangeButton.click({ force: true });

    const iconPicker = page.locator('[data-testid="icon-picker"]');
    await expect(iconPicker).toBeVisible({ timeout: 5000 });

    // ESC 키 누르기
    await page.keyboard.press('Escape');

    // IconPicker가 닫혀야 함
    await expect(iconPicker).not.toBeVisible({ timeout: 3000 });
  });
});
