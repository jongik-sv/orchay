<script setup lang="ts">
/**
 * SetupDialog - 홈 디렉토리 선택 다이얼로그
 * Task: 홈 디렉토리 선택 기능
 *
 * @features
 * - 두 가지 모드: initial (닫기 불가), change (닫기 가능)
 * - Electron: 네이티브 폴더 선택 다이얼로그
 * - Web: 텍스트 입력
 * - 경로 검증 및 에러 표시
 * - Hot reload: 설정 완료 후 데이터 갱신
 */

import { useToast } from 'primevue/usetoast';

// ============================================================
// Composables & Stores
// ============================================================

const configStore = useConfigStore();
const wbsStore = useWbsStore();
const projectStore = useProjectStore();
const toast = useToast();

// ============================================================
// Local State
// ============================================================

/** 입력된 경로 */
const inputPath = ref('');

/** 검증 에러 메시지 */
const validationError = ref<string | null>(null);

/** 제출 중 여부 */
const isSubmitting = ref(false);

// ============================================================
// Computed
// ============================================================

/** 다이얼로그 표시 여부 (로컬 상태) */
const visible = ref(false);

// 스토어 상태와 동기화 (클라이언트에서만)
onMounted(() => {
  // 초기 동기화
  visible.value = configStore.showSetupDialog;

  // 이후 변경 감지
  watch(
    () => configStore.showSetupDialog,
    (newValue) => {
      visible.value = newValue;
    }
  );
});

// 다이얼로그 닫힘 이벤트 처리
function handleVisibleChange(newValue: boolean) {
  if (!newValue && configStore.dialogMode === 'change') {
    configStore.closeDialog();
  }
}

/** 닫기 가능 여부 (변경 모드에서만) */
const isClosable = computed(() => configStore.dialogMode === 'change');

/** 다이얼로그 헤더 */
const dialogHeader = computed(() => {
  return configStore.dialogMode === 'initial'
    ? 'Orchay 홈 디렉토리 설정'
    : '홈 디렉토리 변경';
});

/** 제출 버튼 레이블 */
const submitLabel = computed(() => {
  return configStore.dialogMode === 'initial' ? '설정' : '변경';
});

// ============================================================
// Watch
// ============================================================

// 다이얼로그가 열릴 때 현재 경로로 초기화
watch(
  () => configStore.showSetupDialog,
  (isOpen) => {
    if (isOpen) {
      // 변경 모드면 현재 경로 표시, 초기 모드면 비움
      inputPath.value = configStore.dialogMode === 'change' ? configStore.basePath : '';
      validationError.value = null;
    }
  }
);

// ============================================================
// Methods
// ============================================================

/**
 * 폴더 선택 버튼 클릭 (Electron 전용)
 */
async function handleBrowse(): Promise<void> {
  const selected = await configStore.selectDirectory();
  if (selected) {
    inputPath.value = selected;
    validationError.value = null;
  }
}

/**
 * 경로 검증
 */
function validatePath(path: string): boolean {
  if (!path.trim()) {
    validationError.value = '경로를 입력해주세요';
    return false;
  }

  // 절대 경로 검증 (Windows/Unix)
  const isAbsolute = /^([A-Za-z]:\\|\/|~)/.test(path);
  if (!isAbsolute) {
    validationError.value = '절대 경로를 입력해주세요 (예: C:\\projects 또는 /home/user/projects)';
    return false;
  }

  // 경로 순회 검증
  if (path.includes('..')) {
    validationError.value = '상위 디렉토리 참조(..)는 사용할 수 없습니다';
    return false;
  }

  validationError.value = null;
  return true;
}

/**
 * 설정/변경 버튼 클릭
 */
