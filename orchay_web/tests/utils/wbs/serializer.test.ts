import { describe, it, expect, beforeEach } from 'vitest';
import { serializeWbs, calculateMaxDepth } from '../../../server/utils/wbs/serializer';
import { serializeHeader } from '../../../server/utils/wbs/serializer/_header';
import { serializeAttributes } from '../../../server/utils/wbs/serializer/_attributes';
import { buildMetadataBlock } from '../../../server/utils/wbs/serializer/_metadata';
import type { WbsNode, WbsMetadata, SerializerContext } from '../../../types';
import { SerializationError } from '../../../types';

describe('serializeHeader', () => {
  const createContext = (maxDepth: number = 4): SerializerContext => ({
    currentDepth: 0,
    wpCount: 0,
    maxDepth,
    visited: new Set<string>(),
  });

  it('should generate project header', () => {
    const node: WbsNode = { id: 'proj-1', type: 'project', title: 'Test Project', children: [] };
    const result = serializeHeader(node, createContext());
    expect(result).toBe('# WBS - Test Project');
  });

  it('should generate WP header with ##', () => {
    const node: WbsNode = { id: 'WP-01', type: 'wp', title: 'Platform', children: [] };
    const result = serializeHeader(node, createContext());
    expect(result).toBe('## WP-01: Platform');
  });

  it('should generate ACT header with ###', () => {
    const node: WbsNode = { id: 'ACT-01-01', type: 'act', title: 'Setup', children: [] };
    const result = serializeHeader(node, createContext());
    expect(result).toBe('### ACT-01-01: Setup');
  });

  it('should generate Task header with #### in 4-level structure', () => {
    const node: WbsNode = { id: 'TSK-01-01-01', type: 'task', title: 'Init', children: [] };
    const result = serializeHeader(node, createContext(4));
    expect(result).toBe('#### TSK-01-01-01: Init');
  });

  it('should generate Task header with ### in 3-level structure', () => {
    const node: WbsNode = { id: 'TSK-01-01', type: 'task', title: 'Init', children: [] };
    const result = serializeHeader(node, createContext(3));
    expect(result).toBe('### TSK-01-01: Init');
  });

  it('should use default values for missing id and title', () => {
    const node: WbsNode = { id: '', type: 'wp', title: '', children: [] };
    const result = serializeHeader(node, createContext());
    expect(result).toBe('## UNKNOWN: Untitled');
  });
});

describe('serializeAttributes', () => {
  it('should serialize category', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      category: 'development', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- category: development');
  });

  it('should serialize status', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      status: 'detail-design [dd]', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- status: detail-design [dd]');
  });

  it('should serialize priority', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      priority: 'high', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- priority: high');
  });

  it('should serialize assignee when present', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      assignee: 'john', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- assignee: john');
  });

  it('should serialize assignee as "-" when explicitly set', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      assignee: '-', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- assignee: -');
  });

  it('should serialize schedule when both start and end exist', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      schedule: { start: '2025-01-01', end: '2025-01-15' }, children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- schedule: 2025-01-01 ~ 2025-01-15');
  });

  it('should not serialize schedule when only start exists', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      schedule: { start: '2025-01-01', end: '' }, children: [],
    };
    const result = serializeAttributes(node);
    expect(result.join('\n')).not.toContain('schedule');
  });

  it('should serialize tags as comma-separated list', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      tags: ['nuxt', 'setup', 'init'], children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- tags: nuxt, setup, init');
  });

  it('should not serialize empty tags array', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      tags: [], children: [],
    };
    const result = serializeAttributes(node);
    expect(result.join('\n')).not.toContain('tags');
  });

  it('should serialize depends', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      depends: 'TSK-00-01-01', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- depends: TSK-00-01-01');
  });

  it('should serialize requirements with indentation', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      requirements: ['Requirement 1', 'Requirement 2'], children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- requirements:');
    expect(result).toContain('  - Requirement 1');
    expect(result).toContain('  - Requirement 2');
  });

  it('should serialize ref', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      ref: 'PRD 3.1', children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- ref: PRD 3.1');
  });

  it('should serialize progress for WP', () => {
    const node: WbsNode = {
      id: 'WP-01', type: 'wp', title: 'Platform',
      progress: 50, children: [],
    };
    const result = serializeAttributes(node);
    expect(result).toContain('- progress: 50%');
  });

  it('should not serialize progress for task', () => {
    const node: WbsNode = {
      id: 'TSK-01', type: 'task', title: 'Test',
      progress: 50, children: [],
    };
    const result = serializeAttributes(node);
    expect(result.join('\n')).not.toContain('progress');
  });
});

