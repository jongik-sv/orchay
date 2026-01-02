/**
 * SQLite 데이터베이스 연결 및 초기화
 * TSK-01-01: SQLite 데이터베이스 설정 및 스키마 생성
 *
 * - better-sqlite3 동기 API 사용
 * - 5개 테이블 스키마 생성
 * - 초기 시드 데이터 삽입
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// DB 경로 (환경 변수로 오버라이드 가능 - 테스트용)
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.db');

// 싱글톤 DB 인스턴스
let dbInstance: DatabaseType | null = null;

// 시드 데이터 정의
const SEED_TABLES = [1, 2, 3, 4, 5];
const SEED_CATEGORIES = [
  { name: '메인메뉴', sort_order: 1 },
  { name: '사이드메뉴', sort_order: 2 },
  { name: '음료', sort_order: 3 },
];
const SEED_MENUS = [
  // 메인메뉴 (category_id = 1)
  { category_id: 1, name: '김치찌개', price: 8000 },
  { category_id: 1, name: '된장찌개', price: 8000 },
  { category_id: 1, name: '비빔밥', price: 9000 },
  { category_id: 1, name: '제육볶음', price: 10000 },
  { category_id: 1, name: '불고기정식', price: 12000 },
  // 사이드메뉴 (category_id = 2)
  { category_id: 2, name: '공기밥', price: 1000 },
  { category_id: 2, name: '계란찜', price: 3000 },
  { category_id: 2, name: '김치 추가', price: 2000 },
  // 음료 (category_id = 3)
  { category_id: 3, name: '콜라', price: 2000 },
  { category_id: 3, name: '사이다', price: 2000 },
];

/**
 * data 디렉토리 생성 (없으면)
 */
function ensureDataDir(): void {
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

/**
 * 테이블 스키마 생성
 */
function initSchema(db: DatabaseType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER NOT NULL,
      status TEXT DEFAULT 'available'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS menus (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      image_url TEXT,
      is_sold_out INTEGER DEFAULT 0,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES tables(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER,
      menu_id INTEGER,
      quantity INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_id) REFERENCES menus(id)
    );
  `);
}

/**
 * 시드 데이터 삽입 (내부용)
 */
function doInsertSeedData(db: DatabaseType): void {
  const insertTable = db.prepare('INSERT INTO tables (table_number, status) VALUES (?, ?)');
  for (const tableNum of SEED_TABLES) {
    insertTable.run(tableNum, 'available');
  }

  const insertCategory = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)');
  for (const cat of SEED_CATEGORIES) {
    insertCategory.run(cat.name, cat.sort_order);
  }

  const insertMenu = db.prepare('INSERT INTO menus (category_id, name, price, image_url, is_sold_out) VALUES (?, ?, ?, ?, ?)');
  for (const menu of SEED_MENUS) {
    insertMenu.run(menu.category_id, menu.name, menu.price, null, 0);
  }
}

/**
 * 시드 데이터 삽입 (테이블이 비어있을 때만)
 */
function insertSeedData(db: DatabaseType): void {
  const tableCount = (db.prepare('SELECT COUNT(*) as count FROM tables').get() as { count: number }).count;
  if (tableCount === 0) {
    doInsertSeedData(db);
  }
}

/**
 * DB 인스턴스 반환 (싱글톤)
 */
export function getDb(): DatabaseType {
  if (!dbInstance) {
    ensureDataDir();
    dbInstance = new Database(DB_PATH);
    // MVP에서는 FK 제약 비활성화 (설계 문서 에러 처리 참조)
    dbInstance.pragma('foreign_keys = OFF');
    initSchema(dbInstance);
    insertSeedData(dbInstance);
  }
  return dbInstance;
}

/**
 * 초기화 상태 확인
 */
export function ensureInitialized(): boolean {
  try {
    const db = getDb();
    const tableCount = (db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).get() as { count: number }).count;
    return tableCount === 5;
  } catch {
    return false;
  }
}

/**
 * 시드 데이터 재삽입 (개발용)
 * 기존 데이터를 삭제하고 시드 데이터를 다시 삽입
 */
export function reseedData(): void {
  const db = getDb();

  // 기존 데이터 삭제 (FK 관계 순서로)
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM menus;
    DELETE FROM categories;
    DELETE FROM tables;
  `);

  // 시드 데이터 다시 삽입
  doInsertSeedData(db);
}

// 기본 export - DB 인스턴스
export default getDb();
