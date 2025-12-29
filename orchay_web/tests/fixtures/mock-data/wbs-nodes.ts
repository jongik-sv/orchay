import type { WbsNode } from '../../../types';

/**
 * 최소 WBS 트리 (3단계)
 */
export const minimalWbsTree: WbsNode = {
  id: 'test-project',
  type: 'project',
  title: 'Test Project',
  progress: 0,
  children: [
    {
      id: 'WP-01',
      type: 'wp',
      title: 'Work Package 1',
      status: 'planned',
      priority: 'high',
      progress: 0,
      children: [
        {
          id: 'TSK-01-01',
          type: 'task',
          title: 'Task 1',
          status: '[bd]',
          category: 'development',
          priority: 'critical',
          progress: 25,
          children: []
        }
      ]
    }
  ]
};

/**
 * 복잡한 WBS 트리 (4단계, 다양한 상태)
 */
export const complexWbsTree: WbsNode = {
  id: 'complex-project',
  type: 'project',
  title: 'Complex Project',
  progress: 0,
  children: [
    {
      id: 'WP-01',
      type: 'wp',
      title: 'Infrastructure',
      status: 'planned',
      priority: 'high',
      progress: 0,
      children: [
        {
          id: 'ACT-01-01',
          type: 'act',
          title: 'Environment Setup',
          status: 'in_progress',
          progress: 0,
          children: [
            {
              id: 'TSK-01-01-01',
              type: 'task',
              title: 'Node.js Setup',
              status: '[xx]',
              category: 'infrastructure',
              priority: 'critical',
              progress: 100,
              children: []
            },
            {
              id: 'TSK-01-01-02',
              type: 'task',
              title: 'Database Setup',
              status: '[im]',
              category: 'infrastructure',
              priority: 'high',
              progress: 50,
              children: []
            }
          ]
        }
      ]
    },
    {
      id: 'WP-02',
      type: 'wp',
      title: 'Features',
      status: 'planned',
      priority: 'medium',
      progress: 0,
      children: [
        {
          id: 'TSK-02-01',
          type: 'task',
          title: 'Auth System',
          status: '[bd]',
          category: 'development',
          priority: 'high',
          progress: 25,
          children: []
        },
        {
          id: 'TSK-02-02',
          type: 'task',
          title: 'Fix Login Bug',
          status: '[an]',
          category: 'defect',
          priority: 'critical',
          progress: 0,
          children: []
        }
      ]
    }
  ]
};

/**
 * 빈 WBS 트리
 */
export const emptyWbsTree: WbsNode = {
  id: 'empty-project',
  type: 'project',
  title: 'Empty Project',
  progress: 0,
  children: []
};

/**
 * 검색 테스트용 WBS 트리
 */
export const searchTestTree: WbsNode = {
  id: 'search-test',
  type: 'project',
  title: 'Search Test Project',
  progress: 0,
  children: [
    {
      id: 'WP-01',
      type: 'wp',
      title: 'Backend Development',
      status: 'planned',
      priority: 'high',
      progress: 0,
      children: [
        {
          id: 'TSK-01-01',
          type: 'task',
          title: 'API Design',
          status: '[bd]',
          category: 'development',
          priority: 'high',
          progress: 25,
          children: []
        },
        {
          id: 'TSK-01-02',
          type: 'task',
          title: 'Database Schema',
          status: '[dd]',
          category: 'development',
          priority: 'medium',
          progress: 50,
          children: []
        }
      ]
    },
    {
      id: 'WP-02',
      type: 'wp',
      title: 'Frontend Development',
      status: 'planned',
      priority: 'medium',
      progress: 0,
      children: [
        {
          id: 'TSK-02-01',
          type: 'task',
          title: 'UI Components',
          status: '[ ]',
          category: 'development',
          priority: 'low',
          progress: 0,
          children: []
        }
      ]
    }
  ]
};

/**
 * 깊은 중첩 트리 생성 (성능 테스트용)
 */
export function generateDeepWbsTree(depth: number): WbsNode {
  let node: WbsNode = {
    id: `TSK-${depth}`,
    type: 'task',
    title: `Deep Task ${depth}`,
    status: '[ ]',
    category: 'development',
    priority: 'low',
    progress: 0,
    children: []
  };

  for (let i = depth - 1; i > 0; i--) {
    node = {
      id: `ACT-${i}`,
      type: 'act',
      title: `Activity ${i}`,
      status: 'planned',
      progress: 0,
      children: [node]
    };
  }

  return {
    id: 'deep-project',
    type: 'project',
    title: 'Deep Nesting Test',
    progress: 0,
    children: [
      {
        id: 'WP-01',
        type: 'wp',
        title: 'Deep WP',
        status: 'planned',
        priority: 'high',
        progress: 0,
        children: [node]
      }
    ]
  };
}

/**
 * 대량 WBS 생성 (성능 테스트용)
 */
export function generateLargeWbs(taskCount: number): string {
  let markdown = `# WBS - Large Test Project

> version: 1.0
> depth: 4
> updated: 2025-12-15
> start: 2025-12-01

---

`;

  const wpCount = Math.ceil(taskCount / 10);
  const tasksPerWp = Math.floor(taskCount / wpCount);

  for (let wp = 1; wp <= wpCount; wp++) {
    markdown += `## WP-${String(wp).padStart(2, '0')}: Work Package ${wp}
- status: planned
- priority: high

`;

    for (let tsk = 1; tsk <= tasksPerWp; tsk++) {
      const taskId = (wp - 1) * tasksPerWp + tsk;
      markdown += `### TSK-${String(wp).padStart(2, '0')}-${String(tsk).padStart(2, '0')}: Task ${taskId}
- category: development
- status: [ ]
- priority: medium

`;
    }
  }

  return markdown;
}
