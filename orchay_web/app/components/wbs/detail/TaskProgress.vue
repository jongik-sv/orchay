<template>
  <Panel header="진행 상태" data-testid="task-progress-panel" class="task-progress">
    <div class="space-y-4">
      <!-- 워크플로우 Stepper (TSK-08-07) -->
      <div class="field">
        <div>
          <!-- Stepper 노드들 -->
          <div class="workflow-container mt-2" data-testid="workflow-steps-container">
            <template v-for="(step, index) in workflowSteps" :key="step.code">
              <!-- 단계 노드 (클릭 가능) -->
              <div class="workflow-step-item">
                <button
                  :id="`step-${index}`"
                  class="workflow-step-circle workflow-step-clickable"
                  :class="{
                    'workflow-step-current': index === currentStepIndex,
                    'workflow-step-completed': index < currentStepIndex,
                    'workflow-step-pending': index > currentStepIndex,
                    'workflow-step-selected': index === effectiveSelectedIndex,
                  }"
                  :aria-label="`${step.label} 단계`"
                  :aria-current="index === currentStepIndex ? 'step' : undefined"
                  :aria-selected="index === effectiveSelectedIndex"
                  role="button"
                  tabindex="0"
                  :data-testid="index === currentStepIndex ? 'workflow-step-current' : `workflow-step-${index}`"
                  @click="selectStep(index)"
                  @keydown.enter="selectStep(index)"
                  @keydown.space.prevent="selectStep(index)"
                >
                  <i
                    v-if="index < currentStepIndex"
                    class="pi pi-check text-white"
                  />
                  <i
                    v-else-if="index === currentStepIndex"
                    class="pi pi-circle-fill text-white"
                  />
                  <i
                    v-else
                    class="pi pi-circle text-text-secondary"
                  />
                </button>

                <!-- 단계 라벨 -->
                <div
                  class="workflow-step-label"
                  :class="{
                    'workflow-step-label-current': index === currentStepIndex,
                    'workflow-step-label-selected': index === effectiveSelectedIndex && index !== currentStepIndex,
                  }"
                >
                  {{ step.label }}
                </div>
              </div>

              <!-- 연결선 (마지막 단계 제외) -->
              <div
                v-if="index < workflowSteps.length - 1"
                class="workflow-connector"
                :class="{
                  'workflow-connector-completed': index < currentStepIndex,
                  'workflow-connector-pending': index >= currentStepIndex,
                }"
              />
            </template>
          </div>

          <!-- 선택된 단계 상세 영역 (항상 표시) -->
          <div
            class="workflow-step-detail"
            data-testid="workflow-step-detail"
          >
            <!-- 단계명 + 완료일 -->
            <div class="step-detail-header">
              <span class="step-detail-title">{{ selectedStep?.label }}</span>
              <span
                class="step-detail-date"
                :class="getCompletedDate(selectedStep?.code || '') === '미완료' ? 'step-detail-date-pending' : ''"
              >
                <i class="pi pi-calendar mr-1"></i>
                {{ getCompletedDate(selectedStep?.code || '') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 진행률 -->
      <div class="field">
        <label class="field-label">진행률</label>
        <div class="mt-1">
          <ProgressBar
            :value="progressPercentage"
            :show-value="true"
            class="progress-bar-thick"
          />
        </div>
      </div>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskProgress - Task 진행 상태 및 워크플로우 Stepper
 * Task: TSK-08-07
 * 상세설계: 020-detail-design.md 섹션 5.1
 *
 * 책임:
 * - 카테고리별 워크플로우 단계 계산
 * - 클릭 가능한 Stepper 노드 렌더링
 * - 선택된 단계의 완료일 표시 (하단 고정 영역)
 * - 진행률 ProgressBar 표시
 */

import type { TaskDetail } from '~/types'

// ============================================================
// Props
// ============================================================
interface Props {
  task: TaskDetail
}

const props = defineProps<Props>()

// ============================================================
// Composables
// ============================================================
const workflowConfig = useWorkflowConfig()

// ============================================================
// State
// ============================================================
const selectedStepIndex = ref<number | null>(null)

// ============================================================
// Computed
// ============================================================

/**
 * 워크플로우 단계 계산 (카테고리별)
 * 설정 기반 동적 로딩
 */
const workflowSteps = computed(() => {
  const steps = workflowConfig.getWorkflowSteps(props.task.category)
  return steps.map(step => ({
    code: step.code,
    label: step.label,
  }))
})

/**
 * 현재 단계 인덱스
 */
const currentStepIndex = computed(() => {
  const index = workflowSteps.value.findIndex(step => step.code === props.task.status)
  return index !== -1 ? index : 0
})

/**
 * 선택된 단계 정보 (선택 없으면 현재 단계 표시)
 */
const selectedStep = computed(() => {
  const index = selectedStepIndex.value ?? currentStepIndex.value
  return workflowSteps.value[index]
})

/**
 * 실제 선택 인덱스 (표시용, null이면 현재 단계)
 */
const effectiveSelectedIndex = computed(() => {
  return selectedStepIndex.value ?? currentStepIndex.value
})

/**
 * 진행률 퍼센트
 */
const progressPercentage = computed(() => {
  const total = workflowSteps.value.length - 1 // 시작 전 제외
  if (total === 0) return 0
  return Math.round((currentStepIndex.value / total) * 100)
})

// ============================================================
// Methods
// ============================================================

/**
 * 단계별 완료일 조회
 * CR-004: 타입 가드 추가
 */
function getCompletedDate(statusCode: string): string {
  if (!statusCode) return '미완료'
  if (!props.task.completed) return '미완료'

  // 상태 코드에서 키 추출 (예: '[bd]' → 'bd')
  const key = statusCode.replace(/[\[\]]/g, '')

  // 타입 가드: 키 존재 여부 확인
  if (!Object.prototype.hasOwnProperty.call(props.task.completed, key)) {
    return '미완료'
  }

  const timestamp = props.task.completed[key]
  return timestamp || '미완료'
}

/**
 * 단계 선택 (항상 열린 상태 유지)
 */
function selectStep(index: number) {
  selectedStepIndex.value = index
}

// ============================================================
// Lifecycle
// ============================================================

/**
 * 컴포넌트 마운트 시 현재 단계 자동 선택
 */
onMounted(() => {
  selectedStepIndex.value = currentStepIndex.value
})

/**
 * Task 상태 변경 시 현재 단계 자동 선택
 */
watch(() => props.task.status, () => {
  selectedStepIndex.value = currentStepIndex.value
})
</script>

<style scoped>
.task-progress .field {
  margin-bottom: 1rem;
}

.task-progress .field:last-child {
  margin-bottom: 0;
}

/* 필드 라벨 */
.field-label {
  @apply font-semibold text-sm text-text-secondary;
}

/* 워크플로우 컨테이너 */
.workflow-container {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

/* 단계 아이템 (원형 + 라벨 묶음) */
.workflow-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  position: relative;
}

/* 워크플로우 단계 원형 */
.workflow-step-circle {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease-in-out;
  font-size: 1rem;
  flex-shrink: 0;
  border: none;
  background: transparent;
}

/* 선택된 단계 하이라이트 */
.workflow-step-selected {
  @apply ring-2 ring-primary ring-offset-2;
}

/* 워크플로우 단계 라벨 */
.workflow-step-label {
  margin-top: 0.25rem;
  font-size: 0.85rem;
  text-align: center;
  white-space: nowrap;
  @apply text-text-secondary;
}

.workflow-step-label-current {
  @apply font-semibold text-primary;
}

.workflow-step-label-selected {
  @apply font-medium text-text;
}

/* 워크플로우 연결선 */
.workflow-connector {
  width: 40px;
  height: 3px;
  flex-shrink: 0;
  margin-top: 19px; /* 원형 중앙 높이에 맞춤 (40px/2 - 3px/2) ≈ 19px */
  transition: background-color 0.5s ease-in-out;
}

.workflow-connector-completed {
  @apply bg-success;
}

.workflow-connector-pending {
  @apply bg-border;
}

/* 선택된 단계 상세 영역 */
.workflow-step-detail {
  @apply mt-4 p-3 rounded-lg bg-bg-card border border-border;
}

.step-detail-header {
  @apply flex items-center justify-between;
}

.step-detail-title {
  @apply font-semibold text-text;
}

.step-detail-date {
  @apply text-sm text-text-secondary;
}

.step-detail-date-pending {
  @apply text-text-muted;
}

/* workflow-step-current, workflow-step-completed, workflow-step-pending
   클래스는 main.css에서 전역으로 정의됨 (TSK-08-05 CSS 중앙화 원칙) */

/* 진행률 바 두껍게 - CSS 변수 오버라이드 */
.progress-bar-thick {
  --p-progressbar-height: 1.25rem;
  --p-progressbar-border-radius: 0.625rem;
  --p-progressbar-label-font-size: 0.8rem;
}
</style>
