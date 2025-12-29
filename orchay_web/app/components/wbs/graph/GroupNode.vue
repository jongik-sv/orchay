<script setup lang="ts">
/**
 * 그룹 노드 컴포넌트 (WP/ACT 그룹 표시)
 * Task: TSK-06-03
 */

import { Handle, Position } from '@vue-flow/core'
import type { GroupNodeData } from '~/types/graph'

// Props
interface Props {
  id: string
  data: GroupNodeData
  selected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selected: false
})

// Emits
const emit = defineEmits<{
  toggle: [groupId: string]
}>()

// 진행률 퍼센트 계산
const progressPercent = computed(() => {
  if (props.data.taskCount === 0) return 0
  return Math.round((props.data.completedCount / props.data.taskCount) * 100)
})

// 진행률 색상 클래스
const progressClass = computed(() => {
  const percent = progressPercent.value
  if (percent >= 80) return 'progress-bar-high'
  if (percent >= 40) return 'progress-bar-medium'
  return 'progress-bar-low'
})

// 그룹 타입별 아이콘
const groupIcon = computed(() => {
  return props.data.groupType === 'wp' ? 'pi-folder' : 'pi-folder-open'
})

// 그룹 타입별 CSS 클래스
const groupColorClass = computed(() => {
  return props.data.groupType === 'wp' ? 'group-node-wp' : 'group-node-act'
})

const groupIconClass = computed(() => {
  return props.data.groupType === 'wp' ? 'group-icon-wp' : 'group-icon-act'
})

// 토글 핸들러
function handleToggle() {
  emit('toggle', props.data.groupId)
}
</script>

<template>
  <div
    class="group-node"
    :class="[groupColorClass, { 'group-node-selected': selected }]"
  >
    <!-- 입력 핸들 (왼쪽) -->
    <Handle
      type="target"
      :position="Position.Left"
      class="group-handle"
    />

    <!-- 그룹 헤더 (클릭 가능) -->
    <div
      class="group-header"
      :data-testid="`group-node-header-${data.groupId}`"
      @click="handleToggle"
    >
      <i
        :class="['group-icon pi', data.isExpanded ? 'pi-chevron-down' : 'pi-chevron-right', groupIconClass]"
      />
      <i
        :class="['group-type-icon pi', groupIcon, groupIconClass]"
      />
      <span class="group-title">{{ data.groupId }}: {{ data.title }}</span>
    </div>

    <!-- 진행률 바 -->
    <div
      class="group-progress"
      :data-testid="`group-node-progress-${data.groupId}`"
    >
      <div
        class="group-progress-bar"
        :class="progressClass"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>

    <!-- 진행률 텍스트 -->
    <div
      class="group-progress-text"
      :data-testid="`group-node-progress-text-${data.groupId}`"
    >
      {{ data.completedCount }}/{{ data.taskCount }} ({{ progressPercent }}%)
    </div>

    <!-- 출력 핸들 (오른쪽) -->
    <Handle
      type="source"
      :position="Position.Right"
      class="group-handle"
    />
  </div>
</template>

<style scoped>
/* 그룹 노드 기본 스타일 */
.group-node {
  @apply bg-bg-card border-2 border-border rounded-lg p-3 transition-all duration-200;
  width: 250px;
  min-height: 90px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  cursor: pointer;
}

.group-node:hover {
  @apply shadow-lg;
  transform: translateY(-2px);
}

.group-node-selected {
  @apply ring-2 ring-primary ring-offset-2 ring-offset-bg;
}

/* 그룹 헤더 */
.group-header {
  @apply flex items-center gap-2 mb-2;
}

.group-icon {
  @apply text-sm transition-transform duration-200;
}

.group-type-icon {
  @apply text-base;
}

.group-title {
  @apply text-sm font-semibold text-text flex-1 truncate;
}

/* 진행률 바 */
.group-progress {
  @apply w-full h-5 bg-border rounded-full overflow-hidden mb-1;
}

.group-progress-bar {
  @apply h-full transition-all duration-300;
}

/* 진행률 텍스트 */
.group-progress-text {
  @apply text-xs text-text-secondary text-center;
}

/* 핸들 */
.group-handle {
  width: 10px;
  height: 10px;
  @apply bg-primary;
  border: 2px solid var(--surface-ground);
}

/* 진행률 색상은 main.css에 정의됨 */
</style>
