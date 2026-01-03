/**
 * YAML → WbsNode 변환 로직
 */

import type { WbsNode, ScheduleRange, TaskCategory, Priority } from '../../../../types';
import type {
  YamlWorkPackage,
  YamlActivity,
  YamlTask,
  YamlRequirements,
} from './_types';

/**
 * 일정 문자열 파싱
 * - 범위 형식: "YYYY-MM-DD ~ YYYY-MM-DD"
 * - 단일 날짜: "YYYY-MM-DD"
 */
export function parseScheduleString(schedule: string | undefined): ScheduleRange | undefined {
  if (!schedule) return undefined;

  // 문자열로 변환 (숫자나 다른 타입일 수 있음)
  const scheduleStr = String(schedule).trim();

  // 범위 형식: "YYYY-MM-DD ~ YYYY-MM-DD"
  const rangeMatch = scheduleStr.match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/);
  if (rangeMatch) {
    return {
      start: rangeMatch[1],
      end: rangeMatch[2],
    };
  }

  // 단일 날짜 형식: "YYYY-MM-DD"
  const singleMatch = scheduleStr.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (singleMatch) {
    return {
      start: singleMatch[1],
      end: singleMatch[1],
    };
  }

  return undefined;
}

/**
 * 상태 문자열 정규화 ("[xx]" 형식 유지)
 */
export function normalizeStatus(status: string | undefined): string | undefined {
  if (!status) return undefined;

  // 이미 [xx] 형식이면 그대로 반환
  if (/^\[[^\]]+\]$/.test(status)) {
    return status;
  }

  // "done [xx]" 같은 형태에서 [xx] 추출
  const match = status.match(/\[([^\]]+)\]/);
  if (match) {
    return `[${match[1]}]`;
  }

  return status;
}

/**
 * 카테고리 문자열 검증
 */
export function parseCategory(category: string | undefined): TaskCategory | undefined {
  if (!category) return undefined;

  const validCategories: TaskCategory[] = ['development', 'defect', 'infrastructure'];
  if (validCategories.includes(category as TaskCategory)) {
    return category as TaskCategory;
  }

  return undefined;
}

/**
 * 우선순위 문자열 검증
 */
export function parsePriority(priority: string | undefined): Priority | undefined {
  if (!priority) return undefined;

  const validPriorities: Priority[] = ['critical', 'high', 'medium', 'low'];
  if (validPriorities.includes(priority as Priority)) {
    return priority as Priority;
  }

  return undefined;
}

/**
 * 진행률 문자열 파싱 ("100%" → 100)
 */
export function parseProgress(progress: string | undefined): number | undefined {
  if (!progress) return undefined;

  const match = progress.match(/^(\d+)%?$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  return undefined;
}

/**
 * YamlRequirements → 마크다운 문자열 변환
 */
export function convertRequirementsToMarkdown(req: YamlRequirements | undefined): string | undefined {
  if (!req) return undefined;

  const sections: string[] = [];

  if (req.prdRef) {
    sections.push(`## 참조\n${req.prdRef}`);
  }

  if (req.items && req.items.length > 0) {
    sections.push(`## 요구사항\n${req.items.map(item => `- ${item}`).join('\n')}`);
  }

  if (req.acceptance && req.acceptance.length > 0) {
    sections.push(`## 인수 조건\n${req.acceptance.map(item => `- ${item}`).join('\n')}`);
  }

  if (req.techSpec && req.techSpec.length > 0) {
    sections.push(`## 기술 스펙\n${req.techSpec.map(item => `- ${item}`).join('\n')}`);
  }

  if (req.dataModel && req.dataModel.length > 0) {
    sections.push(`## 데이터 모델\n${req.dataModel.map(item => `- ${item}`).join('\n')}`);
  }

  if (req.apiSpec && req.apiSpec.length > 0) {
    sections.push(`## API 스펙\n${req.apiSpec.map(item => `- ${item}`).join('\n')}`);
  }

  if (req.uiSpec && req.uiSpec.length > 0) {
    sections.push(`## UI 스펙\n${req.uiSpec.map(item => `- ${item}`).join('\n')}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : undefined;
}

/**
 * YamlTask → WbsNode 변환
 */
export function convertTask(task: YamlTask): WbsNode {
  const node: WbsNode = {
    id: task.id,
    type: 'task',
    title: task.title,
    status: normalizeStatus(task.status),
    category: parseCategory(task.category),
    priority: parsePriority(task.priority),
    assignee: task.assignee === '-' ? undefined : task.assignee,
    schedule: parseScheduleString(task.schedule),
    tags: task.tags,
    depends: task.depends,
    requirements: task.requirements?.items,
    children: [],
    completed: task.completed,
    rawContent: convertRequirementsToMarkdown(task.requirements),
  };

  // execution 필드 처리 (스피너 표시용)
  // "design" 또는 { command: "design" } 형태 모두 지원
  if (task.execution) {
    if (typeof task.execution === 'string') {
      node.execution = task.execution;
    } else if (task.execution.command) {
      node.execution = task.execution.command;
    }
  }

  // 커스텀 속성 처리
  const attributes: Record<string, string> = {};

  if (task.testResult) {
    attributes['test-result'] = task.testResult;
  }
  if (task.workflow) {
    attributes['workflow'] = task.workflow;
  }
  if (task.domain) {
    attributes['domain'] = task.domain;
  }
  if (task.requirements?.prdRef) {
    node.ref = task.requirements.prdRef;
  }

  if (Object.keys(attributes).length > 0) {
    node.attributes = attributes;
  }

  return node;
}

/**
 * YamlActivity → WbsNode 변환 (4-level)
 */
export function convertActivity(activity: YamlActivity): WbsNode {
  const node: WbsNode = {
    id: activity.id,
    type: 'act',
    title: activity.title,
    schedule: parseScheduleString(activity.schedule),
    progress: parseProgress(activity.progress),
    children: activity.tasks.map(convertTask),
  };

  return node;
}

/**
 * YamlWorkPackage → WbsNode 변환
 */
export function convertWorkPackage(wp: YamlWorkPackage): WbsNode {
  const children: WbsNode[] = [];

  // 4-level: activities가 있는 경우
  if (wp.activities && wp.activities.length > 0) {
    children.push(...wp.activities.map(convertActivity));
  }

  // 3-level: tasks가 직접 있는 경우 (ACT 없음)
  if (wp.tasks && wp.tasks.length > 0) {
    children.push(...wp.tasks.map(convertTask));
  }

  const node: WbsNode = {
    id: wp.id,
    type: 'wp',
    title: wp.title,
    priority: parsePriority(wp.priority),
    schedule: parseScheduleString(wp.schedule),
    progress: parseProgress(wp.progress),
    children,
  };

  return node;
}

/**
 * workPackages 배열 → WbsNode[] 트리 변환
 */
export function convertWorkPackages(workPackages: YamlWorkPackage[]): WbsNode[] {
  return workPackages.map(convertWorkPackage);
}
