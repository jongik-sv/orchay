<script setup lang="ts">
/**
 * WBS 페이지
 * - 모든 프로젝트 WBS 통합 뷰 (프로젝트 노드가 항상 최상단)
 * - WBS Tree + Task Detail 패널 통합
 *
 * @task TSK-06-01, TSK-09-01
 */

import WbsTreePanel from '~/components/wbs/WbsTreePanel.vue'
import NodeDetailPanel from '~/components/wbs/detail/NodeDetailPanel.vue'
import { decodePathSegment } from '~/utils/urlPath'

// ============================================================
// Page Metadata
// ============================================================
definePageMeta({
  layout: 'default'
})

useHead({
  title: 'WBS - orchay'
})

// ============================================================
// Composables & Stores
// ============================================================
const route = useRoute()
const router = useRouter()
const configStore = useConfigStore()
const projectStore = useProjectStore()
const wbsStore = useWbsStore()
const selectionStore = useSelectionStore()

// ============================================================
// Local State
// ============================================================
const loading = ref(false)
const error = ref<string | null>(null)

/**
 * URL 쿼리에서 projectId 추출 및 형식 검증
 * - 소문자, 숫자, 한글, 하이픈, 언더스코어 허용
 * - 잘못된 형식이면 null 반환
 */
const projectId = computed<string | null>(() => {
  const id = route.query.project
  if (!id || typeof id !== 'string') return null

  // URL 디코딩 (한글, 공백, 괄호 등 특수문자 처리)
  const decodedId = decodePathSegment(id)

  // 형식 검증: 소문자, 숫자, 한글, 하이픈, 언더스코어 허용
  if (!/^[a-z0-9가-힣_-]+$/.test(decodedId)) {
    console.warn(`Invalid projectId format: ${decodedId}`)
    return null
  }

  return decodedId
})

/**
 * 정상 상태 여부 (콘텐츠 표시 가능 여부)
 */
const isContentReady = computed(() => {
  if (loading.value || error.value) return false
  return wbsStore.tree.length > 0
})

// ============================================================
// Lifecycle Hooks
// ============================================================

/**
 * 페이지 초기화
 * - 항상 모든 프로젝트 WBS 로드 (프로젝트 노드가 최상단에 표시)
 * - 첫 번째 Task 자동 선택 및 부모 노드 확장
 */
onMounted(async () => {
  loading.value = true
  error.value = null

  try {
    // Tauri 환경에서는 base path가 설정되어 있어야 WBS 로드 가능
    if (!configStore.initialized) {
      console.log('[WbsPage] Config not initialized, waiting for setup')
      loading.value = false
      return
    }

    // 항상 모든 프로젝트 WBS 로드
    await wbsStore.fetchAllWbs()

    // 첫 번째 Task 자동 선택
    await autoSelectFirstTask()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '프로젝트 목록을 불러오는 데 실패했습니다'
    console.error('Failed to load all projects:', e)
  }

  loading.value = false
})

// configStore.initialized가 변경되면 WBS 로드
watch(
  () => configStore.initialized,
  async (initialized) => {
    if (initialized && wbsStore.tree.length === 0) {
      loading.value = true
      try {
        await wbsStore.fetchAllWbs()
        await autoSelectFirstTask()
      } catch (e) {
        error.value = e instanceof Error ? e.message : '프로젝트 목록을 불러오는 데 실패했습니다'
        console.error('Failed to load all projects:', e)
      }
      loading.value = false
    }
  }
)

/**
 * 첫 번째 Task 자동 선택 및 부모 노드 확장
 */
async function autoSelectFirstTask() {
  // flatNodes에서 첫 번째 Task 찾기
  const firstTask = Array.from(wbsStore.flatNodes.values()).find(n => n.type === 'task')
  if (!firstTask) return

  // 부모 노드들 확장 (트리에서 보이도록)
  const parts = firstTask.id.split(':')
  const nodeId = parts.length > 1 ? parts[1] : firstTask.id
  const idParts = nodeId.split('-')

  if (idParts.length >= 2) {
    // 프로젝트 노드 확장
    const projectId = parts.length > 1 ? parts[0] : null
    if (projectId) {
      wbsStore.expandedNodes.add(projectId)
    }

    // WP 확장
    const wpId = projectId ? `${projectId}:WP-${idParts[1]}` : `WP-${idParts[1]}`
    wbsStore.expandedNodes.add(wpId)

    // ACT 확장 (4단계 구조일 경우)
    if (idParts.length >= 3) {
      const actId = projectId ? `${projectId}:ACT-${idParts[1]}-${idParts[2]}` : `ACT-${idParts[1]}-${idParts[2]}`
      wbsStore.expandedNodes.add(actId)
    }
  }

  // 첫 번째 Task 선택
  await selectionStore.selectNode(firstTask.id)
}

/**
 * 페이지 언마운트 시 상태 초기화
 */
onUnmounted(() => {
  wbsStore.clearWbs()
  selectionStore.clearSelection()
  // projectStore.clearProject() // 선택적: 프로젝트 정보는 유지할 수도 있음
})

// ============================================================
// Watch (스토어 간 반응형 연동)
// ============================================================

