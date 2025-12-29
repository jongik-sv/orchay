<template>
  <Panel
    header="진행 상황"
    data-testid="wp-act-progress-panel"
    class="wp-act-progress"
  >
    <div class="space-y-4">
      <!-- 전체 Task 수 -->
      <div class="text-sm text-text-secondary">
        전체 Task: <span class="font-semibold text-white">{{ stats.total }}개</span>
      </div>

      <!-- 완료/진행/대기 요약 -->
      <div class="flex items-center justify-between gap-4 text-sm">
        <div class="flex items-center gap-1">
          <i class="pi pi-check-circle text-success"></i>
          <span class="text-text-secondary">완료:</span>
          <span class="font-semibold text-success">
            {{ stats.completed }}개 ({{ completedPercentage }}%)
          </span>
        </div>
        <div class="flex items-center gap-1">
          <i class="pi pi-spinner text-warning"></i>
          <span class="text-text-secondary">진행:</span>
          <span class="font-semibold text-warning">
            {{ stats.inProgress }}개 ({{ inProgressPercentage }}%)
          </span>
        </div>
        <div class="flex items-center gap-1">
          <i class="pi pi-clock text-text-muted"></i>
          <span class="text-text-secondary">대기:</span>
          <span class="font-semibold text-text-muted">
            {{ stats.todo }}개 ({{ todoPercentage }}%)
          </span>
        </div>
      </div>

      <!-- 다단계 ProgressBar (완료/진행/대기) -->
      <div
        class="progress-segments"
        data-testid="progress-segments"
        role="progressbar"
        :aria-valuenow="completedPercentage"
        :aria-valuemin="0"
        :aria-valuemax="100"
        :aria-label="`전체 진행률 ${completedPercentage}%`"
      >
        <div class="progress-segment-track">
          <div
            class="progress-segment progress-segment-completed"
            :style="{ width: `${completedPercentage}%` }"
          ></div>
          <div
            class="progress-segment progress-segment-inprogress"
            :style="{ width: `${inProgressPercentage}%` }"
          ></div>
          <div
            class="progress-segment progress-segment-todo"
            :style="{ width: `${todoPercentage}%` }"
          ></div>
        </div>
      </div>

      <!-- 상태별 분포 -->
      <Divider>
        <span class="text-xs text-text-muted">상태별 분포</span>
      </Divider>

      <div class="grid grid-cols-2 gap-2 text-sm">
        <div
          v-for="(count, status) in stats.byStatus"
          :key="status"
          class="flex items-center justify-between px-3 py-2 rounded bg-bg-card border border-border"
        >
          <span class="text-text-secondary">{{ getStatusLabel(status as string) }}</span>
          <Badge
            :value="count"
            :severity="getStatusSeverity(status as string)"
            :data-testid="`status-count-${status}`"
          />
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * WpActProgress - WP/ACT 진행률 시각화
 * Task: TSK-05-05
 * 상세설계: 020-detail-design.md 섹션 2.4
 *
 * 책임:
 * - 하위 Task 상태 집계 표시
 * - 완료/진행/대기 비율 시각화
 * - 상태별 Task 카운트 표시
 */

import { computed } from 'vue'
import Panel from 'primevue/panel'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'
import type { ProgressStats } from '~/types'
import { getStatusSeverity, getStatusLabel } from '~/utils/wbsProgress'

// ============================================================
// Props
// ============================================================
interface Props {
  stats: ProgressStats
}

const props = defineProps<Props>()

// ============================================================
// Computed Properties
// ============================================================

/**
 * 완료 비율 (%)
 */
const completedPercentage = computed(() => {
  if (props.stats.total === 0) return 0
  return Math.round((props.stats.completed / props.stats.total) * 100)
})

/**
 * 진행 중 비율 (%)
 */
const inProgressPercentage = computed(() => {
  if (props.stats.total === 0) return 0
  return Math.round((props.stats.inProgress / props.stats.total) * 100)
})

/**
 * 대기 비율 (%)
 * M-02: 나머지 계산으로 반올림 오차 흡수하여 정확히 100% 보장
 */
const todoPercentage = computed(() => {
  if (props.stats.total === 0) return 0
  // 100에서 나머지 두 비율을 빼서 정확히 100%가 되도록 보장
  return 100 - completedPercentage.value - inProgressPercentage.value
})
</script>

<style scoped>
/* WpActProgress 스타일은 main.css에 중앙화됨 */
</style>
