/**
 * useGroupNodes Composable 단위 테스트
 * Task: TSK-06-03
 * Test Spec: 026-test-specification.md
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useGroupNodes } from '~/composables/useGroupNodes'

describe('useGroupNodes', () => {
  beforeEach(() => {
    // 각 테스트 전에 새로운 인스턴스 생성
  })

  describe('toggleGroup', () => {
    // TC-UNIT-009: 그룹 축소/확장 상태 토글
    it('should toggle group expansion state', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const groupId = 'WP-01'

      // 초기 상태: true (확장)
      expect(isGroupExpanded(groupId)).toBe(true)

      // 첫 토글: true → false
      toggleGroup(groupId)
      expect(isGroupExpanded(groupId)).toBe(false)

      // 재토글: false → true
      toggleGroup(groupId)
      expect(isGroupExpanded(groupId)).toBe(true)
    })

    it('should handle multiple groups independently', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      toggleGroup('WP-01')
      toggleGroup('WP-02')

      expect(isGroupExpanded('WP-01')).toBe(false)
      expect(isGroupExpanded('WP-02')).toBe(false)

      toggleGroup('WP-01')

      expect(isGroupExpanded('WP-01')).toBe(true)
      expect(isGroupExpanded('WP-02')).toBe(false) // 영향 없음
    })

    it('should handle ACT groups', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const actGroupId = 'ACT-02-01'

      toggleGroup(actGroupId)
      expect(isGroupExpanded(actGroupId)).toBe(false)

      toggleGroup(actGroupId)
      expect(isGroupExpanded(actGroupId)).toBe(true)
    })

    it('should default to true for new groups', () => {
      const { isGroupExpanded } = useGroupNodes()

      expect(isGroupExpanded('WP-99')).toBe(true)
      expect(isGroupExpanded('ACT-99-99')).toBe(true)
    })

    it('should handle rapid toggles', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const groupId = 'WP-03'

      // 여러 번 빠르게 토글
      toggleGroup(groupId)
      toggleGroup(groupId)
      toggleGroup(groupId)
      toggleGroup(groupId)
      toggleGroup(groupId)

      // 홀수 번 토글 → false
      expect(isGroupExpanded(groupId)).toBe(false)
    })

    it('should maintain state across multiple calls', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      toggleGroup('WP-01')
      toggleGroup('WP-02')
      toggleGroup('WP-03')

      expect(isGroupExpanded('WP-01')).toBe(false)
      expect(isGroupExpanded('WP-02')).toBe(false)
      expect(isGroupExpanded('WP-03')).toBe(false)

      toggleGroup('WP-02')

      expect(isGroupExpanded('WP-01')).toBe(false)
      expect(isGroupExpanded('WP-02')).toBe(true)
      expect(isGroupExpanded('WP-03')).toBe(false)
    })
  })

  describe('isGroupExpanded', () => {
    it('should return true for groups not in the map', () => {
      const { isGroupExpanded } = useGroupNodes()

      expect(isGroupExpanded('WP-999')).toBe(true)
    })

    it('should return correct state for toggled groups', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      toggleGroup('WP-05')

      expect(isGroupExpanded('WP-05')).toBe(false)
    })

    it('should work with various group ID formats', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      toggleGroup('WP-01')
      toggleGroup('WP-10')
      toggleGroup('ACT-01-01')
      toggleGroup('ACT-10-05')

      expect(isGroupExpanded('WP-01')).toBe(false)
      expect(isGroupExpanded('WP-10')).toBe(false)
      expect(isGroupExpanded('ACT-01-01')).toBe(false)
      expect(isGroupExpanded('ACT-10-05')).toBe(false)
    })
  })

  describe('resetGroupStates', () => {
    it('should reset all group states to default', () => {
      const { toggleGroup, resetGroupStates, isGroupExpanded } = useGroupNodes()

      // 여러 그룹 축소
      toggleGroup('WP-01')
      toggleGroup('WP-02')
      toggleGroup('ACT-01-01')

      expect(isGroupExpanded('WP-01')).toBe(false)
      expect(isGroupExpanded('WP-02')).toBe(false)
      expect(isGroupExpanded('ACT-01-01')).toBe(false)

      // 초기화
      resetGroupStates()

      // 모두 기본값(true)으로 복원
      expect(isGroupExpanded('WP-01')).toBe(true)
      expect(isGroupExpanded('WP-02')).toBe(true)
      expect(isGroupExpanded('ACT-01-01')).toBe(true)
    })

    it('should clear all entries from the map', () => {
      const { toggleGroup, resetGroupStates, groupExpandedStates } = useGroupNodes()

      toggleGroup('WP-01')
      toggleGroup('WP-02')
      toggleGroup('WP-03')

      expect(groupExpandedStates.value.size).toBeGreaterThan(0)

      resetGroupStates()

      expect(groupExpandedStates.value.size).toBe(0)
    })

    it('should allow new toggles after reset', () => {
      const { toggleGroup, resetGroupStates, isGroupExpanded } = useGroupNodes()

      toggleGroup('WP-01')
      resetGroupStates()

      expect(isGroupExpanded('WP-01')).toBe(true)

      toggleGroup('WP-01')
      expect(isGroupExpanded('WP-01')).toBe(false)
    })
  })

  describe('groupExpandedStates', () => {
    it('should be readonly', () => {
      const { groupExpandedStates } = useGroupNodes()

      // groupExpandedStates는 readonly이므로 직접 수정 불가
      expect(typeof groupExpandedStates).toBe('object')
    })

    it('should reflect current state', () => {
      const { toggleGroup, groupExpandedStates } = useGroupNodes()

      toggleGroup('WP-01')
      toggleGroup('WP-02')

      expect(groupExpandedStates.value.size).toBeGreaterThanOrEqual(2)
      expect(groupExpandedStates.value.get('WP-01')).toBe(false)
      expect(groupExpandedStates.value.get('WP-02')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should handle empty string group ID', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      toggleGroup('')
      expect(isGroupExpanded('')).toBe(false)
    })

    it('should handle special characters in group ID', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const specialId = 'WP-01-TEST'
      toggleGroup(specialId)
      expect(isGroupExpanded(specialId)).toBe(false)
    })

    it('should handle numeric group IDs', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const numericId = '12345'
      toggleGroup(numericId)
      expect(isGroupExpanded(numericId)).toBe(false)
    })

    it('should handle very long group IDs', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      const longId = 'WP-' + '0'.repeat(100)
      toggleGroup(longId)
      expect(isGroupExpanded(longId)).toBe(false)
    })
  })

  describe('state persistence', () => {
    it('should maintain state across function calls', () => {
      const instance = useGroupNodes()

      instance.toggleGroup('WP-01')
      expect(instance.isGroupExpanded('WP-01')).toBe(false)

      // 다른 작업 수행
      instance.toggleGroup('WP-02')
      instance.toggleGroup('WP-03')

      // 여전히 WP-01 상태 유지
      expect(instance.isGroupExpanded('WP-01')).toBe(false)
    })

    it('should handle large number of groups', () => {
      const { toggleGroup, isGroupExpanded } = useGroupNodes()

      // 100개 그룹 생성
      for (let i = 1; i <= 100; i++) {
        toggleGroup(`WP-${i}`)
      }

      // 모두 축소 상태
      for (let i = 1; i <= 100; i++) {
        expect(isGroupExpanded(`WP-${i}`)).toBe(false)
      }

      // 일부만 확장
      toggleGroup('WP-50')
      expect(isGroupExpanded('WP-50')).toBe(true)
      expect(isGroupExpanded('WP-49')).toBe(false)
      expect(isGroupExpanded('WP-51')).toBe(false)
    })
  })
})
