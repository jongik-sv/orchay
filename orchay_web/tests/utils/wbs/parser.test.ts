/**
 * wbs-parser 테스트
 * Task: TSK-02-02-01
 *
 * 테스트 명세: 026-test-specification.md
 * 추적성 매트릭스: 025-traceability-matrix.md
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseWbsMarkdown } from '../../../server/utils/wbs/parser';
import { parseNodeHeader } from '../../../server/utils/wbs/parser/_header';
import { parseNodeAttributes } from '../../../server/utils/wbs/parser/_attributes';
import { buildTree, calculateProgress, determineParentId } from '../../../server/utils/wbs/parser/_tree';
import type { WbsNode } from '../../../types';

// 테스트 픽스처 경로 - 프로젝트 루트 기준
const FIXTURES_PATH = resolve(process.cwd(), 'tests/fixtures/wbs');

// 픽스처 로드 헬퍼
const loadFixture = (name: string): string => {
  return readFileSync(resolve(FIXTURES_PATH, name), 'utf-8');
};

// ============================================================
// TC-001: parseNodeHeader 단위 테스트
// 커버하는 FR: FR-001, BR: BR-001, BR-002
// ============================================================
describe('parseNodeHeader', () => {
  // TC-001-001: 정상 WP 헤더
  it('TC-001-001: should parse valid WP header', () => {
    const input = '## WP-01: Platform Infrastructure';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('WP-01');
    expect(result!.type).toBe('wp');
    expect(result!.title).toBe('Platform Infrastructure');
    expect(result!.level).toBe(2);
  });

  // TC-001-002: 정상 ACT 헤더 (4단계)
  it('TC-001-002: should parse valid ACT header (4-level)', () => {
    const input = '### ACT-01-02: Project Setup';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('ACT-01-02');
    expect(result!.type).toBe('act');
    expect(result!.title).toBe('Project Setup');
    expect(result!.level).toBe(3);
  });

  // TC-001-003: 정상 TSK 헤더 (4단계)
  it('TC-001-003: should parse valid TSK header (4-level)', () => {
    const input = '#### TSK-01-02-03: 초기화';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('TSK-01-02-03');
    expect(result!.type).toBe('task');
    expect(result!.title).toBe('초기화');
    expect(result!.level).toBe(4);
  });

  // TC-001-004: 정상 TSK 헤더 (3단계)
  it('TC-001-004: should parse valid TSK header (3-level)', () => {
    const input = '### TSK-01-02: 설정';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('TSK-01-02');
    expect(result!.type).toBe('task');
    expect(result!.title).toBe('설정');
    expect(result!.level).toBe(3);
  });

  // TC-001-005: 제목에 특수문자 포함
  it('TC-001-005: should parse title with special characters', () => {
    const input = '## WP-02: Data & Storage';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('WP-02');
    expect(result!.title).toBe('Data & Storage');
  });

  // TC-001-006: 제목에 한글 포함
  it('TC-001-006: should parse title with Korean characters', () => {
    const input = '## WP-03: 데이터 레이어';
    const result = parseNodeHeader(input);

    expect(result).not.toBeNull();
    expect(result!.id).toBe('WP-03');
    expect(result!.title).toBe('데이터 레이어');
  });

  // TC-001-007: 잘못된 헤더 형식 (: 없음)
  it('TC-001-007: should return null for invalid header format (missing colon)', () => {
    const input = '## WP-01 Platform';
    const result = parseNodeHeader(input);

    expect(result).toBeNull();
  });

  // TC-001-008: 잘못된 ID 형식
  it('TC-001-008: should return null for invalid ID format', () => {
    const input = '## WRONG-01: Test';
    const result = parseNodeHeader(input);

    expect(result).toBeNull();
  });

  // TC-001-009: 빈 제목
  it('TC-001-009: should return null for empty title', () => {
    const input = '## WP-01: ';
    const result = parseNodeHeader(input);

    expect(result).toBeNull();
  });

  // TC-001-010: 공백만 있는 제목
  it('TC-001-010: should return null for whitespace-only title', () => {
    const input = '## WP-01:    ';
    const result = parseNodeHeader(input);

    expect(result).toBeNull();
  });
});

// ============================================================
// TC-002: parseNodeAttributes 단위 테스트
// 커버하는 FR: FR-002, BR: BR-005
// ============================================================
describe('parseNodeAttributes', () => {
  // TC-002-001: category 속성 파싱
  it('TC-002-001: should parse category attribute', () => {
    const lines = ['- category: development'];
    const result = parseNodeAttributes(lines);

    expect(result.category).toBe('development');
  });

  // TC-002-002: status 속성 파싱 (상태 코드 추출)
  it('TC-002-002: should parse status attribute and extract status code', () => {
    const lines = ['- status: done [xx]'];
    const result = parseNodeAttributes(lines);

    expect(result.status).toBe('[xx]');
  });

  // TC-002-003: priority 속성 파싱
  it('TC-002-003: should parse priority attribute', () => {
    const lines = ['- priority: high'];
    const result = parseNodeAttributes(lines);

    expect(result.priority).toBe('high');
  });

  // TC-002-004: assignee 속성 파싱
  it('TC-002-004: should parse assignee attribute', () => {
    const lines = ['- assignee: hong'];
    const result = parseNodeAttributes(lines);

    expect(result.assignee).toBe('hong');
  });

  // TC-002-005: schedule 속성 파싱
  it('TC-002-005: should parse schedule attribute', () => {
    const lines = ['- schedule: 2025-12-01 ~ 2025-12-31'];
    const result = parseNodeAttributes(lines);

    expect(result.schedule).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  // TC-002-006: tags 속성 파싱
  it('TC-002-006: should parse tags attribute', () => {
    const lines = ['- tags: parser, markdown, wbs'];
    const result = parseNodeAttributes(lines);

    expect(result.tags).toEqual(['parser', 'markdown', 'wbs']);
  });

  // TC-002-007: depends 속성 파싱
  it('TC-002-007: should parse depends attribute', () => {
    const lines = ['- depends: TSK-01-02'];
    const result = parseNodeAttributes(lines);

    expect(result.depends).toEqual(['TSK-01-02']);
  });

  // TC-002-008: requirements 속성 파싱 (다중 라인)
  it('TC-002-008: should parse requirements attribute (multi-line)', () => {
    const lines = [
      '- requirements:',
      '  - Nuxt 3 설치',
      '  - TypeScript 설정',
    ];
    const result = parseNodeAttributes(lines);

    expect(result.requirements).toEqual(['Nuxt 3 설치', 'TypeScript 설정']);
  });

  // TC-002-009: ref 속성 파싱
  it('TC-002-009: should parse ref attribute', () => {
    const lines = ['- ref: PRD 7.2'];
    const result = parseNodeAttributes(lines);

    expect(result.ref).toBe('PRD 7.2');
  });

  // TC-002-010: 잘못된 category 값
  it('TC-002-010: should handle invalid category value', () => {
    const lines = ['- category: invalid'];
    const result = parseNodeAttributes(lines);

    expect(result.category).toBeUndefined();
  });

  // TC-002-011: 상태 코드 없는 status
  it('TC-002-011: should handle status without code', () => {
    const lines = ['- status: done'];
    const result = parseNodeAttributes(lines);

    // 코드가 없으면 전체 값 그대로 또는 undefined
    expect(result.status).toBeUndefined();
  });

  // TC-002-012: 잘못된 날짜 형식
  it('TC-002-012: should handle invalid date format', () => {
    const lines = ['- schedule: 2025/12/01 ~ 2025/12/31'];
    const result = parseNodeAttributes(lines);

    expect(result.schedule).toBeUndefined();
  });

  // TC-002-013: 빈 requirements
  it('TC-002-013: should handle empty requirements', () => {
    const lines = ['- requirements:'];
    const result = parseNodeAttributes(lines);

    expect(result.requirements).toEqual([]);
  });

  // TC-002-014: 복수 depends
  it('TC-002-014: should handle multiple depends', () => {
    const lines = ['- depends: TSK-01-01, TSK-01-02'];
    const result = parseNodeAttributes(lines);

    // depends는 배열로 저장 (split 처리)
    expect(result.depends).toEqual(['TSK-01-01', 'TSK-01-02']);
  });

  // TC-002-015: 모든 속성 동시 파싱
  it('TC-002-015: should parse all attributes together', () => {
    const lines = [
      '- category: development',
      '- status: done [xx]',
      '- priority: high',
      '- assignee: hong',
      '- schedule: 2025-12-01 ~ 2025-12-31',
      '- tags: parser, markdown',
      '- depends: TSK-01-01',
      '- requirements:',
      '  - Requirement 1',
      '  - Requirement 2',
      '- ref: PRD 7.2',
    ];
    const result = parseNodeAttributes(lines);

    expect(result.category).toBe('development');
    expect(result.status).toBe('[xx]');
    expect(result.priority).toBe('high');
    expect(result.assignee).toBe('hong');
    expect(result.schedule).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(result.tags).toEqual(['parser', 'markdown']);
    expect(result.depends).toEqual(['TSK-01-01']);
    expect(result.requirements).toEqual(['Requirement 1', 'Requirement 2']);
    expect(result.ref).toBe('PRD 7.2');
  });
});

// ============================================================
// TC-003: buildTree 단위 테스트
// 커버하는 FR: FR-003, BR: BR-003, BR-004
// ============================================================
describe('buildTree', () => {
  // TC-003-001: 4단계 구조 (WP → ACT → TSK)
  it('TC-003-001: should build 4-level tree (WP -> ACT -> TSK)', () => {
    const flatNodes = [
      { id: 'WP-01', type: 'wp' as const, title: 'Platform', level: 2, attributes: {} },
      { id: 'ACT-01-01', type: 'act' as const, title: 'Setup', level: 3, attributes: {} },
      { id: 'TSK-01-01-01', type: 'task' as const, title: 'Initialize', level: 4, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('WP-01');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe('ACT-01-01');
    expect(result[0].children[0].children).toHaveLength(1);
    expect(result[0].children[0].children[0].id).toBe('TSK-01-01-01');
  });

  // TC-003-002: 3단계 구조 (WP → TSK)
  it('TC-003-002: should build 3-level tree (WP -> TSK)', () => {
    const flatNodes = [
      { id: 'WP-02', type: 'wp' as const, title: 'Feature', level: 2, attributes: {} },
      { id: 'TSK-02-01', type: 'task' as const, title: 'Task 1', level: 3, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('WP-02');
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].id).toBe('TSK-02-01');
  });

  // TC-003-003: 혼합 구조 (3단계 + 4단계)
  it('TC-003-003: should build mixed tree (3-level + 4-level)', () => {
    const flatNodes = [
      { id: 'WP-01', type: 'wp' as const, title: 'Platform', level: 2, attributes: {} },
      { id: 'ACT-01-01', type: 'act' as const, title: 'Setup', level: 3, attributes: {} },
      { id: 'TSK-01-01-01', type: 'task' as const, title: 'Init', level: 4, attributes: {} },
      { id: 'WP-02', type: 'wp' as const, title: 'Feature', level: 2, attributes: {} },
      { id: 'TSK-02-01', type: 'task' as const, title: 'Task', level: 3, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    expect(result).toHaveLength(2);
    // WP-01 has 4-level structure
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0].children).toHaveLength(1);
    // WP-02 has 3-level structure
    expect(result[1].children).toHaveLength(1);
    expect(result[1].children[0].id).toBe('TSK-02-01');
  });

  // TC-003-004: 복수 WP
  it('TC-003-004: should handle multiple WP as root nodes', () => {
    const flatNodes = [
      { id: 'WP-01', type: 'wp' as const, title: 'WP 1', level: 2, attributes: {} },
      { id: 'WP-02', type: 'wp' as const, title: 'WP 2', level: 2, attributes: {} },
      { id: 'WP-03', type: 'wp' as const, title: 'WP 3', level: 2, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('WP-01');
    expect(result[1].id).toBe('WP-02');
    expect(result[2].id).toBe('WP-03');
  });

  // TC-003-005: 복수 자식
  it('TC-003-005: should handle multiple children', () => {
    const flatNodes = [
      { id: 'WP-01', type: 'wp' as const, title: 'WP 1', level: 2, attributes: {} },
      { id: 'ACT-01-01', type: 'act' as const, title: 'ACT 1', level: 3, attributes: {} },
      { id: 'ACT-01-02', type: 'act' as const, title: 'ACT 2', level: 3, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].id).toBe('ACT-01-01');
    expect(result[0].children[1].id).toBe('ACT-01-02');
  });

  // TC-003-006: 고아 노드 (부모 없음)
  it('TC-003-006: should handle orphan node (missing parent)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const flatNodes = [
      { id: 'TSK-99-99-99', type: 'task' as const, title: 'Orphan', level: 4, attributes: {} },
    ];

    const result = buildTree(flatNodes);

    // 고아 노드는 루트에 추가
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('TSK-99-99-99');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ============================================================
// TC-004: calculateProgress 단위 테스트
// 커버하는 FR: FR-004
// ============================================================
describe('calculateProgress', () => {
  // TC-004-001: 모든 Task 완료
  it('TC-004-001: should calculate 100% when all tasks are completed', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP 1',
      children: [
        { id: 'TSK-01-01', type: 'task', title: 'Task 1', status: '[xx]', children: [] },
        { id: 'TSK-01-02', type: 'task', title: 'Task 2', status: '[xx]', children: [] },
        { id: 'TSK-01-03', type: 'task', title: 'Task 3', status: '[xx]', children: [] },
      ],
    }];

    calculateProgress(nodes);

    expect(nodes[0].progress).toBe(100);
    expect(nodes[0].taskCount).toBe(3);
  });

  // TC-004-002: 일부 Task 완료
  it('TC-004-002: should calculate 50% when half tasks are completed', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP 1',
      children: [
        { id: 'TSK-01-01', type: 'task', title: 'Task 1', status: '[xx]', children: [] },
        { id: 'TSK-01-02', type: 'task', title: 'Task 2', status: '[xx]', children: [] },
        { id: 'TSK-01-03', type: 'task', title: 'Task 3', status: '[ ]', children: [] },
        { id: 'TSK-01-04', type: 'task', title: 'Task 4', status: '[ ]', children: [] },
      ],
    }];

    calculateProgress(nodes);

    expect(nodes[0].progress).toBe(50);
    expect(nodes[0].taskCount).toBe(4);
  });

  // TC-004-003: 진행 중 Task 포함 (상태별 가중치 적용)
  // 상태별 가중치: [ ]=0%, [bd]=20%, [dd]=40%, [im]=60%, [vf]=80%, [xx]=100%
  it('TC-004-003: should calculate weighted progress for in-progress tasks', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP 1',
      children: [
        { id: 'TSK-01-01', type: 'task', title: 'Task 1', status: '[ ]', children: [] },
        { id: 'TSK-01-02', type: 'task', title: 'Task 2', status: '[bd]', children: [] },
        { id: 'TSK-01-03', type: 'task', title: 'Task 3', status: '[im]', children: [] },
      ],
    }];

    calculateProgress(nodes);

    // (0 + 20 + 60) / 3 = 26.67% → 27% (반올림)
    expect(nodes[0].progress).toBe(27);
    expect(nodes[0].taskCount).toBe(3);
  });

  // TC-004-004: 중첩 구조 진행률
  it('TC-004-004: should calculate progress for nested structure', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP 1',
      children: [{
        id: 'ACT-01-01',
        type: 'act',
        title: 'ACT 1',
        children: [
          { id: 'TSK-01-01-01', type: 'task', title: 'Task 1', status: '[xx]', children: [] },
          { id: 'TSK-01-01-02', type: 'task', title: 'Task 2', status: '[ ]', children: [] },
        ],
      }],
    }];

    calculateProgress(nodes);

    expect(nodes[0].progress).toBe(50);
    expect(nodes[0].taskCount).toBe(2);
    expect(nodes[0].children[0].progress).toBe(50);
    expect(nodes[0].children[0].taskCount).toBe(2);
  });

  // TC-004-005: Task 없는 노드
  it('TC-004-005: should handle node without tasks', () => {
    const nodes: WbsNode[] = [{
      id: 'WP-01',
      type: 'wp',
      title: 'WP 1',
      children: [],
    }];

    calculateProgress(nodes);

    expect(nodes[0].progress).toBe(0);
    expect(nodes[0].taskCount).toBe(0);
  });
});

// ============================================================
// TC-005: parseWbsMarkdown 통합 테스트
// 커버하는 FR: FR-001 ~ FR-005
// ============================================================
describe('parseWbsMarkdown', () => {
  // TC-005-001: 실제 wbs.md 파싱 (complex.md)
  it('TC-005-001: should parse complex wbs.md file', () => {
    const markdown = loadFixture('complex.md');
    const result = parseWbsMarkdown(markdown);

    // 2개의 WP
    expect(result).toHaveLength(2);

    // WP-01 검증
    expect(result[0].id).toBe('WP-01');
    expect(result[0].type).toBe('wp');
    expect(result[0].title).toBe('Platform Infrastructure');

    // WP-01의 자식 (2개 ACT)
    expect(result[0].children).toHaveLength(2);
    expect(result[0].children[0].id).toBe('ACT-01-01');

    // ACT-01-01의 자식 (2개 TSK)
    expect(result[0].children[0].children).toHaveLength(2);
    expect(result[0].children[0].children[0].id).toBe('TSK-01-01-01');
    expect(result[0].children[0].children[0].status).toBe('[xx]');

    // 진행률 검증 (2/3 = 67%, 2 완료 TSK)
    // WP-01에는 총 3개 Task: TSK-01-01-01(xx), TSK-01-01-02(xx), TSK-01-02-01([ ])
    expect(result[0].taskCount).toBe(3);
    expect(result[0].progress).toBe(67); // 2/3 = 66.67% → 67
  });

  // TC-005-002: 빈 파일
  it('TC-005-002: should return empty array for empty file', () => {
    const result = parseWbsMarkdown('');

    expect(result).toEqual([]);
  });

  // TC-005-003: 3단계 구조만
  it('TC-005-003: should parse 3-level structure', () => {
    const markdown = loadFixture('3level.md');
    const result = parseWbsMarkdown(markdown);

    expect(result).toHaveLength(2); // WP-01, WP-02
    expect(result[0].children).toHaveLength(2); // TSK-01-01, TSK-01-02
    expect(result[0].children[0].type).toBe('task');
    expect(result[1].children).toHaveLength(1); // TSK-02-01
  });

  // TC-005-004: 4단계 구조만
  it('TC-005-004: should parse 4-level structure', () => {
    const markdown = loadFixture('4level.md');
    const result = parseWbsMarkdown(markdown);

    expect(result).toHaveLength(1); // WP-01
    expect(result[0].children).toHaveLength(1); // ACT-01-01
    expect(result[0].children[0].children).toHaveLength(2); // TSK-01-01-01, TSK-01-01-02
  });

  // TC-005-005: 메타데이터만 있음
  it('TC-005-005: should return empty array for metadata only', () => {
    const markdown = `# WBS
> version: 1.0
---`;
    const result = parseWbsMarkdown(markdown);

    expect(result).toEqual([]);
  });

  // TC-005-006: 일부 오류 포함 (정상 노드만 파싱)
  it('TC-005-006: should skip invalid headers and parse valid ones', () => {
    const markdown = loadFixture('error.md');
    const result = parseWbsMarkdown(markdown);

    // 유효한 WP만 파싱됨: WP-01, WP-03
    // WP-02는 콜론 없음, WRONG-FORMAT은 잘못된 ID
    expect(result.length).toBeGreaterThanOrEqual(2);

    // WP-01 검증
    const wp01 = result.find(n => n.id === 'WP-01');
    expect(wp01).toBeDefined();
    expect(wp01!.children.length).toBeGreaterThan(0);

    // WP-03 검증
    const wp03 = result.find(n => n.id === 'WP-03');
    expect(wp03).toBeDefined();
  });

  // TC-005-007: 고아 노드 포함
  it('TC-005-007: should handle orphan nodes', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const markdown = `# WBS
> version: 1.0
---

#### TSK-99-99-99: Orphan Task
- category: development
- status: todo [ ]
`;
    const result = parseWbsMarkdown(markdown);

    // 고아 노드가 루트에 추가됨
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('TSK-99-99-99');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  // TC-005-008: 모든 속성 포함
  it('TC-005-008: should parse all 9 attributes correctly', () => {
    const markdown = loadFixture('minimal.md');
    const result = parseWbsMarkdown(markdown);

    expect(result).toHaveLength(1);
    const task = result[0].children[0];

    expect(task.id).toBe('TSK-01-01');
    expect(task.category).toBe('development');
    expect(task.status).toBe('[ ]');
    expect(task.priority).toBe('medium');
    expect(task.assignee).toBe('test-user');
    expect(task.schedule).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(task.tags).toEqual(['test']);
    expect(task.requirements).toEqual(['Test requirement 1']);
    expect(task.ref).toBe('TEST-001');
  });
});

// ============================================================
// TC-006: 성능 테스트
// ============================================================
describe('Performance', () => {
  // TC-006-001: 소규모 wbs.md (50 노드 이하)
  it('TC-006-001: should parse small wbs.md under 50ms', () => {
    const markdown = loadFixture('complex.md');

    const start = performance.now();
    parseWbsMarkdown(markdown);
    const end = performance.now();

    expect(end - start).toBeLessThan(50);
  });
});

// ============================================================
// TC-007: 에러 처리 테스트
// ============================================================
describe('Error Handling', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // TC-007-001: 잘못된 헤더 형식
  it('TC-007-001: should skip invalid header format', () => {
    const markdown = `# WBS
---
## WP-01 Test
`;
    const result = parseWbsMarkdown(markdown);

    expect(result).toEqual([]);
  });

  // TC-007-002: 알 수 없는 ID 패턴
  it('TC-007-002: should skip unknown ID pattern', () => {
    const markdown = `# WBS
---
## INVALID-01: Test
`;
    const result = parseWbsMarkdown(markdown);

    expect(result).toEqual([]);
  });

  // TC-007-003: 필수 속성 누락
  it('TC-007-003: should handle missing required attributes', () => {
    const markdown = `# WBS
---
## WP-01: Test
### TSK-01-01: Task without category
- status: todo [ ]
`;
    const result = parseWbsMarkdown(markdown);

    expect(result).toHaveLength(1);
    const task = result[0].children[0];
    expect(task.category).toBeUndefined();
  });

  // TC-007-007: 빈 라인 처리
  it('TC-007-007: should ignore empty lines', () => {
    const markdown = `# WBS
---

## WP-01: Test


### TSK-01-01: Task
- category: development
- status: todo [ ]

`;
    const result = parseWbsMarkdown(markdown);

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
  });
});

// ============================================================
// determineParentId 테스트
// ============================================================
describe('determineParentId', () => {
  it('should return null for WP node', () => {
    const node = { id: 'WP-01', type: 'wp' as const, title: 'Test', level: 2, attributes: {} };
    expect(determineParentId(node)).toBeNull();
  });

  it('should return WP id for ACT node', () => {
    const node = { id: 'ACT-01-02', type: 'act' as const, title: 'Test', level: 3, attributes: {} };
    expect(determineParentId(node)).toBe('WP-01');
  });

  it('should return ACT id for 4-level TSK node', () => {
    const node = { id: 'TSK-01-02-03', type: 'task' as const, title: 'Test', level: 4, attributes: {} };
    expect(determineParentId(node)).toBe('ACT-01-02');
  });

  it('should return WP id for 3-level TSK node', () => {
    const node = { id: 'TSK-01-02', type: 'task' as const, title: 'Test', level: 3, attributes: {} };
    expect(determineParentId(node)).toBe('WP-01');
  });
});
