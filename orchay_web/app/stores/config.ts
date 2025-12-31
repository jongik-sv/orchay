/**
 * 앱 설정 스토어
 * Task: 홈 디렉토리 선택 기능
 *
 * 홈 디렉토리 선택 및 초기화 상태를 관리합니다.
 */

import { defineStore } from 'pinia';
import type { GetBasePathResponse } from '../../types/appConfig';

/**
 * 다이얼로그 모드
 * - initial: 초기 설정 (닫기 불가)
 * - change: 경로 변경 (닫기 가능)
 */
export type DialogMode = 'initial' | 'change';

/**
 * Config Store
 */
export const useConfigStore = defineStore('config', () => {
  // ============================================================
  // State
  // ============================================================

  /** 현재 기본 경로 */
  const basePath = ref<string>('');

  /** .orchay 루트 경로 */
  const orchayRoot = ref<string>('');

  /** 초기화 여부 (.orchay 폴더 존재 여부) */
  const initialized = ref(false);

  /** 로딩 상태 */
  const loading = ref(false);

  /** 에러 메시지 */
  const error = ref<string | null>(null);

  /** SetupDialog 표시 여부 */
  const showSetupDialog = ref(false);

  /** 다이얼로그 모드 */
  const dialogMode = ref<DialogMode>('initial');

  /** 최근 경로 목록 (Electron 전용) */
  const recentPaths = ref<string[]>([]);

  // ============================================================
  // Getters
  // ============================================================

  /** Electron 환경 여부 */
  const isElectron = computed(() => {
    if (typeof window === 'undefined') return false;
    return !!window.electronAPI?.isElectron;
  });

  /** 설정이 필요한지 여부 */
  const needsSetup = computed(() => !initialized.value);

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 초기화 상태 확인
   * 앱 시작 시 호출하여 .orchay 존재 여부 확인
   */
  async function checkInitStatus(): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const response = await $fetch<GetBasePathResponse>('/api/config/basePath');

      basePath.value = response.data.basePath;
      orchayRoot.value = response.data.orchayRoot;
      initialized.value = response.data.initialized;

      // 초기화되지 않았으면 다이얼로그 표시
      if (!initialized.value) {
        dialogMode.value = 'initial';
        showSetupDialog.value = true;
      }

      // Electron에서 최근 경로 목록 로드
      if (isElectron.value) {
        recentPaths.value = await window.electronAPI!.getRecentPaths();
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '초기화 상태 확인 실패';
      console.error('[ConfigStore] Failed to check init status:', e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 기본 경로 설정 (Hot reload)
   *
   * @param newPath - 새 기본 경로
   */
  async function setBasePath(newPath: string): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      // 1. Electron이면 로컬 저장소에도 저장
      if (isElectron.value) {
        const result = await window.electronAPI!.setBasePath(newPath);
        if (!result.success) {
          throw new Error(result.error || 'Electron 경로 설정 실패');
        }
      }

      // 2. 서버에 경로 변경 요청 (기존 폴더만 열기, 생성하지 않음)
      await $fetch('/api/config/basePath', {
        method: 'PUT',
        body: { basePath: newPath, createIfMissing: false },
      });

      // 3. 상태 업데이트
      basePath.value = newPath;
      initialized.value = true;
      showSetupDialog.value = false;

      // 4. 최근 경로 목록 갱신
      if (isElectron.value) {
        recentPaths.value = await window.electronAPI!.getRecentPaths();
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '경로 설정 실패';
      console.error('[ConfigStore] Failed to set base path:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 디렉토리 선택 다이얼로그 열기 (Electron 전용)
   *
   * @returns 선택된 경로 또는 null
   */
  async function selectDirectory(): Promise<string | null> {
    if (!isElectron.value) {
      return null;
    }
    return await window.electronAPI!.selectDirectory();
  }

  /**
   * 변경 모드로 다이얼로그 열기
   * (헤더 버튼에서 호출)
   */
  function openChangeDialog(): void {
    dialogMode.value = 'change';
    showSetupDialog.value = true;
  }

  /**
   * 다이얼로그 닫기
   * (변경 모드에서만 가능)
   */
  function closeDialog(): void {
    if (dialogMode.value === 'change') {
      showSetupDialog.value = false;
    }
  }

  /**
   * 상태 초기화
   */
  function reset(): void {
    basePath.value = '';
    orchayRoot.value = '';
    initialized.value = false;
    loading.value = false;
    error.value = null;
    showSetupDialog.value = false;
    dialogMode.value = 'initial';
    recentPaths.value = [];
  }

  return {
    // State
    basePath,
    orchayRoot,
    initialized,
    loading,
    error,
    showSetupDialog,
    dialogMode,
    recentPaths,

    // Getters
    isElectron,
    needsSetup,

    // Actions
    checkInitStatus,
    setBasePath,
    selectDirectory,
    openChangeDialog,
    closeDialog,
    reset,
  };
});
