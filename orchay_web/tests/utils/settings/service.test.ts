/**
 * 설정 서비스 함수 테스트
 * Task: TSK-02-03-02
 * 테스트 명세: 026-test-specification.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import {
  getColumns,
  getCategories,
  getWorkflows,
  getActionCommands,
  getSettingsByType,
  isValidSettingsType,
} from '../../../server/utils/settings';
import { refreshCache } from '../../../server/utils/settings/_cache';
import {
  DEFAULT_COLUMNS,
  DEFAULT_WORKFLOWS,
} from '../../../server/utils/settings/defaults';

// Mock fs/promises
vi.mock('fs/promises');

// Mock paths module
vi.mock('../../../server/utils/settings/paths', () => ({
  getSettingsFilePath: vi.fn((type: string) => `/mock/path/${type}.json`),
}));

describe('Settings Service', () => {
  beforeEach(() => {
    refreshCache();
    vi.clearAllMocks();
    // 기본: 파일 없음 → 기본값 사용
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(readFile).mockRejectedValue(error);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('type-specific getters', () => {
    it('UT-007: should return columns config', async () => {
      // When: getColumns 호출
      const columns = await getColumns();

      // Then: ColumnsConfig 반환
      expect(columns).toHaveProperty('version');
      expect(columns).toHaveProperty('columns');
      expect(Array.isArray(columns.columns)).toBe(true);
    });

    it('UT-008: should return categories as string array from workflows keys', async () => {
      // When: getCategories 호출
      const categories = await getCategories();

      // Then: string[] 반환 (workflows.workflows의 키들)
      expect(Array.isArray(categories)).toBe(true);
      expect(categories).toContain('development');
      expect(categories).toContain('defect');
      expect(categories).toContain('infrastructure');
    });

    it('UT-009: should return workflows config', async () => {
      // When: getWorkflows 호출
      const workflows = await getWorkflows();

      // Then: WorkflowsConfig 반환
      expect(workflows).toHaveProperty('version');
      expect(workflows).toHaveProperty('states');
      expect(workflows).toHaveProperty('commands');
      expect(workflows).toHaveProperty('workflows');
    });

    it('UT-010: should return action commands from workflows.commands', async () => {
      // When: getActionCommands 호출
      const actionCommands = await getActionCommands();

      // Then: isAction=true인 명령어 목록 반환
      expect(Array.isArray(actionCommands)).toBe(true);
      expect(actionCommands).toContain('ui');
      expect(actionCommands).toContain('review');
      expect(actionCommands).toContain('test');
      expect(actionCommands).toContain('audit');
      // 상태 전이 명령어는 포함되지 않음
      expect(actionCommands).not.toContain('start');
      expect(actionCommands).not.toContain('done');
    });
  });

  describe('getSettingsByType', () => {
    it('should return columns when type is columns', async () => {
      const result = await getSettingsByType('columns');
      expect(result).toEqual(DEFAULT_COLUMNS);
    });

    it('should return workflows when type is workflows', async () => {
      const result = await getSettingsByType('workflows');
      expect(result).toEqual(DEFAULT_WORKFLOWS);
    });
  });

  describe('isValidSettingsType', () => {
    it('should return true for valid types', () => {
      expect(isValidSettingsType('columns')).toBe(true);
      expect(isValidSettingsType('workflows')).toBe(true);
    });

    it('UT-011: should return false for invalid types', () => {
      expect(isValidSettingsType('invalid')).toBe(false);
      expect(isValidSettingsType('')).toBe(false);
      expect(isValidSettingsType('column')).toBe(false);
      expect(isValidSettingsType('COLUMNS')).toBe(false);
      // categories와 actions는 더 이상 별도 설정 타입이 아님
      expect(isValidSettingsType('categories')).toBe(false);
      expect(isValidSettingsType('actions')).toBe(false);
    });
  });
});
