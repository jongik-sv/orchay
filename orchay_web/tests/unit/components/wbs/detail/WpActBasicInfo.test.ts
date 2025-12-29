import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import WpActBasicInfo from '~/components/wbs/detail/WpActBasicInfo.vue'
import type { WbsNode } from '~/types'
import Panel from 'primevue/panel'
import Badge from 'primevue/badge'
import ProgressBar from 'primevue/progressbar'

describe('WpActBasicInfo', () => {
  describe('노드 정보 표시', () => {
    it('WP 노드 ID와 제목을 표시한다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test Work Package',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const badge = wrapper.find('[data-testid="node-id-badge"]')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('WP-01')
      expect(wrapper.text()).toContain('Test Work Package')
    })

    it('ACT 노드는 🔶 아이콘을 표시한다', () => {
      const node: WbsNode = {
        id: 'ACT-01-01',
        type: 'act',
        title: 'Test Activity',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const icon = wrapper.find('.node-icon-act')
      expect(icon.exists()).toBe(true)
      expect(icon.text()).toBe('🔶')
    })

    it('WP 노드는 🔷 아이콘을 표시한다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test WP',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const icon = wrapper.find('.node-icon-wp')
      expect(icon.exists()).toBe(true)
      expect(icon.text()).toBe('🔷')
    })
  })

  describe('진행률 표시', () => {
    it('진행률 80% 이상일 때 초록색 ProgressBar 표시', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'High Progress',
        progress: 90,
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const progressBar = wrapper.find('[data-testid="node-progress-bar"]')
      expect(progressBar.exists()).toBe(true)
      expect(progressBar.classes()).toContain('progress-bar-high')
    })

    it.each([
      { progress: 90, expected: 'progress-bar-high' },
      { progress: 50, expected: 'progress-bar-medium' },
      { progress: 20, expected: 'progress-bar-low' }
    ])('진행률 $progress%일 때 $expected 클래스 적용', ({ progress, expected }) => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        progress,
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const progressBar = wrapper.find('[data-testid="node-progress-bar"]')
      expect(progressBar.classes()).toContain(expected)
    })

    it('진행률이 없을 때 0으로 표시', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const progressBar = wrapper.find('[data-testid="node-progress-bar"]')
      expect(progressBar.exists()).toBe(true)
      expect(progressBar.classes()).toContain('progress-bar-low')
    })
  })

  describe('일정 표시', () => {
    it('일정 범위를 표시한다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        schedule: {
          start: '2025-12-13',
          end: '2025-12-20'
        },
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      expect(wrapper.text()).toContain('2025-12-13 ~ 2025-12-20')
    })

    it('일정이 없을 때 "-"를 표시한다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const text = wrapper.text()
      expect(text).toContain('-')
      expect(text).not.toContain('~')
    })
  })

  describe('레이아웃 구조', () => {
    it('Panel 컴포넌트로 감싸져 있다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      const panel = wrapper.findComponent(Panel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('header')).toBe('기본 정보')
    })

    it('data-testid가 올바르게 설정되어 있다', () => {
      const node: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test',
        children: []
      }

      const wrapper = mount(WpActBasicInfo, {
        props: { node },
        global: {
          components: { Panel, Badge, ProgressBar }
        }
      })

      expect(wrapper.find('[data-testid="wp-act-basic-info-panel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="node-id-badge"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="node-progress-bar"]').exists()).toBe(true)
    })
  })
})
