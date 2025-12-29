import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import WpActChildren from '~/components/wbs/detail/WpActChildren.vue'
import StatusBadge from '~/components/wbs/StatusBadge.vue'
import type { WbsNode } from '~/types'
import Panel from 'primevue/panel'
import Message from 'primevue/message'
import Tag from 'primevue/tag'

describe('WpActChildren', () => {
  describe('하위 노드 목록 렌더링', () => {
    it('하위 노드 목록을 렌더링한다', () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test ACT', type: 'act', children: [] },
        { id: 'TSK-01-01', title: 'Test Task', type: 'task', status: '[xx]', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const items = wrapper.findAll('.child-item')
      expect(items.length).toBe(2)

      const text = wrapper.text()
      expect(text).toContain('ACT-01-01: Test ACT')
      expect(text).toContain('TSK-01-01: Test Task')
    })

    it('빈 children 배열일 때 빈 상태 메시지를 표시한다', () => {
      const wrapper = mount(WpActChildren, {
        props: { children: [] },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const emptyMessage = wrapper.find('[data-testid="children-empty-message"]')
      expect(emptyMessage.exists()).toBe(true)
      expect(wrapper.text()).toContain('하위 노드가 없습니다')
    })

    it('하위 노드 개수가 Panel 헤더에 표시된다', () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test ACT', type: 'act', children: [] },
        { id: 'TSK-01-01', title: 'Test Task', type: 'task', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const panel = wrapper.findComponent(Panel)
      expect(panel.props('header')).toBe('하위 노드 (2)')
    })
  })

  describe('하위 노드 클릭 이벤트', () => {
    it('하위 노드 클릭 시 select 이벤트를 emit한다', async () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const item = wrapper.find('[data-testid="child-item-ACT-01-01"]')
      await item.trigger('click')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual(['ACT-01-01'])
    })

    it('Enter 키로 하위 노드를 선택할 수 있다', async () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const item = wrapper.find('[data-testid="child-item-ACT-01-01"]')
      await item.trigger('keydown.enter')

      expect(wrapper.emitted('select')).toBeTruthy()
      expect(wrapper.emitted('select')?.[0]).toEqual(['ACT-01-01'])
    })

    it('여러 하위 노드 클릭 시 각각 select 이벤트 emit', async () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Act 1', type: 'act', children: [] },
        { id: 'ACT-01-02', title: 'Act 2', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      await wrapper.find('[data-testid="child-item-ACT-01-01"]').trigger('click')
      await wrapper.find('[data-testid="child-item-ACT-01-02"]').trigger('click')

      const emitted = wrapper.emitted('select')
      expect(emitted).toBeTruthy()
      expect(emitted?.length).toBe(2)
      expect(emitted?.[0]).toEqual(['ACT-01-01'])
      expect(emitted?.[1]).toEqual(['ACT-01-02'])
    })
  })

  describe('Task 노드 상태 표시', () => {
    it('Task 노드는 상태 StatusBadge를 표시한다', () => {
      const children: WbsNode[] = [
        { id: 'TSK-01', type: 'task', title: 'Test', status: '[xx]', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const statusBadge = wrapper.findComponent(StatusBadge)
      expect(statusBadge.exists()).toBe(true)
      expect(statusBadge.props('status')).toBe('[xx]')
    })

    it('Task 노드는 다양한 상태 StatusBadge를 표시한다', () => {
      const children: WbsNode[] = [
        { id: 'TSK-01', type: 'task', title: 'T1', status: '[ ]', children: [] },
        { id: 'TSK-02', type: 'task', title: 'T2', status: '[bd]', children: [] },
        { id: 'TSK-03', type: 'task', title: 'T3', status: '[xx]', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const statusBadges = wrapper.findAllComponents(StatusBadge)
      expect(statusBadges.length).toBe(3)
      expect(statusBadges[0].props('status')).toBe('[ ]')
      expect(statusBadges[1].props('status')).toBe('[bd]')
      expect(statusBadges[2].props('status')).toBe('[xx]')
    })

    it('Task 노드 status가 없으면 StatusBadge를 표시하지 않는다', () => {
      const children: WbsNode[] = [
        { id: 'TSK-01', type: 'task', title: 'Test', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const statusBadges = wrapper.findAllComponents(StatusBadge)
      expect(statusBadges.length).toBe(0)
    })
  })

  describe('WP/ACT 노드 정보 표시', () => {
    it('WP/ACT 노드는 진행률과 Task 수를 표시한다', () => {
      const children: WbsNode[] = [
        {
          id: 'ACT-01-01',
          type: 'act',
          title: 'Test',
          progress: 75,
          taskCount: 5,
          children: []
        }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const info = wrapper.find('.child-info')
      expect(info.exists()).toBe(true)
      expect(info.text()).toContain('진행률: 75%')
      expect(info.text()).toContain('Task: 5개')
    })

    it('WP 노드도 진행률과 Task 수를 표시한다', () => {
      const children: WbsNode[] = [
        {
          id: 'WP-02',
          type: 'wp',
          title: 'Test WP',
          progress: 50,
          taskCount: 10,
          children: []
        }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const info = wrapper.find('.child-info')
      expect(info.exists()).toBe(true)
      expect(info.text()).toContain('진행률: 50%')
      expect(info.text()).toContain('Task: 10개')
    })

    it('Task 노드는 진행률과 Task 수를 표시하지 않는다', () => {
      const children: WbsNode[] = [
        { id: 'TSK-01', type: 'task', title: 'Test', status: '[xx]', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const info = wrapper.find('.child-info')
      expect(info.exists()).toBe(false)
    })

    it('진행률이 없을 때 0%로 표시', () => {
      const children: WbsNode[] = [
        {
          id: 'ACT-01-01',
          type: 'act',
          title: 'Test',
          children: []
        }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const info = wrapper.find('.child-info')
      expect(info.text()).toContain('진행률: 0%')
      expect(info.text()).toContain('Task: 0개')
    })
  })

  describe('노드 타입 아이콘', () => {
    it.each([
      { type: 'wp' as const, icon: '🔷' },
      { type: 'act' as const, icon: '🔶' },
      { type: 'task' as const, icon: '🔸' }
    ])('$type 노드는 $icon 아이콘을 표시한다', ({ type, icon }) => {
      const children: WbsNode[] = [
        { id: 'NODE-01', type, title: 'Test', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const nodeIcon = wrapper.find(`.node-icon-${type}`)
      expect(nodeIcon.exists()).toBe(true)
      expect(nodeIcon.text()).toBe(icon)
    })
  })

  describe('접근성 (Accessibility)', () => {
    it('하위 노드 목록에 role과 aria-label이 설정되어 있다', () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const list = wrapper.find('.children-list')
      expect(list.attributes('role')).toBe('list')
      expect(list.attributes('aria-label')).toBe('하위 노드 목록')
    })

    it('각 하위 노드에 role과 aria-label이 설정되어 있다', () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test ACT', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const item = wrapper.find('.child-item')
      expect(item.attributes('role')).toBe('listitem')
      expect(item.attributes('aria-label')).toBe('Test ACT 선택')
      expect(item.attributes('tabindex')).toBe('0')
    })
  })

  describe('레이아웃 구조', () => {
    it('Panel 컴포넌트로 감싸져 있다', () => {
      const wrapper = mount(WpActChildren, {
        props: { children: [] },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const panel = wrapper.findComponent(Panel)
      expect(panel.exists()).toBe(true)
    })

    it('data-testid가 올바르게 설정되어 있다', () => {
      const children: WbsNode[] = [
        { id: 'ACT-01-01', title: 'Test', type: 'act', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      expect(wrapper.find('[data-testid="wp-act-children-panel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="child-item-ACT-01-01"]').exists()).toBe(true)
    })
  })

  describe('엣지 케이스', () => {
    it('혼합된 노드 타입을 올바르게 렌더링한다', () => {
      const children: WbsNode[] = [
        { id: 'WP-02', type: 'wp', title: 'WP', progress: 80, children: [] },
        { id: 'ACT-01-01', type: 'act', title: 'ACT', progress: 60, children: [] },
        { id: 'TSK-01', type: 'task', title: 'Task', status: '[xx]', children: [] }
      ]

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const items = wrapper.findAll('.child-item')
      expect(items.length).toBe(3)

      // WP icon
      expect(wrapper.find('.node-icon-wp').text()).toBe('🔷')
      // ACT icon
      expect(wrapper.find('.node-icon-act').text()).toBe('🔶')
      // Task icon
      expect(wrapper.find('.node-icon-task').text()).toBe('🔸')

      // WP/ACT have info, Task doesn't
      const infos = wrapper.findAll('.child-info')
      expect(infos.length).toBe(2)

      // Task has StatusBadge
      const statusBadges = wrapper.findAllComponents(StatusBadge)
      expect(statusBadges.length).toBe(1)
    })

    it('대량의 하위 노드를 렌더링할 수 있다', () => {
      const children: WbsNode[] = Array.from({ length: 50 }, (_, i) => ({
        id: `TSK-${i}`,
        type: 'task' as const,
        title: `Task ${i}`,
        status: '[xx]',
        children: []
      }))

      const wrapper = mount(WpActChildren, {
        props: { children },
        global: {
          components: { Panel, Message, StatusBadge, Tag }
        }
      })

      const items = wrapper.findAll('.child-item')
      expect(items.length).toBe(50)
    })
  })
})
