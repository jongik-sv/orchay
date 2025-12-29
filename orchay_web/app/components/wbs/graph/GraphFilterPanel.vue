<script setup lang="ts">
/**
 * 그래프 필터 패널 컴포넌트
 * Task: TSK-06-03
 */

// Props
interface Props {
  categories: string[]
  statuses: string[]
  hierarchyMode: 'full' | 'wp' | 'act'
  focusTask: string | null
  focusDepth: number
  stats: { nodeCount: number; edgeCount: number }
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:categories': [value: string[]]
  'update:statuses': [value: string[]]
  'update:hierarchyMode': [value: 'full' | 'wp' | 'act']
  'update:focusTask': [value: string | null]
  'update:focusDepth': [value: number]
  'reset': []
  'applyFocus': []
}>()

// 로컬 상태
const isExpanded = ref(false)

// 반응형 브레이크포인트에 따른 초기 펼침 상태
onMounted(() => {
  const width = window.innerWidth
  isExpanded.value = width >= 1200  // Desktop (≥1200px): 펼침, 나머지: 접힘
})

// 카테고리 옵션
const categoryOptions = [
  { label: '개발', value: 'development' },
  { label: '결함', value: 'defect' },
  { label: '인프라', value: 'infrastructure' }
]

// 상태 옵션
const statusOptions = [
  { label: 'Todo [ ]', value: '[ ]' },
  { label: '기본설계 [bd]', value: '[bd]' },
  { label: '상세설계 [dd]', value: '[dd]' },
  { label: '구현 [im]', value: '[im]' },
  { label: '검증 [vf]', value: '[vf]' },
  { label: '완료 [xx]', value: '[xx]' }
]

// 계층 뷰 옵션
const hierarchyModeOptions = [
  { label: '전체', value: 'full' },
  { label: 'WP 그룹', value: 'wp' },
  { label: 'ACT 그룹', value: 'act' }
]

// 깊이 옵션
const depthOptions = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 }
]

// Task 옵션 (wbsStore에서 가져옴)
const wbsStore = useWbsStore()
const selectionStore = useSelectionStore()

const taskOptions = computed(() => {
  const options: Array<{ label: string; value: string }> = []
  const currentProjectId = selectionStore.selectedProjectId

  if (!currentProjectId) return options

  wbsStore.flatNodes.forEach((node, id) => {
    if (node.type === 'task') {
      const colonIndex = id.indexOf(':')
      if (colonIndex > 0) {
        const projectId = id.substring(0, colonIndex)
        const taskId = id.substring(colonIndex + 1)

        if (projectId === currentProjectId) {
          options.push({
            label: `${taskId}: ${node.title}`,
            value: taskId
          })
        }
      }
    }
  })

  return options.sort((a, b) => a.value.localeCompare(b.value))
})

// 초점 Task 비활성화 조건
const isFocusDisabled = computed(() => !props.focusTask)

// 로컬 핸들러
function togglePanel() {
  isExpanded.value = !isExpanded.value
}

function handleReset() {
  emit('reset')
}

function handleApplyFocus() {
  emit('applyFocus')
}
</script>

