<template>
  <Panel
    header="워크플로우 흐름"
    class="task-workflow-panel mt-4"
    data-testid="task-workflow-panel"
    :toggleable="true"
  >
    <div
      class="workflow-nodes flex items-center justify-start gap-2 overflow-x-auto pb-2"
      role="list"
      aria-label="워크플로우 단계"
      data-testid="workflow-nodes"
    >
      <template v-for="(step, index) in workflowSteps" :key="step.code">
        <!-- 워크플로우 노드 -->
        <div
          :class="[getNodeClasses(index), getNodeClass(index)]"
          role="listitem"
          :aria-current="index === currentStepIndex ? 'step' : undefined"
          :data-testid="index === currentStepIndex ? 'workflow-node-current' : `workflow-node-${index}`"
        >
          <div class="font-semibold">{{ step.labelEn }}</div>
          <div class="text-xs opacity-80">{{ step.code }}</div>
          <div class="text-xs opacity-70">{{ step.label }}</div>
        </div>

        <!-- 화살표 (마지막 노드 제외) -->
        <i
          v-if="workflowSteps && index < workflowSteps.length - 1"
          class="pi pi-arrow-right text-gray-400"
          aria-hidden="true"
        />
      </template>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskWorkflow - 워크플로우 흐름도 컴포넌트
 * Task: TSK-05-02
 * 상세설계: 020-detail-design.md 섹션 9.2
 *
 * 책임:
 * - 카테고리별 워크플로우 단계 표시
 * - 현재 상태 강조 (파란 배경, 볼드, scale)
 * - 완료/현재/미완료 시각적 구분
 * - 읽기 전용 (상호작용 없음)
 */

import type { TaskDetail } from '~/types'
import type { WorkflowStepInfo } from '~/types/workflow-config'

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
// Computed
// ============================================================

/**
 * 카테고리별 워크플로우 단계 계산 (설정 기반)
 * FR-001, BR-WF-01
 */
const workflowSteps = computed<WorkflowStepInfo[]>(() => {
  const steps = workflowConfig.getWorkflowSteps(props.task?.category)
  return steps || []
})

/**
 * 현재 상태의 인덱스 계산
 * FR-002
 */
const currentStepIndex = computed(() => {
  if (!workflowSteps.value || workflowSteps.value.length === 0) return 0
  return workflowSteps.value.findIndex(step => step.code === props.task?.status)
})

// ============================================================
// Methods
// ============================================================

/**
 * 노드 클래스 계산
 */
function getNodeClasses(index: number): string[] {
  const baseClasses = [
    'flex',
    'flex-col',
    'items-center',
    'justify-center',
    'px-4',
    'py-3',
    'rounded-lg',
    'transition-all',
    'duration-200',
    'min-w-[120px]',
    'text-center'
  ]

  // 현재 상태는 볼드
  if (index === currentStepIndex.value) {
    baseClasses.push('font-bold')
  }

  return baseClasses
}

/**
 * 노드 상태별 CSS 클래스 계산 (TSK-08-05: CSS 클래스 중앙화)
 * FR-003
 */
function getNodeClass(index: number): string {
  if (index < currentStepIndex.value) {
    // 완료 상태
    return 'workflow-step-completed'
  } else if (index === currentStepIndex.value) {
    // 현재 상태
    return 'workflow-step-current'
  } else {
    // 미완료 상태
    return 'workflow-step-pending'
  }
}
</script>

<style scoped>
.workflow-nodes {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) var(--color-bg);
}

.workflow-nodes::-webkit-scrollbar {
  height: 6px;
}

.workflow-nodes::-webkit-scrollbar-track {
  background: var(--color-bg);
  border-radius: 3px;
}

.workflow-nodes::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.workflow-nodes::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-light);
}
</style>
