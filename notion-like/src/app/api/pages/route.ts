import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "database.db");

function getDb() {
  return new Database(dbPath);
}

interface DbRow {
  id: string;
  title: string;
  icon: string | null;
  cover_url: string | null;
  parent_id: string | null;
  content: string | null;
  is_favorite: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * snake_case DB row를 camelCase로 변환
 */
function toCamelCase(row: DbRow) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    coverUrl: row.cover_url,
    parentId: row.parent_id,
    content: row.content ? JSON.parse(row.content) : [],
    isFavorite: row.is_favorite === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/pages
 *
 * 모든 페이지 목록을 조회합니다.
 */
export async function GET() {
  try {
    const db = getDb();

    const stmt = db.prepare(`
      SELECT id, title, icon, cover_url, parent_id, content, is_favorite, sort_order, created_at, updated_at
      FROM pages
      ORDER BY sort_order, created_at
    `);

    const pages = stmt.all() as DbRow[];
    db.close();

    return NextResponse.json(pages.map(toCamelCase));
  } catch (error) {
    console.error("[GET /api/pages] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pages" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pages
 *
 * 새 페이지를 생성합니다.
 *
 * @param request - { parentId?: string } (optional)
 * @returns 201 Created - 생성된 페이지 정보
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();

    // 요청 본문 파싱 (빈 본문 허용)
    let parentId: string | null = null;
    try {
      const body = await request.json();
      parentId = body.parentId || null;
    } catch {
      // 빈 본문인 경우 무시
    }

    // parentId가 제공된 경우 존재 여부 확인
    if (parentId) {
      const checkStmt = db.prepare("SELECT id FROM pages WHERE id = ?");
      const parentPage = checkStmt.get(parentId);
      if (!parentPage) {
        db.close();
        return NextResponse.json(
          { error: "Parent page not found" },
          { status: 404 }
        );
      }
    }

    // 새 페이지 생성
    const id = uuidv4();
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO pages (
        id, title, icon, cover_url, parent_id, content,
        is_favorite, sort_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      id,
      "Untitled",
      null,
      null,
      parentId,
      "[]", // 빈 content 배열
      0, // is_favorite = false
      0, // sort_order
      now,
      now
    );

    // 생성된 페이지 조회
    const selectStmt = db.prepare(
      "SELECT id, title, icon, cover_url, parent_id, content, is_favorite, sort_order, created_at, updated_at FROM pages WHERE id = ?"
    );
    const page = selectStmt.get(id) as {
      id: string;
      title: string;
      icon: string | null;
      cover_url: string | null;
      parent_id: string | null;
      content: string | null;
      is_favorite: number;
      sort_order: number;
      created_at: string;
      updated_at: string;
    };

    db.close();

    return NextResponse.json(toCamelCase(page), { status: 201 });
  } catch (error) {
    console.error("[POST /api/pages] Error:", error);
    return NextResponse.json(
      { error: "Failed to create page" },
      { status: 500 }
    );
  }
}
