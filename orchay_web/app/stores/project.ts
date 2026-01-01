/**
 * 프로젝트 스토어
 * 현재 프로젝트 정보 및 프로젝트 목록 관리
 * Task: TSK-01-01-03
 * Tauri/Electron/Web 환경을 자동 감지합니다.
 */

import type { Project, ProjectSummary, ProjectListResponse } from '~/types/store'
import type { TeamMember } from '~/types'
import * as tauriApi from '../utils/tauri'

export const useProjectStore = defineStore('project', () => {
  // ============================================================
  // State
  // ============================================================
  const currentProject = ref<Project | null>(null)
  const teamMembers = ref<TeamMember[]>([])
  const projects = ref<ProjectSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ============================================================
  // Getters
  // ============================================================
  const projectId = computed(() => currentProject.value?.id)
  const projectName = computed(() => currentProject.value?.name)
  const hasProject = computed(() => currentProject.value !== null)

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 프로젝트 목록 조회
   */
  async function fetchProjects() {
    console.log('[ProjectStore] fetchProjects START')
    loading.value = true
    error.value = null
    try {
      if (tauriApi.isTauri()) {
        // Tauri 환경: Rust 커맨드 사용
        const configStore = useConfigStore()
        console.log('[ProjectStore] configStore.basePath:', configStore?.basePath)
        if (!configStore || !configStore.basePath) {
          console.log('[ProjectStore] No basePath, returning empty')
          projects.value = []
          return
        }
        try {
          console.log('[ProjectStore] Calling tauriApi.getProjects...')
          const response = await tauriApi.getProjects(configStore.basePath)
          console.log('[ProjectStore] tauriApi.getProjects response:', response)
          const projectList = response?.projects ?? []
          projects.value = projectList.map(p => ({
            id: p.id,
            name: p.name,
            status: (p.status || 'active') as 'active' | 'archived',
          }))
          console.log('[ProjectStore] Loaded', projects.value.length, 'projects')
        } catch (e) {
          console.error('[ProjectStore] Tauri getProjects FAILED:', e)
          projects.value = []
          throw e  // 에러 전파
        }
      } else {
        // Web/Electron 환경: Nitro API 사용
        const data = await $fetch<ProjectListResponse>('/api/projects')
        projects.value = data.projects
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch projects'
      console.error('[ProjectStore] Failed to fetch projects:', e)
      projects.value = []
      throw e  // 에러 전파
    } finally {
      loading.value = false
      console.log('[ProjectStore] fetchProjects END')
    }
  }

  /**
   * 특정 프로젝트 로드 (프로젝트 + 팀원 정보)
   */
  async function loadProject(id: string) {
    // 이미 로드된 프로젝트면 스킵
    if (currentProject.value?.id === id) {
      return
    }

    loading.value = true
    error.value = null
    try {
      if (tauriApi.isTauri()) {
        // Tauri 환경: Rust 커맨드 사용
        const configStore = useConfigStore()
        if (!configStore || !configStore.basePath) {
          throw new Error('Base path not configured')
        }
        try {
          const projectConfig = await tauriApi.getProject(configStore.basePath, id)
          currentProject.value = {
            id: projectConfig.id,
            name: projectConfig.name,
            status: (projectConfig.status || 'active') as 'active' | 'archived',
            wbsDepth: projectConfig.wbsDepth || 4,
            createdAt: projectConfig.createdAt || new Date().toISOString(),
          }
          teamMembers.value = []  // TODO: 팀원 정보 Rust 커맨드 추가 필요
        } catch (e) {
          console.warn('[ProjectStore] Tauri getProject failed:', e)
          throw e
        }
      } else {
        // Web/Electron 환경: Nitro API 사용
        const data = await $fetch<{ project: Project; team: TeamMember[] }>(`/api/projects/${id}`)
        currentProject.value = data.project
        teamMembers.value = data.team
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load project'
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 현재 프로젝트 초기화
   */
  function clearProject() {
    currentProject.value = null
  }

  return {
    // State
    currentProject,
    teamMembers,
    projects,
    loading,
    error,
    // Getters
    projectId,
    projectName,
    hasProject,
    // Actions
    fetchProjects,
    loadProject,
    clearProject
  }
})

// HMR 지원
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useProjectStore, import.meta.hot))
}
