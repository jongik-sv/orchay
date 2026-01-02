/**
 * ProjectService Unit Tests
 *
 * @see TSK-02-03-03
 * @see 026-test-specification.md
 *
 * Test Coverage:
 * - UT-002: getProject 정상 조회
 * - UT-003: createProject 정상 생성
 * - UT-004: createProject 중복 ID
 * - UT-005: updateProject 정상 수정
 * - UT-006: updateProject ID 변경 시도
 * - UT-010: getProject 존재하지 않는 프로젝트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as yaml from 'yaml';
import * as projectService from '../../../server/utils/projects/projectService';
import * as paths from '../../../server/utils/projects/paths';

// Mock fs/promises
vi.mock('fs/promises');

// Mock yaml
vi.mock('yaml', () => ({
  parse: vi.fn((content: string) => JSON.parse(content)),
  stringify: vi.fn((obj: unknown) => JSON.stringify(obj, null, 2)),
}));

// Mock paths module
vi.mock('../../../server/utils/projects/paths', () => ({
  getProjectDir: vi.fn((id: string) => `/test/.orchay/projects/${id}`),
  getProjectFilePath: vi.fn((id: string, fileName: string) => `/test/.orchay/projects/${id}/${fileName}`),
  validateProjectId: vi.fn(),
  getBasePath: vi.fn(() => '/test'),
}));

describe('ProjectService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getProject', () => {
    /**
     * UT-002: ProjectService.getProject 정상 조회
     * @requirement FR-002
     */
    it('UT-002: should return project with team', async () => {
      // Arrange: Mock wbs.yaml 데이터 (WbsYaml 구조)
      const mockWbsYaml = {
        project: {
          id: 'test-project',
          name: '테스트 프로젝트',
          description: 'E2E 테스트용 프로젝트',
          version: '0.1.0',
          status: 'active',
          wbsDepth: 3,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          scheduledStart: '2025-01-01',
          scheduledEnd: '2025-06-30',
        },
        wbs: {
          version: '1.0',
          depth: 3,
          projectRoot: 'test-project',
        },
        workPackages: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockWbsYaml));

      // Act
      const result = await projectService.getProject('test-project');

      // Assert
      expect(result).toHaveProperty('id', 'test-project');
      expect(result).toHaveProperty('name', '테스트 프로젝트');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    /**
     * UT-010: ProjectService.getProject 존재하지 않는 프로젝트
     * @requirement FR-002
     */
    it('UT-010: should throw on non-existent project', async () => {
      // Arrange: 파일 없음 시뮬레이션
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      // Act & Assert: PROJECT_NOT_FOUND 에러 발생
      await expect(projectService.getProject('non-existent')).rejects.toThrow();
    });

    it('should throw on file read error', async () => {
      // Arrange: 일반 읽기 오류
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      // Act & Assert
      await expect(projectService.getProject('test-project')).rejects.toThrow();
    });
  });

  describe('createProject', () => {
    /**
     * UT-003: ProjectService.createProject 정상 생성
     * @requirement FR-003, BR-001, BR-004
     */
    it('UT-003: should create project with valid ID', async () => {
      // Arrange
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const createDto = {
        id: 'new-project',
        name: '새 프로젝트',
        description: '새로운 프로젝트 설명',
        wbsDepth: 4 as const,
      };

      // Act
      const result = await projectService.createProject(createDto);

      // Assert
      expect(result).toHaveProperty('id', 'new-project');
      expect(result).toHaveProperty('name', '새 프로젝트');
      expect(result).toHaveProperty('description', '새로운 프로젝트 설명');
      expect(result).toHaveProperty('version', '0.1.0');
      expect(result).toHaveProperty('status', 'active');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');

      // 폴더 생성 호출 확인
      expect(fs.mkdir).toHaveBeenCalled();
      // 파일 쓰기 호출 확인 (wbs.yaml, team.json)
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should create project with minimal fields', async () => {
      // Arrange
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const createDto = {
        id: 'minimal-project',
        name: '최소 프로젝트',
        wbsDepth: 4 as const,
      };

      // Act
      const result = await projectService.createProject(createDto);

      // Assert
      expect(result.id).toBe('minimal-project');
      expect(result.description).toBe('');
    });

    it('should throw on file system error during creation', async () => {
      // Arrange
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));

      const createDto = {
        id: 'fail-project',
        name: 'Fail Project',
        wbsDepth: 4 as const,
      };

      // Act & Assert
      await expect(projectService.createProject(createDto)).rejects.toThrow();
    });
  });

  describe('updateProject', () => {
    /**
     * UT-005: ProjectService.updateProject 정상 수정
     * @requirement FR-004
     */
    it('UT-005: should update project fields', async () => {
      // Arrange: 기존 wbs.yaml 구조
      const existingWbsYaml = {
        project: {
          id: 'test-project',
          name: '기존 프로젝트',
          description: '기존 설명',
          version: '0.1.0',
          status: 'active',
          wbsDepth: 3,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
        wbs: {
          version: '1.0',
          depth: 3,
        },
        workPackages: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingWbsYaml));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const updateDto = {
        name: '수정된 이름',
        description: '수정된 설명',
      };

      // Act
      const result = await projectService.updateProject('test-project', updateDto);

      // Assert
      expect(result.name).toBe('수정된 이름');
      expect(result.description).toBe('수정된 설명');
      expect(result.id).toBe('test-project'); // ID 불변
      expect(result.updatedAt).not.toBe(existingWbsYaml.project.updatedAt); // updatedAt 갱신
      expect(fs.writeFile).toHaveBeenCalled();
    });

    /**
     * UT-006: ProjectService.updateProject ID 변경 시도
     * @requirement BR-002
     */
    it('UT-006: should throw on ID change attempt', async () => {
      // Arrange
      const updateDto = {
        id: 'new-id', // ID 변경 시도
        name: 'New Name',
      } as any;

      // Act & Assert: ID_IMMUTABLE 에러 발생
      await expect(projectService.updateProject('test-project', updateDto)).rejects.toThrow();
    });

    it('should preserve unchanged fields', async () => {
      // Arrange: 기존 wbs.yaml 구조
      const existingWbsYaml = {
        project: {
          id: 'test-project',
          name: '기존 프로젝트',
          description: '기존 설명',
          version: '1.0.0',
          status: 'active',
          wbsDepth: 3,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          scheduledStart: '2025-01-01',
          scheduledEnd: '2025-12-31',
        },
        wbs: {
          version: '1.0',
          depth: 3,
        },
        workPackages: [],
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingWbsYaml));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      // Act: name만 수정
      const result = await projectService.updateProject('test-project', { name: '새 이름' });

      // Assert: 다른 필드는 그대로
      expect(result.description).toBe('기존 설명');
      expect(result.version).toBe('1.0.0');
      expect(result.scheduledStart).toBe('2025-01-01');
    });

    it('should throw on non-existent project', async () => {
      // Arrange
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      // Act & Assert
      await expect(projectService.updateProject('non-existent', { name: 'New' })).rejects.toThrow();
    });
  });
});
