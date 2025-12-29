/**
 * useFocusView Composable 단위 테스트
 * Task: TSK-06-03
 * Test Spec: 026-test-specification.md
 */

import { describe, it, expect } from 'vitest'
import { useFocusView } from '~/composables/useFocusView'
import type { WbsNode } from '~/types'
import type { TaskEdge } from '~/types/graph'

describe('useFocusView', () => {
  const { buildFocusGraph } = useFocusView()

  // Helper to create mock task nodes
  function createTaskNode(id: string, depends?: string): WbsNode {
    return {
      id,
      type: 'task',
      title: `Task ${id}`,
      status: '[ ]',
      depends
    } as WbsNode
  }

  describe('buildFocusGraph', () => {
    // TC-UNIT-005: BFS depth 1 탐색
    it('should return focus task and depth 1 predecessors/successors', () => {
      // 의존관계: TSK-01 → TSK-02 → TSK-03 → TSK-04 → TSK-05
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-02')],
        ['TSK-04', createTaskNode('TSK-04', 'TSK-03')],
        ['TSK-05', createTaskNode('TSK-05', 'TSK-04')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-02-TSK-03', source: 'TSK-02', target: 'TSK-03' },
        { id: 'TSK-03-TSK-04', source: 'TSK-03', target: 'TSK-04' },
        { id: 'TSK-04-TSK-05', source: 'TSK-04', target: 'TSK-05' }
      ]

      const result = buildFocusGraph('TSK-03', 1, taskNodes, edges)

      expect(result.focusTaskId).toBe('TSK-03')
      expect(result.depth).toBe(1)
      expect(result.includesNodes.size).toBe(3)
      expect(result.includesNodes.has('TSK-03')).toBe(true) // 초점
      expect(result.includesNodes.has('TSK-02')).toBe(true) // 선행 depth 1
      expect(result.includesNodes.has('TSK-04')).toBe(true) // 후행 depth 1
      expect(result.includesNodes.has('TSK-01')).toBe(false) // depth 2
      expect(result.includesNodes.has('TSK-05')).toBe(false) // depth 2
    })

    // TC-UNIT-006: BFS depth 3 탐색
    it('should return all tasks within depth 3', () => {
      // 의존관계: TSK-01 → TSK-02 → TSK-03 → TSK-04 → TSK-05
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-02')],
        ['TSK-04', createTaskNode('TSK-04', 'TSK-03')],
        ['TSK-05', createTaskNode('TSK-05', 'TSK-04')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-02-TSK-03', source: 'TSK-02', target: 'TSK-03' },
        { id: 'TSK-03-TSK-04', source: 'TSK-03', target: 'TSK-04' },
        { id: 'TSK-04-TSK-05', source: 'TSK-04', target: 'TSK-05' }
      ]

      const result = buildFocusGraph('TSK-03', 3, taskNodes, edges)

      expect(result.focusTaskId).toBe('TSK-03')
      expect(result.depth).toBe(3)
      expect(result.includesNodes.size).toBe(5)
      expect(result.includesNodes.has('TSK-01')).toBe(true) // depth 2 선행
      expect(result.includesNodes.has('TSK-02')).toBe(true) // depth 1 선행
      expect(result.includesNodes.has('TSK-03')).toBe(true) // 초점
      expect(result.includesNodes.has('TSK-04')).toBe(true) // depth 1 후행
      expect(result.includesNodes.has('TSK-05')).toBe(true) // depth 2 후행
    })

    it('should return only focus task when depth is 0', () => {
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-02')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-02-TSK-03', source: 'TSK-02', target: 'TSK-03' }
      ]

      const result = buildFocusGraph('TSK-02', 0, taskNodes, edges)

      expect(result.includesNodes.size).toBe(1)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
    })

    it('should handle task with no dependencies', () => {
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02')], // 독립 Task
        ['TSK-03', createTaskNode('TSK-03')]
      ])

      const edges: TaskEdge[] = []

      const result = buildFocusGraph('TSK-02', 2, taskNodes, edges)

      expect(result.includesNodes.size).toBe(1)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
    })

    it('should handle multiple predecessors', () => {
      // 의존관계: TSK-01 → TSK-03, TSK-02 → TSK-03
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-01,TSK-02')],
        ['TSK-04', createTaskNode('TSK-04', 'TSK-03')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-03', source: 'TSK-01', target: 'TSK-03' },
        { id: 'TSK-02-TSK-03', source: 'TSK-02', target: 'TSK-03' },
        { id: 'TSK-03-TSK-04', source: 'TSK-03', target: 'TSK-04' }
      ]

      const result = buildFocusGraph('TSK-03', 1, taskNodes, edges)

      expect(result.includesNodes.size).toBe(4)
      expect(result.includesNodes.has('TSK-01')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
      expect(result.includesNodes.has('TSK-03')).toBe(true)
      expect(result.includesNodes.has('TSK-04')).toBe(true)
    })

    it('should handle multiple successors', () => {
      // 의존관계: TSK-01 → TSK-02, TSK-01 → TSK-03
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-00', createTaskNode('TSK-00')],
        ['TSK-01', createTaskNode('TSK-01', 'TSK-00')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-01')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-00-TSK-01', source: 'TSK-00', target: 'TSK-01' },
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-01-TSK-03', source: 'TSK-01', target: 'TSK-03' }
      ]

      const result = buildFocusGraph('TSK-01', 1, taskNodes, edges)

      expect(result.includesNodes.size).toBe(4)
      expect(result.includesNodes.has('TSK-00')).toBe(true)
      expect(result.includesNodes.has('TSK-01')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
      expect(result.includesNodes.has('TSK-03')).toBe(true)
    })

    // TC-UNIT-012: 순환 의존성 처리 (BR-005)
    it('should handle circular dependencies without infinite loop', () => {
      // 순환: TSK-01 → TSK-02 → TSK-03 → TSK-01
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01', 'TSK-03')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-02')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-03-TSK-01', source: 'TSK-03', target: 'TSK-01' },
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-02-TSK-03', source: 'TSK-02', target: 'TSK-03' }
      ]

      const result = buildFocusGraph('TSK-01', 2, taskNodes, edges)

      // 순환이지만 모든 노드가 depth 2 내에 포함되어야 함
      expect(result.includesNodes.size).toBe(3)
      expect(result.includesNodes.has('TSK-01')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
      expect(result.includesNodes.has('TSK-03')).toBe(true)
    })

    it('should handle self-referencing task', () => {
      // TSK-01이 자기 자신을 의존
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01', 'TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-01', source: 'TSK-01', target: 'TSK-01' },
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' }
      ]

      const result = buildFocusGraph('TSK-01', 1, taskNodes, edges)

      expect(result.includesNodes.size).toBe(2)
      expect(result.includesNodes.has('TSK-01')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
    })

    it('should handle complex diamond dependency', () => {
      // 다이아몬드: TSK-01 → TSK-02, TSK-03; TSK-02, TSK-03 → TSK-04
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03', 'TSK-01')],
        ['TSK-04', createTaskNode('TSK-04', 'TSK-02,TSK-03')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-01-TSK-03', source: 'TSK-01', target: 'TSK-03' },
        { id: 'TSK-02-TSK-04', source: 'TSK-02', target: 'TSK-04' },
        { id: 'TSK-03-TSK-04', source: 'TSK-03', target: 'TSK-04' }
      ]

      const result = buildFocusGraph('TSK-02', 2, taskNodes, edges)

      expect(result.includesNodes.size).toBe(4)
      expect(result.includesNodes.has('TSK-01')).toBe(true) // predecessor depth 1
      expect(result.includesNodes.has('TSK-02')).toBe(true) // focus
      expect(result.includesNodes.has('TSK-03')).toBe(true) // sibling via TSK-04
      expect(result.includesNodes.has('TSK-04')).toBe(true) // successor depth 1
    })

    it('should respect depth limit in large graph', () => {
      // 긴 체인: TSK-01 → ... → TSK-10
      const taskNodes = new Map<string, WbsNode>()
      const edges: TaskEdge[] = []

      for (let i = 1; i <= 10; i++) {
        const id = `TSK-${i.toString().padStart(2, '0')}`
        const depends = i > 1 ? `TSK-${(i - 1).toString().padStart(2, '0')}` : undefined
        taskNodes.set(id, createTaskNode(id, depends))

        if (i > 1) {
          const prevId = `TSK-${(i - 1).toString().padStart(2, '0')}`
          edges.push({ id: `${prevId}-${id}`, source: prevId, target: id })
        }
      }

      const result = buildFocusGraph('TSK-05', 2, taskNodes, edges)

      // TSK-05 기준 depth 2: TSK-03, TSK-04, TSK-05, TSK-06, TSK-07
      expect(result.includesNodes.size).toBe(5)
      expect(result.includesNodes.has('TSK-03')).toBe(true)
      expect(result.includesNodes.has('TSK-04')).toBe(true)
      expect(result.includesNodes.has('TSK-05')).toBe(true)
      expect(result.includesNodes.has('TSK-06')).toBe(true)
      expect(result.includesNodes.has('TSK-07')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(false)
      expect(result.includesNodes.has('TSK-08')).toBe(false)
    })

    it('should handle disconnected graph components', () => {
      // 두 개의 분리된 그래프
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')],
        ['TSK-02', createTaskNode('TSK-02', 'TSK-01')],
        ['TSK-03', createTaskNode('TSK-03')],
        ['TSK-04', createTaskNode('TSK-04', 'TSK-03')]
      ])

      const edges: TaskEdge[] = [
        { id: 'TSK-01-TSK-02', source: 'TSK-01', target: 'TSK-02' },
        { id: 'TSK-03-TSK-04', source: 'TSK-03', target: 'TSK-04' }
      ]

      const result = buildFocusGraph('TSK-02', 2, taskNodes, edges)

      // TSK-02의 연결된 컴포넌트만 포함
      expect(result.includesNodes.size).toBe(2)
      expect(result.includesNodes.has('TSK-01')).toBe(true)
      expect(result.includesNodes.has('TSK-02')).toBe(true)
      expect(result.includesNodes.has('TSK-03')).toBe(false)
      expect(result.includesNodes.has('TSK-04')).toBe(false)
    })

    it('should handle non-existent focus task gracefully', () => {
      const taskNodes = new Map<string, WbsNode>([
        ['TSK-01', createTaskNode('TSK-01')]
      ])

      const edges: TaskEdge[] = []

      const result = buildFocusGraph('TSK-99', 2, taskNodes, edges)

      // 존재하지 않는 Task는 초점 Task로만 포함됨 (인접 노드 없음)
      expect(result.includesNodes.size).toBe(1)
      expect(result.includesNodes.has('TSK-99')).toBe(true)
    })
  })
})
