/**
 * TaskRequirements Component Unit Tests
 * Task: TSK-05-02
 * Test Spec: 026-test-specification.md
 *
 * Coverage:
 * - UT-005: toggleEdit function
 * - UT-011: validateRequirement function (500 char limit)
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskRequirements from '~/components/wbs/detail/TaskRequirements.vue'
import Panel from 'primevue/panel'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import type { TaskDetail } from '~/types'

describe('TaskRequirements', () => {
  // Helper to create mock task
  const createMockTask = (requirements: string[] = []): Partial<TaskDetail> => ({
    id: 'TSK-05-02',
    title: 'Test Task',
    category: 'development',
    status: '[bd]',
    priority: 'medium',
    requirements,
    tags: [],
    documents: [],
    history: [],
    availableActions: [],
    parentWp: 'WP-01',
    ref: 'ref: PRD 6.3.2, 6.3.3'
  })

  describe('toggleEdit functionality', () => {
    // UT-005: should activate editing mode
    it('should activate editing mode when edit button clicked', async () => {
      const task = createMockTask(['요구사항1', '요구사항2'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      // Initially not editing
      expect(wrapper.find('[data-testid="requirement-input-0"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="requirement-item-0"]').exists()).toBe(true)

      // Click edit button
      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Should be in editing mode
      const vm = wrapper.vm as any
      expect(vm.isEditing).toBe(true)
      expect(vm.localRequirements).toEqual(['요구사항1', '요구사항2'])
      expect(wrapper.find('[data-testid="requirement-input-0"]').exists()).toBe(true)
    })

    // UT-005: should copy requirements to local state
    it('should copy requirements to localRequirements when editing starts', async () => {
      const task = createMockTask(['Requirement A', 'Requirement B'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      expect(vm.localRequirements).toEqual(['Requirement A', 'Requirement B'])
      expect(vm.localRequirements).not.toBe(task.requirements) // Should be a copy
    })

    // UT-005: should emit update event on save
    it('should emit update:requirements event on save', async () => {
      const task = createMockTask(['요구사항1'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      // Enter edit mode
      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Modify requirement
      const vm = wrapper.vm as any
      vm.localRequirements[0] = '수정된 요구사항'

      // Click save
      await wrapper.find('[data-testid="save-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Should emit event
      expect(wrapper.emitted('update:requirements')).toBeTruthy()
      expect(wrapper.emitted('update:requirements')?.[0]).toEqual([['수정된 요구사항']])
      expect(vm.isEditing).toBe(false)
    })

    // UT-005: should exit editing mode on cancel
    it('should exit editing mode on cancel without saving', async () => {
      const task = createMockTask(['요구사항1'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      // Enter edit mode
      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Modify requirement
      const vm = wrapper.vm as any
      vm.localRequirements[0] = '수정된 요구사항'

      // Click cancel
      await wrapper.find('[data-testid="cancel-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Should not emit event
      expect(wrapper.emitted('update:requirements')).toBeFalsy()
      expect(vm.isEditing).toBe(false)
    })
  })

  describe('addRequirement and removeRequirement', () => {
    it('should add new requirement', async () => {
      const task = createMockTask(['요구사항1'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      // Enter edit mode
      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      const initialCount = vm.localRequirements.length

      // Click add button
      await wrapper.find('[data-testid="add-requirement-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(vm.localRequirements).toHaveLength(initialCount + 1)
      expect(vm.localRequirements[initialCount]).toBe('')
    })

    it('should remove requirement', async () => {
      const task = createMockTask(['요구사항1', '요구사항2', '요구사항3'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      // Enter edit mode
      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any

      // Remove second requirement (index 1)
      await wrapper.find('[data-testid="delete-requirement-btn-1"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(vm.localRequirements).toHaveLength(2)
      expect(vm.localRequirements).toEqual(['요구사항1', '요구사항3'])
    })
  })

  describe('validateRequirement - 500 character limit', () => {
    // UT-011: should accept requirements under 500 characters
    it('should accept requirements under 500 characters', async () => {
      const task = createMockTask(['Short requirement'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      vm.localRequirements[0] = 'a'.repeat(500) // Exactly 500 chars

      vm.validateRequirement(0)
      await wrapper.vm.$nextTick()

      expect(vm.validationError).toBeNull()
    })

    // UT-011: should reject requirements over 500 characters
    it('should reject requirements over 500 characters', async () => {
      const task = createMockTask(['Short requirement'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      vm.localRequirements[0] = 'a'.repeat(501) // 501 chars

      vm.validateRequirement(0)
      await wrapper.vm.$nextTick()

      expect(vm.validationError).toContain('500자 이하')
    })

    // UT-011: should prevent save when validation error exists
    it('should prevent save when validation error exists', async () => {
      const task = createMockTask(['Short requirement'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      vm.localRequirements[0] = 'a'.repeat(501)

      // Try to save
      await wrapper.find('[data-testid="save-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Should not emit event
      expect(wrapper.emitted('update:requirements')).toBeFalsy()
      expect(vm.isEditing).toBe(true)
      expect(vm.validationError).toBeTruthy()
    })

    it('should display error message when validation fails', async () => {
      const task = createMockTask(['Short requirement'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      vm.localRequirements[0] = 'a'.repeat(501)

      await wrapper.find('[data-testid="save-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="requirement-error-message"]').exists()).toBe(true)
    })
  })

  describe('PRD Reference Display', () => {
    it('should display PRD reference when provided', () => {
      const task = createMockTask(['요구사항1'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      const prdRef = wrapper.find('[data-testid="prd-reference"]')
      expect(prdRef.exists()).toBe(true)
      expect(prdRef.text()).toContain('ref: PRD 6.3.2, 6.3.3')
    })

    it('should not display PRD reference when not provided', () => {
      const task = createMockTask(['요구사항1'])
      delete (task as any).ref
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      expect(wrapper.find('[data-testid="prd-reference"]').exists()).toBe(false)
    })
  })

  describe('Empty State', () => {
    it('should display message when no requirements exist', () => {
      const task = createMockTask([])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      const message = wrapper.findComponent(Message)
      expect(message.exists()).toBe(true)
      expect(message.text()).toContain('요구사항이 없습니다')
    })
  })

  describe('Data Integrity', () => {
    it('should filter out empty requirements on save', async () => {
      const task = createMockTask(['요구사항1'])
      const wrapper = mount(TaskRequirements, {
        props: { task: task as TaskDetail },
        global: {
          components: { Panel, Button, InputText, Message }
        }
      })

      await wrapper.find('[data-testid="edit-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      const vm = wrapper.vm as any
      vm.localRequirements = ['요구사항1', '', '  ', '요구사항2']

      await wrapper.find('[data-testid="save-requirements-btn"]').trigger('click')
      await wrapper.vm.$nextTick()

      // Should only emit non-empty requirements
      expect(wrapper.emitted('update:requirements')?.[0]).toEqual([['요구사항1', '요구사항2']])
    })
  })
})
