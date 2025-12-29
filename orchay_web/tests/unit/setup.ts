/**
 * Vitest setup file for component testing
 * Auto-imports Vue composables for test environment
 */

import { vi } from 'vitest'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

// CLI 테스트를 위한 settings 폴더 설정
const settingsDir = join(process.cwd(), '.orchay', 'settings')
const workflowsSrc = join(process.cwd(), '.claude', 'skills', 'orchay-init', 'assets', 'settings', 'workflows.json')
const workflowsDest = join(settingsDir, 'workflows.json')

if (!existsSync(settingsDir)) {
  mkdirSync(settingsDir, { recursive: true })
}
if (!existsSync(workflowsDest) && existsSync(workflowsSrc)) {
  copyFileSync(workflowsSrc, workflowsDest)
}
import { computed, ref, reactive, readonly } from 'vue'
import { defineStore } from 'pinia'
import { config } from '@vue/test-utils'

// Make Vue composition API globally available (like Nuxt auto-imports)
globalThis.computed = computed
globalThis.ref = ref
globalThis.reactive = reactive
globalThis.readonly = readonly
globalThis.defineStore = defineStore

// Mock Pinia HMR
globalThis.acceptHMRUpdate = vi.fn((store: any, hotModule: any) => {
  // Mock HMR update - no-op in test environment
  return () => { }
})

// Mock Nuxt composables
globalThis.useWbsStore = vi.fn(() => ({
  isExpanded: vi.fn(() => true),
  toggleExpand: vi.fn(),
  fetchWbs: vi.fn(),
  clearWbs: vi.fn(),
  tree: [],
  loading: false,
  flatNodes: new Map(),
  expandedNodes: new Set()
}))

globalThis.useSelectionStore = vi.fn(() => ({
  selectedNodeId: null,
  selectedProjectId: null,
  selectNode: vi.fn(),
  clearSelection: vi.fn()
}))

globalThis.useProjectStore = vi.fn(() => ({
  loadProject: vi.fn(),
  currentProject: null,
  clearProject: vi.fn(),
  projectName: ''
}))

// Mock graph composables (for useDependencyGraph)
globalThis.useFocusView = vi.fn(() => ({
  buildFocusGraph: vi.fn((focusTaskId, depth, taskNodes, edges) => ({
    focusTaskId,
    depth,
    includesNodes: new Set([focusTaskId])
  }))
}))

// Mock useDependencyGraph for useGanttDependencies tests
globalThis.useDependencyGraph = vi.fn(() => ({
  extractStatusCode: vi.fn((status: string | undefined) => {
    if (!status) return '[ ]'
    const match = status.match(/\[([^\]]+)\]/)
    return match ? `[${match[1]}]` : '[ ]'
  }),
  buildGraphData: vi.fn(),
  calculateLevels: vi.fn(),
  getStatusName: vi.fn(),
  getCategoryName: vi.fn(),
  getGraphStats: vi.fn()
}))

// Mock PrimeVue useToast
const mockToastAdd = vi.fn()
globalThis.useToast = vi.fn(() => ({
  add: mockToastAdd
}))

// Configure Vue Test Utils to provide PrimeVue config
config.global.mocks = {
  $primevue: {
    config: {
      ripple: false,
      inputStyle: 'outlined',
      locale: {
        accept: 'Yes',
        reject: 'No'
      }
    }
  }
}
