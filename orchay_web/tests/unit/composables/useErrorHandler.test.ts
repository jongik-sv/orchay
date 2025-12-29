/**
 * useErrorHandler Composable 단위 테스트
 * Task: TSK-05-03
 * 설계리뷰 제안 7: Centralize Error Handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useErrorHandler, ERROR_CODES } from '~/composables/useErrorHandler'

// Mock useNotification
const mockNotificationError = vi.fn()

vi.mock('~/composables/useNotification', () => ({
  useNotification: () => ({
    error: mockNotificationError,
  }),
}))

describe('useErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractErrorCode', () => {
    it('should extract error code from statusMessage', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      expect(errorHandler.extractErrorCode(error)).toBe('VALIDATION_ERROR')
    })

    it('should extract error code from data.code', () => {
      const errorHandler = useErrorHandler()
      const error = { data: { code: 'TASK_NOT_FOUND' } }

      expect(errorHandler.extractErrorCode(error)).toBe('TASK_NOT_FOUND')
    })

    it('should return null for unknown error format', () => {
      const errorHandler = useErrorHandler()
      const error = { message: 'Some error' }

      expect(errorHandler.extractErrorCode(error)).toBe(null)
    })

    it('should return null for non-object error', () => {
      const errorHandler = useErrorHandler()

      expect(errorHandler.extractErrorCode(null)).toBe(null)
      expect(errorHandler.extractErrorCode('string error')).toBe(null)
    })

    it('should detect network error from TypeError', () => {
      const errorHandler = useErrorHandler()
      const error = new TypeError('Failed to fetch')

      expect(errorHandler.extractErrorCode(error)).toBe('NETWORK_ERROR')
    })
  })

  describe('extractErrorMessage', () => {
    it('should return mapped message for known error code', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      expect(errorHandler.extractErrorMessage(error)).toBe('입력 값이 유효하지 않습니다. 다시 확인해주세요.')
    })

    it('should return error message from API response', () => {
      const errorHandler = useErrorHandler()
      const error = { message: 'Custom error message' }

      expect(errorHandler.extractErrorMessage(error)).toBe('Custom error message')
    })

    it('should return data.message when available', () => {
      const errorHandler = useErrorHandler()
      const error = { data: { message: 'Data error message' } }

      expect(errorHandler.extractErrorMessage(error)).toBe('Data error message')
    })

    it('should return Error.message for Error instances', () => {
      const errorHandler = useErrorHandler()
      const error = new Error('Error instance message')

      expect(errorHandler.extractErrorMessage(error)).toBe('Error instance message')
    })

    it('should return default message for unknown errors', () => {
      const errorHandler = useErrorHandler()

      expect(errorHandler.extractErrorMessage(null)).toBe('알 수 없는 오류가 발생했습니다.')
    })
  })

  describe('handle', () => {
    it('should show error notification', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      errorHandler.handle(error, 'TestContext')

      expect(mockNotificationError).toHaveBeenCalledWith('입력 값이 유효하지 않습니다. 다시 확인해주세요.')
    })

    it('should use custom message when provided', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      errorHandler.handle(error, 'TestContext', { userMessage: 'Custom error message' })

      expect(mockNotificationError).toHaveBeenCalledWith('Custom error message')
    })

    it('should execute recovery action when provided', async () => {
      const errorHandler = useErrorHandler()
      const recoveryAction = vi.fn()
      const error = new Error('test error')

      errorHandler.handle(error, 'TestContext', { recoveryAction })

      expect(recoveryAction).toHaveBeenCalled()
    })

    it('should handle async recovery action', async () => {
      const errorHandler = useErrorHandler()
      const recoveryAction = vi.fn().mockResolvedValue(undefined)
      const error = new Error('test error')

      errorHandler.handle(error, 'TestContext', { recoveryAction })

      expect(recoveryAction).toHaveBeenCalled()
    })
  })

  describe('isErrorCode', () => {
    it('should return true for matching error code', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      expect(errorHandler.isErrorCode(error, 'VALIDATION_ERROR')).toBe(true)
    })

    it('should return false for non-matching error code', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      expect(errorHandler.isErrorCode(error, 'TASK_NOT_FOUND')).toBe(false)
    })
  })

  describe('helper methods', () => {
    it('isValidationError should return true for validation errors', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'VALIDATION_ERROR' }

      expect(errorHandler.isValidationError(error)).toBe(true)
    })

    it('isNetworkError should return true for network errors', () => {
      const errorHandler = useErrorHandler()
      const error = new TypeError('network error')

      expect(errorHandler.isNetworkError(error)).toBe(true)
    })

    it('isNotFoundError should return true for not found errors', () => {
      const errorHandler = useErrorHandler()
      const error = { statusMessage: 'TASK_NOT_FOUND' }

      expect(errorHandler.isNotFoundError(error)).toBe(true)
    })
  })

  describe('ERROR_CODES constant', () => {
    it('should export all error codes', () => {
      const errorHandler = useErrorHandler()

      expect(errorHandler.ERROR_CODES).toBe(ERROR_CODES)
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
      expect(ERROR_CODES.TASK_NOT_FOUND).toBe('TASK_NOT_FOUND')
      expect(ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR')
    })
  })
})
