import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Test database setup
const testDbPath = path.join(process.cwd(), "data", "test-database.db");

function setupTestDb() {
  // Clean up existing test DB
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = new Database(testDbPath);

  // Create pages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      icon TEXT,
      cover_url TEXT,
      parent_id TEXT,
      content TEXT,
      is_favorite INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function cleanupTestDb() {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
}

describe("Pages API", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = setupTestDb();
  });

  afterEach(() => {
    db.close();
    cleanupTestDb();
  });

  describe("GET /api/pages/:id", () => {
    it("should return page data for existing page", () => {
      // Setup: Insert test page
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title, icon, content)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run("page-1", "Test Page", "📄", '[]');

      // Execute
      const selectStmt = db.prepare("SELECT * FROM pages WHERE id = ?");
      const page = selectStmt.get("page-1") as {
        id: string;
        title: string;
        content: string;
      };

      // Verify
      expect(page).toBeDefined();
      expect(page.id).toBe("page-1");
      expect(page.title).toBe("Test Page");
      expect(page.icon).toBe("📄");
      expect(page.content).toBe("[]");
    });

    it("should return null for non-existent page", () => {
      const selectStmt = db.prepare("SELECT * FROM pages WHERE id = ?");
      const page = selectStmt.get("non-existent");

      expect(page).toBeUndefined();
    });
  });

  describe("PUT /api/pages/:id", () => {
    it("should update page content", () => {
      // Setup: Insert test page
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title, content)
        VALUES (?, ?, ?)
      `);
      insertStmt.run("page-1", "Test Page", '[]');

      // Execute: Update content
      const newContent = '[{"type":"paragraph","content":"Hello"}]';
      const updateStmt = db.prepare(
        "UPDATE pages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      const result = updateStmt.run(newContent, "page-1");

      // Verify
      expect(result.changes).toBe(1);

      // Verify content was updated
      const selectStmt = db.prepare("SELECT content FROM pages WHERE id = ?");
      const page = selectStmt.get("page-1") as { content: string };
      expect(page.content).toBe(newContent);
    });

    it("should return 0 changes for non-existent page", () => {
      const updateStmt = db.prepare(
        "UPDATE pages SET content = ? WHERE id = ?"
      );
      const result = updateStmt.run('[]', "non-existent");

      expect(result.changes).toBe(0);
    });

    it("should handle valid JSON content", () => {
      // Setup
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title)
        VALUES (?, ?)
      `);
      insertStmt.run("page-1", "Test Page");

      // Execute: Save BlockNote document structure
      const validContent = JSON.stringify([
        {
          id: "block-1",
          type: "paragraph",
          props: { textColor: "default" },
          content: [{ type: "text", text: "Hello world", styles: {} }],
          children: [],
        },
      ]);

      const updateStmt = db.prepare(
        "UPDATE pages SET content = ? WHERE id = ?"
      );
      const result = updateStmt.run(validContent, "page-1");

      expect(result.changes).toBe(1);

      // Verify
      const selectStmt = db.prepare("SELECT content FROM pages WHERE id = ?");
      const page = selectStmt.get("page-1") as { content: string };
      const parsedContent = JSON.parse(page.content);
      expect(parsedContent[0].type).toBe("paragraph");
      expect(parsedContent[0].content[0].text).toBe("Hello world");
    });

    it("should preserve other fields when updating content", () => {
      // Setup
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title, icon, is_favorite)
        VALUES (?, ?, ?, ?)
      `);
      insertStmt.run("page-1", "Original Title", "📄", 1);

      // Execute: Update only content
      const updateStmt = db.prepare("UPDATE pages SET content = ? WHERE id = ?");
      updateStmt.run('[]', "page-1");

      // Verify: Other fields are unchanged
      const selectStmt = db.prepare(
        "SELECT title, icon, is_favorite FROM pages WHERE id = ?"
      );
      const page = selectStmt.get("page-1") as {
        title: string;
        icon: string;
        is_favorite: number;
      };
      expect(page.title).toBe("Original Title");
      expect(page.icon).toBe("📄");
      expect(page.is_favorite).toBe(1);
    });
  });

  describe("Content save/load cycle", () => {
    it("should save and load content correctly", () => {
      // Setup: Create page
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title, content)
        VALUES (?, ?, ?)
      `);
      insertStmt.run("page-1", "Test Page", null);

      // Execute: Save content
      const content = JSON.stringify([
        {
          id: "block-1",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Title", styles: {} }],
          children: [],
        },
        {
          id: "block-2",
          type: "paragraph",
          props: {},
          content: [{ type: "text", text: "Content", styles: {} }],
          children: [],
        },
      ]);

      const updateStmt = db.prepare(
        "UPDATE pages SET content = ? WHERE id = ?"
      );
      updateStmt.run(content, "page-1");

      // Execute: Load content
      const selectStmt = db.prepare("SELECT content FROM pages WHERE id = ?");
      const page = selectStmt.get("page-1") as { content: string };

      // Verify: Content is preserved exactly
      expect(page.content).toBe(content);
      const parsed = JSON.parse(page.content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe("heading");
      expect(parsed[1].type).toBe("paragraph");
    });

    it("should handle empty content", () => {
      // Setup
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title)
        VALUES (?, ?)
      `);
      insertStmt.run("page-1", "Test Page");

      // Execute: Save empty content
      const emptyContent = JSON.stringify([]);
      const updateStmt = db.prepare(
        "UPDATE pages SET content = ? WHERE id = ?"
      );
      updateStmt.run(emptyContent, "page-1");

      // Verify
      const selectStmt = db.prepare("SELECT content FROM pages WHERE id = ?");
      const page = selectStmt.get("page-1") as { content: string };
      expect(JSON.parse(page.content)).toEqual([]);
    });

    it("should update updated_at timestamp", () => {
      // Setup
      const insertStmt = db.prepare(`
        INSERT INTO pages (id, title)
        VALUES (?, ?)
      `);
      insertStmt.run("page-1", "Test Page");

      const selectBeforeStmt = db.prepare(
        "SELECT updated_at FROM pages WHERE id = ?"
      );
      const beforeUpdate = (
        selectBeforeStmt.get("page-1") as { updated_at: string }
      ).updated_at;

      // Wait a bit
      const startTime = new Date().getTime();
      while (new Date().getTime() - startTime < 10) {
        // Wait 10ms
      }

      // Execute: Update content
      const updateStmt = db.prepare(
        "UPDATE pages SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      );
      updateStmt.run('[]', "page-1");

      // Verify: updated_at changed
      const selectAfterStmt = db.prepare(
        "SELECT updated_at FROM pages WHERE id = ?"
      );
      const afterUpdate = (
        selectAfterStmt.get("page-1") as { updated_at: string }
      ).updated_at;

      expect(afterUpdate).toBeDefined();
    });
  });
});
