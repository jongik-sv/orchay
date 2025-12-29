<template>
  <div
    v-if="task"
    class="workflow-actions p-4 surface-ground border-round"
    data-testid="workflow-actions"
    role="group"
    aria-label="워크플로우 명령어"
  >
    <!-- 섹션 제목 -->
    <div class="font-semibold text-lg mb-3">워크플로우</div>

    <!-- 명령어 버튼 그룹 -->
    <div class="workflow-buttons flex flex-wrap gap-2 mb-3" data-testid="workflow-buttons">
      <WorkflowWorkflowButton
        v-for="cmd in filteredCommands"
        :key="cmd.name"
        :command="cmd"
        :disabled="!cmd.available || isExecuting"
        :loading="executingCommand === cmd.name"
        @click="handleCommandClick(cmd.name)"
      />
    </div>

    <Divider />

    <!-- 자동실행 버튼 그룹 -->
    <WorkflowWorkflowAutoActions
      :is-executing="isExecuting"
      data-testid="workflow-auto-section"
      @run="handleRun"
      @auto="handleAuto"
      @stop="handleStop"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * WorkflowActions - 워크플로우 명령어 버튼 그룹 컨테이너
 * Task: TSK-02-01
 * 상세설계: 020-detail-design.md 섹션 3.1
 *
 * 책임:
 * - Task 상태/카테고리에 따른 명령어 필터링
 * - 명령어 버튼 그룹 렌더링
 * - 자동실행 버튼 그룹 렌더링
 * - 명령어 실행 이벤트 emit
 */

import type { WbsNode, TaskCategory } from '~/types/index'
import {
  WORKFLOW_COMMANDS,
  isCommandAvailable,
  extractStatusCode,
  type FilteredCommand,
} from '~/utils/workflowCommands'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  /** 현재 Task 정보 (status, category 포함) */
  task: WbsNode | null
  /** 명령어 실행 중 여부 */
  isExecuting?: boolean
  /** 현재 실행 중인 명령어 이름 */
  executingCommand?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  isExecuting: false,
  executingCommand: null,
})

const emit = defineEmits<{
  /** 실행할 명령어 이름 */
  (e: 'execute', commandName: string): void
  /** Run 버튼 클릭 */
  (e: 'run'): void
  /** Auto 버튼 클릭 */
  (e: 'auto'): void
  /** 중지 버튼 클릭 */
  (e: 'stop'): void
}>()

// ============================================================
// Computed
// ============================================================

/**
 * 현재 Task의 상태 코드
 * wbs.md status 필드에서 추출 (예: "implement [im]" → "[im]")
 */
const currentStatusCode = computed<string>(() => {
  if (!props.task?.status) return '[ ]'
  return extractStatusCode(props.task.status)
})

/**
 * 현재 Task의 카테고리
 */
const currentCategory = computed<TaskCategory>(() => {
  return props.task?.category || 'development'
})

/**
 * 가용성 필터링된 명령어 목록
 * 상세설계 섹션 3.1 Computed Properties
 */
const filteredCommands = computed<FilteredCommand[]>(() => {
  return WORKFLOW_COMMANDS.map(command => ({
    ...command,
    available: isCommandAvailable(command, currentStatusCode.value, currentCategory.value),
  }))
})

// ============================================================
// Methods
// ============================================================

/**
 * 명령어 버튼 클릭 핸들러
 * 상세설계 섹션 5.1 버튼 클릭 시퀀스
 */
function handleCommandClick(commandName: string) {
  // 가용성 검증 (disabled 상태에서는 이미 클릭 불가이지만 이중 검증)
  const command = filteredCommands.value.find(c => c.name === commandName)
  if (!command?.available) return

  // 실행 중이면 무시
  if (props.isExecuting) return

  emit('execute', commandName)
}

/**
 * Run 버튼 클릭 핸들러
 */
function handleRun() {
  emit('run')
}

/**
 * Auto 버튼 클릭 핸들러
 */
function handleAuto() {
  emit('auto')
}

/**
 * 중지 버튼 클릭 핸들러
 */
function handleStop() {
  emit('stop')
}
</script>

<style scoped>
.workflow-actions {
  /* surface-ground와 border-round는 Tailwind/PrimeVue에서 제공 */
}

.workflow-buttons {
  /* flex flex-wrap gap-2는 Tailwind 유틸리티 클래스 */
}
</style>
