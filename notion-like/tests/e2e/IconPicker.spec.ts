import { test, expect } from '@playwright/test';

test.describe('IconPicker Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test.describe('UC-01: IconPicker Display', () => {
    test('Should display IconPicker dropdown when icon area "change" button clicked', async ({
      page,
    }) => {
      // Check if PageHeader exists
      const pageHeader = page.locator('[data-testid="page-header"]');
      await expect(pageHeader).toBeVisible();

      // Click icon change button
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await expect(changeButton).toBeVisible({ timeout: 5000 });
      await changeButton.click();

      // Verify IconPicker dropdown is shown
      const iconPicker = page.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible();
    });

    test('Should show recent emojis section when dropdown opens', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const recentSection = page.locator('[data-testid="recent-emojis-section"]');
      await expect(recentSection).toBeVisible();
    });

    test('Should display emoji categories in grid', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      // Check for at least one category
      const categorySection = page.locator('[data-testid="emoji-category"]').first();
      await expect(categorySection).toBeVisible();

      // Verify grid items exist
      const emojiButtons = categorySection.locator('button[data-testid^="emoji-button-"]');
      const count = await emojiButtons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('UC-02: Emoji Selection', () => {
    test('Should update page icon when emoji is selected', async ({ page }) => {
      const pageIcon = page.locator('[data-testid="page-icon"]');
      const initialIcon = await pageIcon.textContent();

      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      // Select first emoji from recent or category
      const firstEmojiButton = page.locator('[data-testid^="emoji-button-"]').first();
      const selectedEmoji = await firstEmojiButton.textContent();

      await firstEmojiButton.click();

      // Verify icon changed
      await expect(pageIcon).toContainText(selectedEmoji || '');
      expect(await pageIcon.textContent()).not.toBe(initialIcon);
    });

    test('Should close IconPicker after emoji selection', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const iconPicker = page.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible();

      const firstEmojiButton = page.locator('[data-testid^="emoji-button-"]').first();
      await firstEmojiButton.click();

      // Verify dropdown closed
      await expect(iconPicker).not.toBeVisible();
    });

    test('Should add selected emoji to recent emojis', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      // Get first emoji from non-recent category
      const emojiButton = page
        .locator('[data-testid="emoji-category"]')
        .nth(1)
        .locator('[data-testid^="emoji-button-"]')
        .first();

      const selectedEmoji = await emojiButton.textContent();
      await emojiButton.click();

      // Wait and reopen
      await page.waitForTimeout(500);
      await changeButton.click();

      // Check if selected emoji appears in recent
      const recentEmojis = page.locator('[data-testid="recent-emojis-section"]');
      const recentContent = await recentEmojis.textContent();

      expect(recentContent?.includes(selectedEmoji || '')).toBe(true);
    });

    test('Should display emoji hover state', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const emojiButton = page.locator('[data-testid^="emoji-button-"]').first();

      // Hover and check for background change
      await emojiButton.hover();

      const styles = await emojiButton.evaluate((el) => {
        return window.getComputedStyle(el).backgroundColor;
      });

      // Should have hover background (not transparent or initial)
      expect(styles).not.toBe('rgba(0, 0, 0, 0)');
    });
  });

  test.describe('UC-03: Dropdown Close', () => {
    test('Should close IconPicker when clicking outside', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const iconPicker = page.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible();

      // Click outside
      await page.click('body', { position: { x: 10, y: 10 } });

      // Verify closed
      await expect(iconPicker).not.toBeVisible();
    });

    test('Should close IconPicker when pressing ESC key', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const iconPicker = page.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible();

      // Press ESC
      await page.keyboard.press('Escape');

      // Verify closed
      await expect(iconPicker).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('Should have proper ARIA labels on emoji buttons', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      const firstEmojiButton = page.locator('[data-testid^="emoji-button-"]').first();

      // Should have aria-label or title
      const ariaLabel =
        (await firstEmojiButton.getAttribute('aria-label')) ||
        (await firstEmojiButton.getAttribute('title'));

      expect(ariaLabel).toBeTruthy();
    });

    test('Should be keyboard navigable', async ({ page }) => {
      const changeButton = page.locator('[data-testid="icon-change-button"]');
      await changeButton.click();

      // Tab to first emoji button
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        return el?.getAttribute('data-testid') || '';
      });

      expect(focused).toMatch(/emoji-button-/);
    });
  });
});
