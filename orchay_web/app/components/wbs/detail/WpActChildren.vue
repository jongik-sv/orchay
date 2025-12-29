<template>
  <Panel
    :header="`하위 노드 (${children.length})`"
    data-testid="wp-act-children-panel"
    class="wp-act-children"
  >
    <!-- 빈 상태 -->
    <div v-if="children.length === 0" class="empty-state p-6 text-center">
      <i class="pi pi-inbox text-4xl text-text-muted mb-3"></i>
      <Message severity="info" :closable="false" data-testid="children-empty-message">
        <p class="mb-2">하위 노드가 없습니다</p>
        <p class="text-xs text-text-secondary">
          wbs.md 파일에 하위 노드를 추가해주세요
        </p>
      </Message>
    </div>

    <!-- 하위 노드 목록 -->
    <div
      v-else
      class="children-list space-y-2"
      role="list"
      aria-label="하위 노드 목록"
    >
      <div
        v-for="child in children"
        :key="child.id"
        class="child-item"
        role="listitem"
        tabindex="0"
        :aria-label="`${child.title} 선택`"
        :data-testid="`child-item-${child.id}`"
        @click="handleChildClick(child.id)"
        @keydown.enter="handleChildClick(child.id)"
      >
        <!-- 노드 헤더 -->
        <div class="child-header">
          <!-- 타입 아이콘 + ID + 제목 -->
          <div class="flex items-center gap-2 flex-1">
            <div :class="`node-icon node-icon-${child.type}`">
              {{ getNodeTypeIcon(child.type) }}
            </div>
            <span class="text-sm font-medium text-white truncate">
              {{ child.id }}: {{ child.title }}
            </span>
          </div>

          <!-- 상태 배지 (Task만) -->
          <StatusBadge
            v-if="child.type === 'task' && child.status"
            :status="child.status"
          />
        </div>

        <!-- 노드 정보 (WP/ACT만) -->
        <div
          v-if="child.type !== 'task'"
          class="child-info"
        >
          <div class="flex items-center gap-4 text-xs text-text-secondary">
            <span>
              <i class="pi pi-chart-bar text-xs mr-1"></i>
              진행률: {{ child.progress || 0 }}%
            </span>
            <span>
              <i class="pi pi-list text-xs mr-1"></i>
              Task: {{ child.taskCount || 0 }}개
            </span>
          </div>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * WpActChildren - WP/ACT 하위 노드 목록
 * Task: TSK-05-05
 * 상세설계: 020-detail-design.md 섹션 2.5
 *
 * 책임:
 * - 하위 노드 목록 렌더링
 * - 노드별 상태/진행률 표시
 * - 클릭 시 노드 선택 변경
 */

import Panel from 'primevue/panel'
import Message from 'primevue/message'
import StatusBadge from '~/components/wbs/StatusBadge.vue'
import type { WbsNode, WbsNodeType } from '~/types'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  children?: WbsNode[]  // M-01: Optional to allow defensive validation
}

// M-01: Provide default empty array for defensive programming
const props = withDefaults(defineProps<Props>(), {
  children: () => []
})

const emit = defineEmits<{
  select: [nodeId: string]  // 하위 노드 선택 이벤트
}>()

// ============================================================
// Methods
// ============================================================

/**
 * 하위 노드 클릭 핸들러
 * @param childId - 선택할 하위 노드 ID
 */
function handleChildClick(childId: string): void {
  emit('select', childId)
}

/**
 * 노드 타입별 아이콘 반환
 * @param type - 노드 타입
 */
function getNodeTypeIcon(type: WbsNodeType): string {
  const iconMap: Record<WbsNodeType, string> = {
    project: '🏠',
    wp: '🔷',
    act: '🔶',
    task: '🔸'
  }
  return iconMap[type] || '📄'
}
</script>

<style scoped>
/* WpActChildren 스타일은 main.css에 중앙화됨 */
</style>
