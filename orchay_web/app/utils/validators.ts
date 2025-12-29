/**
 * 입력 검증 유틸리티 (TSK-05-02 M-01: XSS 방지)
 *
 * HTML 태그 및 스크립트 삽입 방지를 위한 검증 함수
 */

/**
 * HTML 특수문자를 이스케이프하여 XSS 방지
 * @param input 검증할 입력 문자열
 * @returns 이스케이프된 문자열
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

/**
 * 요구사항 유효성 검증
 * @param requirement 검증할 요구사항 문자열
 * @param maxLength 최대 길이 (기본값: 500)
 * @returns 유효성 검증 결과
 */
export function validateRequirement(
  requirement: string,
  maxLength: number = 500
): { isValid: boolean; error?: string } {
  const trimmed = requirement.trim()

  if (trimmed.length === 0) {
    return { isValid: false, error: '요구사항을 입력해주세요' }
  }

  if (trimmed.length > maxLength) {
    return { isValid: false, error: `요구사항은 ${maxLength}자 이하여야 합니다` }
  }

  return { isValid: true }
}

/**
 * 요구사항 배열 필터링 및 검증
 * @param requirements 요구사항 배열
 * @param maxLength 최대 길이 (기본값: 500)
 * @returns 필터링된 요구사항 배열과 에러 메시지
 */
export function processRequirements(
  requirements: string[],
  maxLength: number = 500
): { processed: string[]; error?: string } {
  // 빈 항목 제거 및 sanitize
  const processed = requirements
    .map(req => sanitizeInput(req))
    .filter(req => req.length > 0)

  // 길이 검증
  for (let i = 0; i < processed.length; i++) {
    if (processed[i].length > maxLength) {
      return {
        processed: [],
        error: `요구사항 ${i + 1}은 ${maxLength}자 이하여야 합니다`
      }
    }
  }

  return { processed }
}
