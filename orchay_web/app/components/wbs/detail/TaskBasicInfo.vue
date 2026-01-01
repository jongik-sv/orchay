<template>
  <Panel data-testid="task-basic-info-panel" class="task-basic-info">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <span class="font-semibold">기본 정보</span>
        <div class="flex items-center gap-1">
          <Button
            icon="pi pi-chevron-up"
            text
            rounded
            size="small"
            severity="secondary"
            :disabled="!hasPrevTask"
            data-testid="task-nav-prev-btn"
            aria-label="이전 Task"
            v-tooltip.top="'이전 Task (↑)'"
            @click="handlePrevTask"
          />
          <span class="text-xs text-text-muted px-1">
            {{ currentTaskIndex + 1 }}/{{ totalTasks }}
          </span>
          <Button
            icon="pi pi-chevron-down"
            text
            rounded
            size="small"
            severity="secondary"
            :disabled="!hasNextTask"
            data-testid="task-nav-next-btn"
            aria-label="다음 Task"
            v-tooltip.top="'다음 Task (↓)'"
            @click="handleNextTask"
          />
        </div>
      </div>
    </template>
    <div class="space-y-3">
      <!-- Task ID (카테고리 + ID) -->
      <div class="field-row">
        <label class="field-label">Task ID</label>
        <div class="field-value flex items-center gap-2">
          <Badge
            v-if="projectId"
            :value="projectId"
            severity="secondary"
            class="text-sm"
            data-testid="task-project-badge"
          />
          <Tag
            :value="categoryLabel"
            :class="categoryClass"
            data-testid="task-category-tag"
          />
          <Badge
            :value="task.id"
            data-testid="task-id-badge"
            severity="info"
            class="text-sm"
          />
        </div>
      </div>

      <!-- 제목 (인라인 편집) -->
      <div class="field-row">
        <label class="field-label">제목</label>
        <div class="field-value">
          <!-- 편집 모드 -->
          <InputText
            v-if="isEditingTitle"
            ref="titleInputRef"
            v-model="editedTitle"
            data-testid="task-title-input"
            aria-label="Task 제목 편집"
            class="w-full"
            :disabled="props.updating"
            @keydown.enter="saveTitle"
            @keydown.escape="cancelEditTitle"
            @blur="saveTitle"
          />
          <!-- 표시 모드 -->
          <div
            v-else
            data-testid="task-title-display"
            class="cursor-pointer p-1 rounded"
            @click="startEditTitle"
          >
            {{ task.title }}
          </div>
        </div>
      </div>



      <!-- 우선순위 + 담당자 (한 줄) -->
      <div class="field">
        <div class="flex gap-4">
          <!-- 우선순위 -->
          <div class="flex-1">
            <label class="font-semibold text-sm text-gray-600">우선순위</label>
            <div class="mt-1">
              <Dropdown
                :model-value="task.priority"
                :options="priorityOptions"
                option-label="text"
                option-value="value"
                data-testid="task-priority-dropdown"
                aria-label="우선순위 선택"
                :disabled="props.updating"
                class="w-full"
                @update:model-value="handlePriorityChange"
              >
                <template #value="{ value }">
                  <div :class="getPriorityClass(value)">
                    {{ getPriorityLabel(value) }}
                  </div>
                </template>
                <template #option="{ option }">
                  <div
                    :class="getPriorityClass(option.value)"
                    :data-testid="`priority-option-${option.value}`"
                  >
                    {{ option.text }}
                  </div>
                </template>
              </Dropdown>
            </div>
          </div>
          <!-- 담당자 -->
          <div class="flex-1">
            <label class="font-semibold text-sm text-gray-600">담당자</label>
            <div class="mt-1">
              <Dropdown
                :model-value="task.assignee?.id || null"
                :options="teamMemberOptions"
                option-label="name"
                option-value="id"
                placeholder="담당자 선택"
                data-testid="task-assignee-dropdown"
                aria-label="담당자 선택"
                :disabled="props.updating || loadingTeam"
                class="w-full"
                @update:model-value="handleAssigneeChange"
              >
                <template #value="{ value }">
                  <div v-if="value" class="flex items-center gap-2">
                    <Avatar
                      v-if="getTeamMemberById(value)?.avatar"
                      :image="getTeamMemberById(value)?.avatar"
                      shape="circle"
                      size="small"
                    />
                    <Avatar
                      v-else
                      :label="getTeamMemberById(value)?.name?.charAt(0)"
                      shape="circle"
                      size="small"
                    />
                    <span>{{ getTeamMemberById(value)?.name }}</span>
                  </div>
                  <span v-else class="text-gray-400">담당자 선택</span>
                </template>
                <template #option="{ option }">
                  <div
                    class="flex items-center gap-2"
                    :data-testid="`assignee-option-${option.id}`"
                  >
                    <Avatar
                      v-if="option.avatar"
                      :image="option.avatar"
                      shape="circle"
                      size="small"
                    />
                    <Avatar
                      v-else
                      :label="option.name?.charAt(0)"
                      shape="circle"
                      size="small"
                    />
                    <span>{{ option.name }}</span>
                  </div>
                </template>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>

      <!-- 일정 (TSK-08-07) -->
      <div class="field-row">
        <label class="field-label">일정</label>
        <div class="field-value flex items-center gap-1">
          <DatePicker
            :model-value="parseDate(task.schedule?.start)"
            date-format="yy-mm-dd"
            placeholder="시작일"
            data-testid="task-schedule-start"
            :disabled="props.updating"
            class="schedule-picker"
            @update:model-value="(date: Date) => handleScheduleChange('start', date)"
          />
          <span class="text-gray-400 text-xs">~</span>
          <DatePicker
            :model-value="parseDate(task.schedule?.end)"
            date-format="yy-mm-dd"
            placeholder="종료일"
            data-testid="task-schedule-end"
            :disabled="props.updating"
            class="schedule-picker"
            @update:model-value="(date: Date) => handleScheduleChange('end', date)"
          />
        </div>
      </div>

      <!-- 태그 (TSK-08-07) -->
      <div v-if="task.tags && task.tags.length > 0" class="field-row">
        <label class="field-label">태그</label>
        <div class="field-value flex flex-wrap gap-2" data-testid="task-tags-container">
          <Tag
            v-for="tag in task.tags"
            :key="tag"
            :value="tag"
            severity="secondary"
            class="text-xs"
            :data-testid="`task-tag-${tag}`"
          />
        </div>
      </div>

      <!-- 의존성 (TSK-08-07) -->
      <div v-if="task.depends && task.depends.length > 0" class="field-row">
        <label class="field-label">의존성</label>
        <div class="field-value flex flex-wrap gap-2" data-testid="task-depends-container">
          <Badge
            v-for="depId in task.depends"
            :key="depId"
            :value="getDependsLabel(depId)"
            severity="warn"
            :data-testid="`depends-${depId}`"
          />
        </div>
      </div>

      <!-- 참조 (TSK-08-07) -->
      <div v-if="task.ref" class="field-row">
        <label class="field-label">참조</label>
        <div class="field-value flex items-center gap-2">
          <i class="pi pi-file text-text-secondary text-sm"></i>
          <span class="text-sm text-text" data-testid="task-ref-text">{{ task.ref }}</span>
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskBasicInfo - Task 기본 정보 표시 및 인라인 편집
 * Task: TSK-05-01
 * 상세설계: 020-detail-design.md 섹션 9.3
 *
 * 책임:
 * - ID, 제목, 카테고리, 우선순위, 담당자 렌더링
 * - 제목 인라인 편집 UI
 * - 카테고리/우선순위별 색상 적용
 * - 상태 전이 버튼 렌더링
 * - 편집 이벤트 Emit
 */

