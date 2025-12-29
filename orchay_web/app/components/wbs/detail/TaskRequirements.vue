<template>
  <Panel
    header="요구사항"
    class="task-requirements-panel mt-4"
    data-testid="task-requirements-panel"
    :toggleable="true"
  >
    <template #icons>
      <Button
        v-if="!isEditing"
        icon="pi pi-pencil"
        text
        rounded
        aria-label="요구사항 편집"
        data-testid="edit-requirements-btn"
        @click="toggleEdit"
      />
      <template v-else>
        <Button
          icon="pi pi-times"
          text
          rounded
          severity="secondary"
          aria-label="편집 취소"
          data-testid="cancel-requirements-btn"
          class="mr-2"
          @click="cancelEdit"
        />
        <Button
          icon="pi pi-check"
          text
          rounded
          severity="success"
          aria-label="변경사항 저장"
          data-testid="save-requirements-btn"
          @click="saveEdit"
        />
      </template>
    </template>

    <!-- PRD 참조 -->
    <div v-if="task.ref" class="mb-4 text-sm text-gray-600" data-testid="prd-reference">
      <i class="pi pi-link mr-1" />
      <span>{{ task.ref }}</span>
    </div>

    <!-- 요구사항 목록 (읽기 모드) -->
    <div v-if="!isEditing" data-testid="requirements-list" role="list">
      <div
        v-for="(req, index) in task.requirements"
        :key="index"
        class="mb-2 flex items-start"
        role="listitem"
        :data-testid="`requirement-item-${index}`"
      >
        <i class="pi pi-circle-fill text-xs text-blue-500 mr-2 mt-1.5" aria-hidden="true" />
        <span>{{ req }}</span>
      </div>

      <!-- 빈 상태 -->
      <Message v-if="task.requirements.length === 0" severity="info">
        요구사항이 없습니다
      </Message>
    </div>

    <!-- 요구사항 목록 (편집 모드) -->
    <div v-else class="space-y-3" role="list">
      <div
        v-for="(req, index) in localRequirements"
        :key="index"
        class="flex gap-2 items-start"
        role="listitem"
      >
        <InputText
          v-model="localRequirements[index]"
          class="flex-1"
          :aria-label="`요구사항 ${index + 1}`"
          :data-testid="`requirement-input-${index}`"
          :maxlength="500"
          :invalid="req.length > 500"
          @input="validateRequirement(index)"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          rounded
          :aria-label="`요구사항 ${index + 1} 삭제`"
          :data-testid="`delete-requirement-btn-${index}`"
          @click="removeRequirement(index)"
        />
      </div>

      <!-- 추가 버튼 -->
      <Button
        icon="pi pi-plus"
        label="추가"
        text
        aria-label="요구사항 추가"
        data-testid="add-requirement-btn"
        @click="addRequirement"
      />

      <!-- 에러 메시지 -->
      <Message
        v-if="validationError"
        severity="error"
        data-testid="requirement-error-message"
      >
        {{ validationError }}
      </Message>
    </div>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskRequirements - 요구사항 목록 및 인라인 편집 컴포넌트
 * Task: TSK-05-02
 * 상세설계: 020-detail-design.md 섹션 9.3
 *
 * 책임:
 * - 요구사항 목록 표시
 * - PRD 참조 링크 표시
 * - 인라인 편집 상태 관리
 * - update:requirements 이벤트 발행
 */

import type { TaskDetail } from '~/types'
import { processRequirements } from '~/utils/validators'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  task: TaskDetail
}

interface Emits {
  (e: 'update:requirements', requirements: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// ============================================================
// State
// ============================================================
const isEditing = ref(false)
const localRequirements = ref<string[]>([])
const validationError = ref<string | null>(null)

// ============================================================
// Methods
// ============================================================

/**
 * 편집 모드 토글
 * FR-006
 */
function toggleEdit() {
  isEditing.value = true
  localRequirements.value = [...props.task.requirements]
  validationError.value = null
}

/**
 * 편집 취소
 */
function cancelEdit() {
  isEditing.value = false
  localRequirements.value = []
  validationError.value = null
}

/**
 * 변경사항 저장
 * FR-006, M-01 (XSS 방지)
 */
function saveEdit() {
  // 빈 항목 제거 및 XSS 방지 처리
  const { processed, error } = processRequirements(localRequirements.value, 500)

  if (error) {
    validationError.value = error
    return
  }

  emit('update:requirements', processed)
  isEditing.value = false
  validationError.value = null
}

/**
 * 요구사항 추가
 * FR-006
 */
function addRequirement() {
  localRequirements.value.push('')
}

/**
 * 요구사항 삭제
 * FR-006
 */
function removeRequirement(index: number) {
  localRequirements.value.splice(index, 1)
}

/**
 * 요구사항 유효성 검증
 * BR-REQ-01
 */
function validateRequirement(index: number) {
  const req = localRequirements.value[index]
  if (req.length > 500) {
    validationError.value = `요구사항 ${index + 1}은 500자 이하여야 합니다`
  } else {
    validationError.value = null
  }
}
</script>
