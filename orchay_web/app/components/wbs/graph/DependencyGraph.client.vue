<script setup lang="ts">
/**
 * 의존관계 그래프 캔버스 컴포넌트 (Vue Flow 기반)
 * Task: TSK-06-01
 */

import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { MiniMap } from '@vue-flow/minimap'
import type { GraphData, TaskNode as TaskNodeType, GroupNode as GroupNodeType, TaskEdge } from '~/types/graph'
import { GRAPH_COLORS } from '~/types/graph'
import TaskNode from './TaskNode.vue'
import GroupNode from './GroupNode.vue'

// Props
interface Props {
  graphData: GraphData
  height?: string
}

const props = withDefaults(defineProps<Props>(), {
  height: '100%'
})

// Emits
const emit = defineEmits<{
  nodeClick: [{ nodeId: string }]
  nodeDoubleClick: [{ nodeId: string }]
  groupToggle: [{ groupId: string }]  // TSK-06-03
}>()

// Vue Flow 인스턴스
const {
  fitView,
  zoomIn: vfZoomIn,
  zoomOut: vfZoomOut,
  setCenter,
  getNode
} = useVueFlow()

// 로컬 상태
const nodes = ref<TaskNodeType[]>([])
const edges = ref<TaskEdge[]>([])
const selectedNodeId = ref<string | null>(null)
const highlightedNodes = ref<Map<string, 'selected' | 'dependsOn' | 'dependedBy' | 'dimmed'>>(new Map())

// Props 변경 감지
watch(() => props.graphData, (newData) => {
  nodes.value = [...newData.nodes]
  edges.value = [...newData.edges]
  clearHighlight()
}, { immediate: true, deep: true })

// 노드 클릭 핸들러
function onNodeClick({ node }: { node: TaskNodeType }) {
  highlightConnections(node.id)
  emit('nodeClick', { nodeId: node.id })
}

// 노드 더블클릭 핸들러
function onNodeDoubleClick({ node }: { node: TaskNodeType }) {
  emit('nodeDoubleClick', { nodeId: node.id })
}

// 빈 공간 클릭 시 하이라이트 해제
function onPaneClick() {
  clearHighlight()
}

// TSK-06-03: 그룹 노드 토글 핸들러
function onGroupToggle(groupId: string) {
  emit('groupToggle', { groupId })
}

// 연결된 노드/엣지 하이라이트
function highlightConnections(nodeId: string) {
  clearHighlight()
  selectedNodeId.value = nodeId

  const newHighlights = new Map<string, 'selected' | 'dependsOn' | 'dependedBy' | 'dimmed'>()

  // 연결 관계 분석
  const dependsOnNodes = new Set<string>()
  const dependedByNodes = new Set<string>()

  edges.value.forEach(edge => {
    if (edge.source === nodeId) {
      dependedByNodes.add(edge.target)
    } else if (edge.target === nodeId) {
      dependsOnNodes.add(edge.source)
    }
  })

  // 하이라이트 설정
  nodes.value.forEach(node => {
    if (node.id === nodeId) {
      newHighlights.set(node.id, 'selected')
    } else if (dependsOnNodes.has(node.id)) {
      newHighlights.set(node.id, 'dependsOn')
    } else if (dependedByNodes.has(node.id)) {
      newHighlights.set(node.id, 'dependedBy')
    } else {
      newHighlights.set(node.id, 'dimmed')
    }
  })

  highlightedNodes.value = newHighlights

  // 엣지 스타일 업데이트
  edges.value = edges.value.map(edge => {
    const isConnected = edge.source === nodeId || edge.target === nodeId
    return {
      ...edge,
      class: isConnected ? 'edge-highlighted' : 'edge-dimmed',
      animated: isConnected
    }
  })
}

// 하이라이트 해제
function clearHighlight() {
  if (!selectedNodeId.value) return

  selectedNodeId.value = null
  highlightedNodes.value = new Map()

  // 엣지 스타일 복원
  edges.value = edges.value.map(edge => ({
    ...edge,
    class: 'edge-default',
    animated: false
  }))
}

// 노드의 하이라이트 타입 반환
function getHighlightType(nodeId: string) {
  return highlightedNodes.value.get(nodeId) || null
}

// 미니맵 노드 색상
function minimapNodeColor(node: TaskNodeType) {
  const category = node.data?.category as keyof typeof GRAPH_COLORS
  return GRAPH_COLORS[category]?.background || '#3b82f6'
}

// Exposed methods
function fit() {
  fitView({ padding: 0.2 })
}

function zoomIn() {
  vfZoomIn()
}

function zoomOut() {
  vfZoomOut()
}

function resetZoom() {
  fit()
}

function focusNode(nodeId: string) {
  const node = getNode(nodeId)
  if (node) {
    setCenter(node.position.x + 100, node.position.y + 50, { zoom: 1.5, duration: 500 })
  }
}

function selectNode(nodeId: string) {
  highlightConnections(nodeId)
}

defineExpose({
  fit,
  zoomIn,
  zoomOut,
  resetZoom,
  focusNode,
  selectNode
})
</script>

<template>
  <div class="dependency-graph" :style="{ height }">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :default-edge-options="{ type: 'smoothstep' }"
      :fit-view-on-init="true"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :elements-selectable="true"
      class="vue-flow-container"
      @node-click="onNodeClick"
      @node-double-click="onNodeDoubleClick"
      @pane-click="onPaneClick"
    >
      <!-- 커스텀 노드 -->
      <template #node-task="nodeProps">
        <TaskNode
          :id="nodeProps.id"
          :data="nodeProps.data"
          :selected="nodeProps.selected"
          :highlight-type="getHighlightType(nodeProps.id)"
        />
      </template>

      <!-- TSK-06-03: 그룹 노드 -->
      <template #node-group="nodeProps">
        <GroupNode
          :id="nodeProps.id"
          :data="nodeProps.data"
          :selected="nodeProps.selected"
          @toggle="onGroupToggle"
        />
      </template>

      <!-- 배경 그리드 -->
      <Background
        :gap="20"
        :size="1"
        pattern-color="#374151"
      />

      <!-- 컨트롤 버튼 -->
      <Controls position="top-right" />

      <!-- 미니맵 -->
      <MiniMap
        position="bottom-right"
        :node-color="minimapNodeColor"
        :node-stroke-width="3"
        pannable
        zoomable
      />
    </VueFlow>
  </div>
</template>

<style>
/* Vue Flow 기본 스타일 */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/controls/dist/style.css';
@import '@vue-flow/minimap/dist/style.css';

.dependency-graph {
  width: 100%;
  background-color: var(--surface-ground);
  border-radius: 6px;
  overflow: hidden;
}

.vue-flow-container {
  width: 100%;
  height: 100%;
}

/* Vue Flow 테마 오버라이드 */
.vue-flow {
  --vf-node-bg: transparent;
  --vf-node-text: #e5e7eb;
  --vf-handle: #6c9bcf;
  --vf-box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.vue-flow__edge-path {
  stroke: #93c5fd;
  stroke-width: 2;
}

.vue-flow__edge.selected .vue-flow__edge-path {
  stroke: #fbbf24;
  stroke-width: 3;
}

.vue-flow__controls {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.vue-flow__controls-button {
  background: var(--surface-card);
  border: none;
  color: var(--text-color);
}

.vue-flow__controls-button:hover {
  background: var(--surface-hover);
}

.vue-flow__minimap {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
}

.vue-flow__background {
  background-color: var(--surface-ground);
}
</style>
