/**
 * TSK-01-02: 카테고리/메뉴 조회 API 테스트
 *
 * 설계 문서 기반 테스트 시나리오:
 * - GET /api/categories: 카테고리 목록 조회
 * - GET /api/menus: 메뉴 목록 조회 (품절 필터링 옵션)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// 테스트용 DB 경로
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-api-database.db');

// 테스트 전 환경 설정
beforeAll(() => {
  // 테스트 DB 파일이 존재하면 삭제
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  // 환경 변수로 테스트 DB 경로 설정
  process.env.DB_PATH = TEST_DB_PATH;
});

// 테스트 후 정리
afterAll(() => {
  // 테스트 DB 파일 삭제
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
});

describe('TSK-01-02: 카테고리/메뉴 조회 API', () => {
  describe('1. getCategories() 함수', () => {
    it('정렬된 카테고리 배열을 반환해야 한다', async () => {
      const { getCategories } = await import('@/lib/db');
      const categories = getCategories();

      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(3);
    });

    it('카테고리는 sortOrder 순으로 정렬되어야 한다', async () => {
      const { getCategories } = await import('@/lib/db');
      const categories = getCategories();

      expect(categories[0].name).toBe('메인메뉴');
      expect(categories[1].name).toBe('사이드메뉴');
      expect(categories[2].name).toBe('음료');
    });

    it('각 카테고리에 id, name, sortOrder가 포함되어야 한다', async () => {
      const { getCategories } = await import('@/lib/db');
      const categories = getCategories();

      categories.forEach(cat => {
        expect(cat).toHaveProperty('id');
        expect(cat).toHaveProperty('name');
        expect(cat).toHaveProperty('sortOrder');
        expect(typeof cat.id).toBe('number');
        expect(typeof cat.name).toBe('string');
        expect(typeof cat.sortOrder).toBe('number');
      });
    });
  });

  describe('2. getMenus() 함수', () => {
    it('기본적으로 품절 제외 메뉴를 반환해야 한다', async () => {
      const { getMenus, getDb } = await import('@/lib/db');
      const db = getDb();

      // 하나의 메뉴를 품절 처리
      db.prepare('UPDATE menus SET is_sold_out = 1 WHERE name = ?').run('콜라');

      const menus = getMenus(false);
      const soldOutMenu = menus.find(m => m.name === '콜라');

      expect(soldOutMenu).toBeUndefined();

      // 복구
      db.prepare('UPDATE menus SET is_sold_out = 0 WHERE name = ?').run('콜라');
    });

    it('includeSoldOut=true면 품절 메뉴도 포함해야 한다', async () => {
      const { getMenus, getDb } = await import('@/lib/db');
      const db = getDb();

      // 하나의 메뉴를 품절 처리
      db.prepare('UPDATE menus SET is_sold_out = 1 WHERE name = ?').run('콜라');

      const menus = getMenus(true);
      const soldOutMenu = menus.find(m => m.name === '콜라');

      expect(soldOutMenu).toBeDefined();
      expect(soldOutMenu?.isSoldOut).toBe(true);

      // 복구
      db.prepare('UPDATE menus SET is_sold_out = 0 WHERE name = ?').run('콜라');
    });

    it('각 메뉴에 categoryName이 포함되어야 한다', async () => {
      const { getMenus } = await import('@/lib/db');
      const menus = getMenus();

      menus.forEach(menu => {
        expect(menu).toHaveProperty('categoryName');
        expect(typeof menu.categoryName).toBe('string');
        expect(['메인메뉴', '사이드메뉴', '음료']).toContain(menu.categoryName);
      });
    });

    it('메뉴가 카테고리 순서대로 정렬되어야 한다', async () => {
      const { getMenus } = await import('@/lib/db');
      const menus = getMenus();

      // 메뉴가 카테고리 순서대로 정렬되었는지 확인
      let lastCategoryOrder = -1;
      for (const menu of menus) {
        const currentCategoryId = menu.categoryId;
        // 같은 카테고리 내에서는 순서가 유지되어야 함
        if (menu.categoryId !== lastCategoryOrder) {
          expect(currentCategoryId).toBeGreaterThanOrEqual(lastCategoryOrder);
          lastCategoryOrder = currentCategoryId;
        }
      }
    });

    it('각 메뉴에 필수 필드가 포함되어야 한다', async () => {
      const { getMenus } = await import('@/lib/db');
      const menus = getMenus();

      menus.forEach(menu => {
        expect(menu).toHaveProperty('id');
        expect(menu).toHaveProperty('categoryId');
        expect(menu).toHaveProperty('categoryName');
        expect(menu).toHaveProperty('name');
        expect(menu).toHaveProperty('price');
        expect(menu).toHaveProperty('imageUrl');
        expect(menu).toHaveProperty('isSoldOut');
      });
    });
  });

  describe('3. API 응답 형식 검증', () => {
    it('getCategories 반환 형식이 API 스펙과 일치해야 한다', async () => {
      const { getCategories } = await import('@/lib/db');
      const categories = getCategories();

      // API 응답 형식: { categories: Category[] }
      const response = { categories };

      expect(response).toHaveProperty('categories');
      expect(Array.isArray(response.categories)).toBe(true);
    });

    it('getMenus 반환 형식이 API 스펙과 일치해야 한다', async () => {
      const { getMenus } = await import('@/lib/db');
      const menus = getMenus();

      // API 응답 형식: { menus: Menu[] }
      const response = { menus };

      expect(response).toHaveProperty('menus');
      expect(Array.isArray(response.menus)).toBe(true);
    });
  });
});
