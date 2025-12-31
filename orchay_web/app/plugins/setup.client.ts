/**
 * Setup Plugin - 앱 초기화 상태 확인
 * Task: 홈 디렉토리 선택 기능
 *
 * 앱 시작 시 .orchay 폴더 존재 여부를 확인하고,
 * 없으면 SetupDialog를 표시합니다.
 */

export default defineNuxtPlugin(async () => {
  // SSR에서는 실행하지 않음
  if (import.meta.server) {
    return;
  }

  const configStore = useConfigStore();

  // 초기화 상태 확인
  await configStore.checkInitStatus();

  console.log('[Setup] Initialized:', configStore.initialized);
  console.log('[Setup] Base path:', configStore.basePath);
});
