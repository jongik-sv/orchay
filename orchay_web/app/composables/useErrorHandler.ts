/**
 * 에러 처리 서비스 Composable
 * Task: TSK-05-03
 * 상세설계: 020-detail-design.md 섹션 5.1, 11, 13 (설계리뷰 제안 7)
 *
 * 중앙화된 에러 처리:
 * - 에러 코드별 메시지 매핑
 * - Toast 알림 중앙 처리
 * - 복구 전략 제공
 * - 로깅 및 모니터링 용이
 */

import { useNotification } from './useNotification'

// 에러 코드 상수
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  ASSIGNEE_NOT_FOUND: 'ASSIGNEE_NOT_FOUND',
  WORKFLOW_VIOLATION: 'WORKFLOW_VIOLATION',
  FILE_WRITE_ERROR: 'FILE_WRITE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INVALID_COMMAND: 'INVALID_COMMAND',
  INVALID_TASK_ID: 'INVALID_TASK_ID',
} as const

export type ErrorCode = keyof typeof ERROR_CODES

// 에러 코드별 사용자 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.VALIDATION_ERROR]: '입력 값이 유효하지 않습니다. 다시 확인해주세요.',
  [ERROR_CODES.TASK_NOT_FOUND]: 'Task를 찾을 수 없습니다.',
  [ERROR_CODES.ASSIGNEE_NOT_FOUND]: '선택한 담당자가 팀원 목록에 없습니다.',
  [ERROR_CODES.WORKFLOW_VIOLATION]: '현재 상태에서 실행할 수 없는 명령어입니다.',
  [ERROR_CODES.FILE_WRITE_ERROR]: '데이터 저장에 실패했습니다. 잠시 후 다시 시도해주세요.',
  [ERROR_CODES.NETWORK_ERROR]: '네트워크 연결을 확인해주세요.',
  [ERROR_CODES.INTERNAL_ERROR]: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  [ERROR_CODES.INVALID_COMMAND]: '유효하지 않은 명령어입니다.',
  [ERROR_CODES.INVALID_TASK_ID]: '유효하지 않은 Task ID입니다.',
}

// 기본 에러 메시지
const DEFAULT_ERROR_MESSAGE = '알 수 없는 오류가 발생했습니다.'

// API 에러 인터페이스
export interface ApiError {
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: {
    code?: string
    message?: string
    [key: string]: unknown
  }
}

// 복구 전략 타입
export type RecoveryStrategy = 'retry' | 'redirect' | 'ignore' | 'custom'

export interface ErrorConfig {
  userMessage: string
  recoveryStrategy?: RecoveryStrategy
  recoveryAction?: () => void | Promise<void>
}

export function useErrorHandler() {
  const notification = useNotification()

  /**
   * 에러 코드 추출
   * API 응답 에러에서 코드를 추출
   */
  function extractErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null

    const apiError = error as ApiError

    // statusMessage에서 에러 코드 추출 (H3 에러)
    if (apiError.statusMessage) {
      return apiError.statusMessage
    }

    // data.code에서 에러 코드 추출
    if (apiError.data?.code) {
      return apiError.data.code
    }

    // 네트워크 에러 감지
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('network'))) {
      return ERROR_CODES.NETWORK_ERROR
    }

    return null
  }

  /**
   * 에러 메시지 추출
   * 에러 객체에서 사용자에게 표시할 메시지 추출
   */
  function extractErrorMessage(error: unknown): string {
    const errorCode = extractErrorCode(error)

    // 에러 코드가 있으면 매핑된 메시지 사용
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      return ERROR_MESSAGES[errorCode]
    }

    // API 에러의 message 필드 사용
    if (error && typeof error === 'object') {
      const apiError = error as ApiError
      if (apiError.message) return apiError.message
      if (apiError.data?.message) return apiError.data.message
    }

    // Error 인스턴스인 경우
    if (error instanceof Error) {
      return error.message
    }

    return DEFAULT_ERROR_MESSAGE
  }

  /**
   * 에러 처리 메인 함수
   * @param error 발생한 에러
   * @param context 에러 발생 컨텍스트 (로깅용)
   * @param config 추가 설정 (커스텀 메시지, 복구 전략)
   */
  function handle(
    error: unknown,
    context?: string,
    config?: Partial<ErrorConfig>
  ): void {
    // 1. 에러 로깅
    if (import.meta.dev) {
      console.error(`[ErrorHandler] Context: ${context || 'unknown'}`, error)
    }

    // 2. 사용자 메시지 결정
    const userMessage = config?.userMessage || extractErrorMessage(error)

    // 3. 알림 표시
    notification.error(userMessage)

    // 4. 복구 전략 실행
    if (config?.recoveryAction) {
      const result = config.recoveryAction()
      if (result instanceof Promise) {
        result.catch((e) => {
          console.error('[ErrorHandler] Recovery action failed:', e)
        })
      }
    }
  }

  /**
   * 특정 에러 코드인지 확인
   */
  function isErrorCode(error: unknown, code: ErrorCode): boolean {
    return extractErrorCode(error) === code
  }

  /**
   * 유효성 검증 에러인지 확인
   */
  function isValidationError(error: unknown): boolean {
    return isErrorCode(error, 'VALIDATION_ERROR')
  }

  /**
   * 네트워크 에러인지 확인
   */
  function isNetworkError(error: unknown): boolean {
    return isErrorCode(error, 'NETWORK_ERROR')
  }

  /**
   * Not Found 에러인지 확인
   */
  function isNotFoundError(error: unknown): boolean {
    return isErrorCode(error, 'TASK_NOT_FOUND')
  }

  return {
    handle,
    extractErrorCode,
    extractErrorMessage,
    isErrorCode,
    isValidationError,
    isNetworkError,
    isNotFoundError,
    ERROR_CODES,
  }
}
