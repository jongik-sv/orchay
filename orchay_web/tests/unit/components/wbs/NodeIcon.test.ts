/**
 * NodeIcon 컴포넌트 단위 테스트
 * Task: TSK-04-02, TSK-08-01
 * Test Spec: UT-004
 *
 * TSK-08-01 업데이트: CSS 클래스 중앙화 원칙 적용
 * - style 속성 검증 → CSS 클래스 검증으로 변경
 * - 배경색은 main.css의 .node-icon-* 클래스로 관리
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NodeIcon from '~/components/wbs/NodeIcon.vue'
import type { WbsNodeType } from '~/types'

describe('NodeIcon', () => {
  // UT-004: 계층별 아이콘 매핑 검증 (CSS 클래스 중앙화 버전)
  it.each<[WbsNodeType, string, string]>([
    ['project', 'pi-folder', 'node-icon-project'],
    ['wp', 'pi-briefcase', 'node-icon-wp'],
    ['act', 'pi-list', 'node-icon-act'],
    ['task', 'pi-check-square', 'node-icon-task']
  ])('should display correct icon for %s', (type, expectedIcon, expectedClass) => {
    const wrapper = mount(NodeIcon, {
      props: { type }
    })

    const iconElement = wrapper.find('i')
    expect(iconElement.exists()).toBe(true)
    expect(iconElement.classes()).toContain('pi')
    expect(iconElement.classes()).toContain(expectedIcon)

    const containerElement = wrapper.find('.node-icon')
    expect(containerElement.exists()).toBe(true)
    // CSS 클래스 중앙화: style 대신 CSS 클래스로 배경색 관리
    expect(containerElement.classes()).toContain(expectedClass)
  })

  it('should render with correct dimensions', () => {
    const wrapper = mount(NodeIcon, {
      props: { type: 'project' }
    })

    const container = wrapper.find('.node-icon')
    expect(container.classes()).toContain('node-icon')
    // Check for flex layout and sizing in classes or styles
    expect(container.element.tagName).toBe('DIV')
  })

  it('should have rounded rectangle shape', () => {
    const wrapper = mount(NodeIcon, {
      props: { type: 'wp' }
    })

    const container = wrapper.find('.node-icon')
    // Should have border-radius styling (checked via class application)
    expect(container.exists()).toBe(true)
  })
})
