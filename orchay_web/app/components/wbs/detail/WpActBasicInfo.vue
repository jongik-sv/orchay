<template>
  <Panel
    header="기본 정보"
    data-testid="wp-act-basic-info-panel"
    class="wp-act-basic-info"
  >
    <div class="space-y-4">
      <!-- 노드 ID 및 타입 -->
      <div class="flex items-center gap-2">
        <div :class="`node-icon node-icon-${node.type}`">
          {{ nodeTypeIcon }}
        </div>
        <Badge
          :value="node.id"
          severity="info"
          class="text-sm"
          data-testid="node-id-badge"
        />
      </div>

      <!-- 제목 -->
      <div class="field">
        <label class="font-semibold text-sm text-gray-400">제목</label>
        <div class="mt-1 text-base font-medium text-white">
          {{ node.title }}
        </div>
      </div>

      <!-- 일정 범위 -->
      <div class="field">
        <label class="font-semibold text-sm text-gray-400 flex items-center gap-1">
          <i class="pi pi-calendar text-xs"></i>
          일정
        </label>
        <div class="mt-1 text-sm text-text-secondary">
          {{ scheduleText }}
        </div>
      </div>

      <!-- 전체 진행률 -->
      <div class="field">
        <label class="font-semibold text-sm text-gray-400 flex items-center gap-1">
          <i class="pi pi-chart-bar text-xs"></i>
          전체 진행률
        </label>
        <div class="mt-2">
          <ProgressBar
            :value="node.progress || 0"
            :show-value="true"
            :class="progressBarClass"
            data-testid="node-progress-bar"
          />
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * WpActBasicInfo - WP/ACT 기본 정보 표시
 * Task: TSK-05-05
 * 상세설계: 020-detail-design.md 섹션 2.3
 *
 * 책임:
 * - WP/ACT ID, 제목, 일정, 진행률 표시
 * - 읽기 전용 (편집 없음)
 */

import { computed } from 'vue'
import Panel from 'primevue/panel'
import Badge from 'primevue/badge'
import ProgressBar from 'primevue/progressbar'
import type { WbsNode } from '~/types'

// ============================================================
// Props
// ============================================================
interface Props {
  node: WbsNode
}

const props = defineProps<Props>()

// ============================================================
// Computed Properties
// ============================================================

/**
 * 노드 타입 레이블
 */
const nodeTypeLabel = computed(() => {
  return props.node.type === 'wp' ? 'Work Package' : 'Activity'
})

/**
 * 노드 타입 아이콘
 */
const nodeTypeIcon = computed(() => {
  return props.node.type === 'wp' ? '🔷' : '🔶'
})

/**
 * 일정 텍스트
 */
const scheduleText = computed(() => {
  if (!props.node.schedule) return '-'
  return `${props.node.schedule.start} ~ ${props.node.schedule.end}`
})

/**
 * 진행률에 따른 ProgressBar CSS 클래스
 */
const progressBarClass = computed(() => {
  const progress = props.node.progress || 0
  if (progress >= 80) return 'progress-bar-high'    // 초록색
  if (progress >= 40) return 'progress-bar-medium'  // 주황색
  return 'progress-bar-low'                         // 빨간색
})
</script>

<style scoped>
/* WpActBasicInfo 스타일은 main.css에 중앙화됨 */
</style>
