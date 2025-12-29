/**
 * WBS 서비스 단위 테스트
 * Task: TSK-03-02
 * 테스트 명세: 026-test-specification.md 섹션 3.1-3.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { getWbsTree, saveWbsTree } from '../../../server/utils/wbs/wbsService';
import { getProjectPath, getWbsPath } from '../../../server/utils/file';
import type { WbsMetadata, WbsNode } from '../../../types';

const TEST_PROJECT_ID = 'test-wbs-service';

describe('WbsService', () => {
  beforeEach(async () => {
    // 테스트 프로젝트 폴더 생성
    const projectPath = getProjectPath(TEST_PROJECT_ID);
    await fs.mkdir(projectPath, { recursive: true });
  });

  afterEach(async () => {
    // 테스트 프로젝트 삭제
    const projectPath = getProjectPath(TEST_PROJECT_ID);
    await fs.rm(projectPath, { recursive: true, force: true });
  });

  describe('getWbsTree', () => {
    it('UT-WBS-01-01: 유효한 wbs.md (4단계) 파싱 성공', async () => {
      // Arrange
      const wbsPath = getWbsPath(TEST_PROJECT_ID);
      const wbsContent = `# WBS - Test Project

> version: 1.0
> depth: 4
> updated: 2025-12-14
> start: 2025-12-13

---

## WP-01: Test Work Package
- status: planned
- priority: high

### ACT-01-01: Test Activity
- status: todo

#### TSK-01-01-01: Test Task
- category: development
- status: basic-design [bd]
- priority: critical
`;

      await fs.writeFile(wbsPath, wbsContent, 'utf-8');

      // Act
      const result = await getWbsTree(TEST_PROJECT_ID);

      // Assert
      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.depth).toBe(4);
      expect(result.metadata.updated).toBe('2025-12-14');
      expect(result.tree).toBeInstanceOf(Array);
      expect(result.tree.length).toBeGreaterThan(0);
    });

    it('UT-WBS-01-03: 빈 wbs.md (메타데이터만) 파싱 성공', async () => {
      // Arrange
      const wbsPath = getWbsPath(TEST_PROJECT_ID);
      const wbsContent = `# WBS - Empty Project

> version: 1.0
> depth: 3
> updated: 2025-12-14
> start: 2025-12-13

---
`;

      await fs.writeFile(wbsPath, wbsContent, 'utf-8');

      // Act
      const result = await getWbsTree(TEST_PROJECT_ID);

      // Assert
      expect(result.metadata.version).toBe('1.0');
      expect(result.metadata.depth).toBe(3);
      expect(result.tree).toEqual([]);
    });

    it('UT-WBS-01-04: wbs.md 없음 - PROJECT_NOT_FOUND 에러', async () => {
      // Act & Assert
      await expect(getWbsTree(TEST_PROJECT_ID)).rejects.toThrow('프로젝트를 찾을 수 없습니다');
    });
  });

  describe('saveWbsTree', () => {
    it('UT-WBS-02-01: 유효한 WbsNode[] 저장 성공', async () => {
      // Arrange
      const metadata: WbsMetadata = {
        version: '1.0',
        depth: 3,
        updated: '2025-12-14',
        start: '2025-12-13',
      };

      const tree: WbsNode[] = [
        {
          id: 'WP-01',
          type: 'wp',
          title: 'Test Work Package',
          status: 'planned',
          children: [
            {
              id: 'TSK-01-01',
              type: 'task',
              title: 'Test Task',
              category: 'development',
              status: '[bd]',
              priority: 'high',
              children: [],
            },
          ],
        },
      ];

      // Act
      const result = await saveWbsTree(TEST_PROJECT_ID, metadata, tree);

      // Assert
      expect(result.success).toBe(true);
      expect(result.updated).toBeTruthy();

      // 파일이 생성되었는지 확인
      const wbsPath = getWbsPath(TEST_PROJECT_ID);
      const exists = await fs.access(wbsPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('UT-WBS-02-04: 유효성 검증 실패 - VALIDATION_ERROR', async () => {
      // Arrange
      const metadata: WbsMetadata = {
        version: '1.0',
        depth: 3,
        updated: '2025-12-14',
        start: '2025-12-13',
      };

      // 중복 ID를 가진 트리
      const tree: WbsNode[] = [
        {
          id: 'TSK-01-01',
          type: 'task',
          title: 'Task 1',
          category: 'development',
          children: [],
        },
        {
          id: 'TSK-01-01', // 중복 ID
          type: 'task',
          title: 'Task 2',
          category: 'development',
          children: [],
        },
      ];

      // Act & Assert
      await expect(saveWbsTree(TEST_PROJECT_ID, metadata, tree)).rejects.toThrow('유효하지 않습니다');
    });

    it('UT-WBS-03-01: updated 필드 자동 갱신', async () => {
      // Arrange
      const metadata: WbsMetadata = {
        version: '1.0',
        depth: 3,
        updated: '2025-12-13', // 과거 날짜
        start: '2025-12-13',
      };

      const tree: WbsNode[] = [
        {
          id: 'WP-01',
          type: 'wp',
          title: 'Test WP',
          children: [
            {
              id: 'TSK-01-01',
              type: 'task',
              title: 'Test Task',
              category: 'development',
              status: '[bd]',
              priority: 'high',
              children: [],
            },
          ],
        },
      ];

      // Act
      const result = await saveWbsTree(TEST_PROJECT_ID, metadata, tree);

      // Assert
      expect(result.updated).not.toBe('2025-12-13'); // 자동 갱신됨
      expect(result.updated).toBeTruthy();

      // 저장된 파일에서 updated 확인
      const savedData = await getWbsTree(TEST_PROJECT_ID);
      expect(savedData.metadata.updated).toBe(result.updated);
    });
  });
});
