/**
 * useTreeInteraction Composable 단위 테스트
 * Task: TSK-04-03
 * Priority: P1
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTreeInteraction } from '~/composables/useTreeInteraction'
import { useWbsStore } from '~/stores/wbs'
import { useSelectionStore } from '~/stores/selection'
import type { WbsNode } from '~/types/index'

describe('useTreeInteraction', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('toggleNode', () => {
    it('should toggle node expansion state', () => {
      const wbsStore = useWbsStore()
      const { toggleNode, isExpanded } = useTreeInteraction()

      const nodeId = 'WP-01'
      const mockNode: WbsNode = {
        id: nodeId,
        type: 'wp',
        title: 'Work Package 1',
        children: [{ id: 'ACT-01-01', type: 'act', title: 'Activity', children: [] }]
      }

      wbsStore.getNode = vi.fn(() => mockNode)
      wbsStore.expandedNodes.add(nodeId)

      expect(isExpanded(nodeId)).toBe(true)
      toggleNode(nodeId)
      expect(isExpanded(nodeId)).toBe(false)
      toggleNode(nodeId)
      expect(isExpanded(nodeId)).toBe(true)
    })

    it('should warn and return early if nodeId is invalid', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { toggleNode } = useTreeInteraction()

      toggleNode('')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid nodeId'),
        ''
      )

      toggleNode(null as any)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid nodeId'),
        null
      )

      consoleSpy.mockRestore()
    })

    it('should warn and return early if node does not exist', () => {
      const wbsStore = useWbsStore()
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { toggleNode } = useTreeInteraction()

      // Mock getNode to return undefined
      wbsStore.getNode = vi.fn(() => undefined)

      toggleNode('NON-EXISTENT')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Node not found'),
        'NON-EXISTENT'
      )

      consoleSpy.mockRestore()
    })

    it('should not toggle node without children', () => {
      const wbsStore = useWbsStore()
      const { toggleNode, isExpanded } = useTreeInteraction()

      const nodeId = 'TSK-01-01-01'
      const mockNode: WbsNode = {
        id: nodeId,
        type: 'task',
        title: 'Test Task',
        children: []
      }

      wbsStore.getNode = vi.fn(() => mockNode)

      const initialState = isExpanded(nodeId)
      toggleNode(nodeId)
      expect(isExpanded(nodeId)).toBe(initialState)
    })

    it('should call wbsStore.toggleExpand for valid node with children', () => {
      const wbsStore = useWbsStore()
      const { toggleNode } = useTreeInteraction()

      const nodeId = 'WP-01'
      const mockNode: WbsNode = {
        id: nodeId,
        type: 'wp',
        title: 'Work Package 1',
        children: [{ id: 'ACT-01-01', type: 'act', title: 'Activity', children: [] }]
      }

      wbsStore.getNode = vi.fn(() => mockNode)
      const toggleSpy = vi.spyOn(wbsStore, 'toggleExpand')

      toggleNode(nodeId)
      expect(toggleSpy).toHaveBeenCalledWith(nodeId)
    })
  })

  describe('selectNode', () => {
    it('should select node via selectionStore', async () => {
      const selectionStore = useSelectionStore()
      const { selectNode, isSelected } = useTreeInteraction()

      const nodeId = 'WP-01'
      selectionStore.selectNode = vi.fn().mockResolvedValue(undefined)

      await selectNode(nodeId)
      expect(selectionStore.selectNode).toHaveBeenCalledWith(nodeId)
    })

    it('should prevent duplicate selection', async () => {
      const selectionStore = useSelectionStore()
      const { selectNode } = useTreeInteraction()

      const nodeId = 'WP-01'
      selectionStore.selectedNodeId = nodeId
      selectionStore.selectNode = vi.fn()

      await selectNode(nodeId)
      expect(selectionStore.selectNode).not.toHaveBeenCalled()
    })

    it('should prevent race condition with isSelecting flag', async () => {
      const selectionStore = useSelectionStore()
      const { selectNode } = useTreeInteraction()

      selectionStore.selectNode = vi.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      // First call starts
      const promise1 = selectNode('WP-01')
      // Second call should be ignored (race condition prevention)
      const promise2 = selectNode('WP-02')

      await promise1
      await promise2

      // Only first call should execute
      expect(selectionStore.selectNode).toHaveBeenCalledTimes(1)
      expect(selectionStore.selectNode).toHaveBeenCalledWith('WP-01')
    })

    it('should warn and return early if nodeId is invalid', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { selectNode } = useTreeInteraction()

      await selectNode('')
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid nodeId'),
        ''
      )

      consoleSpy.mockRestore()
    })

    it('should handle selection error and clear selection', async () => {
      const selectionStore = useSelectionStore()
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { selectNode } = useTreeInteraction()

      const error = new Error('Failed to load task')
      selectionStore.selectNode = vi.fn().mockRejectedValue(error)
      selectionStore.clearSelection = vi.fn()

      await expect(selectNode('TSK-01-01-01')).rejects.toThrow('Failed to load task')
      expect(selectionStore.clearSelection).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to select node'),
        error
      )

      consoleErrorSpy.mockRestore()
    })

    it('should reset isSelecting flag after selection completes', async () => {
      const selectionStore = useSelectionStore()
      const { selectNode } = useTreeInteraction()

      selectionStore.selectNode = vi.fn().mockResolvedValue(undefined)

      await selectNode('WP-01')

      // After completion, should be able to select another node
      // Reset selectedNodeId to null first to avoid duplicate selection check
      selectionStore.selectedNodeId = null
      await selectNode('WP-02')

      expect(selectionStore.selectNode).toHaveBeenCalledTimes(2)
    })

    it('should reset isSelecting flag after error', async () => {
      const selectionStore = useSelectionStore()
      const { selectNode } = useTreeInteraction()

      const error = new Error('Test error')
      selectionStore.selectNode = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined)
      selectionStore.clearSelection = vi.fn()

      // First call fails
      await expect(selectNode('WP-01')).rejects.toThrow()

      // Should be able to try again
      // Reset selectedNodeId to null first to avoid duplicate selection check
      selectionStore.selectedNodeId = null
      await selectNode('WP-02')

      expect(selectionStore.selectNode).toHaveBeenCalledTimes(2)
    })
  })

  describe('expandAll', () => {
    it('should expand all nodes', () => {
      const wbsStore = useWbsStore()
      const { expandAll } = useTreeInteraction()

      wbsStore.expandAll = vi.fn()

      expandAll()
      expect(wbsStore.expandAll).toHaveBeenCalled()
    })
  })

  describe('collapseAll', () => {
    it('should collapse all nodes', () => {
      const wbsStore = useWbsStore()
      const { collapseAll } = useTreeInteraction()

      wbsStore.collapseAll = vi.fn()

      collapseAll()
      expect(wbsStore.collapseAll).toHaveBeenCalled()
    })
  })

  describe('isExpanded', () => {
    it('should return true if node is expanded', () => {
      const wbsStore = useWbsStore()
      const { isExpanded } = useTreeInteraction()

      wbsStore.expandedNodes.add('WP-01')

      expect(isExpanded('WP-01')).toBe(true)
      expect(isExpanded('WP-02')).toBe(false)
    })
  })

  describe('isSelected', () => {
    it('should return true if node is selected', () => {
      const selectionStore = useSelectionStore()
      const { isSelected } = useTreeInteraction()

      selectionStore.selectedNodeId = 'WP-01'

      expect(isSelected('WP-01')).toBe(true)
      expect(isSelected('WP-02')).toBe(false)
    })
  })
})