import type { TaskDetail, Priority, TeamMember } from '~/types'
import { storeToRefs } from 'pinia'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  task: TaskDetail
  updating?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  updating: false,
})

const emit = defineEmits<{
  'update:title': [title: string]
  'update:priority': [priority: Priority]
  'update:assignee': [assigneeId: string | null]
  'update:schedule': [schedule: { start: string; end: string }]
  'transition-completed': [command: string]
}>()

// ============================================================
// Stores
// ============================================================
const projectStore = useProjectStore()
const selectionStore = useSelectionStore()
const wbsStore = useWbsStore()
const notification = useNotification()
const errorHandler = useErrorHandler()
const { selectedProjectId } = storeToRefs(selectionStore)

// Task 네비게이션
const { hasPrevTask, hasNextTask, currentTaskIndex, allTasks } = storeToRefs(selectionStore)
const totalTasks = computed(() => allTasks.value?.length || 0)

// ============================================================
// State
// ============================================================
const isEditingTitle = ref(false)
const editedTitle = ref('')
const loadingTeam = ref(false)
const titleInputRef = ref<InstanceType<typeof InputText> | null>(null)
const transitioningCommand = ref<string | null>(null)

// ============================================================
// Computed
// ============================================================

/**
 * 카테고리 라벨
 */
