/**
 * 설정 스토어
 * 전역 설정 (컬럼, 카테고리, 워크플로우, 액션) 관리
 * Task: TSK-01-01-03
 */

import type { ColumnDef, CategoryDef, WorkflowDef, ActionDef, TransitionDef } from '~/types/store'

export const useSettingsStore = defineStore('settings', () => {
  // ============================================================
  // State
  // ============================================================
  const columns = ref<ColumnDef[]>([])
  const categories = ref<CategoryDef[]>([])
  const workflows = ref<WorkflowDef[]>([])
  const actions = ref<ActionDef[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============================================================
  // Getters
  // ============================================================

  /**
   * 상태 코드로 컬럼 조회
   */
  const getColumnByStatus = computed(() => {
    return (status: string): ColumnDef | undefined => {
      return columns.value.find(col => col.statuses.includes(status))
    }
  })

  /**
   * 카테고리 코드로 카테고리 조회
   */
  const getCategoryByCode = computed(() => {
    return (code: string): CategoryDef | undefined => {
      return categories.value.find(cat => cat.code === code)
    }
  })

  /**
   * 카테고리 ID로 워크플로우 조회
   */
  const getWorkflowByCategory = computed(() => {
    return (category: string): WorkflowDef | undefined => {
      return workflows.value.find(wf => wf.category === category)
    }
  })

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 모든 설정 로드
   */
  async function loadSettings() {
    if (loaded.value) return // 이미 로드됨

    loading.value = true
    error.value = null

    try {
      // 병렬로 모든 설정 로드
      const [columnsData, categoriesData, workflowsData, actionsData] = await Promise.all([
        $fetch<ColumnDef[]>('/api/settings/columns'),
        $fetch<CategoryDef[]>('/api/settings/categories'),
        $fetch<WorkflowDef[]>('/api/settings/workflows'),
        $fetch<ActionDef[]>('/api/settings/actions')
      ])

      columns.value = columnsData
      categories.value = categoriesData
      workflows.value = workflowsData
      actions.value = actionsData
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load settings'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 카테고리와 현재 상태에서 가능한 전이 목록 조회
   */
  function getAvailableTransitions(category: string, status: string): TransitionDef[] {
    const workflow = workflows.value.find(wf => wf.category === category)
    if (!workflow) return []

    return workflow.transitions.filter(t => t.from === status)
  }

  /**
   * 현재 상태에서 사용 가능한 액션 조회
   */
  function getAvailableActions(status: string): ActionDef[] {
    return actions.value.filter(action => action.status.includes(status))
  }

  /**
   * 설정 새로고침 (강제 재로드)
   */
  async function refreshSettings() {
    loaded.value = false
    await loadSettings()
  }

  return {
    // State
    columns,
    categories,
    workflows,
    actions,
    loaded,
    loading,
    error,
    // Getters
    getColumnByStatus,
    getCategoryByCode,
    getWorkflowByCategory,
    // Actions
    loadSettings,
    getAvailableTransitions,
    getAvailableActions,
    refreshSettings
  }
})

// HMR 지원
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
}
