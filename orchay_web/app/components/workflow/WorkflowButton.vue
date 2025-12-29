<template>
  <Button
    :label="command.label"
    :icon="`pi ${command.icon}`"
    :severity="computedSeverity"
    :disabled="disabled || loading"
    :loading="loading"
    size="small"
    class="workflow-button"
    :data-testid="`workflow-btn-${command.name}`"
    :aria-label="`워크플로우 ${command.label} 실행`"
    :aria-disabled="disabled"
    :aria-busy="loading"
    @click="handleClick"
  />
</template>

<script setup lang="ts">
/**
 * WorkflowButton - 개별 워크플로우 명령어 버튼
 * Task: TSK-02-01
 * 상세설계: 020-detail-design.md 섹션 3.2
 *
 * 책임:
 * - 개별 명령어 버튼 렌더링
 * - 상태에 따른 스타일 적용 (가용/비가용/실행중)
 * - 클릭 이벤트 emit
 */

import type { WorkflowCommand, ButtonSeverity } from '~/utils/workflowCommands'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  /** 명령어 정보 */
  command: WorkflowCommand
  /** 비활성 여부 */
  disabled?: boolean
  /** 로딩 상태 */
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  loading: false,
})

const emit = defineEmits<{
  (e: 'click'): void
}>()

// ============================================================
// Computed
// ============================================================

/**
 * 렌더링 로직에 따른 severity 계산
 * 상세설계 섹션 3.2 렌더링 로직
 *
 * | 조건 | severity |
 * |------|----------|
 * | 사용 가능 | command.severity |
 * | 사용 불가 | 'secondary' |
 * | 실행 중 | command.severity |
 */
const computedSeverity = computed<ButtonSeverity>(() => {
  if (props.disabled && !props.loading) {
    return 'secondary'
  }
  return props.command.severity
})

// ============================================================
// Methods
// ============================================================

/**
 * 버튼 클릭 핸들러
 */
function handleClick() {
  if (!props.disabled && !props.loading) {
    emit('click')
  }
}
</script>

<style scoped>
.workflow-button {
  min-width: 80px;
}
</style>
