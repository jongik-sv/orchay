<template>
  <!-- 문서 뷰어 다이얼로그 (통합 FileViewer 사용) -->
  <WbsDetailFileViewer
    v-if="currentDocument && selectedTask"
    :file="currentDocument"
    :visible="documentViewerVisible"
    :task-id="selectedTask.id"
    :project-id="selectedProjectId"
    @update:visible="documentViewerVisible = $event"
    @loaded="handleDocumentLoaded"
    @error="handleDocumentError"
  />

  <Card
    class="task-detail-panel h-full"
    data-testid="task-detail-panel"
    role="region"
    aria-label="Task 상세 정보"
  >
    <!-- 로딩 상태 -->
    <template v-if="loadingTask" #content>
      <div data-testid="task-detail-skeleton" aria-busy="true" aria-live="polite">
        <Skeleton height="2rem" class="mb-4" />
        <Skeleton height="1.5rem" class="mb-2" />
        <Skeleton height="1.5rem" class="mb-2" />
        <Skeleton height="1.5rem" class="mb-4" />
        <Skeleton height="8rem" />
      </div>
    </template>

    <!-- 에러 상태 -->
    <template v-else-if="error" #content>
      <Message
        severity="error"
        data-testid="error-message"
        role="alert"
        aria-live="assertive"
      >
        Task 정보를 불러오는 데 실패했습니다.
      </Message>
      <div class="mt-4">
        <Button
          label="다시 시도"
          icon="pi pi-refresh"
          data-testid="error-retry-btn"
          @click="handleRetry"
        />
      </div>
    </template>

    <!-- 빈 상태 -->
    <template v-else-if="!selectedTask" #content>
      <Message
        severity="info"
        data-testid="empty-state-message"
      >
        왼쪽에서 Task를 선택하세요
      </Message>
    </template>

    <!-- 정상 상태 -->
    <template v-else #content>
      <div class="task-detail-content overflow-y-auto space-y-4">
        <!-- 기본 정보 (TSK-05-01) -->
        <WbsDetailTaskBasicInfo
          :task="selectedTask"
          :updating="isUpdating"
          @update:title="handleUpdateTitle"
          @update:priority="handleUpdatePriority"
          @update:assignee="handleUpdateAssignee"
          @update:schedule="handleUpdateSchedule"
          @transition-completed="handleTransitionCompleted"
        />

        <!-- 진행 상태 (TSK-05-01) -->
        <WbsDetailTaskProgress :task="selectedTask" />

        <!-- 요구사항 (TSK-05-02) -->
        <WbsDetailTaskRequirements
          :task="selectedTask"
          @update:requirements="handleUpdateRequirements"
          @update:acceptance="handleUpdateAcceptance"
          @update:techSpec="handleUpdateTechSpec"
          @update:apiSpec="handleUpdateApiSpec"
          @update:uiSpec="handleUpdateUiSpec"
          @update:prdRef="handleUpdatePrdRef"
        />

        <!-- 관련 문서 (TSK-05-02) -->
        <WbsDetailTaskDocuments
          :documents="selectedTask.documents"
          @open-document="handleOpenDocument"
        />
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
/**
 * TaskDetailPanel - Task 상세 정보 컨테이너 컴포넌트
 * Task: TSK-05-01, TSK-05-02
 * 상세설계: 020-detail-design.md 섹션 9.3
 *
 * 책임:
 * - Pinia useSelectionStore 구독
 * - 로딩/에러/빈 상태 분기 처리
 * - 인라인 편집 이벤트 핸들링 및 API 호출
 * - 낙관적 업데이트 및 롤백 로직
 * - TSK-05-02: 4개 섹션 컴포넌트 통합 및 이벤트 핸들링
 */

import { storeToRefs } from 'pinia'
import { useToast } from 'primevue/usetoast'
import type { Priority, DocumentInfo, TeamMember } from '~/types/index'

// ============================================================
// Stores & Composables
// ============================================================
const selectionStore = useSelectionStore()
const projectStore = useProjectStore()
const { selectedTask, selectedProjectId, loadingTask, error } = storeToRefs(selectionStore)
const toast = useToast()
const notification = useNotification()

// ============================================================
// State
// ============================================================
/**
 * 필드별 업데이트 상태 추적 (P1-02: 동시성 제어 개선)
 * 여러 필드를 동시에 수정할 때 race condition 방지
 */
const updatingFields = reactive<Record<string, boolean>>({})
const isUpdating = computed(() => Object.values(updatingFields).some(v => v))
const teamMembers = ref<TeamMember[]>([])

/**
 * TSK-05-04: Document Viewer 상태
 */
const documentViewerVisible = ref(false)
const currentDocument = ref<DocumentInfo | null>(null)

