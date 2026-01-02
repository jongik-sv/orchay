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

// 헬퍼 타입 정의 (타입 단언 제거용)
interface CountResult {
  count: number;
}

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
  const result = db.prepare('SELECT COUNT(*) as count FROM tables').get() as CountResult;
  const tableCount = result.count;
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
    // MVP에서는 FK 제약 비활성화
    // 이유: MVP 단계에서는 데이터 생성 순서를 제어하기 어렵고,
    //       테스트 시 시드 데이터 삽입 순서 문제 회피
    // TODO(post-MVP): FK 활성화 시 마이그레이션 순서 및 시드 스크립트 검토 필요
    // 참조: 010-design.md 에러 처리 섹션
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
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).get() as CountResult;
    return result.count === 5;
  } catch (error) {
    console.error('[DB] 초기화 상태 확인 실패:', error);
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

// ===== TSK-01-02: 카테고리/메뉴 조회 함수 =====

import type { Category, MenuWithCategory } from '@/types';

/**
 * 카테고리 목록 조회
 * sort_order 순으로 정렬된 카테고리 배열 반환
 */
export function getCategories(): Category[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, name, sort_order as sortOrder
    FROM categories
    ORDER BY sort_order ASC
  `);
  return stmt.all() as Category[];
}

/**
 * 메뉴 목록 조회
 * @param includeSoldOut - true면 품절 메뉴 포함 (기본: false)
 */
export function getMenus(includeSoldOut: boolean = false): MenuWithCategory[] {
  const db = getDb();
  const whereClause = includeSoldOut ? '' : 'WHERE m.is_sold_out = 0';
  const stmt = db.prepare(`
    SELECT
      m.id,
      m.category_id as categoryId,
      c.name AS categoryName,
      m.name,
      m.price,
      m.image_url as imageUrl,
      CASE WHEN m.is_sold_out = 1 THEN 1 ELSE 0 END as isSoldOut
    FROM menus m
    JOIN categories c ON m.category_id = c.id
    ${whereClause}
    ORDER BY c.sort_order, m.id
  `);
  // SQLite returns 0/1 for boolean, convert to actual boolean
  const rows = stmt.all() as Array<Omit<MenuWithCategory, 'isSoldOut'> & { isSoldOut: number }>;
  return rows.map(row => ({
    ...row,
    isSoldOut: row.isSoldOut === 1,
  }));
}

// ===== TSK-01-03: 주문 생성/조회 함수 =====

/**
 * 주문 항목 타입 정의
 */
export interface OrderItem {
  id: number;
  menuId: number;
  menuName: string;
  quantity: number;
  price: number;
  status: 'pending' | 'cooking' | 'completed';
}

/**
 * 주문 타입 정의
 */
export interface Order {
  id: number;
  tableId: number;
  status: 'pending' | 'cooking' | 'completed';
  createdAt: string;
  items: OrderItem[];
}

/**
 * 주방용 주문 타입 정의 (tableNumber 포함)
 */
export interface KitchenOrder extends Order {
  tableNumber: number;
}

/**
 * 주문 생성
 * @param tableId - 테이블 ID
 * @param items - 주문 항목 배열 [{ menuId, quantity }]
 * @returns 생성된 주문 ID
 * @throws EMPTY_ITEMS - 주문 항목이 비어있을 때
 * @throws INVALID_QUANTITY - 수량이 1~99 범위를 벗어날 때
 */
export function createOrder(tableId: number, items: { menuId: number; quantity: number }[]): number {
  if (!items || items.length === 0) {
    throw new Error('EMPTY_ITEMS');
  }

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > 99) {
      throw new Error('INVALID_QUANTITY');
    }
  }

  const db = getDb();

  // 트랜잭션으로 주문과 주문 항목을 함께 생성
  const insertOrder = db.prepare('INSERT INTO orders (table_id, status) VALUES (?, ?)');
  const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_id, quantity, status) VALUES (?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    const orderResult = insertOrder.run(tableId, 'pending');
    const orderId = orderResult.lastInsertRowid as number;

    for (const item of items) {
      insertItem.run(orderId, item.menuId, item.quantity, 'pending');
    }

    return orderId;
  });

  return transaction();
}

/**
 * 테이블별 주문 조회
 * @param tableId - 테이블 ID
 * @returns 주문 목록 (최신순, items 포함)
 */
export function getOrdersByTable(tableId: number): Order[] {
  const db = getDb();

  // 주문 조회 (최신순)
  const ordersStmt = db.prepare(`
    SELECT id, table_id as tableId, status, created_at as createdAt
    FROM orders
    WHERE table_id = ?
    ORDER BY created_at DESC
  `);
  const orders = ordersStmt.all(tableId) as Array<{
    id: number;
    tableId: number;
    status: 'pending' | 'cooking' | 'completed';
    createdAt: string;
  }>;

  // 주문 항목 조회
  const itemsStmt = db.prepare(`
    SELECT
      oi.id,
      oi.menu_id as menuId,
      m.name as menuName,
      oi.quantity,
      m.price,
      oi.status
    FROM order_items oi
    JOIN menus m ON oi.menu_id = m.id
    WHERE oi.order_id = ?
  `);

  return orders.map(order => ({
    ...order,
    items: itemsStmt.all(order.id) as OrderItem[],
  }));
}

/**
 * 주방 주문 목록 조회 (pending, cooking 상태만)
 * @returns 주문 목록 (오래된 것 먼저, tableNumber 포함)
 */
export function getKitchenOrders(): KitchenOrder[] {
  const db = getDb();

  // 주문 조회 (오래된 것 먼저, pending/cooking만)
  const ordersStmt = db.prepare(`
    SELECT
      o.id,
      o.table_id as tableId,
      t.table_number as tableNumber,
      o.status,
      o.created_at as createdAt
    FROM orders o
    JOIN tables t ON o.table_id = t.id
    WHERE o.status IN ('pending', 'cooking')
    ORDER BY o.created_at ASC
  `);
  const orders = ordersStmt.all() as Array<{
    id: number;
    tableId: number;
    tableNumber: number;
    status: 'pending' | 'cooking' | 'completed';
    createdAt: string;
  }>;

  // 주문 항목 조회
  const itemsStmt = db.prepare(`
    SELECT
      oi.id,
      oi.menu_id as menuId,
      m.name as menuName,
      oi.quantity,
      m.price,
      oi.status
    FROM order_items oi
    JOIN menus m ON oi.menu_id = m.id
    WHERE oi.order_id = ?
  `);

  return orders.map(order => ({
    ...order,
    items: itemsStmt.all(order.id) as OrderItem[],
  }));
}

/**
 * 주문 상태 변경
 * @param orderId - 주문 ID
 * @param status - 변경할 상태 ('cooking' | 'completed')
 * @returns 성공 여부
 * @throws ORDER_NOT_FOUND - 주문이 존재하지 않을 때
 * @throws INVALID_TRANSITION - 유효하지 않은 상태 전이일 때
 */
export function updateOrderStatus(orderId: number, status: 'pending' | 'cooking' | 'completed'): boolean {
  const db = getDb();

  // 현재 상태 조회
  const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as { status: string } | undefined;

  if (!order) {
    throw new Error('ORDER_NOT_FOUND');
  }

  const currentStatus = order.status;

  // 상태 전이 유효성 검사 (BR-01)
  const validTransitions: Record<string, string[]> = {
    pending: ['cooking'],
    cooking: ['completed'],
    completed: [],
  };

  if (!validTransitions[currentStatus].includes(status)) {
    throw new Error('INVALID_TRANSITION');
  }

  // 상태 업데이트
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, orderId);
  return true;
}

// 기본 export - getDb 함수 자체를 export하여 지연 초기화 지원
// 모듈 로드 시점에 DB 연결 생성 방지 (사용 시점에 초기화)
export { getDb as default };
