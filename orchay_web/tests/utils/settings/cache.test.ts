/**
 * 설정 캐시 모듈 테스트
 * Task: TSK-02-03-02
 * 테스트 명세: 026-test-specification.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import {
  loadSettings,
  isCacheValid,
  refreshCache,
} from '../../../server/utils/settings/_cache';
import {
  DEFAULT_COLUMNS,
  DEFAULT_WORKFLOWS,
} from '../../../server/utils/settings/defaults';

// Mock fs/promises
vi.mock('fs/promises');

// Mock paths module to return predictable paths
vi.mock('../../../server/utils/settings/paths', () => ({
  getSettingsFilePath: vi.fn((type: string) => `/mock/path/${type}.json`),
}));

describe('Settings Cache Module', () => {
  beforeEach(() => {
    // 캐시 초기화
    refreshCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSettings', () => {
    it('UT-001: should load settings from files when all files exist', async () => {
      // Given: 모든 설정 파일이 존재
      const mockColumns = { ...DEFAULT_COLUMNS, version: '2.0' };
      const mockWorkflows = { ...DEFAULT_WORKFLOWS, version: '3.0' };

      vi.mocked(readFile).mockImplementation((path: unknown) => {
        const pathStr = String(path);
        if (pathStr.includes('columns')) return Promise.resolve(JSON.stringify(mockColumns));
        if (pathStr.includes('workflows')) return Promise.resolve(JSON.stringify(mockWorkflows));
        return Promise.reject(new Error('Unknown file'));
      });

      // When: loadSettings 호출
      const settings = await loadSettings();

      // Then: 파일에서 로드된 설정 반환
      expect(settings.columns).toEqual(mockColumns);
      expect(settings.workflows).toEqual(mockWorkflows);
    });

    it('UT-002: should use default settings when files do not exist', async () => {
      // Given: 파일이 존재하지 않음 (ENOENT)
      const error = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      // When: loadSettings 호출
      const settings = await loadSettings();

      // Then: 기본값 반환
      expect(settings.columns).toEqual(DEFAULT_COLUMNS);
      expect(settings.workflows).toEqual(DEFAULT_WORKFLOWS);
    });

    it('UT-003: should fallback to defaults and log warning on JSON parse error', async () => {
      // Given: 잘못된 JSON 파일
      vi.mocked(readFile).mockResolvedValue('{ invalid json }');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // When: loadSettings 호출
      const settings = await loadSettings();

      // Then: 기본값 반환 및 경고 로그
      expect(settings.columns).toEqual(DEFAULT_COLUMNS);
      expect(settings.workflows).toEqual(DEFAULT_WORKFLOWS);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('caching behavior', () => {
    it('UT-004: should return cached settings without file read on subsequent calls', async () => {
      // Given: 첫 번째 호출 완료
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(DEFAULT_COLUMNS));
      await loadSettings();
      vi.mocked(readFile).mockClear();

      // When: 두 번째 호출
      const settings = await loadSettings();

      // Then: 파일 읽기 없이 캐시 반환
      expect(readFile).not.toHaveBeenCalled();
      expect(settings).toBeDefined();
    });

    it('UT-005: should return true when cache is valid', async () => {
      // Given: 설정 로드 완료
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(DEFAULT_COLUMNS));
      await loadSettings();

      // When: 캐시 유효성 확인
      const isValid = isCacheValid();

      // Then: true 반환
      expect(isValid).toBe(true);
    });

    it('UT-006: should invalidate cache and reload on refreshCache', async () => {
      // Given: 캐시된 상태
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(DEFAULT_COLUMNS));
      await loadSettings();
      vi.mocked(readFile).mockClear();

      // When: 캐시 무효화
      refreshCache();

      // Then: 다음 호출에서 재로드
      expect(isCacheValid()).toBe(false);
      await loadSettings();
      expect(readFile).toHaveBeenCalled();
    });
  });
});
