/**
 * 선택 스토어
 * 현재 선택된 노드 및 Task 상세 정보 관리
 * Task: TSK-01-01-03, TSK-09-01
 */

import type { TaskDetail, WbsNodeType, WbsNode, ProjectFile, ProjectFilesResponse } from '~/types'
import { useWbsStore } from './wbs'
import { useProjectStore } from './project'
import { buildApiUrl } from '~/utils/urlPath'

/**
 * 복합 ID 파싱 (다중 프로젝트 모드 지원)
 * @param compositeId - `projectId:nodeId` 또는 `nodeId` 형식
 * @returns { projectId, nodeId } - projectId는 복합 ID일 때만 존재
 */
function parseCompositeId(compositeId: string): { projectId?: string; nodeId: string } {
  const colonIndex = compositeId.indexOf(':')
  if (colonIndex > 0) {
    return {
      projectId: compositeId.substring(0, colonIndex),
      nodeId: compositeId.substring(colonIndex + 1)
    }
  }
  return { nodeId: compositeId }
}

/**
 * 노드 ID에서 노드 타입 추출
 * @param nodeId - 원본 노드 ID (복합 ID 아님)
 */
function getNodeTypeFromId(nodeId: string): WbsNodeType | null {
  const upper = nodeId.toUpperCase()
  if (upper.startsWith('WP-')) return 'wp'
  if (upper.startsWith('ACT-')) return 'act'
  if (upper.startsWith('TSK-')) return 'task'
  return null
}

