import { NextResponse } from "next/server";
import Database from "better-sqlite3";
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
  is_favorite: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toCamelCase(row: DbRow) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    coverUrl: row.cover_url,
    parentId: row.parent_id,
    isFavorite: row.is_favorite === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * GET /api/pages/favorites
 *
 * 즐겨찾기된 페이지 목록을 조회합니다.
 */
export async function GET() {
  try {
    const db = getDb();

    const stmt = db.prepare(`
      SELECT id, title, icon, cover_url, parent_id, is_favorite, sort_order, created_at, updated_at
      FROM pages
      WHERE is_favorite = 1
      ORDER BY sort_order, created_at
    `);

    const pages = stmt.all() as DbRow[];
    db.close();

    return NextResponse.json(pages.map(toCamelCase));
  } catch (error) {
    console.error("[GET /api/pages/favorites] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch favorite pages" },
      { status: 500 }
    );
  }
}
