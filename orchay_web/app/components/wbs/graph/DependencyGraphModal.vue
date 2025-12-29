<script setup lang="ts">
/**
 * 의존관계 그래프 모달 컴포넌트
 * Task: TSK-06-01
 *
 * PrimeVue Dialog 기반 전체화면 모달
 */

import type { GraphFilter } from '~/types/graph'
import { useDebounceFn } from '@vueuse/core'

// 클라이언트 전용 컴포넌트 동적 import
const DependencyGraph = defineAsyncComponent(() =>
  import('./DependencyGraph.client.vue')
)
const GraphLegend = defineAsyncComponent(() =>
  import('./GraphLegend.vue')
)
const GraphFilterPanel = defineAsyncComponent(() =>
  import('./GraphFilterPanel.vue')
)

// Props
const visible = defineModel<boolean>('visible', { required: true })

// Emits
const emit = defineEmits<{
  taskSelect: [taskId: string]
}>()

// Composables
const { buildGraphData, getGraphStats } = useDependencyGraph()
const { encodeFilterToURL, parseURLParams } = useGraphFilter()
const { groupExpandedStates, toggleGroup, isGroupExpanded, resetGroupStates } = useGroupNodes()
const selectionStore = useSelectionStore()
const route = useRoute()
const router = useRouter()

// Refs
const graphRef = ref<{ fit: () => void; zoomIn: () => void; zoomOut: () => void; resetZoom: () => void } | null>(null)

// TSK-06-03: 확장된 필터 상태
const selectedCategories = ref<string[]>([])
const selectedStatuses = ref<string[]>([])
const hierarchyMode = ref<'full' | 'wp' | 'act'>('full')
const focusTask = ref<string | null>(null)
const focusDepth = ref<number>(2)
const isLoading = ref(true)

// TSK-06-03: computed with extended filter
const currentFilter = computed<GraphFilter>(() => ({
  categories: selectedCategories.value,
  statuses: selectedStatuses.value,
  hierarchyMode: hierarchyMode.value,
  focusTask: focusTask.value,
  focusDepth: focusDepth.value
}))

const graphData = computed(() => {
  // 필터가 비어있으면 undefined 전달 (전체 표시)
  const hasFilter =
    selectedCategories.value.length > 0 ||
    selectedStatuses.value.length > 0 ||
    hierarchyMode.value !== 'full' ||
    focusTask.value !== null

  // groupStates는 계층 모드일 때만 전달
  const states = (hierarchyMode.value === 'wp' || hierarchyMode.value === 'act')
    ? groupExpandedStates.value
    : undefined

  return buildGraphData(hasFilter ? currentFilter.value : undefined, states)
})

const stats = computed(() => ({
  nodeCount: graphData.value.nodes.length,
  edgeCount: graphData.value.edges.length
}))

// Methods
function handleNodeClick(event: { nodeId: string }) {
  selectionStore.selectNode(event.nodeId)
  emit('taskSelect', event.nodeId)
}

function handleNodeDoubleClick(event: { nodeId: string }) {
  selectionStore.selectNode(event.nodeId)
  emit('taskSelect', event.nodeId)
  visible.value = false
}

// TSK-06-03: 그룹 노드 토글 핸들러
function handleGroupToggle(event: { groupId: string }) {
  toggleGroup(event.groupId)
}

// TSK-06-03: URL 동기화 (debounce 300ms)
const updateURL = useDebounceFn(() => {
  const queryString = encodeFilterToURL(currentFilter.value)
  const newQuery = Object.fromEntries(new URLSearchParams(queryString))

  router.replace({ query: newQuery })
}, 300)

// URL 파라미터 복원 (모달 열림 시)
function restoreFiltersFromURL() {
  const searchParams = new URLSearchParams(route.query as Record<string, string>)
  const filter = parseURLParams(searchParams)

  selectedCategories.value = filter.categories
  selectedStatuses.value = filter.statuses
  hierarchyMode.value = filter.hierarchyMode
  focusTask.value = filter.focusTask
  focusDepth.value = filter.focusDepth
}

function resetFilters() {
  selectedCategories.value = []
  selectedStatuses.value = []
  hierarchyMode.value = 'full'
  focusTask.value = null
  focusDepth.value = 2
  resetGroupStates()  // 그룹 상태도 초기화
}