const categoryLabel = computed(() => {
  const labels: Record<string, string> = {
    development: '개발',
    defect: '결함',
    infrastructure: '인프라',
  }
  return labels[props.task.category] || props.task.category
})

/**
 * 카테고리 색상 클래스 (FR-006)
 */
const categoryClass = computed(() => {
  const classes: Record<string, string> = {
    development: 'bg-blue-500 text-white',
    defect: 'bg-red-500 text-white',
    infrastructure: 'bg-green-500 text-white',
  }
  return classes[props.task.category] || 'bg-gray-500 text-white'
})

/**
 * 우선순위 옵션 (BR-002)
 */
const priorityOptions = computed(() => [
  { text: '긴급', value: 'critical' },
  { text: '높음', value: 'high' },
  { text: '보통', value: 'medium' },
  { text: '낮음', value: 'low' },
])

/**
 * 팀원 목록 옵션 (MAJ-002)
 */
const teamMemberOptions = computed(() => {
  return projectStore.teamMembers || []
})

/**
 * 사용 가능한 액션 목록
 */
const availableActions = computed(() => props.task.availableActions || [])

/**
 * 프로젝트 ID (TSK-08-07)
 */
const projectId = computed(() => {
  return selectedProjectId.value
})


// ============================================================
// Workflow Button Config
// ============================================================
const workflowButtonConfig: Record<string, { label: string; icon: string; severity: string }> = {
  start: { label: '시작', icon: 'pi pi-play', severity: 'primary' },
  draft: { label: '초안 작성', icon: 'pi pi-pencil', severity: 'info' },
  build: { label: '구현', icon: 'pi pi-cog', severity: 'success' },
  verify: { label: '검증', icon: 'pi pi-check-circle', severity: 'warn' },
  done: { label: '완료', icon: 'pi pi-flag', severity: 'success' },
  review: { label: '리뷰', icon: 'pi pi-eye', severity: 'info' },
  apply: { label: '적용', icon: 'pi pi-check', severity: 'success' },
  test: { label: '테스트', icon: 'pi pi-bolt', severity: 'warn' },
  audit: { label: '감사', icon: 'pi pi-search', severity: 'info' },
  patch: { label: '패치', icon: 'pi pi-wrench', severity: 'success' },
  skip: { label: '건너뛰기', icon: 'pi pi-forward', severity: 'secondary' },
  fix: { label: '수정', icon: 'pi pi-wrench', severity: 'warn' },
}

// ============================================================
// Methods
// ============================================================

/**
 * 액션 라벨 반환
 */
function getActionLabel(action: string): string {
  return workflowButtonConfig[action]?.label || action
}

/**
 * 액션 아이콘 반환
 */
function getActionIcon(action: string): string {
  return workflowButtonConfig[action]?.icon || 'pi pi-arrow-right'
}

/**
 * 액션 심각도 반환
 */
function getActionSeverity(action: string): string {
  return (workflowButtonConfig[action]?.severity || 'secondary') as 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'
}

/**
 * 상태 전이 핸들러
 */
async function handleTransition(command: string) {
  if (transitioningCommand.value) return

  transitioningCommand.value = command

  try {
    const projectParam = selectedProjectId.value ? `?project=${encodeURIComponent(selectedProjectId.value)}` : ''
    await $fetch(`/api/tasks/${props.task.id}/transition${projectParam}`, {
      method: 'POST',
      body: { command },
    })

    await selectionStore.refreshTaskDetail()
    notification.success(`'${getActionLabel(command)}' 명령이 실행되었습니다.`)
    emit('transition-completed', command)
  } catch (error) {
    errorHandler.handle(error, 'TaskBasicInfo.handleTransition')
  } finally {
    transitioningCommand.value = null
  }
}

/**
 * 우선순위 라벨 반환
 */
function getPriorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    critical: '긴급',
    high: '높음',
    medium: '보통',
    low: '낮음',
  }
  return labels[priority] || priority
}

/**
 * 우선순위 색상 클래스 (FR-007)
 */
function getPriorityClass(priority: Priority): string {
  const classes: Record<Priority, string> = {
    critical: 'text-red-600 font-semibold',
    high: 'text-amber-600 font-semibold',
    medium: 'text-blue-600',
    low: 'text-gray-600',
  }
  return classes[priority] || 'text-gray-600'
}

/**
 * 팀원 ID로 TeamMember 찾기
 */
function getTeamMemberById(memberId: string): TeamMember | undefined {
  return teamMemberOptions.value.find((m: TeamMember) => m.id === memberId)
}

