/**
 * WorkflowAutoActions 컴포넌트 단위 테스트
 * Task: TSK-02-01
 * Test Spec: 026-test-specification.md TC-005
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowAutoActions from '~/components/workflow/WorkflowAutoActions.vue'
import Button from 'primevue/button'

describe('WorkflowAutoActions', () => {
  // TC-005: 자동실행 버튼 렌더링
  describe('button rendering', () => {
    it('should show Run and Auto buttons when not executing', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: false },
        global: {
          components: { Button },
        },
      })

      expect(wrapper.find('[data-testid="workflow-run-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-auto-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-stop-btn"]').exists()).toBe(false)
    })

    it('should show Run, Auto, and Stop buttons when executing', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: true },
        global: {
          components: { Button },
        },
      })

      expect(wrapper.find('[data-testid="workflow-run-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-auto-btn"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-stop-btn"]').exists()).toBe(true)
    })
  })

  describe('button states', () => {
    it('should disable Run and Auto buttons when executing', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: true },
        global: {
          components: { Button },
        },
      })

      // isExecuting prop이 true로 전달되었는지 확인
      expect(wrapper.props('isExecuting')).toBe(true)
      // HTML 속성으로 disabled 확인
      const runBtnEl = wrapper.find('[data-testid="workflow-run-btn"]')
      const autoBtnEl = wrapper.find('[data-testid="workflow-auto-btn"]')
      expect(runBtnEl.attributes('disabled')).toBeDefined()
      expect(autoBtnEl.attributes('disabled')).toBeDefined()
    })

    it('should enable Run and Auto buttons when not executing', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: false },
        global: {
          components: { Button },
        },
      })

      // isExecuting prop이 false로 전달되었는지 확인
      expect(wrapper.props('isExecuting')).toBe(false)
      // HTML 속성으로 disabled가 없어야 함
      const runBtnEl = wrapper.find('[data-testid="workflow-run-btn"]')
      const autoBtnEl = wrapper.find('[data-testid="workflow-auto-btn"]')
      expect(runBtnEl.attributes('disabled')).toBeUndefined()
      expect(autoBtnEl.attributes('disabled')).toBeUndefined()
    })
  })

  describe('button severities', () => {
    it('should have correct severities for each button', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: true },
        global: {
          components: { Button },
        },
      })

      const runBtn = wrapper.find('[data-testid="workflow-run-btn"]').findComponent(Button)
      const autoBtn = wrapper.find('[data-testid="workflow-auto-btn"]').findComponent(Button)
      const stopBtn = wrapper.find('[data-testid="workflow-stop-btn"]').findComponent(Button)

      expect(runBtn.props('severity')).toBe('success')
      expect(autoBtn.props('severity')).toBe('info')
      expect(stopBtn.props('severity')).toBe('danger')
    })
  })

  describe('click events', () => {
    it('should emit "run" event when Run button clicked', async () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: false },
        global: {
          components: { Button },
        },
      })

      await wrapper.find('[data-testid="workflow-run-btn"]').trigger('click')
      expect(wrapper.emitted('run')).toHaveLength(1)
    })

    it('should emit "auto" event when Auto button clicked', async () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: false },
        global: {
          components: { Button },
        },
      })

      await wrapper.find('[data-testid="workflow-auto-btn"]').trigger('click')
      expect(wrapper.emitted('auto')).toHaveLength(1)
    })

    it('should emit "stop" event when Stop button clicked', async () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: true },
        global: {
          components: { Button },
        },
      })

      await wrapper.find('[data-testid="workflow-stop-btn"]').trigger('click')
      expect(wrapper.emitted('stop')).toHaveLength(1)
    })
  })

  describe('accessibility', () => {
    it('should have aria-label on container', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: false },
        global: {
          components: { Button },
        },
      })

      expect(wrapper.find('[aria-label="자동실행 버튼"]').exists()).toBe(true)
    })

    it('should have aria-labels on buttons', () => {
      const wrapper = mount(WorkflowAutoActions, {
        props: { isExecuting: true },
        global: {
          components: { Button },
        },
      })

      expect(wrapper.find('[aria-label="워크플로우 Run 실행"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="워크플로우 Auto 실행"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="워크플로우 중지"]').exists()).toBe(true)
    })
  })
})
