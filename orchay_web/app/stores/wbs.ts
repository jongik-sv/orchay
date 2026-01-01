/**
 * WBS 스토어
 * WBS 트리 데이터 관리 및 확장/축소 상태 관리
 * Task: TSK-01-01-03, TSK-09-01
 * Tauri/Electron/Web 환경을 자동 감지합니다.
 */

import type { WbsNode } from '~/types/store'
import type { WbsMetadata, AllWbsResponse, ProjectWbsNode } from '~/types'
import * as tauriApi from '../utils/tauri'
import { parseWbsMarkdown } from '../utils/wbsParser'

// 트리를 평탄화하는 헬퍼 (fetchAllWbs용)
function flattenNodes(nodes: WbsNode[]): WbsNode[] {
  const result: WbsNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.children && node.children.length > 0) {
      result.push(...flattenNodes(node.children))
    }
  }
  return result
}

/**
 * 노드 ID에 프로젝트 프리픽스 추가 (재귀)
 * 다중 프로젝트 모드에서 노드 ID 충돌 방지
 * 서버의 wbsService.ts:addProjectPrefixToNodes()와 동일
 */
function addProjectPrefixToNodes(nodes: WbsNode[], projectId: string): WbsNode[] {
  return nodes.map(node => ({
    ...node,
    id: `${projectId}:${node.id}`,
    projectId,
    children: node.children?.length
      ? addProjectPrefixToNodes(node.children, projectId)
      : [],
  }))
}

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
      let parsedTree: WbsNode[] = []

      if (tauriApi.isTauri()) {
        // Tauri 환경: Rust 커맨드로 마크다운 읽기 → 파싱
        const configStore = useConfigStore()
        if (!configStore.basePath) {
          tree.value = []
          flatNodes.value.clear()
          return
        }
        const wbsContent = await tauriApi.getWbs(configStore.basePath, projectId)
        parsedTree = parseWbsMarkdown(wbsContent)
      } else {
        // Web/Electron 환경: Nitro API 사용
        const response = await $fetch<{ metadata: WbsMetadata; tree: WbsNode[] }>(
          `/api/projects/${projectId}/wbs`
        )
        parsedTree = response.tree
      }

      tree.value = parsedTree
      flatNodes.value = flattenTree(parsedTree)
      // 기본적으로 최상위 노드들 확장
      parsedTree.forEach(node => expandedNodes.value.add(node.id))
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch WBS'
      console.error('[WbsStore] Failed to fetch WBS:', e)
      tree.value = []
      flatNodes.value.clear()
    } finally {
      loading.value = false
    }
  }

  /**
   * 모든 프로젝트 WBS 조회 (다중 프로젝트 모드)
   * TSK-09-01
   */
  async function fetchAllWbs(): Promise<void> {
    console.log('[WbsStore] fetchAllWbs START')
    loading.value = true
    error.value = null
    isMultiProjectMode.value = true

    try {
      let allProjects: WbsNode[] = []

      if (tauriApi.isTauri()) {
        console.log('[WbsStore] Tauri environment detected')
        // Tauri 환경: 각 프로젝트의 WBS를 개별 로드
        let configStore
        let projectStore

        try {
          configStore = useConfigStore()
          projectStore = useProjectStore()
          console.log('[WbsStore] Stores obtained, basePath:', configStore?.basePath)
        } catch (e) {
          console.error('[WbsStore] Failed to get stores:', e)
          tree.value = []
          flatNodes.value.clear()
          throw e  // 에러 전파
        }

        const basePath = configStore?.basePath
        if (!basePath) {
          console.log('[WbsStore] No base path configured, skipping fetchAllWbs')
          tree.value = []
          flatNodes.value.clear()
          return
        }

        // 프로젝트 목록 가져오기
        try {
          console.log('[WbsStore] Fetching projects...')
          await projectStore.fetchProjects()
          const projectList = projectStore.projects
          const projects = Array.isArray(projectList) ? projectList : []
          console.log('[WbsStore] Found', projects.length, 'projects')

          for (const project of projects) {
            if (!project?.id) continue
            try {
              console.log('[WbsStore] Loading WBS for project:', project.id)
              const wbsContent = await tauriApi.getWbs(basePath, project.id)
              const projectTree = parseWbsMarkdown(wbsContent)
              console.log('[WbsStore] Parsed', projectTree.length, 'nodes for', project.id)

              // Task 개수 및 진행률 계산 (프리픽스 추가 전에 계산)
              const tasks = flattenNodes(projectTree).filter(n => n.type === 'task')
              const taskCount = tasks.length
              const progress = taskCount > 0
                ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / taskCount)
                : 0

              // 다중 프로젝트 모드: 노드 ID에 프로젝트 프리픽스 추가 (서버와 동일)
              const prefixedTree = addProjectPrefixToNodes(projectTree, project.id)

              // 프로젝트 노드로 감싸기 (ProjectWbsNode 타입)
              const projectNode: ProjectWbsNode = {
                id: project.id,
                title: project.name || project.id,
                type: 'project',
                status: project.status || 'active',
                progress,
                taskCount,
                children: prefixedTree,
                projectMeta: {
                  name: project.name || project.id,
                  status: (project.status || 'active') as 'active' | 'archived' | 'completed',
                  wbsDepth: 4,
                  createdAt: project.createdAt || new Date().toISOString(),
                }
              }
              allProjects.push(projectNode)
            } catch (e) {
              console.warn(`[WbsStore] Failed to load WBS for project ${project.id}:`, e)
            }
          }
        } catch (e) {
          console.error('[WbsStore] Failed to fetch projects:', e)
          throw e  // 에러 전파
        }
      } else {
        // Web/Electron 환경: Nitro API 사용
        const response = await $fetch<AllWbsResponse>('/api/wbs/all')
        allProjects = response.projects || []
      }

      tree.value = allProjects
      flatNodes.value = flattenTree(allProjects)
      console.log('[WbsStore] Tree loaded with', allProjects.length, 'projects')

      // 프로젝트 노드만 기본 확장
      allProjects.forEach(project => {
        expandedNodes.value.add(project.id)
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch all WBS'
      console.error('[WbsStore] Failed to fetch all WBS:', e)
      tree.value = []
      flatNodes.value.clear()
      throw e  // 에러 전파
    } finally {
      loading.value = false
      console.log('[WbsStore] fetchAllWbs END')
    }
  }

  /**
   * WBS 데이터 저장
   */
  async function saveWbs(projectId: string) {
    loading.value = true
    error.value = null
    try {
      if (tauriApi.isTauri()) {
        // Tauri 환경: Rust 커맨드로 저장
        const configStore = useConfigStore()
        if (!configStore.basePath) {
          throw new Error('Base path not configured')
        }
        // TODO: tree → markdown 변환 구현 필요
        // 현재는 원본 마크다운을 유지하고 있지 않음
        console.warn('[WbsStore] Tauri WBS save not fully implemented')
      } else {
        // Web/Electron 환경: Nitro API 사용
        await $fetch(`/api/projects/${projectId}/wbs`, {
          method: 'PUT',
          body: tree.value
        })
      }
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
