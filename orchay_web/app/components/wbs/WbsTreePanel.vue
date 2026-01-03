<script setup lang="ts">
/**
 * WbsTreePanel 컴포넌트
 * PrimeVue Tree 기반 WBS 트리 패널 (TSK-08-01)
 *
 * - PrimeVue Tree 컴포넌트로 마이그레이션
 * - WbsNode[] → TreeNode[] 변환
 * - v-model:expandedKeys 기반 펼침/접힘 상태 동기화
 * - 커스텀 노드 템플릿 (NodeIcon + StatusBadge)
 *
 * @see 020-detail-design.md
 */

import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useWbsStore } from '~/stores/wbs'
import { useSelectionStore } from '~/stores/selection'
import { useRoute } from 'vue-router'
import type { WbsNode } from '~/types'
import type { TreeNode } from 'primevue/treenode'
import Tree from 'primevue/tree'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import Button from 'primevue/button'
import WbsTreeHeader from './WbsTreeHeader.vue'
import NodeIcon from './NodeIcon.vue'
import StatusBadge from './StatusBadge.vue'

const route = useRoute()
const wbsStore = useWbsStore()
const selectionStore = useSelectionStore()

// Route에서 projectId 추출
const projectId = computed(() => route.query.project as string)

// 스토어 상태 구독
const { loading, error, filteredTree, expandedNodes, flatNodes, isMultiProjectMode } = storeToRefs(wbsStore)

// TSK-09-01: 다중 프로젝트 모드 또는 단일 프로젝트 모드에서 데이터 유효 여부
const hasValidData = computed(() => {
  return projectId.value || isMultiProjectMode.value || filteredTree.value.length > 0
})

// 이벤트 정의
const emit = defineEmits<{
  'node-selected': [nodeId: string]
}>()

/**
 * WbsNode[] → PrimeVue TreeNode[] 변환 함수
 * - 상세설계 섹션 6.1 데이터 변환 로직
 * - 순환 참조 감지 추가 (설계리뷰 IMP-01)
 *
 * @param nodes WbsNode 배열
 * @param visited 순환 참조 감지용 Set (설계리뷰 권고사항)
 * @returns TreeNode 배열
 */
function convertToTreeNodes(nodes: WbsNode[], visited = new Set<string>()): TreeNode[] {
  if (!nodes || nodes.length === 0) {
    return []
  }

  return nodes.map(node => {
    // 순환 참조 감지 (설계리뷰 IMP-01)
    if (visited.has(node.id)) {
      console.error(`Circular reference detected: ${node.id}`)
      return {
        key: node.id,
        label: `${node.id}: ${node.title} (순환 참조 오류)`,
        data: { node },
        children: []
      }
    }
    visited.add(node.id)

    const treeNode: TreeNode = {
      key: node.id,
      label: node.title,
      data: { node },
      children: node.children && node.children.length > 0
        ? convertToTreeNodes(node.children, new Set(visited))
        : undefined
    }

    return treeNode
  })
}

/**
 * PrimeVue TreeNode[] (computed)
 * - filteredTree(검색 적용)를 TreeNode 형식으로 변환
 */
const treeNodes = computed<TreeNode[]>(() => {
  return convertToTreeNodes(filteredTree.value)
})

/**
 * PrimeVue expandedKeys (computed - get/set)
 * - wbsStore.expandedNodes (Set<string>) ↔ Record<string, boolean> 변환
 * - 상세설계 섹션 6.2 변환 로직
 */
const expandedKeys = computed({
  get: (): Record<string, boolean> => {
    const keys: Record<string, boolean> = {}
    expandedNodes.value.forEach(nodeId => {
      keys[nodeId] = true
    })
    return keys
  },
  set: (newKeys: Record<string, boolean>) => {
    // Record에서 true인 키만 Set에 추가
    expandedNodes.value.clear()
    Object.entries(newKeys).forEach(([key, value]) => {
      if (value) {
        expandedNodes.value.add(key)
      }
    })
  }
})

/**
 * 노드 펼침/접힘 이벤트 핸들러
 * - PrimeVue Tree의 @node-expand, @node-collapse 이벤트 처리
 * - wbsStore.expandedNodes 동기화
 *
 * PrimeVue Tree의 이벤트 시그니처: (node: TreeNode) => void
 *
 * @param node 확장/축소된 TreeNode
 */
function updateExpandedKeys(node: TreeNode) {
  const nodeKey = node.key as string

  // 현재 상태 확인 후 토글
  if (expandedNodes.value.has(nodeKey)) {
    expandedNodes.value.delete(nodeKey)
  } else {
    expandedNodes.value.add(nodeKey)
  }
}