/**
 * 제목 편집 시작
 * CRT-001 수정: DOM 직접 조작 대신 Vue template ref 사용
 */
function startEditTitle() {
  if (props.updating) return
  isEditingTitle.value = true
  editedTitle.value = props.task.title
  // nextTick으로 InputText 렌더링 후 포커스 (Vue template ref 사용)
  nextTick(() => {
    // PrimeVue InputText의 $el 또는 내부 input 요소에 포커스
    const inputComponent = titleInputRef.value
    if (inputComponent?.$el) {
      const inputEl = inputComponent.$el.querySelector('input') || inputComponent.$el
      inputEl?.focus()
    }
  })
}

/**
 * 제목 편집 저장 (Enter/Blur)
 */
function saveTitle() {
  if (!isEditingTitle.value) return
  if (editedTitle.value !== props.task.title) {
    emit('update:title', editedTitle.value)
  }
  isEditingTitle.value = false
}

/**
 * 제목 편집 취소 (Escape)
 */
function cancelEditTitle() {
  isEditingTitle.value = false
  editedTitle.value = props.task.title
}

/**
 * 우선순위 변경 핸들러
 */
function handlePriorityChange(newPriority: Priority) {
  emit('update:priority', newPriority)
}

/**
 * 담당자 변경 핸들러
 */
function handleAssigneeChange(assigneeId: string | null) {
  emit('update:assignee', assigneeId)
}

/**
 * 팀원 목록 로드 (MAJ-002)
 */
async function loadTeamMembers() {
  if (projectStore.currentProject) return // 이미 로드됨

  loadingTeam.value = true
  try {
    // 선택된 Task의 프로젝트 ID 사용
    const projectId = selectedProjectId.value
    if (projectId) {
      await projectStore.loadProject(projectId)
    }
  } catch (error) {
    console.error('[TaskBasicInfo] 팀원 목록 로드 실패:', error)
  } finally {
    loadingTeam.value = false
  }
}

// ============================================================
// Additional Methods (TSK-08-07)
// ============================================================

/**
 * 문자열을 Date로 변환
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const date = new Date(dateStr)
  return isNaN(date.getTime()) ? null : date
}

/**
 * Date를 YYYY-MM-DD 문자열로 변환
 */
function formatDateToString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 일정 변경 핸들러
 */
function handleScheduleChange(field: 'start' | 'end', date: Date) {
  const currentSchedule = props.task.schedule || { start: '', end: '' }
  const newSchedule = {
    start: field === 'start' ? formatDateToString(date) : currentSchedule.start,
    end: field === 'end' ? formatDateToString(date) : currentSchedule.end,
  }
  emit('update:schedule', newSchedule)
}

/**
 * 의존성 Task 라벨 (ID + 상태)
 */
function getDependsLabel(taskId: string): string {
  const node = wbsStore.flatNodes.get(taskId)
  if (!node) return taskId

  const statusLabels: Record<string, string> = {
    '': 'Todo',
    'bd': '기본설계',
    'dd': '상세설계',
    'im': '구현',
    'vf': '검증',
    'xx': '완료',
    'an': '분석',
    'fx': '수정',
    'ds': '설계',
  }

  // status에서 괄호 제거 (예: '[xx]' -> 'xx')
  const rawStatus = (node.status || '').replace(/[\[\]]/g, '')
  const statusLabel = statusLabels[rawStatus] ?? statusLabels['']
  return `${taskId}[${statusLabel}]`
}

// ============================================================
// Task Navigation
// ============================================================

/**
 * 이전 Task로 이동
 */
function handlePrevTask() {
  selectionStore.selectPrevTask()
}

/**
 * 다음 Task로 이동
 */
function handleNextTask() {
  selectionStore.selectNextTask()
}

// ============================================================
// Lifecycle
// ============================================================
onMounted(() => {
  loadTeamMembers()
})
</script>

<style scoped>
.task-basic-info .field {
  margin-bottom: 1rem;
}

.task-basic-info .field:last-child {
  margin-bottom: 0;
}

/* 왼쪽 라벨 - 오른쪽 값 레이아웃 */
.field-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.field-row:last-child {
  margin-bottom: 0;
}

.field-label {
  flex-shrink: 0;
  width: 4.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #4b5563;
  padding-top: 0.25rem;
}

.field-value {
  flex: 1;
  min-width: 0;
}

/* 일정 DatePicker 크기 조정 */
.schedule-picker {
  flex: 1;
  min-width: 0;
  max-width: 6rem;
}

.schedule-picker :deep(input) {
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
  width: 100%;
}
</style>
