import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { useSelectionStore } from '~/stores/selection'
import { useWbsStore } from '~/stores/wbs'
import type { WbsNode } from '~/types'

describe('selectionStore - WP/ACT 확장', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('isWpOrActSelected', () => {
    it('WP 선택 시 true', () => {
      const wbsStore = useWbsStore()
      wbsStore.flatNodes.set('WP-01', {
        id: 'WP-01',
        type: 'wp',
        title: 'Test WP',
        children: []
      })

      const store = useSelectionStore()
      store.selectedNodeId = 'WP-01'

      expect(store.isWpOrActSelected).toBe(true)
    })

    it('ACT 선택 시 true', () => {
      const wbsStore = useWbsStore()
      wbsStore.flatNodes.set('ACT-01-01', {
        id: 'ACT-01-01',
        type: 'act',
        title: 'Test ACT',
        children: []
      })

      const store = useSelectionStore()
      store.selectedNodeId = 'ACT-01-01'

      expect(store.isWpOrActSelected).toBe(true)
    })

    it('Task 선택 시 false', () => {
      const store = useSelectionStore()
      store.selectedNodeId = 'TSK-01-01-01'

      expect(store.isWpOrActSelected).toBe(false)
    })

    it('선택 없을 때 false', () => {
      const store = useSelectionStore()

      expect(store.isWpOrActSelected).toBe(false)
    })
  })

  describe('selectedNode', () => {
    it('WP 선택 시 해당 노드 반환', () => {
      const wbsStore = useWbsStore()
      const wpNode: WbsNode = {
        id: 'WP-01',
        type: 'wp',
        title: 'Test WP',
        children: []
      }
      wbsStore.flatNodes.set('WP-01', wpNode)

      const store = useSelectionStore()
      store.selectedNodeId = 'WP-01'

      expect(store.selectedNode).toStrictEqual(wpNode)
      expect(store.selectedNode?.id).toBe('WP-01')
    })

    it('ACT 선택 시 해당 노드 반환', () => {
      const wbsStore = useWbsStore()
      const actNode: WbsNode = {
        id: 'ACT-01-01',
        type: 'act',
        title: 'Test ACT',
        children: []
      }
      wbsStore.flatNodes.set('ACT-01-01', actNode)

      const store = useSelectionStore()
      store.selectedNodeId = 'ACT-01-01'

      expect(store.selectedNode).toStrictEqual(actNode)
      expect(store.selectedNode?.id).toBe('ACT-01-01')
    })

    it('Task 선택 시 null 반환', () => {
      const wbsStore = useWbsStore()
      wbsStore.flatNodes.set('TSK-01-01-01', {
        id: 'TSK-01-01-01',
        type: 'task',
        title: 'Test Task',
        children: []
      })

      const store = useSelectionStore()
      store.selectedNodeId = 'TSK-01-01-01'

      expect(store.selectedNode).toBeNull()
    })

    it('선택 없을 때 null 반환', () => {
      const store = useSelectionStore()

      expect(store.selectedNode).toBeNull()
    })

    it('WBS 데이터 로드 전 null 반환', () => {
      const store = useSelectionStore()
      store.selectedNodeId = 'WP-01'

      // wbsStore.flatNodes가 비어있음
      expect(store.selectedNode).toBeNull()
    })

    it('존재하지 않는 노드 ID 선택 시 null 반환', () => {
      const wbsStore = useWbsStore()
      wbsStore.flatNodes.set('WP-01', {
        id: 'WP-01',
        type: 'wp',
        title: 'Test WP',
        children: []
      })

      const store = useSelectionStore()
      store.selectedNodeId = 'WP-99'

      expect(store.selectedNode).toBeNull()
    })
  })
})
