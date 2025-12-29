/**
 * WBS Parser - 속성 파싱 함수
 * Task: TSK-02-02-01
 * 상세설계: 020-detail-design.md 섹션 3.3
 */

import type { TaskCategory, Priority, ScheduleRange, CompletedTimestamps } from '../../../../types';
import type { NodeAttributes } from './_types';
import {
  ATTRIBUTE_PATTERN,
  STATUS_PATTERN,
  SCHEDULE_PATTERN,
  INDENT_LIST_PATTERN,
  VALID_CATEGORIES,
  VALID_PRIORITIES,
} from './_patterns';

/**
 * 속성 라인 배열을 파싱하여 NodeAttributes 객체 생성
 *
 * @param lines - 속성 라인 배열 (예: ["- category: development", "- status: done [xx]"])
 * @returns 파싱된 속성 객체
 *
 * FR-002: 속성 파싱 (9개 속성)
 * BR-005: 상태 코드 [xx] 형식 추출
 * TSK-03-05: test-result 속성 추가
 */
export function parseNodeAttributes(lines: string[]): NodeAttributes {
  const attributes: NodeAttributes = {};
  const customAttributes: Record<string, string> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(ATTRIBUTE_PATTERN);

    if (!match) {
      continue;
    }

    const [, key, value] = match;

    switch (key) {
      case 'category':
        attributes.category = parseCategory(value);
        break;

      case 'status':
        attributes.status = parseStatus(value);
        break;

      case 'priority':
        attributes.priority = parsePriority(value);
        break;

      case 'assignee':
        // "-" 값은 undefined로 처리
        attributes.assignee = value === '-' ? undefined : value;
        break;

      case 'schedule':
        attributes.schedule = parseSchedule(value);
        break;

      case 'tags':
        attributes.tags = parseTags(value);
        break;

      case 'depends':
        // "-" 값은 undefined로 처리, 쉼표로 분리하여 배열로 저장
        if (value === '-') {
          attributes.depends = undefined;
        } else {
          attributes.depends = value.split(',').map(dep => dep.trim()).filter(dep => dep);
        }
        break;

      case 'requirements':
        // requirements는 다음 라인들에서 들여쓰기된 항목을 수집
        attributes.requirements = parseRequirements(lines, i + 1);
        break;

      case 'ref':
        attributes.ref = value;
        break;

      case 'completed':
        // TSK-03-06: completed 속성 (중첩 리스트 형식)
        attributes.completed = parseCompleted(lines, i + 1);
        break;

      case 'test-result':
        // TSK-03-05: test-result 속성 (none, pass, fail)
        customAttributes['test-result'] = value.trim();
        break;

      default:
        // 알 수 없는 속성은 customAttributes에 저장
        customAttributes[key] = value;
        break;
    }
  }

  // customAttributes가 있으면 attributes 객체에 추가
  if (Object.keys(customAttributes).length > 0) {
    attributes.customAttributes = customAttributes;
  }

  return attributes;
}

/**
 * category 속성 파싱
 */
function parseCategory(value: string): TaskCategory | undefined {
  const trimmed = value.trim().toLowerCase();

  if (VALID_CATEGORIES.includes(trimmed as TaskCategory)) {
    return trimmed as TaskCategory;
  }

  return undefined;
}

/**
 * status 속성 파싱 - 상태 코드 추출
 * 예: "done [xx]" → "[xx]"
 */
function parseStatus(value: string): string | undefined {
  const match = value.match(STATUS_PATTERN);

  if (!match) {
    return undefined;
  }

  return `[${match[1]}]`;
}

/**
 * priority 속성 파싱
 */
function parsePriority(value: string): Priority | undefined {
  const trimmed = value.trim().toLowerCase();

  if (VALID_PRIORITIES.includes(trimmed as Priority)) {
    return trimmed as Priority;
  }

  return undefined;
}

/**
 * schedule 속성 파싱
 * 예: "2025-12-01 ~ 2025-12-31" → { start: "2025-12-01", end: "2025-12-31" }
 */
function parseSchedule(value: string): ScheduleRange | undefined {
  const match = value.match(SCHEDULE_PATTERN);

  if (!match) {
    return undefined;
  }

  return {
    start: match[1],
    end: match[2],
  };
}

/**
 * tags 속성 파싱
 * 예: "parser, markdown, wbs" → ["parser", "markdown", "wbs"]
 */
function parseTags(value: string): string[] {
  if (!value || !value.trim()) {
    return [];
  }

  return value.split(',').map(tag => tag.trim()).filter(Boolean);
}

/**
 * requirements 속성 파싱 (다중 라인)
 *
 * 예:
 * - requirements:
 *   - Nuxt 3 설치
 *   - TypeScript 설정
 *
 * → ["Nuxt 3 설치", "TypeScript 설정"]
 */
function parseRequirements(lines: string[], startIndex: number): string[] {
  const requirements: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // 들여쓰기 리스트 아이템인 경우
    const match = line.match(INDENT_LIST_PATTERN);

    if (match) {
      requirements.push(match[2].trim());
    } else if (line.match(ATTRIBUTE_PATTERN)) {
      // 새로운 속성 시작이면 중단
      break;
    } else if (line.trim() === '') {
      // 빈 줄이면 계속
      continue;
    } else {
      // 그 외의 경우 중단
      break;
    }
  }

  return requirements;
}

/**
 * completed 속성 파싱 (다중 라인)
 * TSK-03-06: 단계별 완료시각 파싱
 *
 * 예:
 * - completed:
 *   - bd: 2025-12-15 10:30
 *   - dd: 2025-12-15 14:20
 *
 * → { bd: "2025-12-15 10:30", dd: "2025-12-15 14:20" }
 */
function parseCompleted(lines: string[], startIndex: number): CompletedTimestamps {
  const completed: CompletedTimestamps = {};

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];

    // 들여쓰기 리스트 아이템인 경우 (예: "  - bd: 2025-12-15 10:30")
    const match = line.match(INDENT_LIST_PATTERN);

    if (match) {
      const content = match[2].trim();
      // "bd: 2025-12-15 10:30" 형태 파싱
      const colonIndex = content.indexOf(':');
      if (colonIndex > 0) {
        const key = content.substring(0, colonIndex).trim();
        const value = content.substring(colonIndex + 1).trim();
        completed[key] = value;
      }
    } else if (line.match(ATTRIBUTE_PATTERN)) {
      // 새로운 속성 시작이면 중단
      break;
    } else if (line.trim() === '') {
      // 빈 줄이면 계속
      continue;
    } else {
      // 그 외의 경우 중단
      break;
    }
  }

  return completed;
}
