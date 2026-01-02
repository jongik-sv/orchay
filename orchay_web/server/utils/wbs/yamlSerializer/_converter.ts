/**
 * WbsNode → YAML 변환 로직
 */

import type { WbsNode, ScheduleRange } from '../../../../types';
import type {
  YamlWorkPackage,
  YamlActivity,
  YamlTask,
  YamlRequirements,
} from '../yamlParser/_types';

/**
 * ScheduleRange → 일정 문자열 변환
 */
export function serializeSchedule(schedule: ScheduleRange | undefined): string | undefined {
  if (!schedule) return undefined;
  return `${schedule.start} ~ ${schedule.end}`;
}

/**
 * 진행률 → 문자열 변환
 */
export function serializeProgress(progress: number | undefined): string | undefined {
  if (progress === undefined) return undefined;
  return `${progress}%`;
}

/**
 * depends 배열 정규화
 * 이미 배열이므로 그대로 반환, undefined 또는 빈 배열 처리
 */
export function normalizeDepends(depends: string[] | undefined): string[] | undefined {
  if (!depends || depends.length === 0) return undefined;
  return depends;
}

/**
 * WbsNode (Task) → YamlTask 변환
 */
export function convertNodeToYamlTask(node: WbsNode): YamlTask {
  const task: YamlTask = {
    id: node.id,
    title: node.title,
  };

  if (node.category) task.category = node.category;
  if (node.attributes?.domain) task.domain = node.attributes.domain;
  if (node.status) task.status = node.status;
  if (node.priority) task.priority = node.priority;
  if (node.assignee) {
    task.assignee = node.assignee;
  } else {
    task.assignee = '-';
  }
  if (node.schedule) task.schedule = serializeSchedule(node.schedule);
  if (node.tags && node.tags.length > 0) task.tags = node.tags;

  const depends = normalizeDepends(node.depends);
  if (depends && depends.length > 0) {
    task.depends = depends;
  } else {
    task.depends = [];
  }

  task.blockedBy = null;
  task.testResult = node.attributes?.['test-result'] ?? null;
  task.note = null;

  // requirements 구성
  if (node.requirements || node.ref) {
    const requirements: YamlRequirements = {};
    if (node.ref) requirements.prdRef = node.ref;
    if (node.requirements) requirements.items = node.requirements;
    task.requirements = requirements;
  }

  if (node.completed && Object.keys(node.completed).length > 0) {
    task.completed = node.completed;
  }

  if (node.attributes?.workflow) {
    task.workflow = node.attributes.workflow;
  }

  return task;
}

/**
 * WbsNode (Activity) → YamlActivity 변환
 */
export function convertNodeToYamlActivity(node: WbsNode): YamlActivity {
  const activity: YamlActivity = {
    id: node.id,
    title: node.title,
    tasks: [],
  };

  if (node.schedule) activity.schedule = serializeSchedule(node.schedule);
  if (node.progress !== undefined) activity.progress = serializeProgress(node.progress);

  // 자식 Task 변환
  activity.tasks = node.children
    .filter((child) => child.type === 'task')
    .map(convertNodeToYamlTask);

  return activity;
}

/**
 * WbsNode (WP) → YamlWorkPackage 변환
 */
export function convertNodeToYamlWorkPackage(node: WbsNode): YamlWorkPackage {
  const wp: YamlWorkPackage = {
    id: node.id,
    title: node.title,
  };

  if (node.status) wp.status = node.status;
  if (node.priority) wp.priority = node.priority;
  if (node.schedule) wp.schedule = serializeSchedule(node.schedule);

  // 자식 분류: ACT vs TSK
  const activities = node.children.filter((child) => child.type === 'act');
  const tasks = node.children.filter((child) => child.type === 'task');

  if (activities.length > 0) {
    // 4-level 구조
    wp.activities = activities.map(convertNodeToYamlActivity);
  }

  if (tasks.length > 0) {
    // 3-level 구조 (ACT 없이 직접 TSK)
    wp.tasks = tasks.map(convertNodeToYamlTask);
  }

  return wp;
}

/**
 * WbsNode[] 트리 → YamlWorkPackage[] 변환
 */
export function convertToYamlWorkPackages(nodes: WbsNode[]): YamlWorkPackage[] {
  return nodes
    .filter((node) => node.type === 'wp')
    .map(convertNodeToYamlWorkPackage);
}
