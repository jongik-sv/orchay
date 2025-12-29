<template>
  <div
    class="workflow-auto-actions flex gap-2"
    data-testid="workflow-auto-actions"
    role="group"
    aria-label="자동실행 버튼"
  >
    <!-- Run 버튼 -->
    <Button
      label="Run"
      icon="pi pi-play"
      severity="success"
      size="small"
      :disabled="isExecuting"
      data-testid="workflow-run-btn"
      aria-label="워크플로우 Run 실행"
      @click="handleRun"
    />

    <!-- Auto 버튼 -->
    <Button
      label="Auto"
      icon="pi pi-forward"
      severity="info"
      size="small"
      :disabled="isExecuting"
      data-testid="workflow-auto-btn"
      aria-label="워크플로우 Auto 실행"
      @click="handleAuto"
    />

    <!-- 중지 버튼 (실행 중일 때만 표시) -->
    <Button
      v-if="isExecuting"
      label="중지"
      icon="pi pi-stop"
      severity="danger"
      size="small"
      data-testid="workflow-stop-btn"
      aria-label="워크플로우 중지"
      @click="handleStop"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * WorkflowAutoActions - 자동실행 버튼 그룹 (Run, Auto, 중지)
 * Task: TSK-02-01
 * 상세설계: 020-detail-design.md 섹션 3.3
 *
 * 책임:
 * - Run, Auto, 중지 버튼 렌더링
 * - 실행 상태에 따른 조건부 표시
 * - 버튼 클릭 이벤트 emit
 */

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  /** 실행 중 여부 */
  isExecuting?: boolean
}

withDefaults(defineProps<Props>(), {
  isExecuting: false,
})

const emit = defineEmits<{
  (e: 'run'): void
  (e: 'auto'): void
  (e: 'stop'): void
}>()

// ============================================================
// Methods
// ============================================================

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
