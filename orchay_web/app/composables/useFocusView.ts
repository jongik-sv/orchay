/**
 * 초점 뷰 관리 컴포저블 (BFS 알고리즘)
 * Task: TSK-06-03
 */

import type { WbsNode } from '~/types'
import type { TaskEdge, FocusViewConfig } from '~/types/graph'

export function useFocusView() {
  /**
   * BFS 탐색으로 초점 Task로부터 depth 제한 내 Task 집합 계산
   *
   * @param focusTaskId 초점 Task ID
   * @param depth 탐색 깊이 (1~3)
   * @param taskNodes 전체 Task 노드 맵
   * @param edges 전체 엣지 배열
   * @returns 초점 뷰 설정 (depth 내 Task ID 집합 포함)
   */
  function buildFocusGraph(
    focusTaskId: string,
    depth: number,
    taskNodes: Map<string, WbsNode>,
    edges: TaskEdge[]
  ): FocusViewConfig {
    const includesNodes = new Set<string>()
    const visited = new Set<string>()

    // 초점 Task 존재 확인 (경고 출력하지만 계속 진행)
    if (!taskNodes.has(focusTaskId)) {
      console.warn(`[useFocusView] 초점 Task가 존재하지 않음: ${focusTaskId}`)
      // 초점 Task만 포함하고 인접 노드 없이 반환
      includesNodes.add(focusTaskId)
      return {
        focusTaskId,
        depth,
        includesNodes
      }
    }

    // 인접 리스트 사전 구축 (성능 최적화)
    const adjacency = buildAdjacencyList(taskNodes, edges)

    // BFS 큐: { taskId, currentDepth }
    const queue: Array<{ taskId: string; currentDepth: number }> = [
      { taskId: focusTaskId, currentDepth: 0 }
    ]

    while (queue.length > 0) {
      const { taskId, currentDepth } = queue.shift()!

      // 이미 방문한 노드는 건너뛰기 (순환 방지)
      if (visited.has(taskId)) continue
      visited.add(taskId)

      // 현재 노드를 결과에 추가
      includesNodes.add(taskId)

      // depth 한계에 도달하면 더 이상 확장하지 않음
      if (currentDepth >= depth) continue

      // 인접 노드 탐색 (predecessors + successors)
      const neighbors = adjacency.get(taskId)
      if (neighbors) {
        const { predecessors, successors } = neighbors

        // 선행 Task (depends on)
        predecessors.forEach(predId => {
          if (!visited.has(predId)) {
            queue.push({ taskId: predId, currentDepth: currentDepth + 1 })
          }
        })

        // 후행 Task (depended by)
        successors.forEach(succId => {
          if (!visited.has(succId)) {
            queue.push({ taskId: succId, currentDepth: currentDepth + 1 })
          }
        })
      }
    }

    return {
      focusTaskId,
      depth,
      includesNodes
    }
  }

  /**
   * 인접 리스트 구축 (O(E) → O(1) 탐색 최적화)
   */
  function buildAdjacencyList(
    taskNodes: Map<string, WbsNode>,
    edges: TaskEdge[]
  ): Map<string, { predecessors: string[]; successors: string[] }> {
    const adjacency = new Map<string, { predecessors: string[]; successors: string[] }>()

    // 초기화
    taskNodes.forEach((_, taskId) => {
      adjacency.set(taskId, { predecessors: [], successors: [] })
    })

    // 엣지로부터 인접 리스트 구축
    edges.forEach(edge => {
      const sourceAdj = adjacency.get(edge.source)
      const targetAdj = adjacency.get(edge.target)

      if (sourceAdj && targetAdj) {
        // source → target: target은 source의 successor
        sourceAdj.successors.push(edge.target)

        // target ← source: source는 target의 predecessor
        targetAdj.predecessors.push(edge.source)
      }
    })

    return adjacency
  }

  return {
    buildFocusGraph
  }
}
