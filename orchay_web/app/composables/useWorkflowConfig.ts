/**
 * useWorkflowConfig - Workflow configuration composable
 * Provides access to workflows.json configuration with reactive data
 *
 * Usage:
 * const { config, getStateInfo, getCommandInfo, getWorkflowSteps } = useWorkflowConfig()
 *
 * Tauri 환경에서는 API 대신 기본 설정을 사용합니다.
 */

import type {
  WorkflowsConfig,
  WorkflowStateConfig,
  WorkflowCommandConfig,
  WorkflowStepInfo,
  WorkflowCommandInfo,
} from '~/types/workflow-config'
import type { TaskCategory } from '~/types'
import { isTauri, readFileContent } from '~/utils/tauri'
import { DEFAULT_WORKFLOWS } from '~/utils/workflowDefaults'

/**
 * Workflow configuration composable
 */
export function useWorkflowConfig() {
  // Tauri 환경 감지 (클라이언트 사이드에서만)
  const inTauri = import.meta.client ? isTauri() : false

  // 초기값: Tauri면 DEFAULT_WORKFLOWS, 아니면 null (API로 로드)
  // SSR 또는 SSG 환경에서도 기본값을 제공하여 hydration mismatch 방지
  const config = ref<WorkflowsConfig | null>(inTauri ? DEFAULT_WORKFLOWS : DEFAULT_WORKFLOWS)
  const error = ref<Error | null>(null)

  // 설정 로드 (Tauri: 파일에서 직접, Web: API 호출)
  const loadConfig = async () => {
    if (inTauri) {
      // Tauri: workflows.json 파일에서 직접 읽기
      try {
        const configStore = useConfigStore()
        if (configStore.basePath) {
          const filePath = `${configStore.basePath}/.orchay/settings/workflows.json`
          const content = await readFileContent(filePath)
          config.value = JSON.parse(content)
          console.log('[WorkflowConfig] Loaded from file (Tauri mode)')
          return
        }
      } catch (e) {
        console.warn('[WorkflowConfig] Failed to read workflows.json, using defaults:', e)
      }
      // fallback: DEFAULT_WORKFLOWS
      config.value = DEFAULT_WORKFLOWS
      console.log('[WorkflowConfig] Using DEFAULT_WORKFLOWS (Tauri fallback)')
      return
    }
    // Web/Electron: API fetch
    try {
      const data = await $fetch<WorkflowsConfig>('/api/settings/workflows')
      config.value = data
    } catch (e) {
      console.warn('[WorkflowConfig] API fetch failed, using defaults:', e)
      // 이미 DEFAULT_WORKFLOWS로 초기화됨
      error.value = e as Error
    }
  }

  // 클라이언트 사이드에서 설정 로드
  if (import.meta.client) {
    loadConfig()
  }

  const refresh = loadConfig

  /**
   * Get state configuration by status code
   * @param code - Status code (e.g., "[ ]", "[bd]", "[xx]")
   * @returns State configuration or undefined
   */
  const getStateInfo = (code: string): WorkflowStateConfig | undefined => {
    return config.value?.states[code]
  }

  /**
   * Get command configuration by command name
   * @param cmd - Command name (e.g., "start", "draft", "build")
   * @returns Command configuration or undefined
   */
  const getCommandInfo = (cmd: string): WorkflowCommandConfig | undefined => {
    return config.value?.commands[cmd]
  }

  /**
   * Get workflow steps for a category
   * @param category - Task category (development, defect, infrastructure)
   * @returns Array of workflow step information
   */
  const getWorkflowSteps = (category: TaskCategory | undefined): WorkflowStepInfo[] => {
    // 카테고리가 없으면 development 기본값 사용
    const effectiveCategory = category || 'development'
    const workflow = config.value?.workflows[effectiveCategory]
    if (!workflow || !config.value) return []

    return workflow.states.map((code) => {
      const stateConfig = config.value!.states[code]
      if (!stateConfig) {
        console.warn(`[WorkflowConfig] State config not found for code: ${code}`)
        return {
          code,
          label: code,
          labelEn: code,
          icon: 'pi-circle',
          color: '#6b7280',
          severity: 'secondary',
          progressWeight: 0,
        }
      }
      return {
        code,
        label: stateConfig.label,
        labelEn: stateConfig.labelEn,
        icon: stateConfig.icon,
        color: stateConfig.color,
        severity: stateConfig.severity,
        progressWeight: stateConfig.progressWeight,
      }
    })
  }

  /**
   * Get available actions for a state in a category
   * @param category - Task category
   * @param statusCode - Current status code
   * @returns Array of command information
   */
  const getStateActions = (category: TaskCategory | undefined, statusCode: string): WorkflowCommandInfo[] => {
    const effectiveCategory = category || 'development'
    const workflow = config.value?.workflows[effectiveCategory]
    if (!workflow || !config.value) return []

    const actionCommands = workflow.actions?.[statusCode] || []

    return actionCommands.map((cmd) => {
      const cmdConfig = config.value!.commands[cmd]
      if (!cmdConfig) {
        return {
          command: cmd,
          label: cmd,
          labelEn: cmd,
          icon: 'pi-circle',
          severity: 'secondary',
          isAction: true,
        }
      }
      return {
        command: cmd,
        label: cmdConfig.label,
        labelEn: cmdConfig.labelEn,
        icon: cmdConfig.icon,
        severity: cmdConfig.severity,
        isAction: cmdConfig.isAction ?? false,
      }
    })
  }

  /**
   * Get available transitions from current state
   * @param category - Task category
   * @param statusCode - Current status code
   * @returns Array of command information for transitions
   */
  const getAvailableTransitions = (
    category: TaskCategory | undefined,
    statusCode: string
  ): WorkflowCommandInfo[] => {
    const effectiveCategory = category || 'development'
    const workflow = config.value?.workflows[effectiveCategory]
    if (!workflow || !config.value) return []

    const transitions = workflow.transitions?.filter((t) => t.from === statusCode) || []

    return transitions.map((t) => {
      const cmdConfig = config.value!.commands[t.command]
      if (!cmdConfig) {
        return {
          command: t.command,
          label: t.command,
          labelEn: t.command,
          icon: 'pi-circle',
          severity: 'secondary',
          isAction: false,
        }
      }
      return {
        command: t.command,
        label: cmdConfig.label,
        labelEn: cmdConfig.labelEn,
        icon: cmdConfig.icon,
        severity: cmdConfig.severity,
        isAction: cmdConfig.isAction ?? false,
      }
    })
  }

  /**
   * Get status severity for Badge component
   * @param statusCode - Status code
   * @returns PrimeVue severity string
   */
  const getStatusSeverity = (statusCode: string): string => {
    const stateInfo = getStateInfo(statusCode)
    return stateInfo?.severity || 'secondary'
  }

  /**
   * Get status label
   * @param statusCode - Status code
   * @returns Korean label
   */
  const getStatusLabel = (statusCode: string): string => {
    const stateInfo = getStateInfo(statusCode)
    return stateInfo?.label || statusCode
  }

  /**
   * Get status icon
   * @param statusCode - Status code
   * @returns PrimeIcons class name
   */
  const getStatusIcon = (statusCode: string): string => {
    const stateInfo = getStateInfo(statusCode)
    return stateInfo?.icon || 'pi-circle'
  }

  /**
   * Get progress weight for a status
   * @param statusCode - Status code
   * @returns Progress weight (0-100)
   */
  const getProgressWeight = (statusCode: string): number => {
    const stateInfo = getStateInfo(statusCode)
    return stateInfo?.progressWeight ?? 0
  }

  /**
   * Check if status is completed
   * @param statusCode - Status code
   * @returns True if status is done ([xx])
   */
  const isCompleted = (statusCode: string): boolean => {
    return statusCode === '[xx]'
  }

  /**
   * Check if status is todo
   * @param statusCode - Status code
   * @returns True if status is todo ([ ])
   */
  const isTodo = (statusCode: string): boolean => {
    return statusCode === '[ ]'
  }

  /**
   * Check if status is in progress
   * @param statusCode - Status code
   * @returns True if status is not todo and not completed
   */
  const isInProgress = (statusCode: string): boolean => {
    return !isTodo(statusCode) && !isCompleted(statusCode)
  }

  return {
    config,
    error,
    refresh,
    getStateInfo,
    getCommandInfo,
    getWorkflowSteps,
    getStateActions,
    getAvailableTransitions,
    getStatusSeverity,
    getStatusLabel,
    getStatusIcon,
    getProgressWeight,
    isCompleted,
    isTodo,
    isInProgress,
  }
}