/**
 * 선택된 노드 ID 변화 감지 → Task 상세 로드
 * 가드 조건:
 * - 동일 노드 ID면 skip
 * - Task 타입이 아니면 상세 로드 skip
 */
watch(
  () => selectionStore.selectedNodeId,
  (newId, oldId) => {
    // 가드: 동일 노드 ID
    if (newId === oldId) return

    // Task 타입이 아니면 상세 초기화
    if (!newId || !newId.toUpperCase().startsWith('TSK-')) {
      // selectionStore 내부에서 처리됨
      return
    }

    // Task 상세 로드는 selectionStore.selectNode에서 자동 처리됨
  }
)

// ============================================================
// Event Handlers
// ============================================================

/**
 * WbsTreePanel 노드 선택 이벤트
 */
function handleNodeSelected(nodeId: string) {
  selectionStore.selectNode(nodeId)
}

/**
 * 재시도 버튼 클릭
 */
async function handleRetry() {
  loading.value = true
  error.value = null

  try {
    await wbsStore.fetchAllWbs()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '프로젝트 목록을 불러오는 데 실패했습니다'
  }

  loading.value = false
}

/**
 * 대시보드로 이동
 */
function goToDashboard() {
  router.push('/')
}
</script>

<template>
  <LayoutAppLayout aria-label="WBS 페이지">
    <!-- Header Slot: AppHeader 컴포넌트 -->
    <template #header>
      <LayoutAppHeader :project-name="projectStore.projectName || ''" />
    </template>

    <!-- Left Panel Slot -->
    <template #left>
      <!-- 1. 로딩 중 -->
      <div
        v-if="loading"
        class="flex items-center justify-center h-full"
        data-testid="loading-spinner"
      >
        <div class="text-center">
          <ProgressSpinner
            stroke-width="4"
            animation-duration="1s"
            aria-label="로딩 중"
          />
          <p class="mt-4 text-text-secondary">로딩 중입니다...</p>
        </div>
      </div>

      <!-- 2. 에러 상태 -->
      <div
        v-else-if="error"
        class="flex items-center justify-center h-full p-8"
        data-testid="error-message"
      >
        <div class="text-center max-w-md">
          <Message severity="error" :closable="false">
            {{ error }}
          </Message>
          <Button
            label="재시도"
            icon="pi pi-refresh"
            severity="secondary"
            class="mt-4"
            data-testid="retry-button"
            @click="handleRetry"
          />
        </div>
      </div>

      <!-- 3. 정상 상태: WBS 트리 패널 (단일 또는 다중 프로젝트 모드) -->
      <div
        v-else-if="isContentReady"
        class="h-full"
        data-testid="wbs-content"
      >
        <WbsTreePanel
          aria-label="WBS 트리 패널"
          :aria-busy="wbsStore.loading ? 'true' : 'false'"
          @node-selected="handleNodeSelected"
        />
      </div>

      <!-- 4. projectId 없음 && 트리 데이터 없음 -->
      <div
        v-else
        class="flex items-center justify-center h-full p-8"
        data-testid="empty-state-no-project"
      >
        <div class="text-center">
          <i class="pi pi-folder text-6xl text-text-muted mb-4"></i>
          <h3 class="text-xl font-semibold text-text mb-2">프로젝트를 선택하세요</h3>
          <p class="text-text-secondary mb-6">
            대시보드에서 프로젝트를 선택하거나 새 프로젝트를 생성하세요.
          </p>
          <Button
            label="대시보드로 이동"
            icon="pi pi-home"
            severity="primary"
            data-testid="dashboard-link"
            @click="goToDashboard"
          />
        </div>
      </div>
    </template>

    <!-- Right Panel Slot -->
    <template #right>
      <div
        class="h-full"
        aria-label="노드 상세 패널"
      >
        <!-- 로딩/에러 상태에서는 빈 상태 표시 -->
        <div
          v-if="loading || error"
          class="flex items-center justify-center h-full p-4"
          data-testid="right-panel-placeholder"
        >
          <div class="text-center text-text-muted">
            <i class="pi pi-info-circle text-2xl mb-2"></i>
            <p class="text-sm">{{ loading ? '로딩 중...' : '프로젝트를 선택하세요' }}</p>
          </div>
        </div>

        <!-- TSK-09-01: 프로젝트 노드 선택 시 ProjectDetailPanel 표시 -->
        <WbsDetailProjectDetailPanel
          v-else-if="selectionStore.selectedNodeType === 'project'"
          :project-id="selectionStore.selectedNodeId!"
          :files="selectionStore.selectedProjectFiles"
        />

        <!-- 노드 상세 정보 표시 (TSK-05-01 ~ TSK-05-05) -->
        <NodeDetailPanel v-else-if="isContentReady" />

        <!-- 미선택 상태 -->
        <div
          v-else
          class="flex items-center justify-center h-full p-4"
          data-testid="right-panel-empty"
        >
          <div class="text-center text-text-muted">
            <i class="pi pi-hand-pointer text-2xl mb-2"></i>
            <p class="text-sm">왼쪽에서 노드를 선택하세요</p>
          </div>
        </div>
      </div>
    </template>
  </LayoutAppLayout>
</template>

<style scoped>
/* WBS 페이지 스타일 */
</style>
