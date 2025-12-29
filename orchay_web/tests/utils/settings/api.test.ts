/**
 * 설정 API 핸들러 테스트
 * Task: TSK-02-03-02
 * 테스트 명세: 026-test-specification.md
 *
 * Note: 이 테스트는 API 핸들러의 유닛 테스트입니다.
 * 실제 Nuxt 서버를 띄우는 E2E 테스트는 별도로 진행합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { isValidSettingsType } from '../../../server/utils/settings';
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

describe('Settings API Handler', () => {
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

  describe('type validation', () => {
    it('AT-001: should accept columns type', () => {
      expect(isValidSettingsType('columns')).toBe(true);
    });

    it('AT-002: should accept workflows type', () => {
      expect(isValidSettingsType('workflows')).toBe(true);
    });

    it('should reject invalid type', () => {
      expect(isValidSettingsType('invalid')).toBe(false);
      expect(isValidSettingsType('')).toBe(false);
      expect(isValidSettingsType('COLUMNS')).toBe(false);
      expect(isValidSettingsType('column')).toBe(false);
      // categories와 actions는 더 이상 별도 파일이 아님
      expect(isValidSettingsType('categories')).toBe(false);
      expect(isValidSettingsType('actions')).toBe(false);
    });
  });

  describe('default settings structure', () => {
    it('should have correct columns structure', () => {
      expect(DEFAULT_COLUMNS).toHaveProperty('version');
      expect(DEFAULT_COLUMNS).toHaveProperty('columns');
      expect(Array.isArray(DEFAULT_COLUMNS.columns)).toBe(true);
      expect(DEFAULT_COLUMNS.columns.length).toBeGreaterThan(0);

      // Check column structure
      const column = DEFAULT_COLUMNS.columns[0];
      expect(column).toHaveProperty('id');
      expect(column).toHaveProperty('name');
      expect(column).toHaveProperty('order');
      expect(column).toHaveProperty('color');
    });

    it('should have correct workflows structure (v2.0 with states, commands, workflows)', () => {
      expect(DEFAULT_WORKFLOWS).toHaveProperty('version');
      expect(DEFAULT_WORKFLOWS).toHaveProperty('states');
      expect(DEFAULT_WORKFLOWS).toHaveProperty('commands');
      expect(DEFAULT_WORKFLOWS).toHaveProperty('workflows');

      // Check workflows is an object with category keys
      expect(typeof DEFAULT_WORKFLOWS.workflows).toBe('object');
      expect(DEFAULT_WORKFLOWS.workflows).toHaveProperty('development');
      expect(DEFAULT_WORKFLOWS.workflows).toHaveProperty('defect');
      expect(DEFAULT_WORKFLOWS.workflows).toHaveProperty('infrastructure');

      // Check workflow structure
      const workflow = DEFAULT_WORKFLOWS.workflows.development;
      expect(workflow).toHaveProperty('name');
      expect(workflow).toHaveProperty('states');
      expect(workflow).toHaveProperty('transitions');
      expect(workflow).toHaveProperty('actions');
      expect(Array.isArray(workflow.transitions)).toBe(true);
    });

    it('should derive categories from workflows keys', () => {
      const categories = Object.keys(DEFAULT_WORKFLOWS.workflows);
      expect(categories).toContain('development');
      expect(categories).toContain('defect');
      expect(categories).toContain('infrastructure');
      expect(categories.length).toBe(4);
    });

    it('should have actions defined in commands with isAction flag', () => {
      const actionCommands = Object.entries(DEFAULT_WORKFLOWS.commands)
        .filter(([_, cmd]) => cmd.isAction === true)
        .map(([name]) => name);

      expect(actionCommands).toContain('ui');
      expect(actionCommands).toContain('review');
      expect(actionCommands).toContain('test');
      expect(actionCommands).toContain('audit');
    });
  });
});