async function handleSubmit(): Promise<void> {
  if (!validatePath(inputPath.value)) {
    return;
  }

  isSubmitting.value = true;

  try {
    // 1. 경로 설정
    await configStore.setBasePath(inputPath.value);

    // 2. Hot reload: 데이터 갱신
    try {
      await Promise.all([
        wbsStore.fetchAllWbs?.() || Promise.resolve(),
        projectStore.fetchProjects?.() || Promise.resolve(),
      ]);
    } catch (hotReloadError) {
      console.warn('[SetupDialog] Hot reload failed:', hotReloadError);
    }

    // 3. 성공 토스트
    toast.add({
      severity: 'success',
      summary: '설정 완료',
      detail: `홈 디렉토리가 ${inputPath.value}로 설정되었습니다`,
      life: 3000,
    });
  } catch (e) {
    // 에러 토스트
    toast.add({
      severity: 'error',
      summary: '설정 실패',
      detail: e instanceof Error ? e.message : '경로 설정에 실패했습니다',
      life: 5000,
    });
  } finally {
    isSubmitting.value = false;
  }
}

/**
 * 최근 경로 선택
 */
function selectRecentPath(path: string): void {
  inputPath.value = path;
  validationError.value = null;
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :closable="isClosable"
    :draggable="false"
    :header="dialogHeader"
    class="w-[500px]"
    data-testid="setup-dialog"
    @update:visible="handleVisibleChange"
  >
    <div class="space-y-4">
      <!-- 설명 -->
      <p class="text-text-secondary text-sm">
        <code class="bg-surface-100 dark:bg-surface-800 px-1 rounded">.orchay</code>
        폴더가 있는 프로젝트 루트 경로를 선택해주세요.
      </p>

      <!-- 현재 경로 (변경 모드) -->
      <div
        v-if="configStore.dialogMode === 'change' && configStore.basePath"
        class="bg-surface-100 dark:bg-surface-800 p-3 rounded-lg"
      >
        <span class="text-sm text-text-secondary">현재 경로: </span>
        <span class="text-sm font-mono">{{ configStore.basePath }}</span>
      </div>

      <!-- 경로 입력 -->
      <div class="flex gap-2">
        <InputText
          v-model="inputPath"
          placeholder="/path/to/projects"
          class="flex-1"
          :class="{ 'p-invalid': validationError }"
          data-testid="path-input"
          @keyup.enter="handleSubmit"
        />

        <!-- Electron 전용: 폴더 선택 버튼 -->
        <Button
          v-if="configStore.isElectron"
          icon="pi pi-folder-open"
          severity="secondary"
          aria-label="폴더 선택"
          data-testid="browse-button"
          @click="handleBrowse"
        />
      </div>

      <!-- 검증 에러 -->
      <small v-if="validationError" class="text-red-500">
        {{ validationError }}
      </small>

      <!-- 최근 경로 목록 (Electron 전용, 변경 모드) -->
      <div
        v-if="configStore.isElectron && configStore.recentPaths.length > 0 && configStore.dialogMode === 'change'"
        class="space-y-2"
      >
        <span class="text-sm text-text-secondary">최근 사용:</span>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="path in configStore.recentPaths"
            :key="path"
            :label="path"
            size="small"
            severity="secondary"
            text
            class="text-xs font-mono truncate max-w-[200px]"
            @click="selectRecentPath(path)"
          />
        </div>
      </div>

      <!-- 웹 모드 안내 -->
      <Message
        v-if="!configStore.isElectron"
        severity="info"
        :closable="false"
        class="text-sm"
      >
        웹 브라우저에서는 서버가 접근 가능한 절대 경로를 직접 입력해주세요.
      </Message>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <!-- 취소 버튼 (변경 모드에서만) -->
        <Button
          v-if="isClosable"
          label="취소"
          severity="secondary"
          text
          @click="configStore.closeDialog"
        />

        <!-- 설정/변경 버튼 -->
        <Button
          :label="submitLabel"
          icon="pi pi-check"
          :loading="isSubmitting"
          :disabled="!inputPath.trim()"
          data-testid="submit-button"
          @click="handleSubmit"
        />
      </div>
    </template>
  </Dialog>
</template>
