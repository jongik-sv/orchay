/**
 * AppLayout 컴포넌트 단위 테스트
 * Task: TSK-08-03
 * Test Spec: 026-test-specification.md
 *
 * 현재 구현: Flex 기반 고정/유동 레이아웃
 * - 좌측 패널: 600px 고정
 * - 우측 패널: flex-1 (나머지 공간)
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppLayout from '~/components/layout/AppLayout.vue'

describe('AppLayout', () => {
  // ==================== TC-UNIT-01: 레이아웃 구조 ====================

  describe('Layout Structure', () => {
    it('should render root element with correct attributes', () => {
      const wrapper = mount(AppLayout)

      const root = wrapper.find('[data-testid="app-layout"]')
      expect(root.exists()).toBe(true)
      expect(root.classes()).toContain('h-screen')
      expect(root.classes()).toContain('flex')
      expect(root.classes()).toContain('flex-col')
    })

    it('should render header, content, left panel, and right panel', () => {
      const wrapper = mount(AppLayout)

      expect(wrapper.find('[data-testid="app-header-container"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="app-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="left-panel"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="right-panel"]').exists()).toBe(true)
    })

    it('should have fixed width for left panel (600px)', () => {
      const wrapper = mount(AppLayout)

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.classes()).toContain('w-[600px]')
      expect(leftPanel.classes()).toContain('flex-shrink-0')
    })

    it('should have flex-1 for right panel (remaining space)', () => {
      const wrapper = mount(AppLayout)

      const rightPanel = wrapper.find('[data-testid="right-panel"]')
      expect(rightPanel.classes()).toContain('flex-1')
      expect(rightPanel.classes()).toContain('min-w-0')
    })

    it('should have fixed header height (56px)', () => {
      const wrapper = mount(AppLayout)

      const header = wrapper.find('[data-testid="app-header-container"]')
      expect(header.classes()).toContain('h-[56px]')
      expect(header.classes()).toContain('flex-shrink-0')
    })

    it('should have minimum width constraint (1200px)', () => {
      const wrapper = mount(AppLayout)

      const root = wrapper.find('[data-testid="app-layout"]')
      expect(root.classes()).toContain('min-w-[1200px]')
    })
  })

  // ==================== TC-UNIT-02: 슬롯 렌더링 ====================

  describe('Slot Rendering', () => {
    it('TC-UNIT-02-A: header 슬롯이 렌더링됨', () => {
      const wrapper = mount(AppLayout, {
        slots: {
          header: '<div class="custom-header">Custom Header</div>'
        }
      })

      const header = wrapper.find('.custom-header')
      expect(header.exists()).toBe(true)
      expect(header.text()).toBe('Custom Header')
    })

    it('TC-UNIT-02-B: left 슬롯이 렌더링됨', () => {
      const wrapper = mount(AppLayout, {
        slots: {
          left: '<div class="custom-left">WBS Tree</div>'
        }
      })

      const leftContent = wrapper.find('.custom-left')
      expect(leftContent.exists()).toBe(true)
      expect(leftContent.text()).toBe('WBS Tree')
    })

    it('TC-UNIT-02-C: right 슬롯이 렌더링됨', () => {
      const wrapper = mount(AppLayout, {
        slots: {
          right: '<div class="custom-right">Task Detail</div>'
        }
      })

      const rightContent = wrapper.find('.custom-right')
      expect(rightContent.exists()).toBe(true)
      expect(rightContent.text()).toBe('Task Detail')
    })

    it('TC-UNIT-02-D: 슬롯 미제공 시 기본 콘텐츠 표시', () => {
      const wrapper = mount(AppLayout)

      // 기본 header 콘텐츠
      expect(wrapper.text()).toContain('orchay')

      // 기본 left 콘텐츠
      expect(wrapper.text()).toContain('Left Panel (WBS Tree)')

      // 기본 right 콘텐츠
      expect(wrapper.text()).toContain('Right Panel (Task Detail)')
    })

    it('TC-UNIT-02-E: 모든 슬롯이 동시에 렌더링됨', () => {
      const wrapper = mount(AppLayout, {
        slots: {
          header: '<div class="test-header">Header</div>',
          left: '<div class="test-left">Left</div>',
          right: '<div class="test-right">Right</div>'
        }
      })

      expect(wrapper.find('.test-header').exists()).toBe(true)
      expect(wrapper.find('.test-left').exists()).toBe(true)
      expect(wrapper.find('.test-right').exists()).toBe(true)
    })
  })

  // ==================== TC-UNIT-03: ARIA 및 접근성 ====================

  describe('ARIA and Accessibility', () => {
    it('TC-UNIT-03-A: 루트 요소에 data-testid 존재', () => {
      const wrapper = mount(AppLayout)

      const root = wrapper.find('[data-testid="app-layout"]')
      expect(root.exists()).toBe(true)
    })

    it('TC-UNIT-03-B: Header에 적절한 role 속성', () => {
      const wrapper = mount(AppLayout)

      const header = wrapper.find('[data-testid="app-header-container"]')
      expect(header.attributes('role')).toBe('banner')
    })

    it('TC-UNIT-03-C: Left panel에 적절한 role 속성', () => {
      const wrapper = mount(AppLayout)

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.attributes('role')).toBe('complementary')
      expect(leftPanel.attributes('aria-label')).toBe('WBS Tree Panel')
    })

    it('TC-UNIT-03-D: Right panel에 적절한 role 속성', () => {
      const wrapper = mount(AppLayout)

      const rightPanel = wrapper.find('[data-testid="right-panel"]')
      expect(rightPanel.attributes('role')).toBe('region')
      expect(rightPanel.attributes('aria-label')).toBe('Task Detail')
    })

    it('TC-UNIT-03-E: Main 영역에 적절한 role 속성', () => {
      const wrapper = mount(AppLayout)

      const main = wrapper.find('[data-testid="app-content"]')
      expect(main.attributes('role')).toBe('main')
    })

    it('TC-UNIT-03-F: Left panel에 aside 태그 사용', () => {
      const wrapper = mount(AppLayout)

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      expect(leftPanel.element.tagName.toLowerCase()).toBe('aside')
    })

    it('TC-UNIT-03-G: Right panel에 section 태그 사용', () => {
      const wrapper = mount(AppLayout)

      const rightPanel = wrapper.find('[data-testid="right-panel"]')
      expect(rightPanel.element.tagName.toLowerCase()).toBe('section')
    })

    it('TC-UNIT-03-H: Header에 header 태그 사용', () => {
      const wrapper = mount(AppLayout)

      const header = wrapper.find('[data-testid="app-header-container"]')
      expect(header.element.tagName.toLowerCase()).toBe('header')
    })

    it('TC-UNIT-03-I: Content에 main 태그 사용', () => {
      const wrapper = mount(AppLayout)

      const main = wrapper.find('[data-testid="app-content"]')
      expect(main.element.tagName.toLowerCase()).toBe('main')
    })
  })

  // ==================== TC-UNIT-04: 스타일 및 클래스 ====================

  describe('Styling and Classes', () => {
    it('TC-UNIT-04-A: 패널에 overflow 설정', () => {
      const wrapper = mount(AppLayout)

      const leftPanel = wrapper.find('[data-testid="left-panel"]')
      const rightPanel = wrapper.find('[data-testid="right-panel"]')

      expect(leftPanel.classes()).toContain('overflow-auto')
      expect(rightPanel.classes()).toContain('overflow-auto')
    })

    it('TC-UNIT-04-B: Content 영역에 overflow-hidden 설정', () => {
      const wrapper = mount(AppLayout)

      const content = wrapper.find('[data-testid="app-content"]')
      expect(content.classes()).toContain('overflow-hidden')
    })

    it('TC-UNIT-04-C: 구분선이 존재함', () => {
      const wrapper = mount(AppLayout)

      const content = wrapper.find('[data-testid="app-content"]')
      const divider = content.find('.w-\\[1px\\]')
      expect(divider.exists()).toBe(true)
      expect(divider.classes()).toContain('bg-border')
    })

    it('TC-UNIT-04-D: 헤더에 border-bottom 설정', () => {
      const wrapper = mount(AppLayout)

      const header = wrapper.find('[data-testid="app-header-container"]')
      expect(header.classes()).toContain('border-b')
      expect(header.classes()).toContain('border-border')
    })

    it('TC-UNIT-04-E: 배경색 클래스 적용', () => {
      const wrapper = mount(AppLayout)

      const root = wrapper.find('[data-testid="app-layout"]')
      const header = wrapper.find('[data-testid="app-header-container"]')
      const leftPanel = wrapper.find('[data-testid="left-panel"]')

      expect(root.classes()).toContain('bg-bg')
      expect(header.classes()).toContain('bg-bg-header')
      expect(leftPanel.classes()).toContain('bg-bg-sidebar')
    })
  })

  // ==================== TC-UNIT-05: 컴포넌트 마운트 ====================

  describe('Component Mounting', () => {
    it('TC-UNIT-05-A: 컴포넌트가 에러 없이 마운트됨', () => {
      expect(() => mount(AppLayout)).not.toThrow()
    })

    it('TC-UNIT-05-B: 컴포넌트가 존재함', () => {
      const wrapper = mount(AppLayout)
      expect(wrapper.exists()).toBe(true)
    })

    it('TC-UNIT-05-C: 복잡한 슬롯 콘텐츠로 마운트됨', () => {
      const wrapper = mount(AppLayout, {
        slots: {
          header: `
            <nav>
              <ul>
                <li>Home</li>
                <li>About</li>
              </ul>
            </nav>
          `,
          left: `
            <div class="tree">
              <div class="node">Node 1</div>
              <div class="node">Node 2</div>
            </div>
          `,
          right: `
            <article>
              <h1>Title</h1>
              <p>Content</p>
            </article>
          `
        }
      })

      expect(wrapper.find('nav').exists()).toBe(true)
      expect(wrapper.findAll('.node').length).toBe(2)
      expect(wrapper.find('article').exists()).toBe(true)
    })
  })
})