// ============================================================
// Lifecycle
// ============================================================
onMounted(async () => {
  // 팀원 목록 로드
  try {
    const currentProject = projectStore.currentProject
    if (currentProject?.id) {
      const response = await $fetch<{ team: TeamMember[] }>(`/api/projects/${currentProject.id}`)
      teamMembers.value = response.team || []
    }
  } catch (e) {
    console.warn('팀원 목록 로드 실패:', e)
  }
})

// ============================================================
// Error Messages
// ============================================================
const ERROR_MESSAGES = {
  TITLE_LENGTH: 'Task 제목은 1자 이상 200자 이하여야 합니다.',
  INVALID_PRIORITY: '올바른 우선순위를 선택해주세요.',
  ASSIGNEE_NOT_FOUND: '선택한 팀원이 프로젝트에 없습니다. 팀원 목록을 확인해주세요.',
  UPDATE_FAILED: '변경사항을 저장하는 중 오류가 발생했습니다. 다시 시도해주세요.',
  NETWORK_ERROR: '네트워크 연결을 확인해주세요.',
  REQUIREMENTS_UPDATE_FAILED: '요구사항 저장에 실패했습니다.',
  FIELD_ALREADY_UPDATING: '이전 변경사항이 처리 중입니다. 잠시 후 다시 시도하세요.',
} as const

// ============================================================
// Helper Functions (P1-03: 타입 안전성 향상)
// ============================================================

/**
 * Task 필드를 타입 안전하게 업데이트
 * @param task - 업데이트할 Task 객체
 * @param field - 업데이트할 필드명
 * @param value - 새 값
 */
function updateTaskField<T extends Record<string, unknown>, K extends keyof T>(
  task: T,
  field: K,
  value: T[K]
): void {
  task[field] = value
}

// ============================================================
// Methods
// ============================================================

/**
 * 공통 Task 업데이트 핸들러 (P1-01, P1-02, P1-03 리팩토링)
 * - P1-01: 중복 코드 제거 - 모든 업데이트 메서드가 이 함수 사용
 * - P1-02: 필드별 동시성 제어 - 여러 필드 동시 편집 가능
 * - P1-03: 타입 안전성 - updateTaskField 헬퍼 사용
 *
 * @param field - 업데이트할 필드명
 * @param newValue - 새 값
 * @param apiBody - API에 전송할 body
 * @param successMessage - 성공 시 표시할 메시지
 * @param validation - 선택적 검증 함수
 */
async function handleUpdate<K extends keyof NonNullable<typeof selectedTask.value>>(
  field: K,
  newValue: NonNullable<typeof selectedTask.value>[K],
  apiBody: Record<string, unknown>,
  successMessage: string,
  validation?: () => string | null
): Promise<void> {
  if (!selectedTask.value) return

  const fieldKey = String(field)

  // P1-02: 필드별 동시성 제어
  if (updatingFields[fieldKey]) {
    toast.add({
      severity: 'warn',
      summary: '처리 중',
      detail: ERROR_MESSAGES.FIELD_ALREADY_UPDATING,
      life: 2000,
    })
    return
  }

  // 클라이언트 검증
  if (validation) {
    const validationError = validation()
    if (validationError) {
      toast.add({
        severity: 'error',
        summary: '유효성 검증 실패',
        detail: validationError,
        life: 3000,
      })
      return
    }
  }

  updatingFields[fieldKey] = true
  const prevValue = selectedTask.value[field] // 백업

  try {
    // P1-03: 타입 안전한 낙관적 업데이트 (FR-008)
    updateTaskField(selectedTask.value, field, newValue)

    // API 호출 (프로젝트 ID 포함)
    const projectParam = selectedProjectId.value ? `?project=${encodeURIComponent(selectedProjectId.value)}` : ''
    const response = await $fetch<{ success: boolean; task: typeof selectedTask.value }>(
      `/api/tasks/${selectedTask.value.id}${projectParam}`,
      {
        method: 'PUT',
        body: apiBody,
      }
    )

    if (response.success) {
      await selectionStore.refreshTaskDetail()
      toast.add({
        severity: 'success',
        summary: '저장 완료',
        detail: successMessage,
        life: 2000,
      })
    }
  } catch (e) {
    // P1-03: 타입 안전한 롤백 (BR-004)
    if (selectedTask.value) {
      updateTaskField(selectedTask.value, field, prevValue)
    }

    const errorMessage = e instanceof Error ? e.message : ERROR_MESSAGES.UPDATE_FAILED
    toast.add({
      severity: 'error',
      summary: '저장 실패',
      detail: errorMessage,
      life: 3000,
    })
  } finally {
    updatingFields[fieldKey] = false
  }
}

/**
 * 제목 수정 핸들러
 * FR-003, BR-001, BR-004, FR-008
 */
