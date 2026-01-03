/**
 * WBS 파일 변경 감지 composable
 * Tauri/Web 환경 모두 지원
 *
 * @example
 * ```ts
 * const { isWatching, error } = useWbsWatcher({
 *   onChanged: (event) => {
 *     console.log('WBS changed:', event.projectId)
 *     wbsStore.handleWbsChanged(event.projectId)
 *   }
 * })
 * ```
 */

import { ref, onMounted, onUnmounted } from 'vue'
import * as tauriApi from '~/utils/tauri'
import type { WbsChangedEvent } from '~/utils/tauri'

export interface UseWbsWatcherOptions {
  /** WBS 변경 시 호출되는 콜백 */
  onChanged: (event: WbsChangedEvent) => void
  /** 특정 프로젝트만 필터링 (선택적) */
  projectId?: string
  /** 자동 시작 여부 (기본: true) */
  autoStart?: boolean
}

export function useWbsWatcher(options: UseWbsWatcherOptions) {
  const isWatching = ref(false)
  const error = ref<string | null>(null)
  let unlisten: (() => void) | null = null
  let ws: WebSocket | null = null

  /**
   * Watcher 시작
   */
  async function startWatching() {
    if (isWatching.value) return

    try {
      if (tauriApi.isTauri()) {
        // Tauri 환경: 이벤트 리스너 등록
        unlisten = await tauriApi.onWbsChanged((event) => {
          // 프로젝트 ID 필터링
          if (options.projectId && event.projectId !== options.projectId) {
            return
          }
          options.onChanged(event)
        })

        // watcher 시작
        const configStore = useConfigStore()
        if (configStore.basePath) {
          await tauriApi.startWbsWatcher(configStore.basePath)
        }
      } else {
        // Web 환경: WebSocket 연결
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        ws = new WebSocket(`${protocol}//${window.location.host}/api/wbs/watch`)

        ws.onmessage = (event) => {
          try {
            const payload: WbsChangedEvent = JSON.parse(event.data)

            // 프로젝트 ID 필터링
            if (options.projectId && payload.projectId !== options.projectId) {
              return
            }

            options.onChanged(payload)
          } catch (e) {
            console.error('[WbsWatcher] Failed to parse message:', e)
          }
        }

        ws.onerror = (e) => {
          error.value = 'WebSocket connection error'
          console.error('[WbsWatcher] WebSocket error:', e)
        }

        ws.onclose = () => {
          isWatching.value = false
          console.log('[WbsWatcher] WebSocket closed')
        }
      }

      isWatching.value = true
      error.value = null
      console.log('[WbsWatcher] Started watching')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to start watcher'
      console.error('[WbsWatcher] Failed to start:', e)
    }
  }

  /**
   * Watcher 중지
   */
  async function stopWatching() {
    if (!isWatching.value) return

    try {
      if (tauriApi.isTauri()) {
        // Tauri 환경: 이벤트 리스너 해제 및 watcher 중지
        if (unlisten) {
          unlisten()
          unlisten = null
        }
        await tauriApi.stopWbsWatcher()
      } else {
        // Web 환경: WebSocket 닫기
        if (ws) {
          ws.close()
          ws = null
        }
      }

      isWatching.value = false
      console.log('[WbsWatcher] Stopped watching')
    } catch (e) {
      console.error('[WbsWatcher] Failed to stop:', e)
    }
  }

  // 라이프사이클
  onMounted(() => {
    if (options.autoStart !== false) {
      startWatching()
    }
  })

  onUnmounted(() => {
    stopWatching()
  })

  return {
    isWatching: readonly(isWatching),
    error: readonly(error),
    startWatching,
    stopWatching,
  }
}
