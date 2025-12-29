<template>
  <Card class="project-detail-panel h-full" data-testid="project-detail-panel">
    <template #content>
      <div v-if="!projectNode" class="text-center text-text-muted">
        <p>프로젝트를 선택하세요</p>
      </div>

      <div v-else class="project-detail-content space-y-4">
        <!-- 프로젝트 헤더 -->
        <div class="project-header">
          <div class="flex items-center gap-3 mb-2">
            <i class="pi pi-folder text-violet-500 text-2xl"></i>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-text">{{ projectNode.title }}</h3>
              <p v-if="projectNode.projectMeta.description" class="text-sm text-text-secondary mt-1">
                {{ projectNode.projectMeta.description }}
              </p>
            </div>
          </div>
        </div>

        <Divider />

        <!-- 프로젝트 정보 섹션 -->
        <div class="space-y-3">
          <!-- 일정 -->
          <div v-if="projectNode.projectMeta.scheduledStart" class="project-schedule">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-calendar text-primary"></i>
              <span class="font-medium text-text">일정</span>
            </div>
            <p class="text-sm text-text-secondary ml-6">
              {{ formatDate(projectNode.projectMeta.scheduledStart) }}
              <span v-if="projectNode.projectMeta.scheduledEnd">
                ~ {{ formatDate(projectNode.projectMeta.scheduledEnd) }}
              </span>
            </p>
          </div>

          <!-- WBS 깊이 -->
          <div class="project-info">
            <div class="flex items-center gap-2">
              <i class="pi pi-sitemap text-primary"></i>
              <span class="text-sm text-text">WBS 깊이: {{ projectNode.projectMeta.wbsDepth }}단계</span>
            </div>
          </div>

          <!-- 상태 -->
          <div class="project-status">
            <div class="flex items-center gap-2">
              <i class="pi pi-info-circle text-primary"></i>
              <span class="text-sm text-text">상태: </span>
              <Tag
                :value="getStatusLabel(projectNode.projectMeta.status)"
                :severity="getStatusSeverity(projectNode.projectMeta.status)"
              />
            </div>
          </div>
        </div>

        <Divider />

        <!-- 진행률 -->
        <div class="project-progress">
          <div class="flex items-center justify-between mb-2">
            <span class="font-medium text-text">진행률</span>
            <span class="text-sm text-text-secondary">{{ projectNode.progress }}%</span>
          </div>
          <ProgressBar :value="projectNode.progress" :show-value="false" />
          <p class="text-xs text-text-muted mt-1">
            전체 Task: {{ projectNode.taskCount }}개
          </p>
        </div>

        <Divider />

        <!-- 파일 목록 -->
        <div class="project-files">
          <div class="flex items-center gap-2 mb-3">
            <i class="pi pi-folder-open text-primary"></i>
            <span class="font-medium text-text">파일 목록</span>
            <ProgressSpinner
              v-if="loadingFiles"
              style="width: 20px; height: 20px"
              stroke-width="4"
            />
          </div>

          <DataTable
            v-if="files.length > 0"
            :value="files"
            size="small"
            scrollable
            scrollHeight="400px"
            selectionMode="single"
            dataKey="path"
            class="project-file-table"
            @row-click="onRowClick"
          >
            <Column field="name" header="파일명" sortable style="min-width: 150px">
              <template #body="{ data }">
                <div class="flex items-center gap-2">
                  <i :class="['pi', fileTypeIcon(data.type)]"></i>
                  <span class="truncate">{{ data.name }}</span>
                </div>
              </template>
            </Column>
            <Column field="size" header="크기" sortable style="width: 80px">
              <template #body="{ data }">
                {{ formatFileSize(data.size) }}
              </template>
            </Column>
            <Column field="updatedAt" header="수정일" sortable style="width: 100px">
              <template #body="{ data }">
                {{ formatDate(data.updatedAt) }}
              </template>
            </Column>
          </DataTable>

          <p v-else-if="!loadingFiles" class="text-sm text-text-muted italic">
            파일이 없습니다
          </p>
        </div>
      </div>
    </template>
  </Card>

  <!-- 파일 뷰어 다이얼로그 -->
  <WbsDetailFileViewer
    v-if="selectedFile"
    :file="selectedFile"
    :visible="fileViewerVisible"
    :project-id="projectId"
    @update:visible="fileViewerVisible = $event"
  />
</template>

<script setup lang="ts">
/**
 * ProjectDetailPanel - 프로젝트 상세 정보 패널
 * TSK-09-01: 다중 프로젝트 WBS 통합 뷰
 *
 * 책임:
 * - 프로젝트 메타데이터 표시 (이름, 설명, 일정, 상태)
 * - 진행률 및 Task 개수 표시
 * - 프로젝트 파일 목록 (DataTable)
 * - 파일 뷰어 열기
 */

import type { ProjectFile, ProjectWbsNode } from '~/types'
import type { DataTableRowClickEvent } from 'primevue/datatable'
import { storeToRefs } from 'pinia'

interface Props {
  projectId: string
  files: ProjectFile[]
}

const props = defineProps<Props>()

// ============================================================
// Stores
// ============================================================
const wbsStore = useWbsStore()
const selectionStore = useSelectionStore()
const { loadingFiles } = storeToRefs(selectionStore)

// ============================================================
// Local State
// ============================================================
const selectedFile = ref<ProjectFile | null>(null)
const fileViewerVisible = ref(false)

// ============================================================
// Computed
// ============================================================
const projectNode = computed(() => {
  const node = wbsStore.getNode(props.projectId)
  return node as ProjectWbsNode | undefined
})

// ============================================================
// Methods
// ============================================================

/**
 * 테이블 행 클릭 → 파일 열기
 */
function onRowClick(event: DataTableRowClickEvent): void {
  const file = event.data as ProjectFile
  selectedFile.value = file
  fileViewerVisible.value = true
}

/**
 * 파일 타입별 아이콘 매핑
 */
function fileTypeIcon(type: ProjectFile['type']): string {
  const iconMap: Record<ProjectFile['type'], string> = {
    markdown: 'pi-file-edit',
    json: 'pi-code',
    image: 'pi-image',
    other: 'pi-file'
  }
  return iconMap[type]
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
 * 날짜 포맷팅 (YYYY-MM-DD or ISO string)
 * 테이블용: YY.MM.DD (간결한 형식)
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yy}.${mm}.${dd}`
  } catch {
    return dateStr
  }
}

/**
 * 프로젝트 상태 라벨
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '진행중',
    archived: '보관됨',
    completed: '완료'
  }
  return labels[status] || status
}

/**
 * 프로젝트 상태별 Severity
 */
function getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'secondary' {
  const severities: Record<string, 'success' | 'info' | 'warning' | 'secondary'> = {
    active: 'info',
    archived: 'secondary',
    completed: 'success'
  }
  return severities[status] || 'info'
}
</script>

<style scoped>
.project-detail-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.project-detail-content {
  padding: 0.5rem;
}

.project-file-table :deep(.p-datatable-tbody > tr) {
  cursor: pointer;
}

.project-file-table :deep(.p-datatable-tbody > tr:hover) {
  background-color: var(--color-bg-hover);
}
</style>