function handleApplyFocus() {
  // 초점 뷰 적용 (필터 상태가 이미 반영되어 있으므로 별도 작업 불필요)
  // graphData computed가 자동으로 재계산됨
  nextTick(() => {
    graphRef.value?.fit()
  })
}

function zoomIn() {
  graphRef.value?.zoomIn()
}

function zoomOut() {
  graphRef.value?.zoomOut()
}

function resetZoom() {
  graphRef.value?.resetZoom()
}

// TSK-06-03: 필터 변경 감지 → URL 업데이트
watch(
  [selectedCategories, selectedStatuses, hierarchyMode, focusTask, focusDepth],
  () => {
    updateURL()
  }
)

// Watch modal open to reset loading state
watch(visible, (newVal) => {
  if (newVal) {
    isLoading.value = true

    // URL 파라미터 복원
    restoreFiltersFromURL()

    // 모달이 열릴 때 잠시 후 fit 호출
    nextTick(() => {
      setTimeout(() => {
        graphRef.value?.fit()
      }, 100)
    })
  }
})

// Graph data watch 최적화 (deep 제거)
// graphData는 computed이므로 참조가 변경되면 자동으로 트리거됨
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    maximizable
    :style="{ width: '90vw', height: '85vh' }"
    header="의존관계 그래프"
    :pt="{
      content: { style: 'height: calc(100% - 60px); display: flex; flex-direction: column;' }
    }"
  >
    <!-- TSK-06-03: 필터 패널 -->
    <GraphFilterPanel
      :categories="selectedCategories"
      :statuses="selectedStatuses"
      :hierarchyMode="hierarchyMode"
      :focusTask="focusTask"
      :focusDepth="focusDepth"
      :stats="stats"
      @update:categories="selectedCategories = $event"
      @update:statuses="selectedStatuses = $event"
      @update:hierarchyMode="hierarchyMode = $event"
      @update:focusTask="focusTask = $event"
      @update:focusDepth="focusDepth = $event"
      @reset="resetFilters"
      @applyFocus="handleApplyFocus"
    />

    <!-- 툴바 (줌 컨트롤만 남김) -->
    <div class="graph-toolbar">
      <!-- 줌 컨트롤 -->
      <div class="zoom-group ml-auto">
        <Button
          icon="pi pi-search-plus"
          severity="secondary"
          text
          rounded
          size="small"
          v-tooltip.top="'확대'"
          @click="zoomIn"
        />
        <Button
          icon="pi pi-search-minus"
          severity="secondary"
          text
          rounded
          size="small"
          v-tooltip.top="'축소'"
          @click="zoomOut"
        />
        <Button
          icon="pi pi-expand"
          severity="secondary"
          text
          rounded
          size="small"
          v-tooltip.top="'전체 보기'"
          @click="resetZoom"
        />
      </div>
    </div>

    <!-- 그래프 영역 -->
    <div class="graph-area">
      <ClientOnly>
        <DependencyGraph
          ref="graphRef"
          :graph-data="graphData"
          height="100%"
          @node-click="handleNodeClick"
          @node-double-click="handleNodeDoubleClick"
          @group-toggle="handleGroupToggle"
        />

        <template #fallback>
          <div class="loading-fallback">
            <ProgressSpinner
              style="width: 50px; height: 50px;"
              stroke-width="4"
            />
            <span>그래프 로딩 중...</span>
          </div>
        </template>
      </ClientOnly>
    </div>

    <!-- 범례 -->
    <div class="graph-footer">
      <GraphLegend />
    </div>
  </Dialog>
</template>

<style scoped>
.graph-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--surface-border);
  margin-bottom: 0.75rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.filter-select {
  min-width: 140px;
}

.stats-group {
  display: flex;
  gap: 0.5rem;
}

.zoom-group {
  display: flex;
  gap: 0.25rem;
}

.graph-area {
  flex: 1;
  min-height: 400px;
  height: calc(85vh - 250px);
  position: relative;
  border-radius: 6px;
  overflow: hidden;
}

.loading-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 1rem;
  color: var(--text-color-secondary);
}

.graph-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--surface-border);
  margin-top: 0.75rem;
}
</style>
