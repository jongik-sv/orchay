<script setup lang="ts">
/**
 * Vue Flow 커스텀 Task 노드 컴포넌트
 * Task: TSK-06-01
 */
import { Handle, Position } from '@vue-flow/core'
import type { TaskNodeData } from '~/types/graph'
import { GRAPH_COLORS, STATUS_COLORS, HIGHLIGHT_COLORS } from '~/types/graph'

interface Props {
  id: string
  data: TaskNodeData
  selected?: boolean
  // 하이라이트 상태
  highlightType?: 'selected' | 'dependsOn' | 'dependedBy' | 'dimmed' | null
  // 초점 뷰 깊이 (TSK-06-03)
  focusDepth?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  highlightType: null,
  focusDepth: null
})

// 노드 스타일 계산
const nodeStyle = computed(() => {
  // 하이라이트 상태가 있으면 하이라이트 색상 사용
  if (props.highlightType) {
    const colors = HIGHLIGHT_COLORS[props.highlightType]
    return {
      backgroundColor: colors.background,
      borderColor: colors.border,
      color: colors.text
    }
  }

  // 완료 상태면 흐리게
  if (props.data.status === '[xx]') {
    return {
      backgroundColor: STATUS_COLORS.done.background,
      borderColor: STATUS_COLORS.done.border,
      color: STATUS_COLORS.done.text
    }
  }

  // 카테고리별 색상
  const category = props.data.category as keyof typeof GRAPH_COLORS
  const colors = GRAPH_COLORS[category] || GRAPH_COLORS.development
  return {
    backgroundColor: colors.background,
    borderColor: colors.border,
    color: colors.text
  }
})

// 노드 CSS 클래스 계산 (테두리 및 애니메이션)
const nodeClass = computed(() => {
  const classes = []

  // 초점 뷰 depth별 클래스
  if (props.focusDepth === 0) {
    classes.push('task-node-focus-center', 'task-node-focus-depth-0')
  } else if (props.focusDepth === 1) {
    classes.push('task-node-focus-depth-1')
  } else if (props.focusDepth === 2) {
    classes.push('task-node-focus-depth-2')
  } else if (props.focusDepth === 3) {
    classes.push('task-node-focus-depth-3')
  } else if (props.selected && !props.highlightType) {
    // 선택된 노드 (초점 뷰가 아닐 때)
    classes.push('task-node-selected')
  }

  return classes
})

// 인라인 스타일 (동적 계산 필수인 항목만)
const nodeInlineStyle = computed(() => {
  const style: Record<string, string> = {
    backgroundColor: nodeStyle.value.backgroundColor,
    color: nodeStyle.value.color
  }

  // 테두리: 초점 뷰나 선택 상태가 아닐 때만 인라인으로 설정
  if (props.focusDepth === null && !props.selected) {
    style.border = `2px solid ${nodeStyle.value.borderColor}`
  }

  return style
})
</script>

<template>
  <div
    :class="['task-node', ...nodeClass]"
    :style="nodeInlineStyle"
  >
    <!-- 입력 핸들 (왼쪽) -->
    <Handle
      type="target"
      :position="Position.Left"
      class="task-handle"
    />

    <!-- 노드 콘텐츠 -->
    <div class="task-content">
      <div class="task-id">{{ data.taskId }}</div>
      <div class="task-title">{{ data.title }}</div>
      <div class="task-meta">
        <span class="task-status">{{ data.statusName }}</span>
        <span v-if="data.assignee" class="task-assignee">{{ data.assignee }}</span>
      </div>
    </div>

    <!-- 출력 핸들 (오른쪽) -->
    <Handle
      type="source"
      :position="Position.Right"
      class="task-handle"
    />
  </div>
</template>

<style scoped>
.task-node {
  padding: 8px 12px;
  border-radius: 6px;
  min-width: 140px;
  max-width: 200px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  cursor: grab;
  transition: box-shadow 0.2s, transform 0.1s;
}

.task-node:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.task-node:active {
  cursor: grabbing;
}

.task-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.task-id {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.9;
}

.task-title {
  font-size: 12px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.task-meta {
  display: flex;
  gap: 8px;
  font-size: 10px;
  opacity: 0.8;
  margin-top: 2px;
}

.task-status {
  padding: 1px 4px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.task-assignee {
  opacity: 0.7;
}

.task-handle {
  width: 8px;
  height: 8px;
  background: currentColor;
  border: 2px solid var(--surface-ground);
}

/* 초점 Task 애니메이션 (TSK-06-03) */
.task-node-focus-center {
  animation: focus-pulse 2s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
}

@keyframes focus-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(251, 191, 36, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(251, 191, 36, 0);
  }
}
</style>
