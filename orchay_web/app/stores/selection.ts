/**
 * 선택 스토어
 * 현재 선택된 노드 및 Task 상세 정보 관리
 * Task: TSK-01-01-03, TSK-09-01
 */

import type { TaskDetail, WbsNodeType, WbsNode, ProjectFile, ProjectFilesResponse, TaskCategory, Priority } from '~/types'
import { useWbsStore } from './wbs'
import { useProjectStore } from './project'
import { useConfigStore } from './config'
import { buildApiUrl } from '~/utils/urlPath'
import * as tauriApi from '~/utils/tauri'

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

/**
 * 가능한 워크플로우 액션 조회
 * 서버의 taskService.getAvailableActions() 로직과 동일하게 구현
 */
function getAvailableActions(category: TaskCategory, status: string): string[] {
  // 상태 코드 추출 (예: "detail-design [dd]" → "[dd]" → "dd")
  const statusCode = status.match(/\[([^\]]+)\]/)?.[1] || status

  const workflowMap: Record<TaskCategory, Record<string, string[]>> = {
    development: {
      '[ ]': ['start'],
      'bd': ['draft'],
      'dd': ['build'],
      'im': ['verify'],
      'vf': ['done'],
      'xx': [],
    },
    defect: {
      '[ ]': ['start'],
      'an': ['verify'],
      'fx': ['verify'],
      'vf': ['done'],
      'xx': [],
    },
    infrastructure: {
      '[ ]': ['start', 'skip'],
      'ds': ['build'],
      'im': ['done'],
      'xx': [],
    },
  }

  const categoryActions = workflowMap[category]
  if (!categoryActions) {
    return []
  }

  return categoryActions[statusCode] || []
}

/**
 * WBS 스토어에서 TaskDetail 구성 (Tauri 전용)
 * 서버의 taskService.getTaskDetail() 로직을 클라이언트에서 재현
 */
async function buildTaskDetailFromWbs(
  wbsStore: ReturnType<typeof useWbsStore>,
  taskId: string,
  projectId: string | null
): Promise<TaskDetail> {
  // 1. WBS 트리에서 Task 노드 검색
  // 다중 프로젝트 모드: 복합 ID 우선 검색 (서버와 동일)
  const taskNode = wbsStore.isMultiProjectMode
    ? (wbsStore.getNode(`${projectId}:${taskId}`) || wbsStore.getNode(taskId))
    : (wbsStore.getNode(taskId) || wbsStore.getNode(`${projectId}:${taskId}`))

  if (!taskNode || taskNode.type !== 'task') {
    throw new Error(`Task not found: ${taskId}`)
  }

  // 2. 부모 WP/ACT 찾기
  const { parentWp, parentAct } = findParentNodes(wbsStore, taskId, projectId)

  // 3. Task 카테고리와 상태로 가능한 액션 조회
  const category = (taskNode.category || 'development') as TaskCategory
  const status = taskNode.status || '[ ]'
  const availableActions = getAvailableActions(category, status)

  // 4. 문서 목록 조회 (Tauri 환경)
  let documents: tauriApi.DocumentInfo[] = []
  if (projectId) {
    try {
      const configStore = useConfigStore()
      if (configStore.basePath) {
        documents = await tauriApi.listTaskDocuments(configStore.basePath, projectId, taskId)
      }
    } catch (e) {
      console.warn('[buildTaskDetailFromWbs] Failed to load documents:', e)
    }
  }

  // 5. TaskDetail 구성 (id는 원본 taskId 사용, 복합 ID 아님)
  return {
    id: taskId,
    title: taskNode.title,
    category,
    status,
    priority: (taskNode.priority || 'medium') as Priority,
    assignee: taskNode.assignee ? { id: taskNode.assignee, name: taskNode.assignee } : undefined,
    parentWp,
    parentAct,
    schedule: taskNode.schedule,
    requirements: taskNode.requirements || [],
    tags: taskNode.tags || [],
    depends: taskNode.depends,  // 이미 배열 형태 (파서에서 처리)
    ref: taskNode.ref,
    documents,
    availableActions,
    completed: taskNode.completed,
    rawContent: taskNode.rawContent,
  }
}

/**
 * 트리에서 부모 WP/ACT 노드 찾기
 */
function findParentNodes(
  wbsStore: ReturnType<typeof useWbsStore>,
  taskId: string,
  projectId: string | null
): { parentWp: string; parentAct?: string } {
  let parentWp = ''
  let parentAct: string | undefined

  // 트리를 순회하며 Task의 부모 찾기
  // 다중 프로젝트 모드: 복합 ID 우선 검색 (서버와 동일)
  const compositeId = projectId ? `${projectId}:${taskId}` : taskId
  const ancestorIds = wbsStore.isMultiProjectMode
    ? (wbsStore.getAncestorIds(compositeId) || wbsStore.getAncestorIds(taskId) || [])
    : (wbsStore.getAncestorIds(taskId) || wbsStore.getAncestorIds(compositeId) || [])

  for (const ancestorId of ancestorIds) {
    const node = wbsStore.getNode(ancestorId)
    if (node?.type === 'wp') {
      // 다중 프로젝트 모드: 원본 ID 반환 (프리픽스 제거)
      parentWp = node.projectId ? node.id.replace(`${node.projectId}:`, '') : node.id
    }
    if (node?.type === 'act') {
      parentAct = node.projectId ? node.id.replace(`${node.projectId}:`, '') : node.id
    }
  }

  return { parentWp, parentAct }
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
   * Tauri 환경에서는 WBS 스토어에서 직접 TaskDetail 구성
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

      // Tauri 환경: WBS 스토어에서 TaskDetail 구성 (API 서버 없음)
      if (tauriApi.isTauri()) {
        const wbsStore = useWbsStore()
        const taskDetail = await buildTaskDetailFromWbs(wbsStore, taskId, projectId)
        selectedTask.value = taskDetail
      } else {
        // Web 환경: API 호출
        const url = buildApiUrl('/api/tasks', [taskId], projectId ? { project: projectId } : undefined)
        const data = await $fetch<TaskDetail>(url)
        selectedTask.value = data
      }
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
