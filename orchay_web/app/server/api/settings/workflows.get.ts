/**
 * GET /api/settings/workflows
 * Workflows configuration API
 * Returns .orchay/settings/workflows.json or defaults
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WorkflowsConfig } from '~/types/workflow-config'
import { DEFAULT_WORKFLOWS } from '~~/server/utils/settings/defaults'

export default defineEventHandler(async (event): Promise<WorkflowsConfig> => {
  try {
    const projectRoot = process.cwd()
    const workflowsPath = join(projectRoot, '.orchay', 'settings', 'workflows.json')

    const content = await readFile(workflowsPath, 'utf-8')
    const config: WorkflowsConfig = JSON.parse(content)

    return config
  } catch (error) {
    // File not found or parse error - return defaults
    console.warn('[API] workflows.json not found, using defaults')
    return DEFAULT_WORKFLOWS as WorkflowsConfig
  }
})
