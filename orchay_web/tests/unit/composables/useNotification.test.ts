/**
 * useNotification Composable 단위 테스트
 * Task: TSK-05-03
 * 설계리뷰 제안 4: Introduce Service Layer - 알림 서비스
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotification } from '~/composables/useNotification'

// Mock PrimeVue useToast
const mockToastAdd = vi.fn()
const mockRemoveAllGroups = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd,
    removeAllGroups: mockRemoveAllGroups,
  }),
}))

describe('useNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('success', () => {
    it('should show success notification with default options', () => {
      const notification = useNotification()
      notification.success('저장 완료')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: '성공',
        detail: '저장 완료',
        life: 2000,
        closable: true,
      })
    })

    it('should show success notification with custom life', () => {
      const notification = useNotification()
      notification.success('저장 완료', { life: 5000 })

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: '성공',
        detail: '저장 완료',
        life: 5000,
        closable: true,
      })
    })

    it('should show sticky success notification', () => {
      const notification = useNotification()
      notification.success('저장 완료', { sticky: true })

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: '성공',
        detail: '저장 완료',
        life: undefined,
        closable: true,
      })
    })
  })

  describe('error', () => {
    it('should show error notification with default options', () => {
      const notification = useNotification()
      notification.error('저장 실패')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: '오류',
        detail: '저장 실패',
        life: 5000,
        closable: true,
      })
    })

    it('should show error notification with custom life', () => {
      const notification = useNotification()
      notification.error('저장 실패', { life: 10000 })

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'error',
        summary: '오류',
        detail: '저장 실패',
        life: 10000,
        closable: true,
      })
    })
  })

  describe('warning', () => {
    it('should show warning notification', () => {
      const notification = useNotification()
      notification.warning('주의 필요')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'warn',
        summary: '경고',
        detail: '주의 필요',
        life: 3000,
        closable: true,
      })
    })
  })

  describe('info', () => {
    it('should show info notification', () => {
      const notification = useNotification()
      notification.info('안내 메시지')

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'info',
        summary: '안내',
        detail: '안내 메시지',
        life: 3000,
        closable: true,
      })
    })
  })

  describe('clear', () => {
    it('should remove all notifications', () => {
      const notification = useNotification()
      notification.clear()

      expect(mockRemoveAllGroups).toHaveBeenCalled()
    })
  })

  describe('closable option', () => {
    it('should set closable to false when specified', () => {
      const notification = useNotification()
      notification.success('메시지', { closable: false })

      expect(mockToastAdd).toHaveBeenCalledWith({
        severity: 'success',
        summary: '성공',
        detail: '메시지',
        life: 2000,
        closable: false,
      })
    })
  })
})
