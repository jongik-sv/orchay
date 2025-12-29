<template>
  <Panel
    header="관련 문서"
    class="task-documents-panel mt-4"
    data-testid="task-documents-panel"
    :toggleable="true"
  >
    <!-- 문서 테이블 -->
    <DataTable
      v-if="documents.length > 0"
      :value="documents"
      size="small"
      scrollable
      scrollHeight="400px"
      selectionMode="single"
      dataKey="path"
      class="task-documents-table"
      @row-click="onRowClick"
    >
      <Column field="name" header="문서명" sortable style="min-width: 180px">
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <i
              :class="getDocumentIcon(data)"
              :style="{ color: getDocumentColor(data) }"
            />
            <span :class="{ 'text-text-muted': !data.exists }">{{ data.name }}</span>
            <Tag v-if="!data.exists" value="예정" severity="secondary" class="text-xs" />
          </div>
        </template>
      </Column>
      <Column field="type" header="타입" sortable style="width: 120px">
        <template #body="{ data }">
          {{ getDocumentTypeLabel(data.type) }}
        </template>
      </Column>
      <Column field="size" header="크기" sortable style="width: 80px">
        <template #body="{ data }">
          <span v-if="data.exists && data.size">{{ formatFileSize(data.size) }}</span>
          <span v-else class="text-text-muted">-</span>
        </template>
      </Column>
      <Column field="updatedAt" header="수정일" sortable style="width: 110px">
        <template #body="{ data }">
          <span v-if="data.exists && data.updatedAt">{{ formatDate(data.updatedAt) }}</span>
          <span v-else class="text-text-muted">-</span>
        </template>
      </Column>
    </DataTable>

    <!-- 빈 상태 -->
    <Message v-else severity="info">
      관련 문서가 없습니다
    </Message>
  </Panel>
</template>

<script setup lang="ts">
/**
 * TaskDocuments - 문서 목록 테이블 컴포넌트
 * Task: TSK-05-02
 *
 * 책임:
 * - 문서 목록 표시 (DataTable)
 * - 존재/예정 상태 시각적 구분
 * - 문서 타입별 아이콘/색상 적용
 * - open-document 이벤트 발행
 */

import type { DocumentInfo } from '~/types'
import type { DataTableRowClickEvent } from 'primevue/datatable'
import { DOCUMENT_TYPE_CONFIG } from '~/utils/documentConfig'

// ============================================================
// Props & Emits
// ============================================================
interface Props {
  documents: DocumentInfo[]
}

interface Emits {
  (e: 'open-document', document: DocumentInfo): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// ============================================================
// Methods
// ============================================================

/**
 * 테이블 행 클릭 → 문서 열기
 */
function onRowClick(event: DataTableRowClickEvent): void {
  const doc = event.data as DocumentInfo
  if (doc.exists) {
    emit('open-document', doc)
  }
}

/**
 * 문서 타입별 아이콘 가져오기
 */
function getDocumentIcon(doc: DocumentInfo): string {
  return DOCUMENT_TYPE_CONFIG[doc.type]?.icon || 'pi pi-file'
}

/**
 * 문서 타입별 색상 가져오기
 */
function getDocumentColor(doc: DocumentInfo): string {
  return DOCUMENT_TYPE_CONFIG[doc.type]?.color || 'var(--color-text-muted)'
}

/**
 * 문서 타입 레이블 가져오기
 */
function getDocumentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_CONFIG[type]?.label || '문서'
}

/**
 * 파일 크기 포맷팅
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * 날짜 포맷팅
 * 테이블용: YY.MM.DD (간결한 형식)
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const yy = String(date.getFullYear()).slice(-2)
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}.${mm}.${dd}`
}
</script>

<style scoped>
.task-documents-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.task-documents-table :deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--color-bg-hover);
}
</style>
