/**
 * ProjectsListService Unit Tests
 *
 * @see TSK-03-01
 * @see 026-test-specification.md
 *
 * 리팩토링됨: 폴더 스캔 방식 테스트
 * - projects.json 마스터 목록 제거됨
 * - projects/ 폴더 스캔하여 프로젝트 목록 생성
 * - wbs.yaml의 project 섹션에서 정보 읽기
 *
 * Test Coverage:
 * - UT-001: getProjectsList 정상 조회
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { Dirent } from 'fs';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import * as projectsListService from '../../../server/utils/projects/projectsListService';

// Mock fs/promises
vi.mock('fs/promises');

// Mock yaml
vi.mock('yaml', () => ({
  parse: vi.fn((content: string) => JSON.parse(content)),
}));

// Mock paths module - 폴더 스캔 방식에 필요한 모든 함수 mock
vi.mock('../../../server/utils/projects/paths', () => ({
  getBasePath: vi.fn(() => '/test'),
  getProjectsBasePath: vi.fn(() => '/test/.orchay/projects'),
  getProjectFilePath: vi.fn((projectId: string, fileName: string) => `/test/.orchay/projects/${projectId}/${fileName}`),
}));

/**
 * Dirent mock 생성 헬퍼
 */
function createMockDirent(name: string, isDir: boolean): Dirent {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: `/test/.orchay/projects/${name}`,
    parentPath: '/test/.orchay/projects',
  } as Dirent;
}

