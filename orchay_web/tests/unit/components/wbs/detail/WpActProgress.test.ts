import { mount } from '@vue/test-utils'
import { describe, it, expect } from 'vitest'
import WpActProgress from '~/components/wbs/detail/WpActProgress.vue'
import type { ProgressStats } from '~/types'
import Panel from 'primevue/panel'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'

describe('WpActProgress', () => {
  describe('진행률 통계 표시', () => {
    it('진행률 통계를 정확히 표시한다', () => {
      const stats: ProgressStats = {
        total: 10,
        completed: 5,
        inProgress: 3,
        todo: 2,
        byStatus: {
          '[ ]': 2,
          '[bd]': 1,
          '[im]': 2,
          '[xx]': 5
        }
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const text = wrapper.text()
      expect(text).toContain('전체 Task: 10개')
      expect(text).toContain('5개 (50%)')
      expect(text).toContain('3개 (30%)')
      expect(text).toContain('2개 (20%)')
    })

    it('전체 Task가 0개일 때 0% 표시', () => {
      const stats: ProgressStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const text = wrapper.text()
      expect(text).toContain('전체 Task: 0개')
      expect(text).toContain('0개 (0%)')
    })

    it('비율이 올바르게 계산된다', () => {
      const stats: ProgressStats = {
        total: 7,
        completed: 3,
        inProgress: 2,
        todo: 2,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const text = wrapper.text()
      // 3/7 = 42.857...% -> 반올림하여 43%
      expect(text).toContain('3개 (43%)')
      // 2/7 = 28.571...% -> 반올림하여 29%
      expect(text).toContain('2개 (29%)')
    })
  })

  describe('다단계 ProgressBar', () => {
    it('다단계 ProgressBar를 렌더링한다', () => {
      const stats: ProgressStats = {
        total: 10,
        completed: 5,
        inProgress: 3,
        todo: 2,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const segments = wrapper.find('[data-testid="progress-segments"]')
      expect(segments.exists()).toBe(true)

      const completed = segments.find('.progress-segment-completed')
      expect(completed.exists()).toBe(true)
      expect(completed.attributes('style')).toContain('width: 50%')

      const inProgress = segments.find('.progress-segment-inprogress')
      expect(inProgress.exists()).toBe(true)
      expect(inProgress.attributes('style')).toContain('width: 30%')

      const todo = segments.find('.progress-segment-todo')
      expect(todo.exists()).toBe(true)
      expect(todo.attributes('style')).toContain('width: 20%')
    })

    it('진행률 aria 속성이 올바르게 설정된다', () => {
      const stats: ProgressStats = {
        total: 10,
        completed: 7,
        inProgress: 2,
        todo: 1,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const segments = wrapper.find('[data-testid="progress-segments"]')
      expect(segments.attributes('role')).toBe('progressbar')
      expect(segments.attributes('aria-valuenow')).toBe('70')
      expect(segments.attributes('aria-valuemin')).toBe('0')
      expect(segments.attributes('aria-valuemax')).toBe('100')
      expect(segments.attributes('aria-label')).toBe('전체 진행률 70%')
    })

    it('전체 Task가 0일 때 width 0%', () => {
      const stats: ProgressStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const completed = wrapper.find('.progress-segment-completed')
      expect(completed.attributes('style')).toContain('width: 0%')
    })
  })

  describe('상태별 분포 표시', () => {
    it('상태별 분포를 표시한다', () => {
      const stats: ProgressStats = {
        total: 10,
        completed: 5,
        inProgress: 3,
        todo: 2,
        byStatus: {
          '[ ]': 2,
          '[bd]': 1,
          '[dd]': 1,
          '[im]': 1,
          '[vf]': 0,
          '[xx]': 5
        }
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      expect(wrapper.find('[data-testid="status-count-[ ]"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-count-[ ]"]').text()).toBe('2')

      expect(wrapper.find('[data-testid="status-count-[bd]"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-count-[bd]"]').text()).toBe('1')

      expect(wrapper.find('[data-testid="status-count-[xx]"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-count-[xx]"]').text()).toBe('5')
    })

    it('byStatus가 빈 객체일 때 상태별 분포를 표시하지 않는다', () => {
      const stats: ProgressStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const statusBadges = wrapper.findAll('[data-testid^="status-count-"]')
      expect(statusBadges.length).toBe(0)
    })

    it('0개인 상태는 표시된다', () => {
      const stats: ProgressStats = {
        total: 5,
        completed: 5,
        inProgress: 0,
        todo: 0,
        byStatus: {
          '[vf]': 0,
          '[xx]': 5
        }
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      expect(wrapper.find('[data-testid="status-count-[vf]"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="status-count-[vf]"]').text()).toBe('0')
    })
  })

  describe('Badge severity 매핑', () => {
    it.each([
      { status: '[ ]', severity: 'secondary' },
      { status: '[bd]', severity: 'info' },
      { status: '[im]', severity: 'warning' },
      { status: '[xx]', severity: 'success' }
    ])('상태 $status는 $severity Badge로 표시', ({ status, severity }) => {
      const stats: ProgressStats = {
        total: 1,
        completed: 0,
        inProgress: 1,
        todo: 0,
        byStatus: { [status]: 1 }
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const badge = wrapper.findComponent({ name: 'Badge', props: { severity } })
      expect(badge.exists()).toBe(true)
    })

    it('Defect 및 Infrastructure 상태의 severity 매핑', () => {
      const stats: ProgressStats = {
        total: 3,
        completed: 0,
        inProgress: 3,
        todo: 0,
        byStatus: {
          '[an]': 1,  // defect - warning
          '[ds]': 1,  // infrastructure - info
          '[fx]': 1   // defect - warning
        }
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      // [an] and [fx] should be warning
      const warningBadges = wrapper.findAllComponents({ name: 'Badge', props: { severity: 'warning' } })
      expect(warningBadges.length).toBeGreaterThanOrEqual(2)

      // [ds] should be info
      const infoBadges = wrapper.findAllComponents({ name: 'Badge', props: { severity: 'info' } })
      expect(infoBadges.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('레이아웃 구조', () => {
    it('Panel 컴포넌트로 감싸져 있다', () => {
      const stats: ProgressStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      const panel = wrapper.findComponent(Panel)
      expect(panel.exists()).toBe(true)
      expect(panel.props('header')).toBe('진행 상황')
    })

    it('data-testid가 올바르게 설정되어 있다', () => {
      const stats: ProgressStats = {
        total: 0,
        completed: 0,
        inProgress: 0,
        todo: 0,
        byStatus: {}
      }

      const wrapper = mount(WpActProgress, {
        props: { stats },
        global: {
          components: { Panel, Badge, Divider }
        }
      })

      expect(wrapper.find('[data-testid="wp-act-progress-panel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="progress-segments"]').exists()).toBe(true)
    })
  })
})
