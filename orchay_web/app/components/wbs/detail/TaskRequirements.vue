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

    <!-- 요구사항 표시 -->
    <div v-if="hasContent" class="markdown-body" v-html="renderMarkdown()" />

    <!-- 빈 상태 -->
    <Message v-else severity="info" data-testid="empty-requirements-message">
      요구사항이 없습니다
    </Message>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskRequirements - 요구사항 표시 컴포넌트
 */
import { marked } from 'marked'
import type { TaskDetail } from '~/types'

interface Props {
  task: TaskDetail
}

interface Emits {
  (e: 'update:requirements', requirements: string[]): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isEditing = ref(false)
const localRequirements = ref<string[]>([])

const hasContent = computed(() => {
  const t = props.task
  return !!(t.rawContent?.trim())
})

/**
 * 마크다운으로 변환
 * rawContent (원본 마크다운)를 그대로 렌더링
 */
function renderMarkdown(): string {
  const t = props.task
  if (!t.rawContent?.trim()) return ''

  return marked(t.rawContent) as string
}

function toggleEdit() {
  isEditing.value = true
  localRequirements.value = [...(props.task.requirements || [])]
}

function cancelEdit() {
  isEditing.value = false
}

function saveEdit() {
  emit('update:requirements', localRequirements.value.filter(r => r.trim()))
  isEditing.value = false
}
</script>
