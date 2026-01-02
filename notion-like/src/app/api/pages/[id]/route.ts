import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "data", "database.db");

function getDb() {
  return new Database(dbPath);
}

// GET /api/pages/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: pageId } = await params;

    const stmt = db.prepare(
      "SELECT id, title, icon, cover_url, parent_id, content, is_favorite, sort_order, created_at, updated_at FROM pages WHERE id = ?"
    );
    const page = stmt.get(pageId) as {
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
    } | undefined;

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(page);
  } catch (error) {
    console.error("[GET /api/pages/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch page" },
      { status: 500 }
    );
  }
}

// PUT /api/pages/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: pageId } = await params;
    const body = await request.json();
    const { content, is_favorite, title, icon } = body;

    // 페이지 존재 여부 확인
    const checkStmt = db.prepare("SELECT id FROM pages WHERE id = ?");
    const existingPage = checkStmt.get(pageId);

    if (!existingPage) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // 업데이트할 필드 동적 구성
    const updates: string[] = [];
    const values: (string | number)[] = [];

    // content 업데이트
    if (content !== undefined) {
      if (typeof content !== "string") {
        return NextResponse.json(
          { error: "Invalid content format" },
          { status: 400 }
        );
      }
      try {
        JSON.parse(content);
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON content" },
          { status: 400 }
        );
      }
      updates.push("content = ?");
      values.push(content);
    }

    // is_favorite 업데이트
    if (is_favorite !== undefined) {
      if (typeof is_favorite !== "boolean") {
        return NextResponse.json(
          { error: "Invalid is_favorite format" },
          { status: 400 }
        );
      }
      updates.push("is_favorite = ?");
      values.push(is_favorite ? 1 : 0);
    }

    // title 업데이트
    if (title !== undefined) {
      if (typeof title !== "string") {
        return NextResponse.json(
          { error: "Invalid title format" },
          { status: 400 }
        );
      }
      updates.push("title = ?");
      values.push(title);
    }

    // icon 업데이트
    if (icon !== undefined) {
      if (icon !== null && typeof icon !== "string") {
        return NextResponse.json(
          { error: "Invalid icon format" },
          { status: 400 }
        );
      }
      updates.push("icon = ?");
      values.push(icon ?? "");
    }

    // 업데이트할 필드가 없으면 에러
    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // updated_at 추가
    updates.push("updated_at = datetime('now')");
    values.push(pageId);

    const stmt = db.prepare(
      `UPDATE pages SET ${updates.join(", ")} WHERE id = ?`
    );
    stmt.run(...values);

    // Return updated page
    const selectStmt = db.prepare(
      "SELECT id, title, icon, cover_url, parent_id, content, is_favorite, sort_order, created_at, updated_at FROM pages WHERE id = ?"
    );
    const updatedPage = selectStmt.get(pageId);

    return NextResponse.json(updatedPage);
  } catch (error) {
    console.error("[PUT /api/pages/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to update page" },
      { status: 500 }
    );
  }
}

/**
 * 재귀적으로 하위 페이지 수를 계산합니다.
 */
function countDescendants(db: Database.Database, pageId: string): number {
  const stmt = db.prepare("SELECT id FROM pages WHERE parent_id = ?");
  const children = stmt.all(pageId) as { id: string }[];

  let count = children.length;
  for (const child of children) {
    count += countDescendants(db, child.id);
  }
  return count;
}

// DELETE /api/pages/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: pageId } = await params;

    // 페이지 존재 여부 확인
    const checkStmt = db.prepare("SELECT id FROM pages WHERE id = ?");
    const page = checkStmt.get(pageId);

    if (!page) {
      db.close();
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // 삭제 전에 하위 페이지 수 계산 (CASCADE로 삭제되므로 미리 계산)
    const descendantCount = countDescendants(db, pageId);
    const deletedCount = 1 + descendantCount; // 본인 + 하위 페이지

    // 페이지 삭제 (CASCADE로 하위 페이지도 자동 삭제)
    const deleteStmt = db.prepare("DELETE FROM pages WHERE id = ?");
    deleteStmt.run(pageId);

    db.close();

    return NextResponse.json({
      success: true,
      deletedCount: deletedCount,
    });
  } catch (error) {
    console.error("[DELETE /api/pages/:id] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete page" },
      { status: 500 }
    );
  }
}
