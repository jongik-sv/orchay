/**
 * 앱 설정 스토어
 * Task: 홈 디렉토리 선택 기능
 *
 * 홈 디렉토리 선택 및 초기화 상태를 관리합니다.
 * Tauri/Electron/Web 환경을 자동 감지합니다.
 */

import { defineStore } from 'pinia';
import type { GetBasePathResponse } from '../../types/appConfig';
import * as tauriApi from '../utils/tauri';

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

  /** Tauri 환경 여부 */
  const isTauri = computed(() => tauriApi.isTauri());

  /** Electron 환경 여부 */
  const isElectron = computed(() => {
    if (typeof window === 'undefined') return false;
    return !!window.electronAPI?.isElectron;
  });

  /** 데스크톱 환경 여부 (Tauri 또는 Electron) */
  const isDesktop = computed(() => isTauri.value || isElectron.value);

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
      if (isTauri.value) {
        // Tauri 환경: Rust 커맨드 사용
        let path = '';
        try {
          path = await tauriApi.getBasePath();
        } catch (e) {
          console.warn('[ConfigStore] Failed to get base path:', e);
          path = '';
        }

        basePath.value = path || '';
        orchayRoot.value = path ? `${path}/.orchay` : '';

        if (path) {
          try {
            const initResponse = await tauriApi.checkInitStatus(path);
            initialized.value = initResponse?.data?.initialized ?? false;
          } catch (e) {
            console.warn('[ConfigStore] Failed to check init status:', e);
            initialized.value = false;
          }
        } else {
          initialized.value = false;
        }

        // 최근 경로 목록 로드
        try {
          const paths = await tauriApi.getRecentPaths();
          recentPaths.value = Array.isArray(paths) ? paths : [];
        } catch (e) {
          console.warn('[ConfigStore] Failed to get recent paths:', e);
          recentPaths.value = [];
        }
      } else if (isElectron.value) {
        // Electron 환경: 기존 API 사용
        const response = await $fetch<GetBasePathResponse>('/api/config/basePath');

        basePath.value = response.data.basePath;
        orchayRoot.value = response.data.orchayRoot;
        initialized.value = response.data.initialized;

        recentPaths.value = await window.electronAPI!.getRecentPaths();
      } else {
        // 웹 환경: Nitro API 사용
        const response = await $fetch<GetBasePathResponse>('/api/config/basePath');

        basePath.value = response.data.basePath;
        orchayRoot.value = response.data.orchayRoot;
        initialized.value = response.data.initialized;
      }

      // 초기화되지 않았으면 다이얼로그 표시
      if (!initialized.value) {
        dialogMode.value = 'initial';
        showSetupDialog.value = true;
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
    console.log('[ConfigStore] setBasePath START:', newPath);
    loading.value = true;
    error.value = null;

    try {
      if (isTauri.value) {
        // Tauri 환경: Rust 커맨드 사용
        console.log('[ConfigStore] Calling tauriApi.setBasePath...');
        const result = await tauriApi.setBasePath(newPath);
        console.log('[ConfigStore] tauriApi.setBasePath result:', result);
        if (!result.success) {
          throw new Error('Tauri 경로 설정 실패');
        }

        // 상태 업데이트
        basePath.value = newPath;
        orchayRoot.value = `${newPath}/.orchay`;
        initialized.value = true;
        showSetupDialog.value = false;
        console.log('[ConfigStore] State updated: initialized=true, showSetupDialog=false');

        // 최근 경로 목록 갱신
        recentPaths.value = await tauriApi.getRecentPaths();
        console.log('[ConfigStore] Recent paths loaded:', recentPaths.value.length);
      } else if (isElectron.value) {
        // Electron 환경: 기존 방식
        const result = await window.electronAPI!.setBasePath(newPath);
        if (!result.success) {
          throw new Error(result.error || 'Electron 경로 설정 실패');
        }

        // 서버에 경로 변경 요청
        await $fetch('/api/config/basePath', {
          method: 'PUT',
          body: { basePath: newPath, createIfMissing: false },
        });

        basePath.value = newPath;
        initialized.value = true;
        showSetupDialog.value = false;

        recentPaths.value = await window.electronAPI!.getRecentPaths();
      } else {
        // 웹 환경: Nitro API 사용
        await $fetch('/api/config/basePath', {
          method: 'PUT',
          body: { basePath: newPath, createIfMissing: false },
        });

        basePath.value = newPath;
        initialized.value = true;
        showSetupDialog.value = false;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '경로 설정 실패';
      console.error('[ConfigStore] Failed to set base path:', e);
      throw e;
    } finally {
      loading.value = false;
      console.log('[ConfigStore] setBasePath END');
    }
  }

  /**
   * 디렉토리 선택 다이얼로그 열기 (데스크톱 전용)
   *
   * @returns 선택된 경로 또는 null
   */
  async function selectDirectory(): Promise<string | null> {
    if (isTauri.value) {
      return await tauriApi.selectDirectory();
    } else if (isElectron.value) {
      return await window.electronAPI!.selectDirectory();
    }
    return null;
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
    isTauri,
    isElectron,
    isDesktop,
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
