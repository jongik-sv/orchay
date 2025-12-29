/**
 * 알림 서비스 Composable
 * Task: TSK-05-03
 * 상세설계: 020-detail-design.md 섹션 5.1, 13 (설계리뷰 제안 4)
 *
 * PrimeVue Toast를 추상화하여 일관된 알림 인터페이스 제공
 * - Toast 라이브러리 변경 시 이 파일만 수정
 * - 테스트 시 Mock 서비스 주입 용이
 * - 알림 로직 중앙 관리
 */

import { useToast } from 'primevue/usetoast'

export interface NotificationOptions {
  life?: number        // 자동 사라짐 시간 (ms), 기본값: 3000
  closable?: boolean   // 닫기 버튼 표시, 기본값: true
  sticky?: boolean     // 자동 사라짐 비활성화, 기본값: false
}

// Severity 타입 정의 (PrimeVue Toast 호환)
type NotificationSeverity = 'success' | 'info' | 'warn' | 'error'

// 알림 설정 인터페이스
interface NotificationConfig {
  severity: NotificationSeverity
  summary: string
  defaultLife: number
}

// 기본 설정값
const DEFAULT_LIFE = 3000
const SUCCESS_LIFE = 2000
const ERROR_LIFE = 5000

// 알림 타입별 설정 (중앙화)
const NOTIFICATION_CONFIGS: Record<string, NotificationConfig> = {
  success: { severity: 'success', summary: '성공', defaultLife: SUCCESS_LIFE },
  error: { severity: 'error', summary: '오류', defaultLife: ERROR_LIFE },
  warning: { severity: 'warn', summary: '경고', defaultLife: DEFAULT_LIFE },
  info: { severity: 'info', summary: '안내', defaultLife: DEFAULT_LIFE },
}

export function useNotification() {
  const toast = useToast()

  /**
   * 공통 알림 함수 (내부용)
   * @param type 알림 타입
   * @param message 표시할 메시지
   * @param options 추가 옵션
   */
  function notify(
    type: keyof typeof NOTIFICATION_CONFIGS,
    message: string,
    options?: NotificationOptions
  ) {
    const config = NOTIFICATION_CONFIGS[type]
    toast.add({
      severity: config.severity,
      summary: config.summary,
      detail: message,
      life: options?.sticky ? undefined : (options?.life ?? config.defaultLife),
      closable: options?.closable ?? true,
    })
  }

  /**
   * 성공 알림
   */
  function success(message: string, options?: NotificationOptions) {
    notify('success', message, options)
  }

  /**
   * 에러 알림
   */
  function error(message: string, options?: NotificationOptions) {
    notify('error', message, options)
  }

  /**
   * 경고 알림
   */
  function warning(message: string, options?: NotificationOptions) {
    notify('warning', message, options)
  }

  /**
   * 정보 알림
   */
  function info(message: string, options?: NotificationOptions) {
    notify('info', message, options)
  }

  /**
   * 모든 알림 제거
   */
  function clear() {
    toast.removeAllGroups()
  }

  return {
    success,
    error,
    warning,
    info,
    clear,
  }
}
