/**
 * TaskWorkflow Component Unit Tests
 * Task: TSK-05-02
 * Test Spec: 026-test-specification.md
 *
 * Coverage:
 * - UT-001: workflowSteps computed (development category)
 * - UT-002: workflowSteps computed (defect, infrastructure)
 * - UT-003: currentStepIndex computed
 * - UT-004: getNodeClass function
 * - UT-010: Independent rendering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { TaskDetail } from '../../../../types'

// Mock useWorkflowConfig composable
const mockGetWorkflowSteps = vi.fn()

vi.mock('~/composables/useWorkflowConfig', () => ({
  useWorkflowConfig: () => ({
    config: { value: {} },
    getWorkflowSteps: mockGetWorkflowSteps,
    getStateInfo: vi.fn(),
    getCommandInfo: vi.fn(),
  }),
}))

// Also mock as global for Nuxt auto-import
vi.stubGlobal('useWorkflowConfig', () => ({
  config: { value: {} },
  getWorkflowSteps: mockGetWorkflowSteps,
  getStateInfo: vi.fn(),
  getCommandInfo: vi.fn(),
}))

import TaskWorkflow from '~/components/wbs/detail/TaskWorkflow.vue'
import Panel from 'primevue/panel'

describe('TaskWorkflow', () => {
  // Mock workflow steps data
  const developmentSteps = [
    { code: '[ ]', label: '대기', labelEn: 'Todo', icon: 'pi-circle', color: '#6b7280', severity: 'secondary', progressWeight: 0 },
    { code: '[bd]', label: '기본설계', labelEn: 'Design', icon: 'pi-pencil', color: '#3b82f6', severity: 'info', progressWeight: 20 },
    { code: '[dd]', label: '상세설계', labelEn: 'Detail', icon: 'pi-file-edit', color: '#8b5cf6', severity: 'info', progressWeight: 40 },
    { code: '[ap]', label: '승인', labelEn: 'Approve', icon: 'pi-check-circle', color: '#f59e0b', severity: 'warn', progressWeight: 50 },
    { code: '[im]', label: '구현', labelEn: 'Implement', icon: 'pi-code', color: '#f97316', severity: 'warning', progressWeight: 70 },
    { code: '[vf]', label: '검증', labelEn: 'Verify', icon: 'pi-verified', color: '#10b981', severity: 'success', progressWeight: 90 },
    { code: '[xx]', label: '완료', labelEn: 'Done', icon: 'pi-check', color: '#22c55e', severity: 'success', progressWeight: 100 },
  ]

  const defectSteps = [
    { code: '[ ]', label: '대기', labelEn: 'Todo', icon: 'pi-circle', color: '#6b7280', severity: 'secondary', progressWeight: 0 },
    { code: '[an]', label: '분석', labelEn: 'Analysis', icon: 'pi-search', color: '#3b82f6', severity: 'info', progressWeight: 25 },
    { code: '[fx]', label: '수정', labelEn: 'Fix', icon: 'pi-wrench', color: '#f97316', severity: 'warning', progressWeight: 60 },
    { code: '[vf]', label: '검증', labelEn: 'Verify', icon: 'pi-verified', color: '#10b981', severity: 'success', progressWeight: 90 },
    { code: '[xx]', label: '완료', labelEn: 'Done', icon: 'pi-check', color: '#22c55e', severity: 'success', progressWeight: 100 },
  ]

  const infrastructureSteps = [
    { code: '[ ]', label: '대기', labelEn: 'Todo', icon: 'pi-circle', color: '#6b7280', severity: 'secondary', progressWeight: 0 },
    { code: '[ds]', label: '설계', labelEn: 'Design', icon: 'pi-pencil', color: '#3b82f6', severity: 'info', progressWeight: 30 },
    { code: '[im]', label: '구현', labelEn: 'Implement', icon: 'pi-code', color: '#f97316', severity: 'warning', progressWeight: 70 },
    { code: '[xx]', label: '완료', labelEn: 'Done', icon: 'pi-check', color: '#22c55e', severity: 'success', progressWeight: 100 },
  ]

  // Helper to create mock task
  const createMockTask = (category: 'development' | 'defect' | 'infrastructure', status: string): Partial<TaskDetail> => ({
    id: 'TSK-05-02',
    title: 'Test Task',
    category,
    status: status as any,
    priority: 'medium',
    requirements: [],
    tags: [],
    documents: [],
    history: [],
    availableActions: [],
    parentWp: 'WP-01'
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to development steps
    mockGetWorkflowSteps.mockImplementation((category: string) => {
      switch (category) {
        case 'development':
          return developmentSteps
        case 'defect':
          return defectSteps
        case 'infrastructure':
          return infrastructureSteps
        default:
          return developmentSteps
      }
    })
  })

  describe('workflowSteps computed', () => {
    // UT-001: development category should return 7 steps
    it('should return 7 steps for development category', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      expect(vm.workflowSteps).toHaveLength(7)
      expect(vm.workflowSteps[0]).toMatchObject({
        code: '[ ]',
        label: '대기',
        labelEn: 'Todo'
      })
      expect(vm.workflowSteps[6]).toMatchObject({
        code: '[xx]',
        label: '완료',
        labelEn: 'Done'
      })
    })

    // UT-002: defect category should return 5 steps
    it('should return 5 steps for defect category', () => {
      const task = createMockTask('defect', '[an]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      expect(vm.workflowSteps).toHaveLength(5)
      expect(vm.workflowSteps[1]).toMatchObject({
        code: '[an]',
        label: '분석',
        labelEn: 'Analysis'
      })
    })

    // UT-002: infrastructure category should return 4 steps
    it('should return 4 steps for infrastructure category', () => {
      const task = createMockTask('infrastructure', '[ds]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      expect(vm.workflowSteps).toHaveLength(4)
      expect(vm.workflowSteps[1]).toMatchObject({
        code: '[ds]',
        label: '설계',
        labelEn: 'Design'
      })
    })
  })

  describe('currentStepIndex computed', () => {
    // UT-003: should calculate correct index for current status
    it('should return correct index for current status [dd]', () => {
      const task = createMockTask('development', '[dd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      // [dd] is 3rd step (index 2): [ ], [bd], [dd], [ap], [im], [vf], [xx]
      expect(vm.currentStepIndex).toBe(2)
    })

    it('should return correct index for status [ ]', () => {
      const task = createMockTask('development', '[ ]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      expect(vm.currentStepIndex).toBe(0)
    })

    it('should return correct index for status [xx]', () => {
      const task = createMockTask('development', '[xx]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      expect(vm.currentStepIndex).toBe(6)
    })
  })

  describe('getNodeClass method', () => {
    // UT-004: completed status should have completed class
    it('should return workflow-step-completed class for completed steps', () => {
      const task = createMockTask('development', '[dd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const nodeClass = vm.getNodeClass(0) // index 0 is before [dd] (index 2)

      expect(nodeClass).toBe('workflow-step-completed')
    })

    // UT-004: current status should have current class
    it('should return workflow-step-current class for current step', () => {
      const task = createMockTask('development', '[dd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const nodeClass = vm.getNodeClass(2) // currentStepIndex is 2

      expect(nodeClass).toBe('workflow-step-current')
    })

    // UT-004: future status should have pending class
    it('should return workflow-step-pending class for future steps', () => {
      const task = createMockTask('development', '[dd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const nodeClass = vm.getNodeClass(4) // index 4 is after [dd] (index 2)

      expect(nodeClass).toBe('workflow-step-pending')
    })
  })

  describe('getNodeClasses method', () => {
    it('should return base classes for all nodes', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const classes = vm.getNodeClasses(0)

      expect(classes).toContain('flex')
      expect(classes).toContain('flex-col')
      expect(classes).toContain('rounded-lg')
    })

    it('should add font-bold class for current step', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const currentIndex = vm.currentStepIndex
      const classes = vm.getNodeClasses(currentIndex)

      expect(classes).toContain('font-bold')
    })

    it('should not add font-bold class for non-current steps', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const vm = wrapper.vm as any
      const currentIndex = vm.currentStepIndex
      const otherIndex = currentIndex === 0 ? 1 : 0
      const classes = vm.getNodeClasses(otherIndex)

      expect(classes).not.toContain('font-bold')
    })
  })

  describe('Component Rendering', () => {
    // UT-010: should render independently without errors
    it('should render independently with minimal props', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.find('[data-testid="task-workflow-panel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-nodes"]').exists()).toBe(true)
    })

    it('should render all workflow nodes', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const nodes = wrapper.findAll('[data-testid^="workflow-node-"]')
      expect(nodes.length).toBeGreaterThan(0)
    })

    it('should mark current node with special data-testid', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      expect(wrapper.find('[data-testid="workflow-node-current"]').exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const nodesList = wrapper.find('[data-testid="workflow-nodes"]')
      expect(nodesList.attributes('role')).toBe('list')
      expect(nodesList.attributes('aria-label')).toBe('워크플로우 단계')
    })

    it('should mark current step with aria-current', () => {
      const task = createMockTask('development', '[bd]')
      const wrapper = mount(TaskWorkflow, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel }
        }
      })

      const currentNode = wrapper.find('[data-testid="workflow-node-current"]')
      expect(currentNode.attributes('aria-current')).toBe('step')
    })
  })
})
