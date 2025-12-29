/**
 * 상태 코드 유틸리티
 * Task: TSK-03-04
 *
 * 상태 코드 추출 및 포맷팅 공통 함수
 */

/**
 * 상태 문자열에서 상태 코드 추출
 * @param status - 상태 문자열 (예: "detail-design [dd]" 또는 "[dd]")
 * @param defaultValue - 기본값 (기본: 빈 문자열)
 * @returns 상태 코드 (예: "dd")
 */
export function extractStatusCode(status?: string, defaultValue = ''): string {
  if (!status) return defaultValue;
  const match = status.match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : defaultValue;
}

/**
 * 상태 코드를 대괄호 포함 형태로 포맷
 * @param code - 상태 코드 (예: "bd")
 * @returns 포맷된 상태 (예: "[bd]")
 */
export function formatStatusCode(code: string): string {
  return code && code.trim() ? `[${code.trim()}]` : '[ ]';
}

/**
 * 상태 문자열이 todo 상태인지 확인
 * @param status - 상태 문자열
 * @returns todo 상태 여부
 */
export function isTodoStatus(status?: string): boolean {
  if (!status) return true;
  const code = extractStatusCode(status);
  return !code || code === ' ';
}
