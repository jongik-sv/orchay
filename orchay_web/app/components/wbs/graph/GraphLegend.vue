<script setup lang="ts">
/**
 * 그래프 범례 컴포넌트
 * Task: TSK-06-01
 */

import { GRAPH_COLORS } from '~/types/graph'

// Props
interface Props {
  showStatus?: boolean
}

withDefaults(defineProps<Props>(), {
  showStatus: false
})

// 카테고리 범례 데이터
const categoryLegend = [
  { key: 'development', label: '개발', color: GRAPH_COLORS.development.background },
  { key: 'defect', label: '결함', color: GRAPH_COLORS.defect.background },
  { key: 'infrastructure', label: '인프라', color: GRAPH_COLORS.infrastructure.background }
]

// 상태 범례 데이터
const statusLegend = [
  { key: '[ ]', label: 'Todo', color: '#9ca3af' },
  { key: '[bd]', label: '기본설계', color: '#fbbf24' },
  { key: '[dd]', label: '상세설계', color: '#f97316' },
  { key: '[im]', label: '구현', color: '#3b82f6' },
  { key: '[vf]', label: '검증', color: '#8b5cf6' },
  { key: '[xx]', label: '완료', color: '#22c55e' }
]
</script>

<template>
  <div class="graph-legend">
    <!-- 카테고리 범례 -->
    <div class="legend-section">
      <div
        v-for="item in categoryLegend"
        :key="item.key"
        class="legend-item"
      >
        <span
          class="legend-dot"
          :style="{ backgroundColor: item.color }"
        />
        <span class="legend-label">{{ item.label }}</span>
      </div>
    </div>

    <!-- 상태 범례 (선택적) -->
    <div
      v-if="showStatus"
      class="legend-section status-section"
    >
      <div
        v-for="item in statusLegend"
        :key="item.key"
        class="legend-item"
      >
        <span
          class="legend-dot small"
          :style="{ backgroundColor: item.color }"
        />
        <span class="legend-label small">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  background-color: var(--surface-card);
  border-radius: 6px;
}

.legend-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.status-section {
  padding-left: 1rem;
  border-left: 1px solid var(--surface-border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-dot.small {
  width: 8px;
  height: 8px;
}

.legend-label {
  font-size: 0.875rem;
  color: var(--text-color);
}

.legend-label.small {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}
</style>
