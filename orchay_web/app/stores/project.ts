/**
 * 프로젝트 스토어
 * 현재 프로젝트 정보 및 프로젝트 목록 관리
 * Task: TSK-01-01-03
 */

import type { Project, ProjectSummary, ProjectListResponse } from '~/types/store'
import type { TeamMember } from '~/types'

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
    loading.value = true
    error.value = null
    try {
      const data = await $fetch<ProjectListResponse>('/api/projects')
      projects.value = data.projects
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch projects'
      throw e
    } finally {
      loading.value = false
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
      // GET /api/projects/:id는 ProjectDetail 반환 { project, team }
      const data = await $fetch<{ project: Project; team: TeamMember[] }>(`/api/projects/${id}`)
      currentProject.value = data.project
      teamMembers.value = data.team
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
