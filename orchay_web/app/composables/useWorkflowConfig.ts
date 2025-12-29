/**
 * useWorkflowConfig - Workflow configuration composable
 * Provides access to workflows.json configuration with reactive data
 *
 * Usage:
 * const { config, getStateInfo, getCommandInfo, getWorkflowSteps } = useWorkflowConfig()
 */

import type {
  WorkflowsConfig,
  WorkflowStateConfig,
  WorkflowCommandConfig,
  WorkflowStepInfo,
  WorkflowCommandInfo,
} from '~/types/workflow-config'
import type { TaskCategory } from '~/types'

/**
 * Workflow configuration composable
 */
export function useWorkflowConfig() {
  // Fetch configuration with auto-refresh
  const { data: config, error, refresh } = useFetch<WorkflowsConfig>('/api/settings/workflows', {
    key: 'workflow-config',
    // Cache for session to avoid repeated requests
    getCachedData: (key) => {
      return useNuxtData(key).data.value
    },
  })

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
  const getWorkflowSteps = (category: TaskCategory): WorkflowStepInfo[] => {
    const workflow = config.value?.workflows[category]
    if (!workflow || !config.value) return []

    return workflow.states.map((code) => {
      const stateConfig = config.value!.states[code]
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
  const getStateActions = (category: TaskCategory, statusCode: string): WorkflowCommandInfo[] => {
    const workflow = config.value?.workflows[category]
    if (!workflow || !config.value) return []

    const actionCommands = workflow.actions[statusCode] || []

    return actionCommands.map((cmd) => {
      const cmdConfig = config.value!.commands[cmd]
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
    category: TaskCategory,
    statusCode: string
  ): WorkflowCommandInfo[] => {
    const workflow = config.value?.workflows[category]
    if (!workflow || !config.value) return []

    const transitions = workflow.transitions.filter((t) => t.from === statusCode)

    return transitions.map((t) => {
      const cmdConfig = config.value!.commands[t.command]
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
