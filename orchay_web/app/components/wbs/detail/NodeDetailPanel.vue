<template>
  <div class="node-detail-panel h-full" role="region" aria-label="노드 상세 정보">
    <!-- Task 선택 시 -->
    <TaskDetailPanel v-if="selectionStore.isTaskSelected" />

    <!-- WP/ACT 선택 시 -->
    <WpActDetailPanel
      v-else-if="isWpOrActSelected && selectedNode"
      :node="selectedNode"
    />

    <!-- 선택 없음 -->
    <Message v-else severity="info" data-testid="empty-state-message">
      왼쪽에서 노드를 선택하세요
    </Message>
  </div>
</template>

<script setup lang="ts">
/**
 * NodeDetailPanel - 노드 타입별 상세 패널 분기 컨테이너
 * Task: TSK-05-05
 * 상세설계: 020-detail-design.md 섹션 2.1
 *
 * 책임:
 * - Task/WP/ACT 타입별 패널 분기 렌더링
 * - TaskDetailPanel 기존 동작 유지
 * - WP/ACT 선택 시 WpActDetailPanel 표시
 */

import { storeToRefs } from 'pinia'
import TaskDetailPanel from './TaskDetailPanel.vue'
import WpActDetailPanel from './WpActDetailPanel.vue'
import Message from 'primevue/message'

// ============================================================
// Stores
// ============================================================
const selectionStore = useSelectionStore()

// Use storeToRefs to avoid duplicating computed logic from selectionStore
// H-01: Remove duplicate selectedNode computed, use store's implementation
const { isWpOrActSelected, selectedNode } = storeToRefs(selectionStore)
</script>

<style scoped>
/* NodeDetailPanel 스타일은 main.css에 중앙화됨 */
</style>
