<template>
  <div
    class="node-icon"
    :class="`node-icon-${type}`"
    :data-testid="`node-icon-${type}`"
  >
    <i :class="`pi ${iconClass}`" />
  </div>
</template>

<script setup lang="ts">
/**
 * NodeIcon 컴포넌트
 * WBS 노드 타입별 아이콘 표시
 *
 * CSS 클래스 중앙화 원칙 준수 (TSK-08-01)
 * - :style 인라인 스타일 제거
 * - 배경색은 main.css의 .node-icon-* 클래스로 관리
 *
 * @see 020-detail-design.md 섹션 9.7
 * @see main.css (.node-icon-project, .node-icon-wp, .node-icon-act, .node-icon-task)
 */
import type { WbsNodeType } from '~/types'

interface Props {
  type: WbsNodeType
}

const props = defineProps<Props>()

interface IconConfig {
  icon: string
  label: string
}

const iconConfig = computed((): IconConfig => {
  const configs: Record<WbsNodeType, IconConfig> = {
    project: { icon: 'pi-folder', label: 'P' },
    wp: { icon: 'pi-briefcase', label: 'WP' },
    act: { icon: 'pi-list', label: 'ACT' },
    task: { icon: 'pi-check-square', label: 'TSK' }
  }
  return configs[props.type]
})

const iconClass = computed(() => iconConfig.value.icon)
</script>

<!-- 스타일은 main.css로 완전 이전 (CSS 클래스 중앙화 원칙) -->