describe('buildMetadataBlock', () => {
  it('should generate metadata block with all fields', () => {
    const metadata: WbsMetadata = {
      version: '1.0',
      depth: 4,
      updated: '2025-01-01',
      start: '2025-01-01',
    };
    const result = buildMetadataBlock(metadata, { updateDate: false });
    expect(result).toContain('> version: 1.0');
    expect(result).toContain('> depth: 4');
    expect(result).toContain('> updated: 2025-01-01');
    expect(result).toContain('> start: 2025-01-01');
  });

  it('should use default values for missing fields', () => {
    const metadata = {} as WbsMetadata;
    const result = buildMetadataBlock(metadata, { updateDate: false });
    expect(result).toContain('> version: 1.0');
    expect(result).toContain('> depth: 4');
  });

  it('should update date when updateDate option is true', () => {
    const metadata: WbsMetadata = {
      version: '1.0',
      depth: 4,
      updated: '2020-01-01',
      start: '2020-01-01',
    };
    const result = buildMetadataBlock(metadata, { updateDate: true });
    // Should contain today's date, not the old date
    expect(result).not.toContain('> updated: 2020-01-01');
  });
});

describe('calculateMaxDepth', () => {
  it('should return 4 when ACT nodes exist', () => {
    const nodes: WbsNode[] = [
      {
        id: 'WP-01', type: 'wp', title: 'WP', children: [
          { id: 'ACT-01-01', type: 'act', title: 'ACT', children: [] },
        ],
      },
    ];
    expect(calculateMaxDepth(nodes)).toBe(4);
  });

  it('should return 4 when Task ID follows TSK-XX-XX-XX pattern', () => {
    const nodes: WbsNode[] = [
      {
        id: 'WP-01', type: 'wp', title: 'WP', children: [
          { id: 'TSK-01-01-01', type: 'task', title: 'Task', children: [] },
        ],
      },
    ];
    expect(calculateMaxDepth(nodes)).toBe(4);
  });

  it('should return 3 when no ACT nodes and Task IDs are not 4-level', () => {
    const nodes: WbsNode[] = [
      {
        id: 'WP-01', type: 'wp', title: 'WP', children: [
          { id: 'TSK-01-01', type: 'task', title: 'Task', children: [] },
        ],
      },
    ];
    expect(calculateMaxDepth(nodes)).toBe(3);
  });

  it('should return 3 for empty array', () => {
    expect(calculateMaxDepth([])).toBe(3);
  });
});

