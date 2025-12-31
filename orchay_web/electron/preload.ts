import { contextBridge, ipcRenderer } from 'electron'

/**
 * Electron API를 렌더러 프로세스에 안전하게 노출
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 디렉토리 선택 다이얼로그 열기
   */
  selectDirectory: (): Promise<string | null> => {
    return ipcRenderer.invoke('dialog:selectDirectory')
  },

  /**
   * 현재 ORCHAY_BASE_PATH 조회
   */
  getBasePath: (): Promise<string> => {
    return ipcRenderer.invoke('config:getBasePath')
  },

  /**
   * ORCHAY_BASE_PATH 설정 (영구 저장)
   */
  setBasePath: (path: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    return ipcRenderer.invoke('config:setBasePath', path)
  },

  /**
   * 최근 사용한 경로 목록 조회
   */
  getRecentPaths: (): Promise<string[]> => {
    return ipcRenderer.invoke('config:getRecentPaths')
  },

  /**
   * DevTools 토글 (개발용)
   */
  toggleDevTools: (): Promise<void> => {
    return ipcRenderer.invoke('dev:toggleDevTools')
  },

  /**
   * Electron 환경인지 확인
   */
  isElectron: true
})

// TypeScript 타입 선언
declare global {
  interface Window {
    electronAPI?: {
      selectDirectory: () => Promise<string | null>
      getBasePath: () => Promise<string>
      setBasePath: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
      getRecentPaths: () => Promise<string[]>
      toggleDevTools: () => Promise<void>
      isElectron: boolean
    }
  }
}
