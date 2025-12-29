/**
 * Format Utilities
 *
 * @see TSK-04-00
 */

/**
 * 날짜 문자열을 로컬 형식으로 포맷팅
 *
 * @param dateString - ISO 8601 형식의 날짜 문자열
 * @returns 포맷된 날짜 문자열 (YYYY-MM-DD)
 *
 * @example
 * formatDate('2024-01-15T10:30:00Z') // '2024-01-15'
 * formatDate('invalid') // 'Invalid Date'
 */
export function formatDate(dateString: string): string {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
