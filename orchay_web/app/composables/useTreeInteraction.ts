/**
 * 트리 인터랙션 Composable
 * 노드 토글, 선택, 전체 펼치기/접기 기능 제공
 * Task: TSK-04-03
 * Priority: P1
 */

import { ref } from 'vue'
import { useWbsStore } from '~/stores/wbs'
import { useSelectionStore } from '~/stores/selection'

/**
 * 트리 인터랙션 Composable
 * 노드 토글, 선택, 전체 펼치기/접기 기능 제공
 */
export interface UseTreeInteractionReturn {
  /**
   * 노드 펼침/접기 토글
   * @param nodeId - 노드 ID (WP-01, ACT-01-01, TSK-01-01-01 등)
   */
  toggleNode: (nodeId: string) => void

  /**
   * 노드 선택 (상세 패널 표시)
   * @param nodeId - 선택할 노드 ID
   */
  selectNode: (nodeId: string) => Promise<void>

  /**
   * 전체 노드 펼치기
   */
  expandAll: () => void

  /**
   * 전체 노드 접기
   */
  collapseAll: () => void

  /**
   * 노드가 펼쳐져 있는지 확인
   * @param nodeId - 노드 ID
   * @returns 펼쳐져 있으면 true
   */
  isExpanded: (nodeId: string) => boolean

  /**
   * 노드가 선택되어 있는지 확인
   * @param nodeId - 노드 ID
   * @returns 선택되어 있으면 true
   */
  isSelected: (nodeId: string) => boolean
}

// Race Condition 방지를 위한 플래그 (ISS-DR-008)
const isSelecting = ref(false)

export function useTreeInteraction(): UseTreeInteractionReturn {
  const wbsStore = useWbsStore()
  const selectionStore = useSelectionStore()

  /**
   * 노드 펼침/접기 토글
   */
  function toggleNode(nodeId: string): void {
    // 입력 검증
    if (!nodeId || typeof nodeId !== 'string') {
      console.warn('[useTreeInteraction] Invalid nodeId:', nodeId)
      return
    }

    // 노드 존재 확인
    const node = wbsStore.getNode(nodeId)
    if (!node) {
      console.warn('[useTreeInteraction] Node not found:', nodeId)
      return
    }

    // 자식이 없는 노드는 토글 불가
    if (!node.children || node.children.length === 0) {
      return
    }

    // 스토어 액션 호출 (반응형 업데이트 자동)
    wbsStore.toggleExpand(nodeId)
  }

  /**
   * 노드 선택 (Race Condition 방지 적용)
   */
  async function selectNode(nodeId: string): Promise<void> {
    // 입력 검증
    if (!nodeId || typeof nodeId !== 'string') {
      console.warn('[useTreeInteraction] Invalid nodeId:', nodeId)
      return
    }

    // 중복 선택 및 진행 중 요청 방지 (ISS-DR-008)
    if (selectionStore.selectedNodeId === nodeId || isSelecting.value) {
      return
    }

    isSelecting.value = true
    try {
      await selectionStore.selectNode(nodeId)
    } catch (error) {
      console.error('[useTreeInteraction] Failed to select node:', error)
      // 에러 발생 시 선택 해제 (일관성 유지)
      selectionStore.clearSelection()
      throw error
    } finally {
      isSelecting.value = false
    }
  }

  /**
   * 전체 노드 펼치기
   */
  function expandAll(): void {
    wbsStore.expandAll()
  }

  /**
   * 전체 노드 접기
   */
  function collapseAll(): void {
    wbsStore.collapseAll()
  }

  /**
   * 노드가 펼쳐져 있는지 확인
   */
  function isExpanded(nodeId: string): boolean {
    return wbsStore.isExpanded(nodeId)
  }

  /**
   * 노드가 선택되어 있는지 확인
   */
  function isSelected(nodeId: string): boolean {
    return selectionStore.selectedNodeId === nodeId
  }

  return {
    toggleNode,
    selectNode,
    expandAll,
    collapseAll,
    isExpanded,
    isSelected
  }
}