<template>
  <div
    class="graph-filter-panel"
    :data-testid="'graph-filter-panel'"
  >
    <!-- 필터 헤더 (항상 표시) -->
    <div class="filter-header">
      <div class="filter-header-left">
        <Button
          :icon="isExpanded ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          :label="'필터'"
          severity="secondary"
          text
          size="small"
          :data-testid="'filter-toggle-btn'"
          @click="togglePanel"
        />

        <Button
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          rounded
          size="small"
          v-tooltip.top="'초기화'"
          :data-testid="'filter-reset-btn'"
          @click="handleReset"
        />
      </div>

      <!-- 통계 (항상 표시) -->
      <div class="filter-stats" :data-testid="'filter-stats'">
        <Tag severity="info">
          <i class="pi pi-circle mr-1" />
          노드: {{ stats.nodeCount }}
        </Tag>
        <Tag severity="secondary">
          <i class="pi pi-arrow-right mr-1" />
          엣지: {{ stats.edgeCount }}
        </Tag>
      </div>
    </div>

    <!-- 필터 콘텐츠 (펼쳤을 때만 표시) -->
    <div v-if="isExpanded" class="filter-content">
      <!-- 카테고리 필터 -->
      <div class="filter-section">
        <label class="filter-label">카테고리</label>
        <div class="filter-checkboxes">
          <div
            v-for="option in categoryOptions"
            :key="option.value"
            class="filter-checkbox-item"
          >
            <Checkbox
              :modelValue="categories"
              :inputId="`category-${option.value}`"
              :value="option.value"
              :data-testid="`category-checkbox-${option.value}`"
              @update:modelValue="emit('update:categories', $event)"
            />
            <label :for="`category-${option.value}`" class="checkbox-label">
              {{ option.label }}
            </label>
          </div>
        </div>
      </div>

      <!-- 상태 필터 -->
      <div class="filter-section">
        <label class="filter-label">상태</label>
        <MultiSelect
          :modelValue="statuses"
          :options="statusOptions"
          optionLabel="label"
          optionValue="value"
          placeholder="상태 선택"
          :maxSelectedLabels="2"
          :data-testid="'status-multiselect'"
          class="w-full"
          @update:modelValue="emit('update:statuses', $event)"
        />
      </div>

      <!-- 계층 뷰 -->
      <div class="filter-section">
        <label class="filter-label">계층 뷰</label>
        <div class="filter-radios">
          <div
            v-for="option in hierarchyModeOptions"
            :key="option.value"
            class="filter-radio-item"
          >
            <RadioButton
              :modelValue="hierarchyMode"
              :inputId="`hierarchy-${option.value}`"
              :value="option.value"
              :data-testid="`hierarchy-radio-${option.value}`"
              @update:modelValue="emit('update:hierarchyMode', $event)"
            />
            <label :for="`hierarchy-${option.value}`" class="radio-label">
              {{ option.label }}
            </label>
          </div>
        </div>
      </div>

      <!-- 초점 Task -->
      <div class="filter-section">
        <label class="filter-label">초점 Task</label>
        <div class="filter-focus">
          <Select
            :modelValue="focusTask"
            :options="taskOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Task 선택"
            :filter="true"
            :data-testid="'focus-task-select'"
            class="flex-1"
            @update:modelValue="emit('update:focusTask', $event)"
          />

          <!-- 깊이 선택 -->
          <div class="focus-depth">
            <span class="focus-depth-label">깊이:</span>
            <div class="focus-depth-radios">
              <div
                v-for="option in depthOptions"
                :key="option.value"
                class="focus-depth-item"
              >
                <RadioButton
                  :modelValue="focusDepth"
                  :inputId="`depth-${option.value}`"
                  :value="option.value"
                  :disabled="isFocusDisabled"
                  :data-testid="`focus-depth-radio-${option.value}`"
                  @update:modelValue="emit('update:focusDepth', $event)"
                />
                <label :for="`depth-${option.value}`" class="radio-label">
                  {{ option.label }}
                </label>
              </div>
            </div>
          </div>

          <!-- 적용 버튼 -->
          <Button
            label="적용"
            severity="primary"
            size="small"
            :disabled="isFocusDisabled"
            :data-testid="'focus-apply-btn'"
            @click="handleApplyFocus"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 필터 패널 기본 스타일 */
.graph-filter-panel {
  @apply border border-border rounded-lg bg-bg-card mb-3;
}

/* 필터 헤더 */
.filter-header {
  @apply flex items-center justify-between p-2;
}

.filter-header-left {
  @apply flex items-center gap-2;
}

.filter-stats {
  @apply flex gap-2;
}

/* 필터 콘텐츠 */
.filter-content {
  @apply px-4 pb-4 pt-2 space-y-4;
  border-top: 1px solid var(--color-border);
}

/* 필터 섹션 */
.filter-section {
  @apply space-y-2;
}

.filter-label {
  @apply block text-sm font-medium text-text mb-1;
}

/* Checkbox 그룹 */
.filter-checkboxes {
  @apply flex flex-wrap gap-4;
}

.filter-checkbox-item {
  @apply flex items-center gap-2;
}

.checkbox-label {
  @apply text-sm text-text cursor-pointer;
}

/* RadioButton 그룹 */
.filter-radios {
  @apply flex gap-4;
}

.filter-radio-item {
  @apply flex items-center gap-2;
}

.radio-label {
  @apply text-sm text-text cursor-pointer;
}

/* 초점 Task 영역 */
.filter-focus {
  @apply flex flex-col gap-3;
}

.focus-depth {
  @apply flex items-center gap-2;
}

.focus-depth-label {
  @apply text-sm text-text-secondary;
}

.focus-depth-radios {
  @apply flex gap-3;
}

.focus-depth-item {
  @apply flex items-center gap-1;
}

/* 반응형: Mobile */
@media (max-width: 767px) {
  .filter-checkboxes,
  .filter-radios {
    @apply flex-col gap-2;
  }

  .filter-focus {
    @apply flex-col;
  }
}
</style>
