/**
 * 그래프 필터 상태 관리 컴포저블
 * Task: TSK-06-03
 */

import type { GraphFilter } from '~/types/graph'

export function useGraphFilter() {
  /**
   * GraphFilter를 URL 쿼리 문자열로 직렬화
   */
  function encodeFilterToURL(filter: GraphFilter): string {
    const params = new URLSearchParams()

    // categories: 빈 배열이면 생략
    if (filter.categories.length > 0) {
      params.set('categories', filter.categories.join(','))
    }

    // statuses: 괄호 제거 (예: "[im]" → "im")
    if (filter.statuses.length > 0) {
      const statusCodes = filter.statuses.map(s => s.replace(/[\[\]]/g, ''))
      params.set('statuses', statusCodes.join(','))
    }

    // hierarchyMode: 'full'이면 생략
    if (filter.hierarchyMode !== 'full') {
      params.set('hierarchyMode', filter.hierarchyMode)
    }

    // focusTask: null이면 생략
    if (filter.focusTask) {
      params.set('focusTask', filter.focusTask)

      // focusDepth: focusTask 있을 때만 포함
      if (filter.focusDepth !== 2) {  // 기본값 2가 아닐 때만
        params.set('focusDepth', filter.focusDepth.toString())
      }
    }

    const queryString = params.toString()

    // URL 길이 제한 체크 (2000자)
    if (queryString.length > 2000) {
      console.warn('[useGraphFilter] URL 파라미터 길이 초과, 압축 전략 적용')
      return compressFilter(filter)
    }

    return queryString
  }

  /**
   * URL 파라미터 압축 (우선순위 적용)
   * focusTask > hierarchyMode > categories (최대 3개) > statuses (최대 3개)
   */
  function compressFilter(filter: GraphFilter): string {
    const params = new URLSearchParams()

    // 우선순위 1: focusTask
    if (filter.focusTask) {
      params.set('focusTask', filter.focusTask)
      if (filter.focusDepth !== 2) {
        params.set('focusDepth', filter.focusDepth.toString())
      }
    }

    // 우선순위 2: hierarchyMode
    if (filter.hierarchyMode !== 'full') {
      params.set('hierarchyMode', filter.hierarchyMode)
    }

    // 우선순위 3: categories (최대 3개)
    if (filter.categories.length > 0) {
      const limitedCategories = filter.categories.slice(0, 3)
      params.set('categories', limitedCategories.join(','))
    }

    // 우선순위 4: statuses (최대 3개)
    if (filter.statuses.length > 0) {
      const limitedStatuses = filter.statuses.slice(0, 3).map(s => s.replace(/[\[\]]/g, ''))
      params.set('statuses', limitedStatuses.join(','))
    }

    return params.toString()
  }

  /**
   * URL 쿼리 파라미터를 GraphFilter로 역직렬화
   */
  function parseURLParams(searchParams: URLSearchParams): GraphFilter {
    try {
      // categories
      const categoriesParam = searchParams.get('categories')
      const categories = categoriesParam ? categoriesParam.split(',').filter(Boolean) : []

      // statuses: 괄호 복원 (예: "im" → "[im]")
      const statusesParam = searchParams.get('statuses')
      const statuses = statusesParam
        ? statusesParam.split(',').filter(Boolean).map(s => `[${s}]`)
        : []

      // hierarchyMode
      const hierarchyModeParam = searchParams.get('hierarchyMode')
      const hierarchyMode = (['full', 'wp', 'act'].includes(hierarchyModeParam || ''))
        ? hierarchyModeParam as 'full' | 'wp' | 'act'
        : 'full'

      // focusTask
      const focusTask = searchParams.get('focusTask') || null

      // focusDepth
      const focusDepthParam = searchParams.get('focusDepth')
      const focusDepth = focusDepthParam ? parseInt(focusDepthParam, 10) : 2

      // depth 값 검증 및 클램핑 (1~3), NaN 처리
      const clampedDepth = isNaN(focusDepth)
        ? 2  // NaN이면 기본값 2
        : Math.max(1, Math.min(3, focusDepth))

      return {
        categories,
        statuses,
        hierarchyMode,
        focusTask,
        focusDepth: clampedDepth
      }
    } catch (error) {
      console.error('[useGraphFilter] URL 파라미터 복원 실패:', error)
      // 기본값 반환
      return {
        categories: [],
        statuses: [],
        hierarchyMode: 'full',
        focusTask: null,
        focusDepth: 2
      }
    }
  }

  return {
    encodeFilterToURL,
    parseURLParams
  }
}
