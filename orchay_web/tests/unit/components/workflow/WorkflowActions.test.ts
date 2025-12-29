/**
 * WorkflowActions 컴포넌트 단위 테스트
 * Task: TSK-02-01
 * Test Spec: 026-test-specification.md TC-001, TC-006, TC-EDGE-001, TC-EDGE-002
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowActions from '~/components/workflow/WorkflowActions.vue'
import WorkflowButton from '~/components/workflow/WorkflowButton.vue'
import WorkflowAutoActions from '~/components/workflow/WorkflowAutoActions.vue'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import type { WbsNode } from '~/types/index'

const mockTask: WbsNode = {
  id: 'TSK-01-01',
  type: 'task',
  title: 'Test Task',
  status: 'todo [ ]',
  category: 'development',
  children: [],
}

const globalComponents = {
  Button,
  Divider,
  WorkflowWorkflowButton: WorkflowButton,
  WorkflowWorkflowAutoActions: WorkflowAutoActions,
}

describe('WorkflowActions', () => {
  // TC-001: WorkflowActions 버튼 렌더링
  describe('button rendering', () => {
    it('should render 13 command buttons', () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      expect(buttons).toHaveLength(13)
    })

    it('should not render when task is null', () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: null },
        global: {
          components: globalComponents,
        },
      })

      expect(wrapper.find('[data-testid="workflow-actions"]').exists()).toBe(false)
    })
  })

  // TC-002: development 상태별 버튼 활성화
  describe('development category state-based activation', () => {
    it('should enable only "start" for status [ ]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'todo [ ]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const startBtn = buttons.find(b => b.props('command').name === 'start')
      const buildBtn = buttons.find(b => b.props('command').name === 'build')

      expect(startBtn?.props('disabled')).toBe(false)
      expect(buildBtn?.props('disabled')).toBe(true)
    })

    it('should enable "ui" and "draft" for status [bd]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'basic-design [bd]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const uiBtn = buttons.find(b => b.props('command').name === 'ui')
      const draftBtn = buttons.find(b => b.props('command').name === 'draft')
      const startBtn = buttons.find(b => b.props('command').name === 'start')

      expect(uiBtn?.props('disabled')).toBe(false)
      expect(draftBtn?.props('disabled')).toBe(false)
      expect(startBtn?.props('disabled')).toBe(true)
    })

    it('should enable "review", "apply", "build" for status [dd]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'detail-design [dd]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const reviewBtn = buttons.find(b => b.props('command').name === 'review')
      const applyBtn = buttons.find(b => b.props('command').name === 'apply')
      const buildBtn = buttons.find(b => b.props('command').name === 'build')

      expect(reviewBtn?.props('disabled')).toBe(false)
      expect(applyBtn?.props('disabled')).toBe(false)
      expect(buildBtn?.props('disabled')).toBe(false)
    })

    it('should enable "test", "audit", "patch", "verify" for status [im]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'implement [im]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const testBtn = buttons.find(b => b.props('command').name === 'test')
      const auditBtn = buttons.find(b => b.props('command').name === 'audit')
      const patchBtn = buttons.find(b => b.props('command').name === 'patch')
      const verifyBtn = buttons.find(b => b.props('command').name === 'verify')

      expect(testBtn?.props('disabled')).toBe(false)
      expect(auditBtn?.props('disabled')).toBe(false)
      expect(patchBtn?.props('disabled')).toBe(false)
      expect(verifyBtn?.props('disabled')).toBe(false)
    })
  })

  // TC-003: defect/infrastructure 상태별 버튼 활성화
  describe('defect category state-based activation', () => {
    it('should enable "fix" for defect [an]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'analysis [an]', category: 'defect' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const fixBtn = buttons.find(b => b.props('command').name === 'fix')

      expect(fixBtn?.props('disabled')).toBe(false)
    })
  })

  describe('infrastructure category state-based activation', () => {
    it('should enable "start" and "skip" for infrastructure [ ]', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'todo [ ]', category: 'infrastructure' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const startBtn = buttons.find(b => b.props('command').name === 'start')
      const skipBtn = buttons.find(b => b.props('command').name === 'skip')

      expect(startBtn?.props('disabled')).toBe(false)
      expect(skipBtn?.props('disabled')).toBe(false)
    })
  })

  // TC-006: execute 이벤트 emit
  describe('execute event', () => {
    it('should emit execute event when enabled button clicked', async () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'basic-design [bd]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const draftBtn = buttons.find(b => b.props('command').name === 'draft')

      await draftBtn?.vm.$emit('click')
      expect(wrapper.emitted('execute')).toBeTruthy()
      expect(wrapper.emitted('execute')?.[0]).toEqual(['draft'])
    })

    it('should not emit execute event when executing', async () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'basic-design [bd]', category: 'development' },
          isExecuting: true,
        },
        global: {
          components: globalComponents,
        },
      })

      // handleCommandClick 직접 호출로 테스트
      const vm = wrapper.vm as any
      vm.handleCommandClick('draft')
      expect(wrapper.emitted('execute')).toBeUndefined()
    })
  })

  describe('auto actions events', () => {
    it('should emit run event from WorkflowAutoActions', async () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      const autoActions = wrapper.findComponent(WorkflowAutoActions)
      await autoActions.vm.$emit('run')

      expect(wrapper.emitted('run')).toHaveLength(1)
    })

    it('should emit auto event from WorkflowAutoActions', async () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      const autoActions = wrapper.findComponent(WorkflowAutoActions)
      await autoActions.vm.$emit('auto')

      expect(wrapper.emitted('auto')).toHaveLength(1)
    })

    it('should emit stop event from WorkflowAutoActions', async () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      const autoActions = wrapper.findComponent(WorkflowAutoActions)
      await autoActions.vm.$emit('stop')

      expect(wrapper.emitted('stop')).toHaveLength(1)
    })
  })

  // TC-EDGE-002: 알 수 없는 상태 코드
  describe('edge cases', () => {
    it('should disable all buttons for unknown status', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: '[unknown]', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      buttons.forEach(btn => {
        expect(btn.props('disabled')).toBe(true)
      })
    })

    it('should handle status without code brackets', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'invalid-status', category: 'development' },
        },
        global: {
          components: globalComponents,
        },
      })

      // 유효하지 않은 상태는 '[ ]'로 폴백되어 start만 활성화
      const buttons = wrapper.findAllComponents(WorkflowButton)
      const startBtn = buttons.find(b => b.props('command').name === 'start')

      expect(startBtn?.props('disabled')).toBe(false)
    })
  })

  describe('loading state', () => {
    it('should show loading on executing command button', () => {
      const wrapper = mount(WorkflowActions, {
        props: {
          task: { ...mockTask, status: 'basic-design [bd]', category: 'development' },
          isExecuting: true,
          executingCommand: 'draft',
        },
        global: {
          components: globalComponents,
        },
      })

      const buttons = wrapper.findAllComponents(WorkflowButton)
      const draftBtn = buttons.find(b => b.props('command').name === 'draft')

      expect(draftBtn?.props('loading')).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('should have aria-label on container', () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      expect(wrapper.find('[aria-label="워크플로우 명령어"]').exists()).toBe(true)
    })

    it('should have role="group" on container', () => {
      const wrapper = mount(WorkflowActions, {
        props: { task: mockTask },
        global: {
          components: globalComponents,
        },
      })

      expect(wrapper.find('[role="group"]').exists()).toBe(true)
    })
  })
})