/**
 * 노드 클릭 핸들러
 * - 커스텀 템플릿 내 @click에서 호출
 * - 'node-selected' 이벤트 발생 (선택만)
 *
 * @param nodeId 클릭한 노드 ID
 */
function handleNodeClick(nodeId: string) {
  emit('node-selected', nodeId)
}

/**
 * 노드 더블클릭 핸들러
 * - 자식이 있는 노드만 펼침/접힘 토글
 *
 * @param nodeId 더블클릭한 노드 ID
 */
function handleNodeDblClick(nodeId: string) {
  const node = flatNodes.value.get(nodeId)
  if (node?.children && node.children.length > 0) {
    if (expandedNodes.value.has(nodeId)) {
      expandedNodes.value.delete(nodeId)
    } else {
      expandedNodes.value.add(nodeId)
    }
  }
}

/**
 * WBS 데이터 로드 함수
 * 에러 발생 시 리트라이 가능하도록 분리
 *
 * 참고: pages/wbs.vue에서 loadProjectAndWbs를 통해 이미 로드됨
 * WbsTreePanel은 데이터가 이미 있으면 다시 로드하지 않음
 * TSK-09-01: 다중 프로젝트 모드에서는 projectId 불필요
 */
async function loadWbs() {
  // 이미 데이터가 있으면 다시 로드하지 않음 (중복 방지)
  if (filteredTree.value && filteredTree.value.length > 0) {
    return
  }

  // 다중 프로젝트 모드에서는 projectId 불필요
  if (isMultiProjectMode.value) {
    return
  }

  // 단일 프로젝트 모드: projectId 필수
  if (!projectId.value) {
    console.error('Project ID is required')
    return
  }

  try {
    await wbsStore.fetchWbs(projectId.value)
  } catch (e) {
    console.error('Failed to load WBS:', e)
  }
}

/**
 * 노드 타입에 따른 텍스트 스타일 클래스 반환
 * TSK-09-01: 프로젝트 타입 추가
 * @param type 노드 타입
 */
function getTitleClass(type: string): string {
  const classMap: Record<string, string> = {
    'project': 'wbs-tree-node-title-project',
    'wp': 'wbs-tree-node-title-wp',
    'act': 'wbs-tree-node-title-act',
    'task': 'wbs-tree-node-title-task'
  }
  return classMap[type] || 'wbs-tree-node-title-wp'
}

// 컴포넌트 마운트 시 WBS 데이터 로드
onMounted(() => {
  loadWbs()
})

// 언마운트 시에는 wbsStore.clearWbs()를 호출하지 않음
// pages/wbs.vue에서 언마운트 시 정리함
</script>

