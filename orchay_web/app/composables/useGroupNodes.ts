/**
 * 그룹 노드 관리 컴포저블
 * Task: TSK-06-03
 */

export function useGroupNodes() {
  // 그룹 확장/축소 상태 Map
  const groupExpandedStates = ref<Map<string, boolean>>(new Map())

  /**
   * 그룹 노드의 확장/축소 상태 토글
   *
   * @param groupId 토글할 그룹 ID (예: "WP-01")
   */
  function toggleGroup(groupId: string) {
    const currentState = groupExpandedStates.value.get(groupId)
    const newState = currentState === undefined ? false : !currentState

    // Map 불변성 유지 (Vue 반응성)
    const newMap = new Map(groupExpandedStates.value)
    newMap.set(groupId, newState)
    groupExpandedStates.value = newMap
  }

  /**
   * 그룹의 현재 확장 상태 조회
   *
   * @param groupId 그룹 ID
   * @returns 확장 여부 (기본값: true)
   */
  function isGroupExpanded(groupId: string): boolean {
    const state = groupExpandedStates.value.get(groupId)
    return state === undefined ? true : state
  }

  /**
   * 모든 그룹 상태 초기화
   */
  function resetGroupStates() {
    groupExpandedStates.value = new Map()
  }

  return {
    groupExpandedStates: readonly(groupExpandedStates),
    toggleGroup,
    isGroupExpanded,
    resetGroupStates
  }
}