describe('ProjectsListService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProjectsList', () => {
    /**
     * UT-001: ProjectsListService.getList 정상 조회
     * @requirement FR-001
     *
     * 폴더 스캔 방식:
     * 1. readdir로 projects/ 폴더 스캔
     * 2. 각 프로젝트 폴더의 wbs.yaml 읽기
     */
    it('UT-001: should return project list with default config', async () => {
      // Arrange: 폴더 스캔 mock
      const mockDirents = [
        createMockDirent('test-project', true),
        createMockDirent('archived-project', true),
      ];

      // wbs.yaml 내용 mock (WbsYaml 구조)
      const testProjectWbs = {
        project: {
          id: 'test-project',
          name: '테스트 프로젝트',
          status: 'active',
          wbsDepth: 4,
          createdAt: '2025-01-01',
        },
        wbs: { version: '1.0', depth: 4 },
        workPackages: [],
      };

      const archivedProjectWbs = {
        project: {
          id: 'archived-project',
          name: '아카이브 프로젝트',
          status: 'archived',
          wbsDepth: 3,
          createdAt: '2024-06-01',
        },
        wbs: { version: '1.0', depth: 3 },
        workPackages: [],
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockDirents as unknown as Dirent[]);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes('test-project/wbs.yaml')) {
          return JSON.stringify(testProjectWbs);
        }
        if (pathStr.includes('archived-project/wbs.yaml')) {
          return JSON.stringify(archivedProjectWbs);
        }
        throw new Error(`Unexpected path: ${pathStr}`);
      });

      // Act: 프로젝트 목록 조회
      const result = await projectsListService.getProjectsList();

      // Assert: 응답 검증
      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('defaultProject');
      expect(result.projects).toHaveLength(2);
      expect(result.defaultProject).toBeNull();
      // 최신순 정렬 (2025-01-01 > 2024-06-01)
      expect(result.projects[0].id).toBe('test-project');
    });

    it('UT-001a: should return empty list when no projects folder exists', async () => {
      // Arrange: projects 폴더 없음 시뮬레이션
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readdir).mockRejectedValue(error);
      vi.mocked(fs.readFile).mockRejectedValue(error);

      // Act
      const result = await projectsListService.getProjectsList();

      // Assert: 기본값 반환
      expect(result.projects).toEqual([]);
      expect(result.defaultProject).toBeNull();
    });

    it('UT-001b: should filter by status when statusFilter is provided', async () => {
      // Arrange: 폴더 스캔 mock
      const mockDirents = [
        createMockDirent('active-1', true),
        createMockDirent('archived-1', true),
      ];

      const activeWbs = {
        project: {
          id: 'active-1',
          name: 'Active 1',
          status: 'active',
          wbsDepth: 4,
          createdAt: '2025-01-01',
        },
        wbs: { version: '1.0', depth: 4 },
        workPackages: [],
      };

      const archivedWbs = {
        project: {
          id: 'archived-1',
          name: 'Archived 1',
          status: 'archived',
          wbsDepth: 3,
          createdAt: '2024-06-01',
        },
        wbs: { version: '1.0', depth: 3 },
        workPackages: [],
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockDirents as unknown as Dirent[]);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes('active-1/wbs.yaml')) {
          return JSON.stringify(activeWbs);
        }
        if (pathStr.includes('archived-1/wbs.yaml')) {
          return JSON.stringify(archivedWbs);
        }
        throw new Error(`Unexpected path: ${pathStr}`);
      });

      // Act: active 필터
      const result = await projectsListService.getProjectsList('active');

      // Assert
      expect(result.projects).toHaveLength(1);
      expect(result.projects[0].status).toBe('active');
    });
  });

  describe('isProjectIdDuplicate', () => {
    it('should return true for existing project ID', async () => {
      // Arrange: 폴더에 프로젝트 존재
      const mockDirents = [createMockDirent('existing-project', true)];

      const projectWbs = {
        project: {
          id: 'existing-project',
          name: 'Existing',
          status: 'active',
          wbsDepth: 4,
          createdAt: '2025-01-01',
        },
        wbs: { version: '1.0', depth: 4 },
        workPackages: [],
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockDirents as unknown as Dirent[]);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes('existing-project/wbs.yaml')) {
          return JSON.stringify(projectWbs);
        }
        throw new Error(`Unexpected path: ${pathStr}`);
      });

      // Act
      const result = await projectsListService.isProjectIdDuplicate('existing-project');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for non-existing project ID', async () => {
      // Arrange: 빈 프로젝트 폴더
      vi.mocked(fs.readdir).mockResolvedValue([]);

      // Act
      const result = await projectsListService.isProjectIdDuplicate('new-project');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('addProjectToList', () => {
    it('should add project to list successfully (중복 확인만 수행)', async () => {
      // Arrange: 빈 프로젝트 폴더 (중복 없음)
      vi.mocked(fs.readdir).mockResolvedValue([]);

      const newProject = {
        id: 'new-project',
        name: '새 프로젝트',
        path: 'new-project',
        status: 'active' as const,
        wbsDepth: 4 as const,
        createdAt: '2025-01-01',
      };

      // Act & Assert: 에러 없이 완료 (실제 폴더 생성은 projectFacade에서 수행)
      await expect(projectsListService.addProjectToList(newProject)).resolves.not.toThrow();
      // 폴더 스캔 방식에서는 writeFile 호출하지 않음
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should throw error on duplicate project ID', async () => {
      // Arrange: 이미 프로젝트 존재
      const mockDirents = [createMockDirent('existing', true)];

      const projectWbs = {
        project: {
          id: 'existing',
          name: 'Existing',
          status: 'active',
          wbsDepth: 4,
          createdAt: '2025-01-01',
        },
        wbs: { version: '1.0', depth: 4 },
        workPackages: [],
      };

      vi.mocked(fs.readdir).mockResolvedValue(mockDirents as unknown as Dirent[]);
      vi.mocked(fs.readFile).mockImplementation(async (path) => {
        const pathStr = String(path);
        if (pathStr.includes('existing/wbs.yaml')) {
          return JSON.stringify(projectWbs);
        }
        throw new Error(`Unexpected path: ${pathStr}`);
      });

      const duplicateProject = {
        id: 'existing',
        name: 'Duplicate',
        path: 'existing',
        status: 'active' as const,
        wbsDepth: 4 as const,
        createdAt: '2025-01-01',
      };

      // Act & Assert
      await expect(projectsListService.addProjectToList(duplicateProject)).rejects.toThrow();
    });
  });
});
