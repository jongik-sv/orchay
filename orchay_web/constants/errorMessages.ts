/**
 * Centralized error messages
 *
 * Provides consistent error messages across the application.
 * Future: Can be integrated with i18n for multi-language support.
 */

export const ERROR_MESSAGES = {
  // Validation errors
  TITLE_LENGTH: '제목은 1-200자여야 합니다',
  INVALID_PRIORITY: '올바른 우선순위를 선택하세요',
  ASSIGNEE_NOT_FOUND: '해당 팀원을 찾을 수 없습니다',
  INVALID_ASSIGNEE: '유효하지 않은 담당자입니다',

  // File operation errors
  FILE_READ_ERROR: '데이터를 불러오는 데 실패했습니다',
  FILE_WRITE_ERROR: '변경 사항을 저장하는 데 실패했습니다',
  FILE_NOT_FOUND: '파일을 찾을 수 없습니다',

  // Network errors
  NETWORK_ERROR: '네트워크 연결을 확인하세요',
  TIMEOUT: '요청 시간이 초과되었습니다',
  SERVER_ERROR: '서버 오류가 발생했습니다',

  // Task errors
  TASK_NOT_FOUND: '요청한 Task를 찾을 수 없습니다',
  TASK_UPDATE_FAILED: 'Task 업데이트에 실패했습니다',

  // Generic errors
  UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다',
  NO_DATA: '데이터가 없습니다'
} as const

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES
