/**
 * SQLite Database Utility
 *
 * 페이지 데이터 CRUD 작업을 처리합니다.
 * better-sqlite3 동기 API를 사용합니다.
 *
 * @module db
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'database.db');

/**
 * 페이지 데이터 타입
 */
export interface Page {
  id: string;
  title: string;
  icon?: string;
  cover_url?: string;
  parent_id?: string;
  content?: string;
  is_favorite: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * 페이지 생성 입력 타입
 */
export interface CreatePageInput {
  id?: string;
  title?: string;
  icon?: string;
  cover_url?: string;
  parent_id?: string;
  content?: string;
  is_favorite?: boolean;
  sort_order?: number;
}

/**
 * 페이지 업데이트 입력 타입
 */
export interface UpdatePageInput extends Partial<CreatePageInput> {
  id: string;
}

/**
 * DatabaseManager 클래스
 *
 * @remarks
 * - 싱글톤 패턴 사용
 * - WAL 모드 활성화 (concurrent read)
 * - 자동 테이블 초기화
 */
class DatabaseManager {
  private db: Database.Database;

  constructor() {
    // 데이터 디렉토리 생성
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  /**
   * 테이블 초기화
   */
  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'Untitled',
        icon TEXT,
        cover_url TEXT,
        parent_id TEXT,
        content TEXT,
        is_favorite INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
      CREATE INDEX IF NOT EXISTS idx_pages_is_favorite ON pages(is_favorite);
      CREATE INDEX IF NOT EXISTS idx_pages_sort_order ON pages(sort_order);
    `);
  }

  /**
   * 페이지 생성
   */
  createPage(input: CreatePageInput): Page {
    const id = input.id || uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO pages (
        id, title, icon, cover_url, parent_id, content,
        is_favorite, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.title || 'Untitled',
      input.icon || null,
      input.cover_url || null,
      input.parent_id || null,
      input.content || null,
      input.is_favorite ? 1 : 0,
      input.sort_order || 0,
      now,
      now
    );

    return this.getPageById(id)!;
  }

  /**
   * ID로 페이지 조회
   */
  getPageById(id: string): Page | undefined {
    const stmt = this.db.prepare('SELECT * FROM pages WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.mapRowToPage(row) : undefined;
  }

  /**
   * 모든 페이지 조회
   */
  getAllPages(): Page[] {
    const stmt = this.db.prepare('SELECT * FROM pages ORDER BY sort_order, created_at');
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToPage(row));
  }

  /**
   * 자식 페이지 조회
   */
  getChildPages(parentId: string): Page[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pages
      WHERE parent_id = ?
      ORDER BY sort_order, created_at
    `);
    const rows = stmt.all(parentId) as any[];
    return rows.map(row => this.mapRowToPage(row));
  }

  /**
   * 즐겨찾기 페이지 조회
   */
  getFavoritePages(): Page[] {
    const stmt = this.db.prepare(`
      SELECT * FROM pages
      WHERE is_favorite = 1
      ORDER BY sort_order, created_at
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => this.mapRowToPage(row));
  }

  /**
   * 페이지 업데이트
   */
  updatePage(input: UpdatePageInput): Page | undefined {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE pages
      SET
        title = COALESCE(?, title),
        icon = COALESCE(?, icon),
        cover_url = COALESCE(?, cover_url),
        parent_id = COALESCE(?, parent_id),
        content = COALESCE(?, content),
        is_favorite = COALESCE(?, is_favorite),
        sort_order = COALESCE(?, sort_order),
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(
      input.title ?? null,
      input.icon ?? null,
      input.cover_url ?? null,
      input.parent_id ?? null,
      input.content ?? null,
      input.is_favorite !== undefined ? (input.is_favorite ? 1 : 0) : null,
      input.sort_order ?? null,
      now,
      input.id
    );

    return this.getPageById(input.id);
  }

  /**
   * 페이지 삭제
   */
  deletePage(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM pages WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * DB 행을 Page 객체로 매핑
   */
  private mapRowToPage(row: any): Page {
    return {
      id: row.id,
      title: row.title,
      icon: row.icon || undefined,
      cover_url: row.cover_url || undefined,
      parent_id: row.parent_id || undefined,
      content: row.content || undefined,
      is_favorite: row.is_favorite === 1,
      sort_order: row.sort_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * DB 연결 종료
   */
  close(): void {
    this.db.close();
  }
}

// 싱글톤 인스턴스
export let dbInstance: DatabaseManager | null = null;

/**
 * DatabaseManager 인스턴스 가져오기
 */
export function getDb(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

/**
 * 싱글톤 인스턴스 초기화 (테스트용)
 */
export function resetDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * CRUD 함수들 export
 */
export const db = {
  createPage: (input: CreatePageInput) => getDb().createPage(input),
  getPageById: (id: string) => getDb().getPageById(id),
  getAllPages: () => getDb().getAllPages(),
  getChildPages: (parentId: string) => getDb().getChildPages(parentId),
  getFavoritePages: () => getDb().getFavoritePages(),
  updatePage: (input: UpdatePageInput) => getDb().updatePage(input),
  deletePage: (id: string) => getDb().deletePage(id),
};

/**
 * 레거시 호환을 위한 export (이전 API와 호환)
 */
export async function initializeDatabase() {
  getDb();
}

export async function createPage(page: Omit<Page, 'id' | 'created_at' | 'updated_at'>) {
  const input: CreatePageInput = {
    title: page.title,
    icon: page.icon,
    cover_url: page.cover_url,
    parent_id: page.parent_id,
    content: page.content,
    is_favorite: page.is_favorite,
    sort_order: page.sort_order,
  };
  return db.createPage(input);
}

export async function getPage(pageId: string): Promise<Page | null> {
  return db.getPageById(pageId) || null;
}

export async function getAllPages(): Promise<Page[]> {
  return db.getAllPages();
}

export async function updatePage(
  pageId: string,
  updates: Partial<Omit<Page, 'id' | 'created_at'>>
) {
  const input: UpdatePageInput = {
    id: pageId,
    ...updates,
  };
  return db.updatePage(input);
}

export async function deletePage(pageId: string) {
  return db.deletePage(pageId);
}

export async function getPageChildren(parentId: string | null = null): Promise<Page[]> {
  if (!parentId) {
    // 루트 페이지 조회 (parent_id가 NULL인 페이지)
    const dbInstance = getDb() as any;
    const stmt = dbInstance.db.prepare('SELECT * FROM pages WHERE parent_id IS NULL ORDER BY sort_order, created_at');
    const rows = stmt.all() as any[];
    return rows.map((row: any) => dbInstance.mapRowToPage(row));
  }
  return db.getChildPages(parentId);
}
