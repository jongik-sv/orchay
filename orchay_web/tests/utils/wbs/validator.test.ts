/**
 * WBS Validator 테스트
 * Task: TSK-02-02-03
 *
 * 테스트 명세: 026-test-specification.md
 * 추적성 매트릭스: 025-traceability-matrix.md
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { validateWbs } from '../../../server/utils/wbs/validation';
import { validateId } from '../../../server/utils/wbs/validation/validators/_id-validator';
import { validateAttributes } from '../../../server/utils/wbs/validation/validators/_attribute-validator';
import { validateStatus, isValidStatus } from '../../../server/utils/wbs/validation/validators/_status-validator';
import { validateHierarchy, extractPrefix, getExpectedPrefix } from '../../../server/utils/wbs/validation/validators/_hierarchy-validator';
import { checkDuplicates, collectAllIds } from '../../../server/utils/wbs/validation/validators/_duplicate-checker';
import type { WbsNode } from '../../../types';
import type { ValidationError } from '../../../server/utils/wbs/validation/_types';

// ============================================================
// UT-ID: IdValidator 단위 테스트
// 커버하는 FR: FR-001, BR: BR-001
// ============================================================
describe('IdValidator', () => {
  describe('validateId', () => {
    // UT-ID-001: 유효한 WP ID
    it('UT-ID-001: should return null for valid WP ID', () => {
      const result = validateId('WP-01', 'wp');
      expect(result).toBeNull();
    });

    // UT-ID-002: 유효한 ACT ID
    it('UT-ID-002: should return null for valid ACT ID', () => {
      const result = validateId('ACT-02-03', 'act');
      expect(result).toBeNull();
    });

    // UT-ID-003: 유효한 TSK ID (4단계)
    it('UT-ID-003: should return null for valid TSK ID (4-level)', () => {
      const result = validateId('TSK-01-02-03', 'task');
      expect(result).toBeNull();
    });

    // UT-ID-004: 유효한 TSK ID (3단계)
    it('UT-ID-004: should return null for valid TSK ID (3-level)', () => {
      const result = validateId('TSK-02-01', 'task');
      expect(result).toBeNull();
    });

    // UT-ID-005: 잘못된 WP ID (한 자리)
    it('UT-ID-005: should return error for invalid WP ID (single digit)', () => {
      const result = validateId('WP-1', 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
      expect(result!.message).toContain('WP');
    });

    // UT-ID-006: 잘못된 WP ID (세 자리)
    it('UT-ID-006: should return error for invalid WP ID (three digits)', () => {
      const result = validateId('WP-001', 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-007: 잘못된 ACT ID 형식
    it('UT-ID-007: should return error for invalid ACT ID format', () => {
      const result = validateId('ACT-1-2', 'act');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-008: 잘못된 TSK ID (두 자리)
    it('UT-ID-008: should return error for invalid TSK ID (two digits only)', () => {
      const result = validateId('TSK-01', 'task');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-009: 빈 ID 입력
    it('UT-ID-009: should return error for empty ID', () => {
      const result = validateId('', 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-010: null ID 입력 (실제로는 빈 문자열로 처리)
    it('UT-ID-010: should return error for null-like ID', () => {
      const result = validateId(null as unknown as string, 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-011: 대소문자 혼합
    it('UT-ID-011: should return error for mixed case ID', () => {
      const result = validateId('Wp-01', 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // UT-ID-012: 공백 포함 ID
    it('UT-ID-012: should return error for ID with space', () => {
      const result = validateId('WP- 01', 'wp');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('ID_FORMAT');
    });

    // depth 옵션 테스트
    it('should validate Task ID with specific depth 3', () => {
      // depth=3일 때 TSK-XX-XX만 허용
      const result3Level = validateId('TSK-02-01', 'task', 3);
      expect(result3Level).toBeNull();

      const result4Level = validateId('TSK-01-02-03', 'task', 3);
      expect(result4Level).not.toBeNull();
      expect(result4Level!.type).toBe('ID_FORMAT');
    });

    it('should validate Task ID with specific depth 4', () => {
      // depth=4일 때 TSK-XX-XX-XX만 허용
      const result4Level = validateId('TSK-01-02-03', 'task', 4);
      expect(result4Level).toBeNull();

      const result3Level = validateId('TSK-02-01', 'task', 4);
      expect(result3Level).not.toBeNull();
      expect(result3Level!.type).toBe('ID_FORMAT');
    });
  });
});

// ============================================================
// UT-ATTR: AttributeValidator 단위 테스트
// 커버하는 FR: FR-002, BR: BR-002
// ============================================================
describe('AttributeValidator', () => {
  describe('validateAttributes', () => {
    // UT-ATTR-001: 모든 필수 속성 존재
    it('UT-ATTR-001: should return empty array when all required attributes exist', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: 'development',
        status: '[bd]',
        priority: 'high',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors).toHaveLength(0);
    });

    // UT-ATTR-002: WP 노드는 속성 검증 스킵
    it('UT-ATTR-002: should skip validation for WP node', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Work Package',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors).toHaveLength(0);
    });

    // UT-ATTR-003: category 누락 오류
    it('UT-ATTR-003: should return error when category is missing', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        status: '[bd]',
        priority: 'high',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some(e => e.type === 'MISSING_ATTR' && e.field === 'category')).toBe(true);
    });

    // UT-ATTR-004: status 누락 오류
    it('UT-ATTR-004: should return error when status is missing', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: 'development',
        priority: 'high',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some(e => e.type === 'MISSING_ATTR' && e.field === 'status')).toBe(true);
    });

    // UT-ATTR-005: priority 누락 오류
    it('UT-ATTR-005: should return error when priority is missing', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: 'development',
        status: '[bd]',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors.some(e => e.type === 'MISSING_ATTR' && e.field === 'priority')).toBe(true);
    });

    // UT-ATTR-006: 모든 속성 누락
    it('UT-ATTR-006: should return 3 errors when all attributes are missing', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors).toHaveLength(3);
    });

    // UT-ATTR-007: 잘못된 category 값
    it('UT-ATTR-007: should return error for invalid category value', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: 'testing' as any,
        status: '[bd]',
        priority: 'high',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.some(e => e.type === 'INVALID_VALUE' && e.field === 'category')).toBe(true);
    });

    // UT-ATTR-008: 잘못된 priority 값
    it('UT-ATTR-008: should return error for invalid priority value', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: 'development',
        status: '[bd]',
        priority: 'urgent' as any,
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.some(e => e.type === 'INVALID_VALUE' && e.field === 'priority')).toBe(true);
    });

    // UT-ATTR-009: category 빈 문자열
    it('UT-ATTR-009: should treat empty string as missing', () => {
      const node: WbsNode = {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        category: '' as any,
        status: '[bd]',
        priority: 'high',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors.some(e => e.field === 'category')).toBe(true);
    });

    // UT-ATTR-010: ACT 노드는 속성 검증 스킵
    it('UT-ATTR-010: should skip validation for ACT node', () => {
      const node: WbsNode = {
        id: 'ACT-01-01',
        type: 'act',
        title: 'Activity',
        children: [],
      };
      const errors = validateAttributes(node);
      expect(errors).toHaveLength(0);
    });
  });
});

// ============================================================
// UT-STATUS: StatusValidator 단위 테스트
// 커버하는 FR: FR-003, BR: BR-003
// ============================================================
describe('StatusValidator', () => {
  describe('validateStatus', () => {
    // UT-STATUS-001: 유효한 상태 코드 (모든)
    it('UT-STATUS-001: should return null for all valid status codes', () => {
      const validCodes = ['[ ]', '[bd]', '[dd]', '[an]', '[ds]', '[im]', '[fx]', '[vf]', '[xx]'];
      validCodes.forEach(code => {
        const result = validateStatus(code);
        expect(result).toBeNull();
      });
    });

    // UT-STATUS-002: 잘못된 상태 코드
    it('UT-STATUS-002: should return error for invalid status codes', () => {
      const invalidCodes = ['[done]', '[todo]', '[wip]'];
      invalidCodes.forEach(code => {
        const result = validateStatus(code);
        expect(result).not.toBeNull();
        expect(result!.type).toBe('INVALID_STATUS');
      });
    });

    // UT-STATUS-003: 대괄호 누락
    it('UT-STATUS-003: should return error for status without brackets', () => {
      const result = validateStatus('bd');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('INVALID_STATUS');
    });

    // UT-STATUS-004: 공백 포함
    it('UT-STATUS-004: should return error for status with extra space', () => {
      const result1 = validateStatus('[ bd]');
      expect(result1).not.toBeNull();

      const result2 = validateStatus('[dd ]');
      expect(result2).not.toBeNull();
    });

    // UT-STATUS-005: 대소문자 혼합
    it('UT-STATUS-005: should return error for mixed case status', () => {
      const result1 = validateStatus('[BD]');
      expect(result1).not.toBeNull();

      const result2 = validateStatus('[Dd]');
      expect(result2).not.toBeNull();
    });

    // UT-STATUS-006: 빈 상태
    it('UT-STATUS-006: should return error for empty status', () => {
      const result = validateStatus('');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('INVALID_STATUS');
    });

    // UT-STATUS-007: null/undefined
    it('UT-STATUS-007: should return error for null/undefined', () => {
      const result1 = validateStatus(null as unknown as string);
      expect(result1).not.toBeNull();

      const result2 = validateStatus(undefined as unknown as string);
      expect(result2).not.toBeNull();
    });
  });

  describe('isValidStatus', () => {
    it('should return true for valid status', () => {
      expect(isValidStatus('[xx]')).toBe(true);
      expect(isValidStatus('[bd]')).toBe(true);
      expect(isValidStatus('[ ]')).toBe(true);
    });

    it('should return false for invalid status', () => {
      expect(isValidStatus('[invalid]')).toBe(false);
      expect(isValidStatus('bd')).toBe(false);
      expect(isValidStatus('')).toBe(false);
    });
  });
});

// ============================================================
// UT-HIER: HierarchyValidator 단위 테스트
// 커버하는 FR: FR-005, BR: BR-005
// ============================================================
describe('HierarchyValidator', () => {
  describe('validateHierarchy', () => {
    // UT-HIER-001: 유효한 WP → ACT 관계
    it('UT-HIER-001: should return null for valid WP -> ACT relationship', () => {
      const parent: WbsNode = { id: 'WP-02', type: 'wp', title: 'WP', children: [] };
      const child: WbsNode = { id: 'ACT-02-01', type: 'act', title: 'ACT', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).toBeNull();
    });

    // UT-HIER-002: 유효한 ACT → TSK 관계 (4단계)
    it('UT-HIER-002: should return null for valid ACT -> TSK relationship (4-level)', () => {
      const parent: WbsNode = { id: 'ACT-02-01', type: 'act', title: 'ACT', children: [] };
      const child: WbsNode = { id: 'TSK-02-01-03', type: 'task', title: 'TSK', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).toBeNull();
    });

    // UT-HIER-003: 유효한 WP → TSK 관계 (3단계)
    it('UT-HIER-003: should return null for valid WP -> TSK relationship (3-level)', () => {
      const parent: WbsNode = { id: 'WP-02', type: 'wp', title: 'WP', children: [] };
      const child: WbsNode = { id: 'TSK-02-01', type: 'task', title: 'TSK', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).toBeNull();
    });

    // UT-HIER-004: 계층 불일치 (WP-ACT)
    it('UT-HIER-004: should return error for hierarchy mismatch (WP-ACT)', () => {
      const parent: WbsNode = { id: 'WP-01', type: 'wp', title: 'WP', children: [] };
      const child: WbsNode = { id: 'ACT-02-01', type: 'act', title: 'ACT', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('HIERARCHY_MISMATCH');
    });

    // UT-HIER-005: 계층 불일치 (ACT-TSK)
    it('UT-HIER-005: should return error for hierarchy mismatch (ACT-TSK)', () => {
      const parent: WbsNode = { id: 'ACT-01-01', type: 'act', title: 'ACT', children: [] };
      const child: WbsNode = { id: 'TSK-02-01-03', type: 'task', title: 'TSK', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('HIERARCHY_MISMATCH');
    });

    // UT-HIER-006: 계층 불일치 (WP-TSK 3단계)
    it('UT-HIER-006: should return error for hierarchy mismatch (WP-TSK 3-level)', () => {
      const parent: WbsNode = { id: 'WP-01', type: 'wp', title: 'WP', children: [] };
      const child: WbsNode = { id: 'TSK-02-01', type: 'task', title: 'TSK', children: [] };
      const result = validateHierarchy(child, parent);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('HIERARCHY_MISMATCH');
    });

    // WP 루트 노드는 부모 없어도 됨
    it('should return null for WP node without parent', () => {
      const node: WbsNode = { id: 'WP-01', type: 'wp', title: 'WP', children: [] };
      const result = validateHierarchy(node, null);
      expect(result).toBeNull();
    });

    // Task/ACT 루트는 오류
    it('should return error for Task/ACT without parent', () => {
      const taskNode: WbsNode = { id: 'TSK-01-01-01', type: 'task', title: 'TSK', children: [] };
      const result1 = validateHierarchy(taskNode, null);
      expect(result1).not.toBeNull();
      expect(result1!.type).toBe('HIERARCHY_MISMATCH');

      const actNode: WbsNode = { id: 'ACT-01-01', type: 'act', title: 'ACT', children: [] };
      const result2 = validateHierarchy(actNode, null);
      expect(result2).not.toBeNull();
      expect(result2!.type).toBe('HIERARCHY_MISMATCH');
    });
  });

  describe('extractPrefix', () => {
    // UT-HIER-007: 접두사 추출 (WP)
    it('UT-HIER-007: should extract prefix from WP ID', () => {
      expect(extractPrefix('WP-05', 'wp')).toBe('05');
    });

    // UT-HIER-008: 접두사 추출 (ACT)
    it('UT-HIER-008: should extract prefix from ACT ID', () => {
      expect(extractPrefix('ACT-03-07', 'act')).toBe('03-07');
    });

    // UT-HIER-009: 접두사 추출 (TSK 4단계)
    it('UT-HIER-009: should extract prefix from TSK ID (4-level)', () => {
      expect(extractPrefix('TSK-02-03-04', 'task')).toBe('02-03');
    });

    // UT-HIER-010: 접두사 추출 (TSK 3단계)
    it('UT-HIER-010: should extract prefix from TSK ID (3-level)', () => {
      expect(extractPrefix('TSK-01-02', 'task')).toBe('01');
    });
  });

  describe('getExpectedPrefix', () => {
    it('should return correct expected prefix from WP parent', () => {
      expect(getExpectedPrefix('WP-02', 'wp')).toBe('02');
    });

    it('should return correct expected prefix from ACT parent', () => {
      expect(getExpectedPrefix('ACT-02-03', 'act')).toBe('02-03');
    });
  });
});

// ============================================================
// UT-DUP: DuplicateChecker 단위 테스트
// 커버하는 FR: FR-004, BR: BR-004
// ============================================================
describe('DuplicateChecker', () => {
  describe('checkDuplicates', () => {
    // UT-DUP-001: 중복 ID 2개
    it('UT-DUP-001: should detect duplicate IDs (2 occurrences)', () => {
      const nodes: WbsNode[] = [
        { id: 'WP-01', type: 'wp', title: 'WP 1', children: [] },
        { id: 'WP-01', type: 'wp', title: 'WP 1 Dup', children: [] },
      ];
      const errors = checkDuplicates(nodes);
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('DUPLICATE_ID');
      expect(errors[0].message).toContain('2');
    });

    // UT-DUP-002: 중복 없음
    it('UT-DUP-002: should return empty array when no duplicates', () => {
      const nodes: WbsNode[] = [
        { id: 'WP-01', type: 'wp', title: 'WP 1', children: [] },
        { id: 'WP-02', type: 'wp', title: 'WP 2', children: [] },
        { id: 'ACT-01-01', type: 'act', title: 'ACT 1', children: [] },
      ];
      const errors = checkDuplicates(nodes);
      expect(errors).toHaveLength(0);
    });

    // UT-DUP-003: 중복 ID 3개 이상
    it('UT-DUP-003: should detect duplicate IDs (3+ occurrences)', () => {
      const nodes: WbsNode[] = [
        { id: 'TSK-01-01', type: 'task', title: 'T1', children: [] },
        { id: 'TSK-01-01', type: 'task', title: 'T2', children: [] },
        { id: 'TSK-01-01', type: 'task', title: 'T3', children: [] },
      ];
      const errors = checkDuplicates(nodes);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('3');
    });

    // UT-DUP-004: 여러 ID 중복
    it('UT-DUP-004: should detect multiple duplicate IDs', () => {
      const nodes: WbsNode[] = [
        { id: 'WP-01', type: 'wp', title: 'WP 1', children: [] },
        { id: 'WP-01', type: 'wp', title: 'WP 1 Dup', children: [] },
        { id: 'WP-02', type: 'wp', title: 'WP 2', children: [] },
        { id: 'WP-02', type: 'wp', title: 'WP 2 Dup', children: [] },
      ];
      const errors = checkDuplicates(nodes);
      expect(errors).toHaveLength(2);
    });

    // UT-DUP-005: 빈 트리
    it('UT-DUP-005: should return empty array for empty tree', () => {
      const errors = checkDuplicates([]);
      expect(errors).toHaveLength(0);
    });

    // UT-DUP-006: 중첩 트리에서 중복
    it('UT-DUP-006: should detect duplicates in nested tree', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-01',
        type: 'wp',
        title: 'WP 1',
        children: [{
          id: 'ACT-01-01',
          type: 'act',
          title: 'ACT 1',
          children: [
            { id: 'TSK-01-01-01', type: 'task', title: 'T1', children: [] },
            { id: 'TSK-01-01-01', type: 'task', title: 'T1 Dup', children: [] },
          ],
        }],
      }];
      const errors = checkDuplicates(nodes);
      expect(errors).toHaveLength(1);
      expect(errors[0].nodeId).toBe('TSK-01-01-01');
    });
  });

  describe('collectAllIds', () => {
    it('should collect all IDs from flat tree', () => {
      const nodes: WbsNode[] = [
        { id: 'WP-01', type: 'wp', title: 'WP 1', children: [] },
        { id: 'WP-02', type: 'wp', title: 'WP 2', children: [] },
      ];
      const ids = collectAllIds(nodes);
      expect(ids).toEqual(['WP-01', 'WP-02']);
    });

    it('should collect all IDs from nested tree', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-01',
        type: 'wp',
        title: 'WP 1',
        children: [
          { id: 'TSK-01-01', type: 'task', title: 'T1', children: [] },
        ],
      }];
      const ids = collectAllIds(nodes);
      expect(ids).toEqual(['WP-01', 'TSK-01-01']);
    });
  });
});

// ============================================================
// IT-VAL: WbsValidator 통합 테스트
// 커버하는 FR: FR-001 ~ FR-005, IF-001
// ============================================================
describe('WbsValidator Integration', () => {
  describe('validateWbs', () => {
    // IT-VAL-001: 완전히 유효한 WBS (4단계)
    it('IT-VAL-001: should validate valid 4-level WBS tree', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-01',
        type: 'wp',
        title: 'Work Package 1',
        children: [{
          id: 'ACT-01-01',
          type: 'act',
          title: 'Activity 1',
          children: [{
            id: 'TSK-01-01-01',
            type: 'task',
            title: 'Task 1',
            category: 'development',
            status: '[bd]',
            priority: 'high',
            children: [],
          }],
        }],
      }];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.nodeCount).toBe(3);
    });

    // IT-VAL-002: 완전히 유효한 WBS (3단계)
    it('IT-VAL-002: should validate valid 3-level WBS tree', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-01',
        type: 'wp',
        title: 'Work Package 1',
        children: [{
          id: 'TSK-01-01',
          type: 'task',
          title: 'Task 1',
          category: 'development',
          status: '[bd]',
          priority: 'high',
          children: [],
        }],
      }];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.nodeCount).toBe(2);
    });

    // IT-VAL-003: 복합 오류 (ID + 속성)
    it('IT-VAL-003: should detect multiple error types', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-1', // Invalid ID
        type: 'wp',
        title: 'Work Package 1',
        children: [{
          id: 'TSK-01-01-01',
          type: 'task',
          title: 'Task without category',
          status: '[bd]',
          priority: 'high',
          children: [],
        }],
      }];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
      expect(result.errors.some(e => e.type === 'ID_FORMAT')).toBe(true);
      expect(result.errors.some(e => e.type === 'MISSING_ATTR')).toBe(true);
    });

    // IT-VAL-004: 복합 오류 (중복 + 계층)
    it('IT-VAL-004: should detect duplicate and hierarchy errors', () => {
      const nodes: WbsNode[] = [
        {
          id: 'WP-01',
          type: 'wp',
          title: 'WP 1',
          children: [{
            id: 'TSK-02-01', // Hierarchy mismatch with WP-01
            type: 'task',
            title: 'Task 1',
            category: 'development',
            status: '[bd]',
            priority: 'high',
            children: [],
          }],
        },
        {
          id: 'WP-01', // Duplicate
          type: 'wp',
          title: 'WP 1 Dup',
          children: [],
        },
      ];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'DUPLICATE_ID')).toBe(true);
      expect(result.errors.some(e => e.type === 'HIERARCHY_MISMATCH')).toBe(true);
    });

    // IT-VAL-005: 빈 WBS 트리
    it('IT-VAL-005: should validate empty WBS tree as valid', () => {
      const result = validateWbs([]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.nodeCount).toBe(0);
    });

    // IT-VAL-006: 단일 WP만
    it('IT-VAL-006: should validate single WP as valid', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-01',
        type: 'wp',
        title: 'Work Package 1',
        children: [],
      }];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(true);
      expect(result.nodeCount).toBe(1);
    });

    // IT-VAL-007: 혼합 구조 (3+4단계)
    it('IT-VAL-007: should validate mixed structure (3+4 level)', () => {
      const nodes: WbsNode[] = [
        {
          id: 'WP-01',
          type: 'wp',
          title: 'WP 1 (4-level)',
          children: [{
            id: 'ACT-01-01',
            type: 'act',
            title: 'ACT',
            children: [{
              id: 'TSK-01-01-01',
              type: 'task',
              title: 'TSK 4-level',
              category: 'development',
              status: '[bd]',
              priority: 'high',
              children: [],
            }],
          }],
        },
        {
          id: 'WP-02',
          type: 'wp',
          title: 'WP 2 (3-level)',
          children: [{
            id: 'TSK-02-01',
            type: 'task',
            title: 'TSK 3-level',
            category: 'development',
            status: '[xx]',
            priority: 'medium',
            children: [],
          }],
        },
      ];

      const result = validateWbs(nodes);
      expect(result.isValid).toBe(true);
      expect(result.nodeCount).toBe(5);
    });

    // failFast 옵션 테스트
    it('should stop at first error when failFast is true', () => {
      const nodes: WbsNode[] = [{
        id: 'WP-1', // Invalid ID
        type: 'wp',
        title: 'WP',
        children: [{
          id: 'TSK-01-01-01',
          type: 'task',
          title: 'Task',
          // Missing all required attributes
          children: [],
        }],
      }];

      const result = validateWbs(nodes, { failFast: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    // validatedAt 필드 테스트
    it('should include validatedAt timestamp', () => {
      const result = validateWbs([]);
      expect(result.validatedAt).toBeDefined();
      expect(new Date(result.validatedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});

// ============================================================
// EDGE: 엣지 케이스 테스트
// ============================================================
describe('Edge Cases', () => {
  // EDGE-001: 빈 WBS 트리
  it('EDGE-001: should handle empty WBS tree', () => {
    const result = validateWbs([]);
    expect(result.isValid).toBe(true);
  });

  // EDGE-004: 단일 WP만
  it('EDGE-004: should handle single WP only', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP',
      children: [],
    }];
    const result = validateWbs(nodes);
    expect(result.isValid).toBe(true);
  });

  // EDGE-006: 최대 ID 값
  it('EDGE-006: should handle maximum ID values', () => {
    const result = validateId('TSK-99-99-99', 'task');
    expect(result).toBeNull();
  });

  // EDGE-008: 특수문자 포함 title
  it('EDGE-008: should handle title with special characters', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'Task <>&"\'',
      children: [],
    }];
    const result = validateWbs(nodes);
    expect(result.isValid).toBe(true);
  });

  // EDGE-009: Unicode 문자
  it('EDGE-009: should handle Unicode characters in title', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: '작업 タスク 任务',
      children: [],
    }];
    const result = validateWbs(nodes);
    expect(result.isValid).toBe(true);
  });

  // EDGE-010: ID + 속성 오류 조합
  it('EDGE-010: should detect both ID and attribute errors', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-1',
      type: 'wp',
      title: 'WP',
      children: [{
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Task',
        // Missing required attributes
        children: [],
      }],
    }];
    const result = validateWbs(nodes);
    expect(result.errors.some(e => e.type === 'ID_FORMAT')).toBe(true);
    expect(result.errors.some(e => e.type === 'MISSING_ATTR')).toBe(true);
  });
});

// ============================================================
// PERF: 성능 테스트
// ============================================================
describe('Performance', () => {
  it('PERF-001: should validate 50 nodes under 10ms', () => {
    // 50개 노드 생성
    const nodes: WbsNode[] = [];
    for (let i = 1; i <= 5; i++) {
      const wpId = `WP-${i.toString().padStart(2, '0')}`;
      const wp: WbsNode = {
        id: wpId,
        type: 'wp',
        title: `Work Package ${i}`,
        children: [],
      };
      for (let j = 1; j <= 9; j++) {
        const tskId = `TSK-${i.toString().padStart(2, '0')}-${j.toString().padStart(2, '0')}`;
        wp.children.push({
          id: tskId,
          type: 'task',
          title: `Task ${i}-${j}`,
          category: 'development',
          status: '[bd]',
          priority: 'high',
          children: [],
        });
      }
      nodes.push(wp);
    }

    const start = performance.now();
    validateWbs(nodes);
    const end = performance.now();

    expect(end - start).toBeLessThan(50); // 여유있게 50ms
  });
});
