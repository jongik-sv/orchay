/**
 * 프로젝트 경로 관리 테스트
 * Task: TSK-02-03-03
 * 테스트 명세: 026-test-specification.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getBasePath,
  getProjectsBasePath,
  getProjectDir,
  getProjectFilePath,
  validateProjectId,
} from '../../../server/utils/projects/paths';

describe('ProjectPaths', () => {
  const originalEnv = process.env.ORCHAY_BASE_PATH;

  beforeEach(() => {
    // 환경 변수 초기화
    delete process.env.ORCHAY_BASE_PATH;
  });

  afterEach(() => {
    // 환경 변수 복원
    if (originalEnv) {
      process.env.ORCHAY_BASE_PATH = originalEnv;
    } else {
      delete process.env.ORCHAY_BASE_PATH;
    }
  });

  describe('getBasePath', () => {
    it('should return current working directory when ORCHAY_BASE_PATH is not set', () => {
      const result = getBasePath();
      expect(result).toBe(process.cwd());
    });

    it('should return normalized ORCHAY_BASE_PATH when set', () => {
      process.env.ORCHAY_BASE_PATH = 'C:\\test\\path';
      const result = getBasePath();
      expect(result).toContain('test');
      expect(result).toContain('path');
    });

    it('should reject path traversal attack (..)', () => {
      process.env.ORCHAY_BASE_PATH = '../malicious';
      const result = getBasePath();
      expect(result).toBe(process.cwd()); // 공격 시도 시 cwd 반환
    });
  });

  describe('getProjectsBasePath', () => {
    it('should return .orchay/projects path', () => {
      const result = getProjectsBasePath();
      expect(result).toContain('.orchay');
      expect(result).toContain('projects');
    });
  });

  describe('getProjectDir', () => {
    it('should return project directory path', () => {
      const result = getProjectDir('test-project');
      expect(result).toContain('.orchay');
      expect(result).toContain('projects');
      expect(result).toContain('test-project');
    });

    it('should throw error for invalid project ID (uppercase)', () => {
      expect(() => getProjectDir('TestProject')).toThrow('영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용');
    });

    it('should throw error for invalid project ID (special characters)', () => {
      // 언더스코어는 허용되므로 느낌표 같은 특수문자만 거부됨
      expect(() => getProjectDir('test_project!')).toThrow('영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용');
    });
  });

  describe('getProjectFilePath', () => {
    it('should return project.json path', () => {
      const result = getProjectFilePath('test-project', 'project.json');
      expect(result).toContain('test-project');
      expect(result).toContain('project.json');
    });

    it('should return team.json path', () => {
      const result = getProjectFilePath('test-project', 'team.json');
      expect(result).toContain('test-project');
      expect(result).toContain('team.json');
    });
  });

  describe('validateProjectId', () => {
    it('should accept valid project ID (lowercase, numbers, hyphens)', () => {
      expect(() => validateProjectId('test-project-123')).not.toThrow();
    });

    it('should accept valid project ID with Korean characters', () => {
      expect(() => validateProjectId('테스트-프로젝트')).not.toThrow();
    });

    it('should accept valid project ID with underscore', () => {
      expect(() => validateProjectId('test_project')).not.toThrow();
    });

    it('should reject uppercase letters', () => {
      expect(() => validateProjectId('TestProject')).toThrow('영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용');
    });

    it('should reject special characters (exclamation, etc)', () => {
      expect(() => validateProjectId('test-project!')).toThrow('영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용');
    });

    it('should reject path traversal (..)', () => {
      expect(() => validateProjectId('../etc/passwd')).toThrow();
    });

    it('should reject path with slashes', () => {
      expect(() => validateProjectId('test/project')).toThrow('영소문자, 숫자, 한글, 하이픈, 언더스코어만 허용');
    });
  });
});