<template>
  <div
    data-testid="wbs-tree-panel"
    class="wbs-tree-panel h-full bg-bg-sidebar flex flex-col overflow-hidden"
    role="region"
    aria-label="WBS Tree Panel"
    :aria-busy="loading"
  >
    <!-- 로딩 상태 -->
    <div
      v-if="loading"
      data-testid="loading-state"
      class="flex items-center justify-center h-full"
    >
      <ProgressSpinner
        style="width: 50px; height: 50px"
        strokeWidth="4"
        fill="transparent"
        animationDuration="1s"
        aria-label="Loading WBS data"
      />
    </div>

    <!-- 에러 상태 -->
    <div
      v-else-if="error"
      data-testid="error-state"
      class="p-4 flex flex-col items-center justify-center h-full"
    >
      <Message
        severity="error"
        :closable="false"
        class="mb-4"
      >
        {{ error }}
      </Message>
      <Button
        data-testid="retry-button"
        label="다시 시도"
        icon="pi pi-refresh"
        severity="secondary"
        outlined
        @click="loadWbs"
        aria-label="WBS 데이터 다시 로드"
      />
    </div>

    <!-- projectId 미존재 && 다중 프로젝트 데이터도 없는 상태 (설계리뷰 IMP-02, TSK-09-01) -->
    <div
      v-else-if="!hasValidData"
      data-testid="no-project-state"
      class="p-4 flex flex-col items-center justify-center h-full"
    >
      <Message
        severity="warn"
        :closable="false"
        class="mb-4"
      >
        프로젝트 ID가 지정되지 않았습니다.
      </Message>
      <Button
        label="프로젝트 목록으로"
        icon="pi pi-arrow-left"
        severity="secondary"
        outlined
        @click="$router.push('/projects')"
        aria-label="프로젝트 목록으로 돌아가기"
      />
    </div>

    <!-- 정상 상태 -->
    <div
      v-else
      data-testid="content-state"
      class="flex flex-col h-full"
    >
      <!-- 헤더 (고정) -->
      <WbsTreeHeader class="flex-shrink-0" />

      <!-- PrimeVue Tree (스크롤) -->
      <div class="flex-1 overflow-y-auto" data-testid="wbs-tree">
        <!-- PrimeVue Tree 컴포넌트 (TSK-08-01) -->
        <Tree
          v-if="treeNodes.length > 0"
          v-model:expandedKeys="expandedKeys"
          :value="treeNodes"
          class="wbs-tree"
          :metaKeySelection="false"
          @node-expand="updateExpandedKeys"
          @node-collapse="updateExpandedKeys"
        >
          <!-- 커스텀 노드 템플릿 -->
          <template #default="slotProps">
            <div
              class="wbs-tree-node-label"
              :class="{
                'selected': selectionStore.selectedNodeId === slotProps.node.key
              }"
              :data-testid="`wbs-tree-node-${slotProps.node.key}`"
              @click="handleNodeClick(slotProps.node.key as string)"
              @dblclick="handleNodeDblClick(slotProps.node.key as string)"
            >
              <!-- NodeIcon 컴포넌트 -->
              <NodeIcon :type="slotProps.node.data.node.type" />

              <!-- 실행 중 스피너 (execution 필드 존재 시) -->
              <i
                v-if="slotProps.node.data.node.type === 'task' && slotProps.node.data.node.execution"
                class="pi pi-spinner pi-spin wbs-execution-spinner"
                :title="`실행 중: ${slotProps.node.data.node.execution}`"
              />

              <!-- 노드 제목 -->
              <span
                class="wbs-tree-node-title"
                :class="getTitleClass(slotProps.node.data.node.type)"
              >
                {{ slotProps.node.key }}: {{ slotProps.node.label }}
              </span>

              <!-- 진행률 표시 (WP/ACT 노드만) -->
              <span
                v-if="slotProps.node.data.node.type === 'wp' || slotProps.node.data.node.type === 'act'"
                class="wbs-tree-node-progress"
              >
                {{ slotProps.node.data.node.progress || 0 }}%
              </span>

              <!-- StatusBadge (Task 노드만) -->
              <StatusBadge
                v-if="slotProps.node.data.node.type === 'task'"
                :status="slotProps.node.data.node.status || '[ ]'"
                class="ml-auto"
              />
            </div>
          </template>
        </Tree>

        <!-- 빈 상태 -->
        <div
          v-else
          data-testid="empty-state-no-wbs"
          class="flex flex-col items-center justify-center h-full text-text-secondary"
        >
          <i class="pi pi-inbox text-4xl mb-4 opacity-50"></i>
          <p>WBS 데이터가 없습니다.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PrimeVue Tree 커스터마이징 */
:deep(.p-tree) {
  background: transparent;
  border: none;
  padding: 0;
}

:deep(.p-treenode-content) {
  padding: 0 !important;
  border-radius: 0 !important;
  transition: background-color 0.2s;
}

:deep(.p-treenode-content:hover) {
  background-color: rgba(255, 255, 255, 0.05);
}

/* 노드 라벨 컨테이너 */
.wbs-tree-node-label {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 12px;
  gap: 8px;
  cursor: pointer;
  min-height: 40px;
  border-left: 4px solid transparent; /* 선택바 공간 확보 */
}

/* 선택된 상태 스타일 (WbsTreeNode.vue와 일치) */
.wbs-tree-node-label.selected {
  background-color: rgba(59, 130, 246, 0.3); /* blue-500/30 */
  border-left-color: #3b82f6; /* blue-500 */
  box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.5);
}

.wbs-tree-node-label.selected .wbs-tree-node-title {
  color: #60a5fa; /* blue-400 */
  font-weight: 600;
}

.wbs-tree-node-title {
  font-size: 14px;
  font-weight: 500;
  color: #e5e7eb; /* gray-200 */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* 노드 타입별 타이틀 색상 (선택 안되었을 때) */
.wbs-tree-node-title-project { color: #fcd34d; } /* amber-300 */
.wbs-tree-node-title-wp { color: #93c5fd; } /* blue-300 */
.wbs-tree-node-title-act { color: #c4b5fd; } /* violet-300 */
.wbs-tree-node-title-task { color: #e5e7eb; } /* gray-200 */

.wbs-tree-node-progress {
  font-size: 12px;
  color: #9ca3af;
  margin-left: 8px;
}

/* 실행 중 스피너 스타일 */
.wbs-execution-spinner {
  color: #fbbf24; /* amber-400 */
  font-size: 14px;
  flex-shrink: 0;
}
</style>
