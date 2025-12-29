/**
 * 낙관적 업데이트 서비스 Composable
 * Task: TSK-05-03
 * 상세설계: 020-detail-design.md 섹션 5.1, 8.1, 8.2, 13 (설계리뷰 제안 2, 6)
 *
 * 낙관적 업데이트 로직 중앙화:
 * - API 호출 전 UI 즉시 업데이트
 * - API 실패 시 자동 롤백
 * - 재사용 가능한 업데이트 패턴
 * - 테스트 용이성 향상
 */

import { ref, readonly } from 'vue'

export interface OptimisticUpdateOptions<T> {
  /**
   * 현재 값 백업을 위한 함수
   */
  getCurrentValue: () => T

  /**
   * 로컬 상태 업데이트 함수
   * @param value 새 값 (낙관적 업데이트 시) 또는 이전 값 (롤백 시)
   */
  updateLocal: (value: T) => void

  /**
   * 낙관적 업데이트할 새 값
   */
  newValue: T

  /**
   * API 호출 함수
   */
  apiCall: () => Promise<void>

  /**
   * 데이터 재동기화 함수 (선택적)
   * API 성공 후 서버 데이터로 동기화
   */
  refreshData?: () => Promise<void>

  /**
   * 성공 콜백
   */
  onSuccess?: () => void

  /**
   * 에러 콜백
   * @param error 발생한 에러
   * @param prevValue 롤백된 이전 값
   */
  onError?: (error: unknown, prevValue: T) => void
}

export interface OptimisticUpdateResult {
  success: boolean
  error?: unknown
}

export function useOptimisticUpdate() {
  const isUpdating = ref(false)

  /**
   * 낙관적 업데이트 실행
   * @param options 업데이트 옵션
   * @returns 실행 결과 (success, error)
   */
  async function execute<T>(options: OptimisticUpdateOptions<T>): Promise<OptimisticUpdateResult> {
    const {
      getCurrentValue,
      updateLocal,
      newValue,
      apiCall,
      refreshData,
      onSuccess,
      onError,
    } = options

    // 동시 실행 방지
    if (isUpdating.value) {
      return { success: false, error: new Error('Update already in progress') }
    }

    isUpdating.value = true

    // 1. 이전 값 백업
    const prevValue = getCurrentValue()

    try {
      // 2. 낙관적 업데이트 (UI 즉시 반영)
      updateLocal(newValue)

      // 3. API 호출
      await apiCall()

      // 4. 데이터 재동기화 (선택적)
      if (refreshData) {
        await refreshData()
      }

      // 5. 성공 콜백
      onSuccess?.()

      return { success: true }
    } catch (error) {
      // 6. 롤백 (이전 값으로 복원)
      updateLocal(prevValue)

      // 7. 에러 콜백
      onError?.(error, prevValue)

      return { success: false, error }
    } finally {
      isUpdating.value = false
    }
  }

  /**
   * 간단한 낙관적 업데이트 (ref 기반)
   * ref 값을 직접 업데이트하는 간편 버전
   */
  async function executeRef<T>(
    targetRef: { value: T },
    newValue: T,
    apiCall: () => Promise<void>,
    callbacks?: {
      refreshData?: () => Promise<void>
      onSuccess?: () => void
      onError?: (error: unknown, prevValue: T) => void
    }
  ): Promise<OptimisticUpdateResult> {
    return execute({
      getCurrentValue: () => targetRef.value,
      updateLocal: (value) => { targetRef.value = value },
      newValue,
      apiCall,
      ...callbacks,
    })
  }

  /**
   * 객체 필드 업데이트 (Partial 기반)
   * 객체의 특정 필드만 업데이트하는 버전
   * 코드리뷰 제안 3.2: 타입 안정성 강화
   */
  async function executePartial<T extends object>(
    targetRef: { value: T | null },
    updates: Partial<T>,
    apiCall: () => Promise<void>,
    callbacks?: {
      refreshData?: () => Promise<void>
      onSuccess?: () => void
      onError?: (error: unknown, prevValue: T) => void  // T | null -> T (null 체크 이후)
    }
  ): Promise<OptimisticUpdateResult> {
    const currentValue = targetRef.value

    // Early return with explicit type guard
    if (!currentValue) {
      return { success: false, error: new Error('Target is null') }
    }

    // Deep clone for rollback safety (JSON 기반 - Vue Proxy 호환)
    const prevValue = JSON.parse(JSON.stringify(currentValue)) as T
    const newValue = { ...currentValue, ...updates }

    return execute({
      getCurrentValue: () => prevValue,
      updateLocal: (value) => {
        // 단순화된 롤백/업데이트 로직
        targetRef.value = value as T
      },
      newValue,
      apiCall,
      ...callbacks,
    })
  }

  return {
    isUpdating: readonly(isUpdating),
    execute,
    executeRef,
    executePartial,
  }
}
