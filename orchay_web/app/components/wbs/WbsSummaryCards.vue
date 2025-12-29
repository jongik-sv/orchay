<script setup lang="ts">
/**
 * WbsSummaryCards 컴포넌트
 * WBS 통계 요약 카드 표시
 * - WP/ACT/TSK 개수
 * - 전체 진행률
 *
 * @see TSK-04-01
 * @see 020-detail-design.md
 */

import { useWbsStore } from '~/stores/wbs'
import Card from 'primevue/card'

const wbsStore = useWbsStore()

// 스토어에서 통계 데이터 구독
const { wpCount, actCount, tskCount, overallProgress } = storeToRefs(wbsStore)

// 카드 데이터 구성 (단순화된 인터페이스)
interface CardData {
  label: string
  value: number
  colorClass: string
  ariaLabel: string
  testId: string
  isPercentage: boolean
}

// 카드 데이터 - computed로 값을 직접 계산
const cards = computed<CardData[]>(() => [
  {
    label: 'WP',
    value: wpCount.value,
    colorClass: 'text-blue-500',
    ariaLabel: `Work Package count: ${wpCount.value}`,
    testId: 'wp-card',
    isPercentage: false
  },
  {
    label: 'ACT',
    value: actCount.value,
    colorClass: 'text-green-500',
    ariaLabel: `Activity count: ${actCount.value}`,
    testId: 'act-card',
    isPercentage: false
  },
  {
    label: 'TSK',
    value: tskCount.value,
    colorClass: 'text-orange-500',
    ariaLabel: `Task count: ${tskCount.value}`,
    testId: 'tsk-card',
    isPercentage: false
  },
  {
    label: 'Progress',
    value: overallProgress.value,
    colorClass: 'text-purple-500',
    ariaLabel: `Overall progress: ${overallProgress.value}%`,
    testId: 'progress-card',
    isPercentage: true
  }
])
</script>

<template>
  <div
    data-testid="wbs-summary-cards"
    class="grid grid-cols-4 gap-3"
  >
    <Card
      v-for="card in cards"
      :key="card.label"
      :data-testid="card.testId"
      class="bg-bg-card border border-border"
      :aria-label="card.ariaLabel"
    >
      <template #content>
        <div class="text-center p-2">
          <!-- 카드 값 -->
          <div
            :class="card.colorClass"
            class="text-2xl font-bold"
          >
            {{ card.value }}{{ card.isPercentage ? '%' : '' }}
          </div>

          <!-- 카드 레이블 -->
          <div class="text-sm text-text-secondary mt-1 uppercase">
            {{ card.label }}
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
