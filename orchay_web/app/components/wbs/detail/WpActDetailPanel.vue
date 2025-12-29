<template>
  <Card
    class="wp-act-detail-panel h-full"
    data-testid="wp-act-detail-panel"
    role="region"
    :aria-label="`${nodeTypeLabel} 상세 정보`"
  >
    <template #content>
      <div class="wp-act-detail-content overflow-y-auto space-y-4">
        <!-- 섹션 1: 기본 정보 -->
        <WpActBasicInfo :node="node" />

        <!-- 섹션 2: 진행률 시각화 -->
        <WpActProgress :stats="progressStats" />

        <!-- 섹션 3: 하위 노드 목록 -->
        <WpActChildren
          :children="node.children"
          @select="handleNodeSelect"
        />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
/**
 * WpActDetailPanel - WP/ACT 상세 정보 컨테이너
 * Task: TSK-05-05
 * 상세설계: 020-detail-design.md 섹션 2.2
 *
 * 책임:
 * - WP/ACT 노드 전체 정보 표시
 * - 3개 섹션 컴포넌트 조정
 * - 하위 노드 선택 이벤트 처리
 */

import { computed } from 'vue'
import Card from 'primevue/card'
import WpActBasicInfo from './WpActBasicInfo.vue'
import WpActProgress from './WpActProgress.vue'
import WpActChildren from './WpActChildren.vue'
import type { WbsNode, ProgressStats } from '~/types'
import { calculateProgressStats } from '~/utils/wbsProgress'

// L-01: Removed unnecessary alias assignments for simplicity

// ============================================================
// Props
// ============================================================
interface Props {
  node: WbsNode  // 선택된 WP 또는 ACT 노드
}

const props = defineProps<Props>()

// ============================================================
// Composables & Stores
// ============================================================
const selectionStore = useSelectionStore()

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
 * 진행률 통계 계산
 */
const progressStats = computed((): ProgressStats => {
  return calculateProgressStats(props.node)
})

// ============================================================
// Methods
// ============================================================

/**
 * 하위 노드 선택 핸들러
 * WpActChildren에서 emit된 select 이벤트 수신
 */
function handleNodeSelect(nodeId: string): void {
  selectionStore.selectNode(nodeId)
}
</script>

<style scoped>
/* WpActDetailPanel 스타일은 main.css에 중앙화됨 */
</style>
