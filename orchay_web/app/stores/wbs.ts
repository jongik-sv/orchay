/**
 * WBS 스토어
 * WBS 트리 데이터 관리 및 확장/축소 상태 관리
 * Task: TSK-01-01-03, TSK-09-01
 */

import type { WbsNode } from '~/types/store'
import type { WbsMetadata, AllWbsResponse } from '~/types'

export const useWbsStore = defineStore('wbs', () => {
  // ============================================================
  // State
  // ============================================================
  const tree = ref<WbsNode[]>([])
  const flatNodes = ref<Map<string, WbsNode>>(new Map())
  const loading = ref(false)
  const error = ref<string | null>(null)
  const expandedNodes = ref<Set<string>>(new Set())
  const searchQuery = ref('')
  const isMultiProjectMode = ref(false)  // TSK-09-01: 다중 프로젝트 모드 여부

  // ============================================================
  // Getters
  // ============================================================

  /**
   * WP 노드 개수
   */
  const wpCount = computed(() => {
    return countNodesByType('wp')
  })

  /**
   * ACT 노드 개수
   */
  const actCount = computed(() => {
    return countNodesByType('act')
  })

  /**
   * TSK 노드 개수
   */
  const tskCount = computed(() => {
    return countNodesByType('task')
  })

  /**
   * 전체 진행률
   */
  const overallProgress = computed(() => {
    const tasks = Array.from(flatNodes.value.values()).filter(n => n.type === 'task')
    if (tasks.length === 0) return 0
    const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0)
    return Math.round(totalProgress / tasks.length)
  })

  /**
   * 검색어로 필터링된 트리
   * - 검색어가 없으면 원본 트리 반환
   * - 검색어가 있으면 매칭되는 노드만 포함
   */
  const filteredTree = computed<WbsNode[]>(() => {
    if (!searchQuery.value.trim()) {
      return tree.value
    }

    const query = searchQuery.value.toLowerCase().trim()
    return filterTreeNodes(tree.value, query)
  })

  // ============================================================
  // Helper Functions
  // ============================================================

  /**
   * 노드 타입별 개수 계산
   */
  function countNodesByType(type: string): number {
    return Array.from(flatNodes.value.values()).filter(n => n.type === type).length
  }

  /**
   * 트리를 평탄화하여 flatNodes Map에 저장
   */
  function flattenTree(nodes: WbsNode[], result: Map<string, WbsNode> = new Map()): Map<string, WbsNode> {
    for (const node of nodes) {
      result.set(node.id, node)
      if (node.children && node.children.length > 0) {
        flattenTree(node.children, result)
      }
    }
    return result
  }

  /**
   * 트리 노드 필터링 헬퍼 함수
   * - 노드 ID 또는 title이 검색어를 포함하면 해당 노드와 상위 경로 유지
   * - 재귀적으로 자식 노드 검색
   */
  function filterTreeNodes(nodes: WbsNode[], query: string): WbsNode[] {
    const result: WbsNode[] = []

    for (const node of nodes) {
      // 현재 노드가 검색어와 매칭되는지 확인
      const nodeMatches =
        node.id.toLowerCase().includes(query) ||
        node.title.toLowerCase().includes(query)

      // 자식 노드 재귀 필터링
      const filteredChildren = node.children
        ? filterTreeNodes(node.children, query)
        : []

      // 현재 노드가 매칭되거나 자식 중 매칭되는 노드가 있으면 포함
      if (nodeMatches || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren
        })
      }
    }

    return result
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * WBS 데이터 조회 (단일 프로젝트)
   */
  async function fetchWbs(projectId: string) {
    loading.value = true
    error.value = null
    isMultiProjectMode.value = false
    try {
      // API 응답: { metadata, tree } 객체 형식
      const response = await $fetch<{ metadata: WbsMetadata; tree: WbsNode[] }>(
        `/api/projects/${projectId}/wbs`
      )
      tree.value = response.tree
      flatNodes.value = flattenTree(response.tree)
      // 기본적으로 최상위 노드들 확장
      response.tree.forEach(node => expandedNodes.value.add(node.id))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch WBS'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 모든 프로젝트 WBS 조회 (다중 프로젝트 모드)
   * TSK-09-01
   */
  async function fetchAllWbs(): Promise<void> {
    loading.value = true
    error.value = null
    isMultiProjectMode.value = true

    try {
      const response = await $fetch<AllWbsResponse>('/api/wbs/all')
      tree.value = response.projects
      flatNodes.value = flattenTree(response.projects)

      // 프로젝트 노드만 기본 확장
      response.projects.forEach(project => {
        expandedNodes.value.add(project.id)
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch all WBS'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * WBS 데이터 저장
   */
  async function saveWbs(projectId: string) {
    loading.value = true
    error.value = null
    try {
      await $fetch(`/api/projects/${projectId}/wbs`, {
        method: 'PUT',
        body: tree.value
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to save WBS'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * ID로 노드 조회
   */
  function getNode(id: string): WbsNode | undefined {
    return flatNodes.value.get(id)
  }

  /**
   * 특정 노드의 조상 노드 ID 목록 반환 (루트 → 부모 순서)
   * 트리 순회하여 해당 노드까지의 경로 탐색
   */
  function getAncestorIds(targetId: string): string[] {
    const path: string[] = []

    function findPath(nodes: WbsNode[], currentPath: string[]): boolean {
      for (const node of nodes) {
        if (node.id === targetId) {
          path.push(...currentPath)
          return true
        }
        if (node.children && node.children.length > 0) {
          if (findPath(node.children, [...currentPath, node.id])) {
            return true
          }
        }
      }
      return false
    }

    findPath(tree.value, [])
    return path
  }

  /**
   * 노드 확장/축소 토글
   */
  function toggleExpand(id: string) {
    if (expandedNodes.value.has(id)) {
      expandedNodes.value.delete(id)
    } else {
      expandedNodes.value.add(id)
    }
  }

  /**
   * 노드가 확장되어 있는지 확인
   */
  function isExpanded(id: string): boolean {
    return expandedNodes.value.has(id)
  }

  /**
   * 모든 노드 확장
   */
  function expandAll() {
    flatNodes.value.forEach((_, id) => {
      expandedNodes.value.add(id)
    })
  }

  /**
   * 모든 노드 축소
   */
  function collapseAll() {
    expandedNodes.value.clear()
  }

  /**
   * WBS 데이터 초기화
   */
  function clearWbs() {
    tree.value = []
    flatNodes.value.clear()
    expandedNodes.value.clear()
  }

  /**
   * 검색어 설정
   */
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  return {
    // State
    tree,
    flatNodes,
    loading,
    error,
    expandedNodes,
    searchQuery,
    isMultiProjectMode,
    // Getters
    wpCount,
    actCount,
    tskCount,
    overallProgress,
    filteredTree,
    // Actions
    fetchWbs,
    fetchAllWbs,
    saveWbs,
    getNode,
    getAncestorIds,
    toggleExpand,
    isExpanded,
    expandAll,
    collapseAll,
    clearWbs,
    setSearchQuery
  }
})

// HMR 지원
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWbsStore, import.meta.hot))
}