describe('serializeWbs', () => {
  const defaultMetadata: WbsMetadata = {
    version: '1.0',
    depth: 4,
    updated: '2025-01-01',
    start: '2025-01-01',
  };

  it('should serialize empty tree with only metadata', () => {
    const result = serializeWbs([], defaultMetadata, { updateDate: false });
    expect(result).toContain('> version: 1.0');
  });

  it('should serialize project with children', () => {
    const nodes: WbsNode[] = [
      {
        id: 'orchay',
        type: 'project',
        title: 'orchay',
        children: [
          {
            id: 'WP-01',
            type: 'wp',
            title: 'Platform Infrastructure',
            status: 'planned',
            priority: 'critical',
            children: [],
          },
        ],
      },
    ];
    const result = serializeWbs(nodes, defaultMetadata, { updateDate: false });
    expect(result).toContain('# WBS - orchay');
    expect(result).toContain('## WP-01: Platform Infrastructure');
    expect(result).toContain('- status: planned');
  });

  it('should add separator between WPs', () => {
    const nodes: WbsNode[] = [
      {
        id: 'proj',
        type: 'project',
        title: 'Project',
        children: [
          { id: 'WP-01', type: 'wp', title: 'WP1', children: [] },
          { id: 'WP-02', type: 'wp', title: 'WP2', children: [] },
        ],
      },
    ];
    const result = serializeWbs(nodes, defaultMetadata, { updateDate: false });
    expect(result).toContain('---');
  });

  it('should serialize nested 4-level structure', () => {
    const nodes: WbsNode[] = [
      {
        id: 'proj',
        type: 'project',
        title: 'Project',
        children: [
          {
            id: 'WP-01',
            type: 'wp',
            title: 'Platform',
            children: [
              {
                id: 'ACT-01-01',
                type: 'act',
                title: 'Setup',
                children: [
                  {
                    id: 'TSK-01-01-01',
                    type: 'task',
                    title: 'Init',
                    category: 'infrastructure',
                    status: 'done [xx]',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    const result = serializeWbs(nodes, defaultMetadata, { updateDate: false });
    expect(result).toContain('## WP-01: Platform');
    expect(result).toContain('### ACT-01-01: Setup');
    expect(result).toContain('#### TSK-01-01-01: Init');
    expect(result).toContain('- category: infrastructure');
  });

  it('should throw SerializationError on circular reference', () => {
    const child: WbsNode = { id: 'child', type: 'task', title: 'Child', children: [] };
    const parent: WbsNode = { id: 'parent', type: 'wp', title: 'Parent', children: [child] };
    // Create circular reference
    child.children = [parent];

    expect(() => serializeWbs([parent], defaultMetadata)).toThrow(SerializationError);
    expect(() => serializeWbs([parent], defaultMetadata)).toThrow(/Circular reference detected/);
  });

  it('should serialize all task attributes correctly', () => {
    const nodes: WbsNode[] = [
      {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Nuxt 3 프로젝트 초기화',
        category: 'infrastructure',
        status: 'done [xx]',
        priority: 'critical',
        assignee: '-',
        schedule: { start: '2025-12-13', end: '2025-12-13' },
        tags: ['nuxt', 'setup'],
        depends: '-',
        requirements: [
          'Nuxt 3 프로젝트 생성 (npx nuxi init)',
          'TypeScript 설정',
          'Standalone 모드 설정 (nitro preset)',
        ],
        ref: 'PRD 3',
        children: [],
      },
    ];
    const result = serializeWbs(nodes, defaultMetadata, { updateDate: false });
    expect(result).toContain('- category: infrastructure');
    expect(result).toContain('- status: done [xx]');
    expect(result).toContain('- priority: critical');
    expect(result).toContain('- assignee: -');
    expect(result).toContain('- schedule: 2025-12-13 ~ 2025-12-13');
    expect(result).toContain('- tags: nuxt, setup');
    expect(result).toContain('- depends: -');
    expect(result).toContain('- requirements:');
    expect(result).toContain('  - Nuxt 3 프로젝트 생성 (npx nuxi init)');
    expect(result).toContain('- ref: PRD 3');
  });

  it('should handle nodes without project wrapper', () => {
    const nodes: WbsNode[] = [
      { id: 'WP-01', type: 'wp', title: 'WP1', status: 'planned', children: [] },
      { id: 'WP-02', type: 'wp', title: 'WP2', status: 'planned', children: [] },
    ];
    const result = serializeWbs(nodes, defaultMetadata, { updateDate: false });
    expect(result).toContain('## WP-01: WP1');
    expect(result).toContain('## WP-02: WP2');
    expect(result).toContain('---');
  });
});
