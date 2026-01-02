/**
 * SQLite Database Utility Tests
 *
 * TSK-00-04: 데이터베이스 CRUD 기능 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { db, getDb, resetDb, CreatePageInput, UpdatePageInput } from '../db';

const DB_PATH = path.join(process.cwd(), 'data', 'database.db');

describe('DatabaseManager', () => {
  beforeEach(() => {
    // 각 테스트 전에 DB 파일 삭제 및 싱글톤 초기화
    if (fs.existsSync(DB_PATH)) {
      fs.unlinkSync(DB_PATH);
    }
    resetDb();
  });

  afterEach(() => {
    // 각 테스트 후 정리
    resetDb();
  });

  describe('CREATE', () => {
    it('새 페이지를 생성해야 함', () => {
      const input: CreatePageInput = {
        title: 'Test Page',
        icon: '🧪',
        is_favorite: false,
        sort_order: 0,
      };

      const page = db.createPage(input);

      expect(page).toBeDefined();
      expect(page.id).toBeDefined();
      expect(page.title).toBe('Test Page');
      expect(page.icon).toBe('🧪');
      expect(page.is_favorite).toBe(false);
      expect(page.sort_order).toBe(0);
      expect(page.created_at).toBeDefined();
      expect(page.updated_at).toBeDefined();
    });

    it('ID를 명시하면 해당 ID로 페이지를 생성해야 함', () => {
      const customId = uuidv4();
      const input: CreatePageInput = {
        id: customId,
        title: 'Custom ID Page',
      };

      const page = db.createPage(input);

      expect(page.id).toBe(customId);
    });

    it('기본값으로 Untitled 타이틀을 설정해야 함', () => {
      const input: CreatePageInput = {};

      const page = db.createPage(input);

      expect(page.title).toBe('Untitled');
    });

    it('부모 페이지 ID를 설정할 수 있어야 함', () => {
      const parent = db.createPage({ title: 'Parent Page' });
      const input: CreatePageInput = {
        title: 'Child Page',
        parent_id: parent.id,
      };

      const child = db.createPage(input);

      expect(child.parent_id).toBe(parent.id);
    });

    it('content를 JSON으로 저장할 수 있어야 함', () => {
      const content = JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
      });
      const input: CreatePageInput = {
        title: 'Content Page',
        content,
      };

      const page = db.createPage(input);

      expect(page.content).toBe(content);
    });
  });

  describe('READ', () => {
    it('ID로 페이지를 조회할 수 있어야 함', () => {
      const created = db.createPage({ title: 'Find Me' });

      const found = db.getPageById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe('Find Me');
    });

    it('없는 ID로 조회하면 undefined를 반환해야 함', () => {
      const found = db.getPageById('non-existent-id');

      expect(found).toBeUndefined();
    });

    it('모든 페이지를 조회할 수 있어야 함', () => {
      db.createPage({ title: 'Page 1', sort_order: 1 });
      db.createPage({ title: 'Page 2', sort_order: 2 });
      db.createPage({ title: 'Page 3', sort_order: 3 });

      const pages = db.getAllPages();

      expect(pages).toHaveLength(3);
      expect(pages[0].title).toBe('Page 1');
      expect(pages[1].title).toBe('Page 2');
      expect(pages[2].title).toBe('Page 3');
    });

    it('자식 페이지를 조회할 수 있어야 함', () => {
      const parent = db.createPage({ title: 'Parent' });
      db.createPage({ title: 'Child 1', parent_id: parent.id, sort_order: 1 });
      db.createPage({ title: 'Child 2', parent_id: parent.id, sort_order: 2 });
      db.createPage({ title: 'Orphan' }); // parent_id 없음

      const children = db.getChildPages(parent.id);

      expect(children).toHaveLength(2);
      expect(children[0].title).toBe('Child 1');
      expect(children[1].title).toBe('Child 2');
    });

    it('즐겨찾기 페이지만 조회할 수 있어야 함', () => {
      db.createPage({ title: 'Favorite 1', is_favorite: true });
      db.createPage({ title: 'Normal Page', is_favorite: false });
      db.createPage({ title: 'Favorite 2', is_favorite: true });

      const favorites = db.getFavoritePages();

      expect(favorites).toHaveLength(2);
      expect(favorites[0].title).toBe('Favorite 1');
      expect(favorites[1].title).toBe('Favorite 2');
    });
  });

  describe('UPDATE', () => {
    it('페이지를 업데이트할 수 있어야 함', () => {
      const page = db.createPage({ title: 'Original Title' });

      const input: UpdatePageInput = {
        id: page.id,
        title: 'Updated Title',
      };

      const updated = db.updatePage(input);

      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
    });

    it('여러 필드를 동시에 업데이트할 수 있어야 함', () => {
      const page = db.createPage({
        title: 'Original',
        icon: '📄',
        is_favorite: false,
      });

      const input: UpdatePageInput = {
        id: page.id,
        title: 'Updated',
        icon: '📝',
        is_favorite: true,
      };

      const updated = db.updatePage(input);

      expect(updated?.title).toBe('Updated');
      expect(updated?.icon).toBe('📝');
      expect(updated?.is_favorite).toBe(true);
    });

    it('업�데이트 시 updated_at이 변경되어야 함', async () => {
      const page = db.createPage({ title: 'Test' });
      const originalUpdatedAt = page.updated_at;

      // 1ms 대기 (시간 차이 보장)
      await new Promise((resolve) => setTimeout(resolve, 10));

      db.updatePage({ id: page.id, title: 'Updated' });

      const updated = db.getPageById(page.id);
      expect(updated?.updated_at).not.toBe(originalUpdatedAt);
    });

    it('없는 페이지 업데이트 시 undefined를 반환해야 함', () => {
      const result = db.updatePage({ id: 'non-existent', title: 'Test' });

      expect(result).toBeUndefined();
    });
  });

  describe('DELETE', () => {
    it('페이지를 삭제할 수 있어야 함', () => {
      const page = db.createPage({ title: 'To Delete' });

      const deleted = db.deletePage(page.id);

      expect(deleted).toBe(true);

      const found = db.getPageById(page.id);
      expect(found).toBeUndefined();
    });

    it('없는 페이지 삭제 시 false를 반환해야 함', () => {
      const deleted = db.deletePage('non-existent-id');

      expect(deleted).toBe(false);
    });

    it('부모 페이지 삭제 시 자식 페이지도 삭제되어야 함 (CASCADE)', () => {
      const parent = db.createPage({ title: 'Parent' });
      const child = db.createPage({ title: 'Child', parent_id: parent.id });

      db.deletePage(parent.id);

      const parentFound = db.getPageById(parent.id);
      const childFound = db.getPageById(child.id);

      expect(parentFound).toBeUndefined();
      expect(childFound).toBeUndefined();
    });
  });

  describe('Sort Order', () => {
    it('sort_order 순서대로 페이지를 정렬해야 함', () => {
      db.createPage({ title: 'First', sort_order: 2 });
      db.createPage({ title: 'Second', sort_order: 1 });
      db.createPage({ title: 'Third', sort_order: 3 });

      const pages = db.getAllPages();

      expect(pages[0].title).toBe('Second');
      expect(pages[1].title).toBe('First');
      expect(pages[2].title).toBe('Third');
    });

    it('sort_order가 같으면 created_at 순서대로 정렬해야 함', async () => {
      const first = db.createPage({ title: 'First', sort_order: 0 });

      // 10ms 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      const second = db.createPage({ title: 'Second', sort_order: 0 });

      const pages = db.getAllPages();

      expect(pages[0].id).toBe(first.id);
      expect(pages[1].id).toBe(second.id);
    });
  });

  describe('Edge Cases', () => {
    it('빈 문자열 title은 Untitled로 기본 설정됨', () => {
      const page = db.createPage({ title: '' });

      expect(page.title).toBe('Untitled');
    });

    it('null 값 필드를 올바르게 처리해야 함', () => {
      const page = db.createPage({
        title: 'Test',
        icon: undefined,
        cover_url: undefined,
        parent_id: undefined,
      });

      expect(page.icon).toBeUndefined();
      expect(page.cover_url).toBeUndefined();
      expect(page.parent_id).toBeUndefined();
    });

    it('대용량 content 저장 가능해야 함', () => {
      const largeContent = 'x'.repeat(10000);
      const page = db.createPage({
        title: 'Large Content',
        content: largeContent,
      });

      expect(page.content).toBe(largeContent);
    });
  });
});
