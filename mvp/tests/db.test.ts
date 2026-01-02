/**
 * TSK-01-01: SQLite 데이터베이스 설정 및 스키마 생성 테스트
 *
 * 설계 문서 기반 테스트 시나리오:
 * - DB 파일 생성 확인
 * - 5개 테이블 스키마 생성 확인
 * - 시드 데이터 삽입 확인
 * - 기본 CRUD 동작 확인
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// 테스트용 DB 경로 (실제 DB와 분리)
const TEST_DB_PATH = path.join(process.cwd(), 'data', 'test-database.db');

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

describe('TSK-01-01: SQLite 데이터베이스 설정', () => {
  describe('1. DB 초기화', () => {
    it('DB 모듈을 import하면 DB 파일이 생성되어야 한다', async () => {
      // DB 모듈 import (초기화 트리거)
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // DB 파일 존재 확인
      expect(fs.existsSync(TEST_DB_PATH)).toBe(true);

      // DB 인스턴스가 유효한지 확인
      expect(db).toBeDefined();
      expect(db.open).toBe(true);
    });

    it('data 디렉토리가 없으면 자동 생성되어야 한다', async () => {
      const dataDir = path.dirname(TEST_DB_PATH);
      expect(fs.existsSync(dataDir)).toBe(true);
    });
  });

  describe('2. 테이블 스키마 생성', () => {
    it('tables 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='tables'
      `).get();

      expect(result).toBeDefined();
    });

    it('categories 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='categories'
      `).get();

      expect(result).toBeDefined();
    });

    it('menus 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='menus'
      `).get();

      expect(result).toBeDefined();
    });

    it('orders 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='orders'
      `).get();

      expect(result).toBeDefined();
    });

    it('order_items 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='order_items'
      `).get();

      expect(result).toBeDefined();
    });

    it('총 5개의 테이블이 생성되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`
        SELECT COUNT(*) as count FROM sqlite_master
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).get() as { count: number };

      expect(result.count).toBe(5);
    });
  });

  describe('3. 테이블 스키마 상세', () => {
    it('tables 테이블 컬럼이 올바르게 정의되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const columns = db.prepare(`PRAGMA table_info(tables)`).all() as Array<{
        name: string;
        type: string;
        notnull: number;
      }>;

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('table_number');
      expect(columnNames).toContain('status');
    });

    it('categories 테이블 컬럼이 올바르게 정의되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const columns = db.prepare(`PRAGMA table_info(categories)`).all() as Array<{
        name: string;
      }>;

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('sort_order');
    });

    it('menus 테이블 컬럼이 올바르게 정의되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const columns = db.prepare(`PRAGMA table_info(menus)`).all() as Array<{
        name: string;
      }>;

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('category_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('price');
      expect(columnNames).toContain('image_url');
      expect(columnNames).toContain('is_sold_out');
    });

    it('orders 테이블 컬럼이 올바르게 정의되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const columns = db.prepare(`PRAGMA table_info(orders)`).all() as Array<{
        name: string;
      }>;

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('table_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('created_at');
    });

    it('order_items 테이블 컬럼이 올바르게 정의되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const columns = db.prepare(`PRAGMA table_info(order_items)`).all() as Array<{
        name: string;
      }>;

      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('order_id');
      expect(columnNames).toContain('menu_id');
      expect(columnNames).toContain('quantity');
      expect(columnNames).toContain('status');
    });
  });

  describe('4. 시드 데이터 삽입', () => {
    it('테이블 5개가 시드되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`SELECT COUNT(*) as count FROM tables`).get() as { count: number };
      expect(result.count).toBe(5);
    });

    it('테이블 번호 1~5가 존재해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const tables = db.prepare(`SELECT table_number FROM tables ORDER BY table_number`).all() as Array<{ table_number: number }>;
      expect(tables.map(t => t.table_number)).toEqual([1, 2, 3, 4, 5]);
    });

    it('카테고리 3개가 시드되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`SELECT COUNT(*) as count FROM categories`).get() as { count: number };
      expect(result.count).toBe(3);
    });

    it('카테고리에 메인메뉴, 사이드메뉴, 음료가 존재해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const categories = db.prepare(`SELECT name FROM categories ORDER BY sort_order`).all() as Array<{ name: string }>;
      expect(categories.map(c => c.name)).toEqual(['메인메뉴', '사이드메뉴', '음료']);
    });

    it('메뉴 10개가 시드되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const result = db.prepare(`SELECT COUNT(*) as count FROM menus`).get() as { count: number };
      expect(result.count).toBe(10);
    });

    it('메뉴 가격이 올바르게 설정되어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const menu = db.prepare(`SELECT * FROM menus WHERE name = '김치찌개'`).get() as { price: number } | undefined;
      expect(menu).toBeDefined();
      expect(menu?.price).toBe(8000);
    });

    it('카테고리별 메뉴 연결이 올바라야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // 메인메뉴 (category_id = 1) 에 5개
      const mainCount = db.prepare(`SELECT COUNT(*) as count FROM menus WHERE category_id = 1`).get() as { count: number };
      expect(mainCount.count).toBe(5);

      // 사이드메뉴 (category_id = 2) 에 3개
      const sideCount = db.prepare(`SELECT COUNT(*) as count FROM menus WHERE category_id = 2`).get() as { count: number };
      expect(sideCount.count).toBe(3);

      // 음료 (category_id = 3) 에 2개
      const drinkCount = db.prepare(`SELECT COUNT(*) as count FROM menus WHERE category_id = 3`).get() as { count: number };
      expect(drinkCount.count).toBe(2);
    });
  });

  describe('5. 유틸리티 함수', () => {
    it('ensureInitialized()가 true를 반환해야 한다', async () => {
      const { ensureInitialized } = await import('@/lib/db');
      expect(ensureInitialized()).toBe(true);
    });

    it('reseedData()가 시드 데이터를 재삽입해야 한다', async () => {
      const { getDb, reseedData } = await import('@/lib/db');
      const db = getDb();

      // 기존 메뉴 삭제
      db.prepare(`DELETE FROM menus`).run();
      let count = (db.prepare(`SELECT COUNT(*) as count FROM menus`).get() as { count: number }).count;
      expect(count).toBe(0);

      // 재삽입
      reseedData();
      count = (db.prepare(`SELECT COUNT(*) as count FROM menus`).get() as { count: number }).count;
      expect(count).toBe(10);
    });
  });

  describe('6. 기본 CRUD 동작', () => {
    it('메뉴 조회가 가능해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const menus = db.prepare(`SELECT * FROM menus WHERE is_sold_out = 0`).all();
      expect(menus.length).toBeGreaterThan(0);
    });

    it('주문 생성이 가능해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const insertOrder = db.prepare(`INSERT INTO orders (table_id, status) VALUES (?, ?)`);
      const result = insertOrder.run(1, 'pending');

      expect(result.lastInsertRowid).toBeDefined();
      expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);
    });

    it('주문 항목 생성이 가능해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // 먼저 주문 생성
      const orderResult = db.prepare(`INSERT INTO orders (table_id, status) VALUES (?, ?)`).run(1, 'pending');
      const orderId = orderResult.lastInsertRowid;

      // 주문 항목 생성
      const itemResult = db.prepare(`INSERT INTO order_items (order_id, menu_id, quantity) VALUES (?, ?, ?)`).run(orderId, 1, 2);

      expect(itemResult.lastInsertRowid).toBeDefined();
    });

    it('주문 상태 변경이 가능해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // 주문 생성
      const orderResult = db.prepare(`INSERT INTO orders (table_id, status) VALUES (?, ?)`).run(1, 'pending');
      const orderId = orderResult.lastInsertRowid;

      // 상태 변경
      db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run('cooking', orderId);

      // 확인
      const order = db.prepare(`SELECT status FROM orders WHERE id = ?`).get(orderId) as { status: string };
      expect(order.status).toBe('cooking');
    });

    it('테이블별 주문 조회가 가능해야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const orders = db.prepare(`SELECT * FROM orders WHERE table_id = ?`).all(1);
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe('7. 상태 기본값', () => {
    it('테이블 기본 상태가 available이어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // table_number로 조회 (reseedData 후 id가 변경될 수 있음)
      const table = db.prepare(`SELECT status FROM tables WHERE table_number = 1`).get() as { status: string };
      expect(table.status).toBe('available');
    });

    it('주문 기본 상태가 pending이어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      // 주문 생성 (status 미지정)
      const result = db.prepare(`INSERT INTO orders (table_id) VALUES (?)`).run(1);
      const order = db.prepare(`SELECT status FROM orders WHERE id = ?`).get(result.lastInsertRowid) as { status: string };

      expect(order.status).toBe('pending');
    });

    it('메뉴 기본 품절 상태가 0이어야 한다', async () => {
      const { getDb } = await import('@/lib/db');
      const db = getDb();

      const menus = db.prepare(`SELECT is_sold_out FROM menus`).all() as Array<{ is_sold_out: number }>;
      const allNotSoldOut = menus.every(m => m.is_sold_out === 0);
      expect(allNotSoldOut).toBe(true);
    });
  });
});
