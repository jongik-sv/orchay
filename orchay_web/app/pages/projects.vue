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

    <!-- 설정 필요 상태 -->
    <InlineMessage
      v-if="configStore.needsSetup"
      severity="warn"
      class="mb-4"
    >
      홈 디렉토리를 먼저 설정해주세요.
    </InlineMessage>

    <!-- 로딩 상태 -->
    <div v-else-if="projectStore.loading" class="flex justify-center items-center h-64">
      <ProgressSpinner />
    </div>

    <!-- 에러 상태 -->
    <InlineMessage
      v-else-if="projectStore.error"
      severity="error"
      class="mb-4"
    >
      프로젝트 목록을 불러오는 중 오류가 발생했습니다: {{ projectStore.error }}
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
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { encodePathSegment } from '~/utils/urlPath';

/**
 * Projects Page
 *
 * @see TSK-04-00
 * @see 010-basic-design.md
 * @see 020-detail-design.md
 */

// ============================================================
// Stores
// ============================================================

const configStore = useConfigStore()
const projectStore = useProjectStore()

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

// 필터링된 프로젝트 목록
const filteredProjects = computed(() => {
  const projects = projectStore.projects || []

  if (filterStatus.value === 'all') {
    return projects;
  }

  return projects.filter(
    (project) => project.status === filterStatus.value
  );
});

// ============================================================
// Lifecycle
// ============================================================

onMounted(async () => {
  // 설정이 완료된 경우에만 프로젝트 목록 로드
  if (configStore.initialized) {
    await projectStore.fetchProjects()
  }
})

// configStore.initialized가 변경되면 프로젝트 목록 로드
watch(
  () => configStore.initialized,
  async (initialized) => {
    if (initialized && projectStore.projects.length === 0) {
      await projectStore.fetchProjects()
    }
  }
)

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
