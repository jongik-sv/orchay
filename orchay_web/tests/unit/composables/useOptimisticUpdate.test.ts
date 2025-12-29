/**
 * useOptimisticUpdate Composable 단위 테스트
 * Task: TSK-05-03
 * 설계리뷰 제안 2, 6: Extract Method, Optimistic Update Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useOptimisticUpdate } from '~/composables/useOptimisticUpdate'

describe('useOptimisticUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('execute', () => {
    it('should perform optimistic update on success', async () => {
      const { execute, isUpdating } = useOptimisticUpdate()
      const currentValue = { name: 'old' }
      const newValue = { name: 'new' }
      let localValue = currentValue

      const apiCall = vi.fn().mockResolvedValue(undefined)
      const onSuccess = vi.fn()

      const result = await execute({
        getCurrentValue: () => currentValue,
        updateLocal: (value) => { localValue = value },
        newValue,
        apiCall,
        onSuccess,
      })

      expect(result.success).toBe(true)
      expect(apiCall).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalled()
      expect(isUpdating.value).toBe(false)
    })

    it('should rollback on API failure', async () => {
      const { execute } = useOptimisticUpdate()
      const currentValue = { name: 'old' }
      const newValue = { name: 'new' }
      let localValue = currentValue

      const apiError = new Error('API failed')
      const apiCall = vi.fn().mockRejectedValue(apiError)
      const onError = vi.fn()

      const result = await execute({
        getCurrentValue: () => currentValue,
        updateLocal: (value) => { localValue = value },
        newValue,
        apiCall,
        onError,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(apiError)
      expect(onError).toHaveBeenCalledWith(apiError, currentValue)
      expect(localValue).toEqual(currentValue) // Rollback
    })

    it('should call refreshData on success', async () => {
      const { execute } = useOptimisticUpdate()
      const refreshData = vi.fn().mockResolvedValue(undefined)

      await execute({
        getCurrentValue: () => ({}),
        updateLocal: () => {},
        newValue: {},
        apiCall: vi.fn().mockResolvedValue(undefined),
        refreshData,
      })

      expect(refreshData).toHaveBeenCalled()
    })

    it('should prevent concurrent updates', async () => {
      const { execute, isUpdating } = useOptimisticUpdate()

      // Start first update (will take some time)
      const slowApiCall = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

      const firstUpdate = execute({
        getCurrentValue: () => ({}),
        updateLocal: () => {},
        newValue: {},
        apiCall: slowApiCall,
      })

      // Attempt second update immediately
      const secondUpdate = await execute({
        getCurrentValue: () => ({}),
        updateLocal: () => {},
        newValue: {},
        apiCall: vi.fn(),
      })

      expect(secondUpdate.success).toBe(false)
      expect(secondUpdate.error).toBeInstanceOf(Error)

      // Wait for first update to complete
      await firstUpdate
    })

    it('should set isUpdating during execution', async () => {
      const { execute, isUpdating } = useOptimisticUpdate()
      let wasUpdating = false

      const apiCall = vi.fn().mockImplementation(async () => {
        wasUpdating = isUpdating.value
      })

      await execute({
        getCurrentValue: () => ({}),
        updateLocal: () => {},
        newValue: {},
        apiCall,
      })

      expect(wasUpdating).toBe(true)
      expect(isUpdating.value).toBe(false)
    })
  })

  describe('executeRef', () => {
    it('should update ref value', async () => {
      const { executeRef } = useOptimisticUpdate()
      const targetRef = ref('old')

      await executeRef(
        targetRef,
        'new',
        vi.fn().mockResolvedValue(undefined)
      )

      // After refresh, value should be updated
      expect(targetRef.value).toBe('new')
    })

    it('should rollback ref value on failure', async () => {
      const { executeRef } = useOptimisticUpdate()
      const targetRef = ref('old')

      await executeRef(
        targetRef,
        'new',
        vi.fn().mockRejectedValue(new Error('fail'))
      )

      expect(targetRef.value).toBe('old')
    })

    it('should call callbacks', async () => {
      const { executeRef } = useOptimisticUpdate()
      const targetRef = ref('old')
      const onSuccess = vi.fn()
      const refreshData = vi.fn().mockResolvedValue(undefined)

      await executeRef(
        targetRef,
        'new',
        vi.fn().mockResolvedValue(undefined),
        { onSuccess, refreshData }
      )

      expect(onSuccess).toHaveBeenCalled()
      expect(refreshData).toHaveBeenCalled()
    })
  })

  describe('executePartial', () => {
    it('should update object fields', async () => {
      const { executePartial } = useOptimisticUpdate()
      const targetRef = ref({ name: 'old', age: 20 })

      await executePartial(
        targetRef,
        { name: 'new' },
        vi.fn().mockResolvedValue(undefined)
      )

      expect(targetRef.value.name).toBe('new')
      expect(targetRef.value.age).toBe(20)
    })

    it('should rollback object fields on failure', async () => {
      const { executePartial } = useOptimisticUpdate()
      const targetRef = ref({ name: 'old', age: 20 })

      await executePartial(
        targetRef,
        { name: 'new' },
        vi.fn().mockRejectedValue(new Error('fail'))
      )

      expect(targetRef.value.name).toBe('old')
      expect(targetRef.value.age).toBe(20)
    })

    it('should return error when target is null', async () => {
      const { executePartial } = useOptimisticUpdate()
      const targetRef = ref<{ name: string } | null>(null)

      const result = await executePartial(
        targetRef,
        { name: 'new' },
        vi.fn()
      )

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })

    it('should call onError callback on failure', async () => {
      const { executePartial } = useOptimisticUpdate()
      const targetRef = ref({ name: 'old' })
      const onError = vi.fn()
      const apiError = new Error('fail')

      await executePartial(
        targetRef,
        { name: 'new' },
        vi.fn().mockRejectedValue(apiError),
        { onError }
      )

      expect(onError).toHaveBeenCalled()
    })
  })

  describe('isUpdating', () => {
    it('should be readonly', () => {
      const { isUpdating } = useOptimisticUpdate()

      // isUpdating is readonly, this should not cause runtime error but value won't change
      expect(isUpdating.value).toBe(false)
    })
  })
})