function handleUpdateTitle(newTitle: string) {
  handleUpdate(
    'title',
    newTitle,
    { title: newTitle },
    '제목이 변경되었습니다.',
    () => {
      if (newTitle.length < 1 || newTitle.length > 200) {
        return ERROR_MESSAGES.TITLE_LENGTH
      }
      return null
    }
  )
}

/**
 * 우선순위 수정 핸들러
 * FR-004, BR-002, BR-004, FR-008
 */
function handleUpdatePriority(newPriority: Priority) {
  handleUpdate(
    'priority',
    newPriority,
    { priority: newPriority },
    '우선순위가 변경되었습니다.'
  )
}

/**
 * 담당자 수정 핸들러
 * FR-005, BR-003, BR-004, FR-008
 */
function handleUpdateAssignee(assigneeId: string | null) {
  handleUpdate(
    'assignee',
    assigneeId === null ? undefined : selectedTask.value?.assignee,
    { assignee: assigneeId },
    '담당자가 변경되었습니다.'
  )
}

/**
 * 일정 수정 핸들러
 */
function handleUpdateSchedule(schedule: { start: string; end: string }) {
  handleUpdate(
    'schedule',
    schedule,
    { schedule },
    '일정이 변경되었습니다.'
  )
}

/**
 * 재시도 핸들러 (에러 상태)
 */
function handleRetry() {
  if (selectionStore.selectedNodeId) {
    selectionStore.loadTaskDetail(selectionStore.selectedNodeId)
  }
}

/**
 * 요구사항 수정 핸들러 (TSK-05-02)
 * FR-006
 * P1-01: 공통 handleUpdate 메서드 사용으로 중복 코드 제거
 */
function handleUpdateRequirements(requirements: string[]) {
  handleUpdate(
    'requirements',
    requirements,
    { requirements },
    '요구사항이 업데이트되었습니다.'
  )
}

/**
 * acceptance 수정 핸들러
 */
function handleUpdateAcceptance(acceptance: string[]) {
  handleUpdate(
    'acceptance',
    acceptance,
    { acceptance },
    '인수 조건이 업데이트되었습니다.'
  )
}

/**
 * techSpec 수정 핸들러
 */
function handleUpdateTechSpec(techSpec: string[]) {
  handleUpdate(
    'techSpec',
    techSpec,
    { techSpec },
    '기술 스펙이 업데이트되었습니다.'
  )
}

/**
 * apiSpec 수정 핸들러
 */
function handleUpdateApiSpec(apiSpec: string[]) {
  handleUpdate(
    'apiSpec',
    apiSpec,
    { apiSpec },
    'API 스펙이 업데이트되었습니다.'
  )
}

/**
 * uiSpec 수정 핸들러
 */
function handleUpdateUiSpec(uiSpec: string[]) {
  handleUpdate(
    'uiSpec',
    uiSpec,
    { uiSpec },
    'UI 스펙이 업데이트되었습니다.'
  )
}

/**
 * prdRef 수정 핸들러
 */
function handleUpdatePrdRef(prdRef: string) {
  handleUpdate(
    'prdRef',
    prdRef,
    { prdRef },
    'PRD 참조가 업데이트되었습니다.'
  )
}

/**
 * 문서 열기 핸들러 (TSK-05-04)
 * FR-009
 * Document Viewer 다이얼로그 열기
 */
function handleOpenDocument(doc: DocumentInfo) {
  currentDocument.value = doc
  documentViewerVisible.value = true
}

/**
 * 문서 로드 완료 핸들러 (TSK-05-04)
 */
function handleDocumentLoaded(_content: string) {
  // 문서 로드 완료 (필요 시 추가 처리)
}

/**
 * 문서 로드 에러 핸들러 (TSK-05-04)
 */
function handleDocumentError(error: Error) {
  toast.add({
    severity: 'error',
    summary: '문서 로드 실패',
    detail: error.message,
    life: 5000
  })
}

// ============================================================
// TSK-05-03: TaskActions 이벤트 핸들러
// ============================================================

/**
 * Task 업데이트 완료 핸들러
 */
function handleTaskUpdated() {
  // Task 업데이트 완료 (필요 시 상위 컴포넌트 알림)
}

/**
 * 상태 전이 완료 핸들러
 */
function handleTransitionCompleted(_command: string) {
  // 상태 전이 완료 (필요 시 상위 컴포넌트 알림)
}

/**
 * 문서 목록 열기 핸들러
 * TaskDocuments 섹션으로 스크롤
 */
function handleOpenDocuments() {
  const docsPanel = document.querySelector('[data-testid="task-documents-panel"]')
  if (docsPanel) {
    docsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<style scoped>
.task-detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.task-detail-content {
  padding: 1rem;
}
</style>
