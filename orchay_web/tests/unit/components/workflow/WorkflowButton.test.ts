/**
 * WorkflowButton 컴포넌트 단위 테스트
 * Task: TSK-02-01
 * Test Spec: 026-test-specification.md TC-004, TC-009
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowButton from '~/components/workflow/WorkflowButton.vue'
import Button from 'primevue/button'
import type { WorkflowCommand } from '~/utils/workflowCommands'

const mockCommand: WorkflowCommand = {
  name: 'build',
  label: '구현',
  icon: 'pi-wrench',
  severity: 'warning',
  availableStatuses: ['[dd]'],
  categories: ['development', 'infrastructure'],
}

describe('WorkflowButton', () => {
  // TC-009: WorkflowButton Props 렌더링
  describe('props rendering', () => {
    it('should render command label and icon', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.exists()).toBe(true)
      expect(button.props('label')).toBe('구현')
      expect(button.props('icon')).toBe('pi pi-wrench')
    })

    it('should apply command severity when enabled', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: false },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.props('severity')).toBe('warning')
    })
  })

  // TC-004: 버튼 상태 스타일링
  describe('button state styling', () => {
    it('should apply "secondary" severity when disabled', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: true, loading: false },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.props('severity')).toBe('secondary')
      // WorkflowButton 컴포넌트의 props 확인
      expect(wrapper.props('disabled')).toBe(true)
      expect(wrapper.props('loading')).toBe(false)
    })

    it('should apply command severity and loading when loading', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: true, loading: true },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.props('severity')).toBe('warning') // loading 상태는 command.severity 유지
      // WorkflowButton 컴포넌트의 props 확인
      expect(wrapper.props('disabled')).toBe(true)
      expect(wrapper.props('loading')).toBe(true)
    })

    it('should not be disabled or loading when enabled', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: false, loading: false },
        global: {
          components: { Button },
        },
      })

      // WorkflowButton 컴포넌트의 props 확인
      expect(wrapper.props('disabled')).toBe(false)
      expect(wrapper.props('loading')).toBe(false)
    })
  })

  describe('click events', () => {
    it('should emit click event when clicked and enabled', async () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: false },
        global: {
          components: { Button },
        },
      })

      await wrapper.findComponent(Button).trigger('click')
      expect(wrapper.emitted('click')).toHaveLength(1)
    })

    it('should not emit click event when disabled', async () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: true },
        global: {
          components: { Button },
        },
      })

      // PrimeVue Button이 disabled일 때 클릭 방지
      // handleClick 직접 호출로 테스트
      const vm = wrapper.vm as any
      vm.handleClick()
      expect(wrapper.emitted('click')).toBeUndefined()
    })
  })

  describe('accessibility', () => {
    it('should have aria-label for accessibility', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.attributes('aria-label')).toBe('워크플로우 구현 실행')
    })

    it('should have aria-disabled when disabled', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, disabled: true },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.attributes('aria-disabled')).toBe('true')
    })

    it('should have aria-busy when loading', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand, loading: true },
        global: {
          components: { Button },
        },
      })

      const button = wrapper.findComponent(Button)
      expect(button.attributes('aria-busy')).toBe('true')
    })
  })

  describe('data-testid', () => {
    it('should have correct data-testid', () => {
      const wrapper = mount(WorkflowButton, {
        props: { command: mockCommand },
        global: {
          components: { Button },
        },
      })

      expect(wrapper.find('[data-testid="workflow-btn-build"]').exists()).toBe(true)
    })
  })
})
