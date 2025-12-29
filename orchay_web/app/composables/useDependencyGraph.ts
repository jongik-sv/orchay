/**
 * 의존관계 그래프 데이터 변환 컴포저블 (Vue Flow 기반)
 * Task: TSK-06-01
 */

import type { WbsNode } from '~/types'
import type { TaskNode, TaskEdge, GraphData, GraphFilter, GroupNode, GroupNodeData } from '~/types/graph'
import { GRAPH_COLORS } from '~/types/graph'

export function useDependencyGraph() {
  const wbsStore = useWbsStore()
  const selectionStore = useSelectionStore()
  const { buildFocusGraph } = useFocusView()

  /**
   * 현재 선택된 프로젝트의 Task만 필터링하여 반환
   */
  function getProjectTasks(): Map<string, { node: WbsNode; taskId: string }> {
    const result = new Map<string, { node: WbsNode; taskId: string }>()
    const currentProjectId = selectionStore.selectedProjectId

    if (!currentProjectId) return result

    wbsStore.flatNodes.forEach((node, id) => {
      if (node.type === 'task') {
        const colonIndex = id.indexOf(':')
        if (colonIndex > 0) {
          const projectId = id.substring(0, colonIndex)
          const taskId = id.substring(colonIndex + 1)

          if (projectId === currentProjectId) {
            result.set(taskId, { node, taskId })
          }
        }
      }
    })

    return result
  }

  /**
   * flatNodes Map에서 Task 노드만 추출하여 Vue Flow 데이터로 변환
   * TSK-06-03: filter 지원, 초점 뷰, 그룹 노드
   *
   * @param filter GraphFilter (optional)
   * @param groupStates 그룹 확장/축소 상태 Map (optional)
   */
  function buildGraphData(filter?: GraphFilter, groupStates?: Map<string, boolean>): GraphData {
    let nodes: (TaskNode | GroupNode)[] = []
    let edges: TaskEdge[] = []
    const taskNodes = new Map<string, WbsNode>()

    // 1. 현재 프로젝트의 Task만 필터링
    const projectTasks = getProjectTasks()

    projectTasks.forEach(({ node, taskId }) => {
      // 카테고리/상태 필터 적용
      if (filter) {
        const category = node.category || 'development'
        const status = extractStatusCode(node.status)

        if (filter.categories.length > 0 && !filter.categories.includes(category)) {
          return
        }
        if (filter.statuses.length > 0 && !filter.statuses.includes(status)) {
          return
        }
      }

      taskNodes.set(taskId, node)
    })

    // 1.5. 초점 뷰 필터 적용 (TSK-06-03)
    let focusViewConfig = null
    if (filter?.focusTask && taskNodes.has(filter.focusTask)) {
      // 임시 엣지 생성 (BFS 탐색용)
      const tempEdges: TaskEdge[] = []
      taskNodes.forEach((node, taskId) => {
        if (node.depends) {
          const deps = typeof node.depends === 'string'
            ? node.depends.split(',').map(d => d.trim())
            : node.depends

          deps.forEach(depId => {
            if (depId && taskNodes.has(depId)) {
              tempEdges.push({
                id: `${depId}-${taskId}`,
                source: depId,
                target: taskId
              })
            }
          })
        }
      })

      focusViewConfig = buildFocusGraph(filter.focusTask, filter.focusDepth, taskNodes, tempEdges)

      // 초점 뷰 범위 내 Task만 남김
      const filteredTaskNodes = new Map<string, WbsNode>()
      focusViewConfig.includesNodes.forEach(taskId => {
        const node = taskNodes.get(taskId)
        if (node) {
          filteredTaskNodes.set(taskId, node)
        }
      })
      taskNodes.clear()
      filteredTaskNodes.forEach((node, taskId) => taskNodes.set(taskId, node))
    }

    // 2. 계층 모드에 따라 그룹 노드 생성 (TSK-06-03)
    if (filter?.hierarchyMode === 'wp' || filter?.hierarchyMode === 'act') {
      const groupType = filter.hierarchyMode
      const { groupNodes: builtGroupNodes, taskNodesArray } = buildGroupNodes(groupType, taskNodes, groupStates)

      // 그룹 확장/축소 상태에 따라 Task 노드 필터링
      let filteredTaskNodes = taskNodesArray
      if (groupStates) {
        filteredTaskNodes = taskNodesArray.filter(taskNode => {
          // 해당 Task가 속한 그룹 찾기
          const group = builtGroupNodes.find(g =>
            g.data.childTaskIds?.includes(taskNode.id)
          )

          if (!group) return true  // 그룹이 없으면 표시

          // 그룹 상태 확인 (undefined = 확장됨)
          const isExpanded = groupStates.get(group.id)
          return isExpanded !== false  // false가 아니면 표시
        })
      }

      nodes = [...builtGroupNodes, ...filteredTaskNodes]

      // 엣지 생성 (그룹 고려, 축소된 그룹 내부 엣지 제외)
      edges = buildEdgesWithGroups(taskNodes, builtGroupNodes, groupStates)
    } else {
      // 3. 기본 모드: 레벨 계산 (위상정렬)
      const levelMap = calculateLevels(taskNodes)

      // 4. Vue Flow 노드 배열 생성
      const taskNodesArray: TaskNode[] = []
      taskNodes.forEach((node, taskId) => {
        const status = extractStatusCode(node.status)
        const category = node.category || 'development'
        const level = levelMap.get(taskId) || 0

        // 같은 레벨의 노드 인덱스 계산 (Y 위치용)
        const sameLevelNodes = Array.from(levelMap.entries())
          .filter(([_, l]) => l === level)
          .map(([id]) => id)
        const yIndex = sameLevelNodes.indexOf(taskId)

        taskNodesArray.push({
          id: taskId,
          type: 'task',
          position: {
            x: level * 280,
            y: yIndex * 140
          },
          data: {
            taskId,
            title: node.title,
            status,
            statusName: getStatusName(status),
            category,
            categoryName: getCategoryName(category),
            assignee: node.assignee,
            depends: node.depends
          }
        })
      })

      nodes = taskNodesArray

      // 5. Vue Flow 엣지 생성
      taskNodes.forEach((node, taskId) => {
        const status = extractStatusCode(node.status)
        if (node.depends) {
          const deps = typeof node.depends === 'string'
            ? node.depends.split(',').map(d => d.trim())
            : node.depends

          deps.forEach(depId => {
            if (depId && taskNodes.has(depId)) {
              edges.push({
                id: `${depId}-${taskId}`,
                source: depId,
                target: taskId,
                type: 'smoothstep',
                animated: status !== '[xx]'
              })
            }
          })
        }
      })
    }

    return { nodes, edges }
  }

  /**
   * 그룹 노드 생성 (WP 또는 ACT)
   * TSK-06-03
   *
   * @param groupType 그룹 타입 ('wp' | 'act')
   * @param filteredTasks 필터링된 Task 맵
   * @param groupStates 그룹 확장/축소 상태 Map (optional)
   */
  function buildGroupNodes(
    groupType: 'wp' | 'act',
    filteredTasks: Map<string, WbsNode>,
    groupStates?: Map<string, boolean>
  ): { groupNodes: GroupNode[]; taskNodesArray: TaskNode[] } {
    const groupNodes: GroupNode[] = []
    const taskNodesArray: TaskNode[] = []
    const groupMap = new Map<string, { node: WbsNode; tasks: Array<{ taskId: string; node: WbsNode }> }>()

    // wbsStore에서 WP/ACT 노드 추출
    wbsStore.flatNodes.forEach((node, id) => {
      if (groupType === 'wp' && node.type === 'wp') {
        const colonIndex = id.indexOf(':')
        if (colonIndex > 0) {
          const wpId = id.substring(colonIndex + 1)
          groupMap.set(wpId, { node, tasks: [] })
        }
      } else if (groupType === 'act' && node.type === 'activity') {
        const colonIndex = id.indexOf(':')
        if (colonIndex > 0) {
          const actId = id.substring(colonIndex + 1)
          groupMap.set(actId, { node, tasks: [] })
        }
      }
    })

    // 각 Task를 해당 그룹에 할당
    filteredTasks.forEach((taskNode, taskId) => {
      // Task ID에서 그룹 ID 추출 (예: TSK-01-01 → WP-01 또는 ACT-01)
      const parts = taskId.split('-')
      if (parts.length >= 2) {
        const groupId = groupType === 'wp'
          ? `WP-${parts[1]}`
          : `ACT-${parts[1]}-${parts[2] || '01'}`

        const group = groupMap.get(groupId)
        if (group) {
          group.tasks.push({ taskId, node: taskNode })
        }
      }
    })

    // 그룹 노드 및 Task 노드 생성
    let groupIndex = 0
    groupMap.forEach((group, groupId) => {
      if (group.tasks.length === 0) {
        // 빈 그룹 제외
        return
      }

      // completedCount 계산: status === '[xx]'인 Task만
      const completedCount = group.tasks.filter(t => extractStatusCode(t.node.status) === '[xx]').length

      // Task 노드 생성
      const childTaskNodes: TaskNode[] = []
      group.tasks.forEach((task, taskIndex) => {
        const status = extractStatusCode(task.node.status)
        const category = task.node.category || 'development'

        childTaskNodes.push({
          id: task.taskId,
          type: 'task',
          position: {
            x: groupIndex * 300 + 120,
            y: taskIndex * 100
          },
          data: {
            taskId: task.taskId,
            title: task.node.title,
            status,
            statusName: getStatusName(status),
            category,
            categoryName: getCategoryName(category),
            assignee: task.node.assignee,
            depends: task.node.depends
          }
        })
      })

      // 그룹 확장 상태 확인 (기본값: true)
      const isExpanded = groupStates?.get(groupId) !== false

      // 그룹 노드 데이터 생성
      const groupNodeData: GroupNodeData = {
        groupId,
        groupType,
        title: group.node?.title || groupId,
        taskCount: group.tasks?.length || 0,
        completedCount,
        isExpanded,
        childTaskIds: group.tasks.map(t => t.taskId)
      }

      // 그룹 노드 position: 하위 Task의 평균 y, x는 왼쪽 오프셋
      const avgY = childTaskNodes.length > 0
        ? childTaskNodes.reduce((sum, n) => sum + n.position.y, 0) / childTaskNodes.length
        : 0
      groupNodes.push({
        id: groupId,
        type: 'group',
        position: {
          x: groupIndex * 300 - 100,
          y: avgY
        },
        data: groupNodeData
      })

      taskNodesArray.push(...childTaskNodes)
      groupIndex++
    })

    return { groupNodes, taskNodesArray }
  }

  /**
   * 엣지 생성 (그룹 고려)
   * TSK-06-03
   *
   * @param taskNodes Task 노드 맵
   * @param groupNodes 그룹 노드 배열
   * @param groupStates 그룹 확장/축소 상태 Map (optional)
   */
  function buildEdgesWithGroups(
    taskNodes: Map<string, WbsNode>,
    groupNodes: GroupNode[],
    groupStates?: Map<string, boolean>
  ): TaskEdge[] {
    const edges: TaskEdge[] = []
    const edgeMap = new Map<string, TaskEdge>()  // 중복 제거용

    // 축소된 그룹의 Task ID 집합 생성
    const hiddenTaskIds = new Set<string>()
    if (groupStates) {
      groupNodes.forEach(groupNode => {
        const isExpanded = groupStates.get(groupNode.id) !== false
        if (!isExpanded && groupNode.data.childTaskIds) {
          groupNode.data.childTaskIds.forEach(taskId => hiddenTaskIds.add(taskId))
        }
      })
    }

    taskNodes.forEach((node, taskId) => {
      const status = extractStatusCode(node.status)
      if (node.depends) {
        const deps = typeof node.depends === 'string'
          ? node.depends.split(',').map(d => d.trim())
          : node.depends

        deps.forEach(depId => {
          if (depId && taskNodes.has(depId)) {
            // 축소된 그룹 내부 엣지는 제외
            const sourceHidden = hiddenTaskIds.has(depId)
            const targetHidden = hiddenTaskIds.has(taskId)

            // 둘 다 숨겨진 경우에만 엣지 제외
            if (sourceHidden && targetHidden) {
              return
            }

            const edgeId = `${depId}-${taskId}`
            if (!edgeMap.has(edgeId)) {
              edgeMap.set(edgeId, {
                id: edgeId,
                source: depId,
                target: taskId,
                type: 'smoothstep',
                animated: status !== '[xx]'
              })
            }
          }
        })
      }
    })

    return Array.from(edgeMap.values())
  }

  /**
   * 위상정렬 기반 레벨 계산 (왼쪽→오른쪽 레이아웃용)
   */
  function calculateLevels(taskNodes: Map<string, WbsNode>): Map<string, number> {
    const levels = new Map<string, number>()
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    // 초기화
    taskNodes.forEach((_, id) => {
      inDegree.set(id, 0)
      adjacency.set(id, [])
    })

    // 의존관계 그래프 구축
    taskNodes.forEach((node, taskId) => {
      if (node.depends) {
        const deps = typeof node.depends === 'string'
          ? node.depends.split(',').map(d => d.trim())
          : node.depends

        deps.forEach(depId => {
          if (depId && taskNodes.has(depId)) {
            adjacency.get(depId)!.push(taskId)
            inDegree.set(taskId, (inDegree.get(taskId) || 0) + 1)
          }
        })
      }
    })

    // BFS로 레벨 할당
    const queue: string[] = []
    taskNodes.forEach((_, id) => {
      if (inDegree.get(id) === 0) {
        queue.push(id)
        levels.set(id, 0)
      }
    })

    while (queue.length > 0) {
      const current = queue.shift()!
      const currentLevel = levels.get(current) || 0

      adjacency.get(current)?.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)

        const newLevel = Math.max(levels.get(neighbor) || 0, currentLevel + 1)
        levels.set(neighbor, newLevel)

        if (newDegree === 0) {
          queue.push(neighbor)
        }
      })
    }

    // 순환 의존성 처리
    const maxLevel = Math.max(...Array.from(levels.values()), 0)
    taskNodes.forEach((_, id) => {
      if (!levels.has(id)) {
        levels.set(id, maxLevel + 1)
        console.warn(`[useDependencyGraph] 순환 의존성 감지: ${id}`)
      }
    })

    return levels
  }

  /**
   * 상태 코드 추출 (예: "basic-design [bd]" → "[bd]")
   */
  function extractStatusCode(status?: string): string {
    if (!status) return '[ ]'
    const match = status.match(/\[[\w\s]*\]/)
    return match ? match[0] : '[ ]'
  }

  /**
   * 상태 이름 반환
   */
  function getStatusName(status: string): string {
    const statusNames: Record<string, string> = {
      '[ ]': 'Todo',
      '[bd]': '기본설계',
      '[dd]': '상세설계',
      '[im]': '구현',
      '[vf]': '검증',
      '[xx]': '완료',
      '[an]': '분석',
      '[fx]': '수정',
      '[ds]': '설계'
    }
    return statusNames[status] || status
  }

  /**
   * 카테고리 이름 반환
   */
  function getCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
      development: '개발',
      defect: '결함',
      infrastructure: '인프라'
    }
    return categoryNames[category] || category
  }

  /**
   * 그래프 통계 반환 (현재 프로젝트만)
   */
  function getGraphStats() {
    let taskCount = 0
    let edgeCount = 0

    const projectTasks = getProjectTasks()
    const taskIds = new Set(projectTasks.keys())

    projectTasks.forEach(({ node }) => {
      taskCount++
      if (node.depends) {
        const deps = typeof node.depends === 'string'
          ? node.depends.split(',')
          : node.depends
        edgeCount += deps.filter(d => d.trim() && taskIds.has(d.trim())).length
      }
    })

    return { taskCount, edgeCount }
  }

  return {
    buildGraphData,
    calculateLevels,
    extractStatusCode,
    getStatusName,
    getCategoryName,
    getGraphStats,
    GRAPH_COLORS
  }
}
