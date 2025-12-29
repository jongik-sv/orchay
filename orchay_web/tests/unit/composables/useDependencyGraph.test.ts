/**
 * useDependencyGraph Composable 단위 테스트
 * Task: TSK-06-03
 * Test Spec: 026-test-specification.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, reactive } from 'vue'
import type { WbsNode } from '~/types'
import type { GraphFilter } from '~/types/graph'

// Mock stores
const mockFlatNodes = reactive(new Map<string, WbsNode>())
const mockSelectedProjectId = ref<string | null>('test-project')

const mockWbsStore = {
  flatNodes: mockFlatNodes
}

const mockSelectionStore = {
  get selectedProjectId() { return mockSelectedProjectId.value },
  set selectedProjectId(val: string | null) { mockSelectedProjectId.value = val }
}

// Mock useFocusView
const mockBuildFocusGraph = vi.fn().mockReturnValue({
  includesNodes: new Set<string>()
})

vi.stubGlobal('useWbsStore', () => mockWbsStore)
vi.stubGlobal('useSelectionStore', () => mockSelectionStore)
vi.stubGlobal('useFocusView', () => ({
  buildFocusGraph: mockBuildFocusGraph
}))

// Import after mocks are set up
import { useDependencyGraph } from '~/composables/useDependencyGraph'

describe('useDependencyGraph', () => {
  beforeEach(() => {
    // Clear flatNodes before each test
    mockFlatNodes.clear()
    mockSelectedProjectId.value = 'test-project'
    mockBuildFocusGraph.mockClear()
  })

  // Helper to create mock task node
  function createMockTask(
    taskId: string,
    category: string,
    status: string,
    depends?: string
  ): WbsNode {
    return {
      id: taskId,
      type: 'task',
      title: `Task ${taskId}`,
      category,
      status,
      depends,
      children: []
    } as WbsNode
  }

  // Helper to add task to store
  function addTaskToStore(taskId: string, category: string, status: string, depends?: string) {
    const fullId = `test-project:${taskId}`
    mockFlatNodes.set(fullId, createMockTask(taskId, category, status, depends))
  }

  describe('buildGraphData - Category Filtering', () => {
    // TC-UNIT-001: 카테고리 필터 적용
    it('should filter tasks by category', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[ ]')
      addTaskToStore('TSK-03', 'infrastructure', '[ ]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: ['development'],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(1)
      expect(result.nodes[0].data.category).toBe('development')
      expect(result.nodes[0].data.taskId).toBe('TSK-01')
    })

    it('should include multiple categories', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[ ]')
      addTaskToStore('TSK-03', 'infrastructure', '[ ]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: ['development', 'infrastructure'],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(2)
      const categories = result.nodes.map(n => n.data.category)
      expect(categories).toContain('development')
      expect(categories).toContain('infrastructure')
      expect(categories).not.toContain('defect')
    })

    it('should show all tasks when categories filter is empty', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[ ]')
      addTaskToStore('TSK-03', 'infrastructure', '[ ]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(3)
    })
  })

  describe('buildGraphData - Status Filtering', () => {
    // TC-UNIT-002: 상태 필터 적용
    it('should filter tasks by status', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[bd]')
      addTaskToStore('TSK-03', 'development', '[im]')
      addTaskToStore('TSK-04', 'development', '[vf]')
      addTaskToStore('TSK-05', 'development', '[xx]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: [],
        statuses: ['[im]', '[vf]'],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(2)
      const statuses = result.nodes.map(n => n.data.status)
      expect(statuses).toContain('[im]')
      expect(statuses).toContain('[vf]')
      expect(statuses).not.toContain('[ ]')
      expect(statuses).not.toContain('[bd]')
      expect(statuses).not.toContain('[xx]')
    })

    it('should show all tasks when statuses filter is empty', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[im]')
      addTaskToStore('TSK-03', 'development', '[xx]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(3)
    })

    it('should handle status with full text format', () => {
      addTaskToStore('TSK-01', 'development', 'basic-design [bd]')
      addTaskToStore('TSK-02', 'development', 'implementation [im]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: [],
        statuses: ['[bd]'],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(1)
      expect(result.nodes[0].data.status).toBe('[bd]')
    })
  })

  describe('buildGraphData - Combined Filters', () => {
    it('should apply both category and status filters', () => {
      addTaskToStore('TSK-01', 'development', '[im]')
      addTaskToStore('TSK-02', 'development', '[vf]')
      addTaskToStore('TSK-03', 'defect', '[im]')
      addTaskToStore('TSK-04', 'infrastructure', '[im]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: ['development'],
        statuses: ['[im]'],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(1)
      expect(result.nodes[0].data.taskId).toBe('TSK-01')
      expect(result.nodes[0].data.category).toBe('development')
      expect(result.nodes[0].data.status).toBe('[im]')
    })
  })

  describe('buildGraphData - No Filter', () => {
    // TC-UNIT-010: 빈 필터 = 전체 표시 (BR-001)
    it('should return all tasks when no filter is provided', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[bd]')
      addTaskToStore('TSK-03', 'infrastructure', '[im]')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.nodes.length).toBe(3)
    })

    it('should return all tasks when filter has empty arrays', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[bd]')
      addTaskToStore('TSK-03', 'infrastructure', '[im]')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      expect(result.nodes.length).toBe(3)
    })
  })

  describe('buildGraphData - Edges', () => {
    it('should create edges based on dependencies', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]', 'TSK-01')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-02')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.edges.length).toBe(2)
      expect(result.edges[0].source).toBe('TSK-01')
      expect(result.edges[0].target).toBe('TSK-02')
      expect(result.edges[1].source).toBe('TSK-02')
      expect(result.edges[1].target).toBe('TSK-03')
    })

    it('should handle multiple dependencies', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-01,TSK-02')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.edges.length).toBe(2)
      const edgeTargets = result.edges.map(e => ({ source: e.source, target: e.target }))
      expect(edgeTargets).toContainEqual({ source: 'TSK-01', target: 'TSK-03' })
      expect(edgeTargets).toContainEqual({ source: 'TSK-02', target: 'TSK-03' })
    })

    it('should not create edges for filtered-out tasks', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'defect', '[ ]', 'TSK-01')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-02')

      const { buildGraphData } = useDependencyGraph()

      const filter: GraphFilter = {
        categories: ['development'],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }

      const result = buildGraphData(filter)

      // TSK-02가 필터링되어 엣지도 생성되지 않음
      expect(result.nodes.length).toBe(2)
      expect(result.edges.length).toBe(0)
    })

    it('should set animated to false for completed tasks', () => {
      addTaskToStore('TSK-01', 'development', '[xx]')
      addTaskToStore('TSK-02', 'development', '[ ]', 'TSK-01')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      const edge = result.edges.find(e => e.target === 'TSK-02')
      expect(edge?.animated).toBe(true) // TSK-02는 완료 아님

      // TSK-03 추가 (완료 상태)
      addTaskToStore('TSK-03', 'development', '[xx]', 'TSK-01')
      const result2 = buildGraphData()
      const edge2 = result2.edges.find(e => e.target === 'TSK-03')
      expect(edge2?.animated).toBe(false)
    })
  })

  describe('calculateLevels', () => {
    it('should assign correct levels to tasks', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]', 'TSK-01')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-02')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      // 노드를 ID로 찾기
      const node1 = result.nodes.find(n => n.id === 'TSK-01')
      const node2 = result.nodes.find(n => n.id === 'TSK-02')
      const node3 = result.nodes.find(n => n.id === 'TSK-03')

      expect(node1?.position.x).toBe(0) // Level 0
      expect(node2?.position.x).toBe(280) // Level 1
      expect(node3?.position.x).toBe(560) // Level 2
    })

    // TC-UNIT-012: 순환 의존성 처리 (BR-005)
    it('should handle circular dependencies', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 순환: TSK-01 → TSK-02 → TSK-03 → TSK-01
      addTaskToStore('TSK-01', 'development', '[ ]', 'TSK-03')
      addTaskToStore('TSK-02', 'development', '[ ]', 'TSK-01')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-02')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      // 모든 Task에 레벨이 할당되어야 함
      expect(result.nodes.length).toBe(3)
      result.nodes.forEach(node => {
        expect(node.position.x).toBeGreaterThanOrEqual(0)
      })

      // 경고 출력 확인
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('순환 의존성 감지')
      )

      consoleSpy.mockRestore()
    })

    it('should place independent tasks at level 0', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]')
      addTaskToStore('TSK-03', 'development', '[ ]')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      result.nodes.forEach(node => {
        expect(node.position.x).toBe(0)
      })
    })
  })

  describe('extractStatusCode', () => {
    it('should extract status code from full status string', () => {
      const { extractStatusCode } = useDependencyGraph()

      expect(extractStatusCode('basic-design [bd]')).toBe('[bd]')
      expect(extractStatusCode('implementation [im]')).toBe('[im]')
      expect(extractStatusCode('done [xx]')).toBe('[xx]')
    })

    it('should return status code as-is if already in bracket format', () => {
      const { extractStatusCode } = useDependencyGraph()

      expect(extractStatusCode('[bd]')).toBe('[bd]')
      expect(extractStatusCode('[im]')).toBe('[im]')
    })

    it('should return "[ ]" for empty or undefined status', () => {
      const { extractStatusCode } = useDependencyGraph()

      expect(extractStatusCode('')).toBe('[ ]')
      expect(extractStatusCode(undefined)).toBe('[ ]')
    })

    it('should handle status without brackets', () => {
      const { extractStatusCode } = useDependencyGraph()

      expect(extractStatusCode('todo')).toBe('[ ]')
      expect(extractStatusCode('in progress')).toBe('[ ]')
    })
  })

  describe('getStatusName', () => {
    it('should return correct Korean status names', () => {
      const { getStatusName } = useDependencyGraph()

      expect(getStatusName('[ ]')).toBe('Todo')
      expect(getStatusName('[bd]')).toBe('기본설계')
      expect(getStatusName('[dd]')).toBe('상세설계')
      expect(getStatusName('[im]')).toBe('구현')
      expect(getStatusName('[vf]')).toBe('검증')
      expect(getStatusName('[xx]')).toBe('완료')
    })

    it('should return status code for unknown statuses', () => {
      const { getStatusName } = useDependencyGraph()

      expect(getStatusName('[unknown]')).toBe('[unknown]')
    })
  })

  describe('getCategoryName', () => {
    it('should return correct Korean category names', () => {
      const { getCategoryName } = useDependencyGraph()

      expect(getCategoryName('development')).toBe('개발')
      expect(getCategoryName('defect')).toBe('결함')
      expect(getCategoryName('infrastructure')).toBe('인프라')
    })

    it('should return category as-is for unknown categories', () => {
      const { getCategoryName } = useDependencyGraph()

      expect(getCategoryName('unknown')).toBe('unknown')
    })
  })

  describe('getGraphStats', () => {
    it('should return correct task and edge counts', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]', 'TSK-01')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-02')

      const { getGraphStats } = useDependencyGraph()

      const stats = getGraphStats()

      expect(stats.taskCount).toBe(3)
      expect(stats.edgeCount).toBe(2)
    })

    it('should handle tasks with no dependencies', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]')

      const { getGraphStats } = useDependencyGraph()

      const stats = getGraphStats()

      expect(stats.taskCount).toBe(2)
      expect(stats.edgeCount).toBe(0)
    })

    it('should count multiple dependencies correctly', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]')
      addTaskToStore('TSK-03', 'development', '[ ]', 'TSK-01,TSK-02')

      const { getGraphStats } = useDependencyGraph()

      const stats = getGraphStats()

      expect(stats.taskCount).toBe(3)
      expect(stats.edgeCount).toBe(2)
    })
  })

  describe('project filtering', () => {
    it('should only include tasks from selected project', () => {
      mockSelectedProjectId.value = 'project-a'

      mockFlatNodes.set('project-a:TSK-01', createMockTask('TSK-01', 'development', '[ ]'))
      mockFlatNodes.set('project-b:TSK-02', createMockTask('TSK-02', 'development', '[ ]'))

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.nodes.length).toBe(1)
      expect(result.nodes[0].data.taskId).toBe('TSK-01')
    })

    it('should return empty graph when no project is selected', () => {
      mockSelectedProjectId.value = null

      addTaskToStore('TSK-01', 'development', '[ ]')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.nodes.length).toBe(0)
      expect(result.edges.length).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty flatNodes', () => {
      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.nodes.length).toBe(0)
      expect(result.edges.length).toBe(0)
    })

    it('should handle tasks with undefined category', () => {
      const node: WbsNode = {
        id: 'TSK-01',
        type: 'task',
        title: 'Task 1',
        status: '[ ]',
        children: []
      } as WbsNode

      mockFlatNodes.set('test-project:TSK-01', node)

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.nodes.length).toBe(1)
      expect(result.nodes[0].data.category).toBe('development') // 기본값
    })

    it('should handle malformed dependency strings', () => {
      addTaskToStore('TSK-01', 'development', '[ ]')
      addTaskToStore('TSK-02', 'development', '[ ]', '  ,  TSK-01  ,  ')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.edges.length).toBe(1)
      expect(result.edges[0].source).toBe('TSK-01')
    })

    it('should ignore dependencies to non-existent tasks', () => {
      addTaskToStore('TSK-01', 'development', '[ ]', 'TSK-99')

      const { buildGraphData } = useDependencyGraph()

      const result = buildGraphData()

      expect(result.edges.length).toBe(0)
    })
  })
})
