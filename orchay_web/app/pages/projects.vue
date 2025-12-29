<template>
  <div class="projects-page min-h-screen bg-surface-50 dark:bg-surface-900 p-6">
    <!-- 헤더 섹션 -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-6 text-surface-900 dark:text-surface-50">
        Projects
      </h1>

      <!-- 필터 버튼 -->
      <SelectButton
        v-model="filterStatus"
        :options="filterOptions"
        option-label="label"
        option-value="value"
        class="mb-4"
      />
    </div>

    <!-- 로딩 상태 -->
    <div v-if="pending" class="flex justify-center items-center h-64">
      <ProgressSpinner />
    </div>

    <!-- 에러 상태 -->
    <InlineMessage
      v-else-if="error"
      severity="error"
      class="mb-4"
    >
      프로젝트 목록을 불러오는 중 오류가 발생했습니다: {{ error.message }}
    </InlineMessage>

    <!-- 빈 상태 -->
    <InlineMessage
      v-else-if="filteredProjects.length === 0"
      severity="info"
      class="mb-4"
    >
      {{ filterStatus === 'all' ? '프로젝트가 없습니다.' : `${filterStatus} 상태의 프로젝트가 없습니다.` }}
    </InlineMessage>

    <!-- 프로젝트 카드 그리드 -->
    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <Card
        v-for="project in filteredProjects"
        :key="project.id"
        class="cursor-pointer hover:shadow-lg transition-shadow duration-200"
        @click="navigateToWbs(project.id)"
      >
        <template #title>
          <div class="flex items-center justify-between">
            <span class="text-xl font-semibold">{{ project.name }}</span>
            <Badge
              v-if="project.id === defaultProject"
              value="Default"
              severity="success"
            />
          </div>
        </template>

        <template #content>
          <div class="space-y-3">
            <!-- 상태 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-surface-600 dark:text-surface-400">Status:</span>
              <Tag
                :value="project.status"
                :severity="project.status === 'active' ? 'success' : 'secondary'"
              />
            </div>

            <!-- WBS 깊이 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-surface-600 dark:text-surface-400">WBS Depth:</span>
              <span class="text-sm font-medium">{{ project.wbsDepth }} Levels</span>
            </div>

            <!-- 생성일 -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-surface-600 dark:text-surface-400">Created:</span>
              <span class="text-sm">{{ formatDate(project.createdAt) }}</span>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { formatDate } from '~/utils/format';
import { encodePathSegment } from '~/utils/urlPath';

// 타입 정의 (server/utils/projects/types.ts에서 복사)
interface ProjectListItem {
  id: string;
  name: string;
  path: string;
  status: 'active' | 'archived';
  wbsDepth: 3 | 4;
  createdAt: string;
}

interface ProjectListResponse {
  projects: ProjectListItem[];
  defaultProject: string | null;
  total: number;
}

/**
 * Projects Page
 *
 * @see TSK-04-00
 * @see 010-basic-design.md
 * @see 020-detail-design.md
 */

// ============================================================
// API 호출
// ============================================================

const {
  data,
  pending,
  error,
  refresh,
} = await useFetch<ProjectListResponse>('/api/projects', {
  key: 'projects-list',
  timeout: 5000, // 5초 타임아웃 (C-002)
  retry: 2, // 2회 재시도 (C-002)
  retryDelay: 1000, // 1초 간격 (C-002)
});

// ============================================================
// 상태 관리
// ============================================================

// 필터 상태
const filterStatus = ref<'all' | 'active' | 'archived'>('all');

// 필터 옵션
const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Archived', value: 'archived' },
];

// ============================================================
// Computed Properties
// ============================================================

// 기본 프로젝트 ID
const defaultProject = computed(() => data.value?.defaultProject ?? null);

// 필터링된 프로젝트 목록
const filteredProjects = computed<ProjectListItem[]>(() => {
  if (!data.value?.projects) return [];

  if (filterStatus.value === 'all') {
    return data.value.projects;
  }

  return data.value.projects.filter(
    (project: ProjectListItem) => project.status === filterStatus.value
  );
});

// ============================================================
// 이벤트 핸들러
// ============================================================

/**
 * WBS 페이지로 이동 (M-003: 입력 검증 및 URL 인코딩 추가)
 */
function navigateToWbs(projectId: string): void {
  // 방어적 검증 (M-003)
  if (!projectId || typeof projectId !== 'string') {
    console.error('[Projects] Invalid project ID:', projectId);
    return;
  }

  // URL 인코딩으로 특수문자 처리 (한글, 공백, 괄호 등)
  const encodedId = encodePathSegment(projectId);
  navigateTo(`/wbs?project=${encodedId}`);
}
</script>