export const useSelectionStore = defineStore('selection', () => {
  // ============================================================
  // State
  // ============================================================
  const selectedNodeId = ref<string | null>(null)
  const selectedTask = ref<TaskDetail | null>(null)
  const selectedProjectId = ref<string | null>(null)  // 현재 선택된 Task/Node의 프로젝트 ID
  const loadingTask = ref(false)
  const error = ref<string | null>(null)

  // TSK-09-01: 프로젝트 파일 목록
  const selectedProjectFiles = ref<ProjectFile[]>([])
  const loadingFiles = ref(false)

  // ============================================================
  // Getters
  // ============================================================

  /**
   * 선택된 노드가 있는지 확인
   */
  const hasSelection = computed(() => selectedNodeId.value !== null)

  /**
   * 선택된 노드의 타입 추출
   * 다중 프로젝트 모드: 복합 ID (projectId:nodeId) 지원
   */
  const selectedNodeType = computed((): WbsNodeType | null => {
    if (!selectedNodeId.value) return null

    // 복합 ID에서 원본 nodeId 추출
    const { nodeId } = parseCompositeId(selectedNodeId.value)
    const type = getNodeTypeFromId(nodeId)
    return type || 'project'
  })

  /**
   * 선택된 것이 Task인지 확인
   */
  const isTaskSelected = computed(() => selectedNodeType.value === 'task')

  /**
   * WP 또는 ACT 선택 여부
   */
  const isWpOrActSelected = computed(() => {
    const type = selectedNodeType.value
    return type === 'wp' || type === 'act'
  })

  /**
   * 선택된 WbsNode 반환 (WP/ACT 전용)
   * Task가 선택되었으면 null 반환
   *
   * H-01 지적사항 반영:
   * - wbsStore.flatNodes 초기화 검증 추가
   * - 노드 조회 실패 시 경고 로그 출력
   */
  const selectedNode = computed((): WbsNode | null => {
    if (!selectedNodeId.value) return null
    if (isTaskSelected.value) return null

    const wbsStore = useWbsStore()

    // wbsStore.flatNodes가 초기화되었는지 확인
    if (!wbsStore.flatNodes || wbsStore.flatNodes.size === 0) {
      console.warn('[selectionStore] WBS data not loaded yet')
      return null
    }

    const node = wbsStore.getNode(selectedNodeId.value)
    if (!node) {
      console.warn(`[selectionStore] Node not found: ${selectedNodeId.value}`)
    }

    return node || null
  })

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 노드 선택
   * 다중 프로젝트 모드: 복합 ID (projectId:nodeId) 지원
   */
  async function selectNode(nodeId: string) {
    // 같은 노드 재선택 시 무시
    if (selectedNodeId.value === nodeId) return

    selectedNodeId.value = nodeId
    error.value = null

    const wbsStore = useWbsStore()
    const node = wbsStore.getNode(nodeId)

    if (!node) return

    // 프로젝트 노드 선택 시 파일 목록 로드 (TSK-09-01)
    if (node.type === 'project') {
      // 프로젝트 ID 설정 (의존관계 그래프 필터링용)
      selectedProjectId.value = nodeId
      await fetchProjectFiles(nodeId)
      selectedTask.value = null
    }
    // Task인 경우 상세 정보 로드
    else if (node.type === 'task') {
      await loadTaskDetail(nodeId)
      selectedProjectFiles.value = []
    } else {
      // WP/ACT 노드: 복합 ID에서 프로젝트 ID 추출
      const { projectId } = parseCompositeId(nodeId)
      if (projectId) {
        selectedProjectId.value = projectId
      }
      selectedTask.value = null
      selectedProjectFiles.value = []
    }
  }

  /**
   * Task 상세 정보 로드
   * 다중 프로젝트 모드: 복합 ID (projectId:taskId)에서 원본 ID 추출
   */
  async function loadTaskDetail(compositeTaskId: string) {
    loadingTask.value = true
    error.value = null
    try {
      // 복합 ID에서 projectId와 원본 taskId 추출
      const { projectId: parsedProjectId, nodeId: taskId } = parseCompositeId(compositeTaskId)

      // projectId 우선순위: 복합 ID > projectStore
      const projectStore = useProjectStore()
      const projectId = parsedProjectId || projectStore.projectId

      // 선택된 프로젝트 ID 저장
      selectedProjectId.value = projectId || null

      // 한글, 공백, 괄호 등 특수문자 안전하게 인코딩
      const url = buildApiUrl('/api/tasks', [taskId], projectId ? { project: projectId } : undefined)
      const data = await $fetch<TaskDetail>(url)
      selectedTask.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load task detail'
      selectedTask.value = null
    } finally {
      loadingTask.value = false
    }
  }

  /**
   * Task 상세 정보 새로고침
   */
  async function refreshTaskDetail() {
    if (selectedNodeId.value && isTaskSelected.value) {
      await loadTaskDetail(selectedNodeId.value)
    }
  }

  /**
   * 프로젝트 파일 목록 조회 (TSK-09-01)
   */
  async function fetchProjectFiles(projectId: string): Promise<void> {
    loadingFiles.value = true

    try {
      const response = await $fetch<ProjectFilesResponse>(
        `/api/projects/${projectId}/files`
      )
      selectedProjectFiles.value = response.files
    } catch (e) {
      console.error('Failed to fetch project files:', e)
      selectedProjectFiles.value = []
    } finally {
      loadingFiles.value = false
    }
  }

  /**
   * 선택 해제
   */
  function clearSelection() {
    selectedNodeId.value = null
    selectedTask.value = null
    selectedProjectId.value = null
    selectedProjectFiles.value = []
    error.value = null
  }

  /**
   * 모든 Task 목록 (트리 순서)
   */
  const allTasks = computed(() => {
    const wbsStore = useWbsStore()
    return Array.from(wbsStore.flatNodes.values()).filter(n => n.type === 'task')
  })

  /**
   * 현재 선택된 Task의 인덱스
   */
  const currentTaskIndex = computed(() => {
    if (!selectedNodeId.value || !isTaskSelected.value) return -1
    return allTasks.value.findIndex(t => t.id === selectedNodeId.value)
  })

  /**
   * 이전 Task 존재 여부
   */
  const hasPrevTask = computed(() => currentTaskIndex.value > 0)

  /**
   * 다음 Task 존재 여부
   */
  const hasNextTask = computed(() => {
    return currentTaskIndex.value >= 0 && currentTaskIndex.value < allTasks.value.length - 1
  })

  /**
   * 이전 Task로 이동
   */
  async function selectPrevTask() {
    if (!hasPrevTask.value) return
    const prevTask = allTasks.value[currentTaskIndex.value - 1]
    if (prevTask) {
      await selectNode(prevTask.id)
      // 트리에서 노드가 보이도록 부모 노드 확장
      ensureNodeVisible(prevTask.id)
    }
  }

  /**
   * 다음 Task로 이동
   */
  async function selectNextTask() {
    if (!hasNextTask.value) return
    const nextTask = allTasks.value[currentTaskIndex.value + 1]
    if (nextTask) {
      await selectNode(nextTask.id)
      // 트리에서 노드가 보이도록 부모 노드 확장
      ensureNodeVisible(nextTask.id)
    }
  }

  /**
   * 노드가 트리에서 보이도록 부모 노드들을 확장
   * 트리 구조를 순회하여 정확한 조상 노드들을 찾아 확장
   */
  function ensureNodeVisible(nodeId: string) {
    const wbsStore = useWbsStore()
    // 트리를 순회하여 정확한 조상 노드 ID 목록 획득
    const ancestorIds = wbsStore.getAncestorIds(nodeId)
    // 모든 조상 노드 확장
    for (const ancestorId of ancestorIds) {
      wbsStore.expandedNodes.add(ancestorId)
    }
  }

  return {
    // State
    selectedNodeId,
    selectedTask,
    selectedProjectId,
    selectedProjectFiles,
    loadingTask,
    loadingFiles,
    error,
    // Getters
    hasSelection,
    selectedNodeType,
    isTaskSelected,
    isWpOrActSelected,
    selectedNode,
    allTasks,
    currentTaskIndex,
    hasPrevTask,
    hasNextTask,
    // Actions
    selectNode,
    loadTaskDetail,
    refreshTaskDetail,
    fetchProjectFiles,
    clearSelection,
    selectPrevTask,
    selectNextTask
  }
})

// HMR 지원
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSelectionStore, import.meta.hot))
}
