import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * WCAG 2.1 색상 대비 계산
 */
export function calculateContrast(rgb1: string, rgb2: string): number {
  const getLuminance = (rgb: string): number => {
    const [r, g, b] = rgb
      .match(/\d+/g)!
      .map(Number)
      .map(val => {
        const sRGB = val / 255;
        return sRGB <= 0.03928
          ? sRGB / 12.92
          : Math.pow((sRGB + 0.055) / 1.055, 2.4);
      });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = getLuminance(rgb1);
  const lum2 = getLuminance(rgb2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * 색상 대비 검증 헬퍼
 */
export async function verifyColorContrast(
  page: Page,
  element: Locator,
  background: Locator,
  level: 'AA' | 'AAA' = 'AA'
): Promise<void> {
  const textColor = await element.evaluate(el =>
    window.getComputedStyle(el).color
  );
  const bgColor = await background.evaluate(el =>
    window.getComputedStyle(el).backgroundColor
  );

  const contrast = calculateContrast(textColor, bgColor);
  const threshold = level === 'AAA' ? 7.0 : 4.5;

  expect(contrast).toBeGreaterThanOrEqual(threshold);
}
