import type { WbsNode } from '../../../../types';

/**
 * 노드 속성을 마크다운 목록으로 포맷팅
 * @param node - WBS 노드
 * @returns 속성 라인 배열
 */
export function serializeAttributes(node: WbsNode): string[] {
  const lines: string[] = [];

  // category
  if (node.category) {
    lines.push(`- category: ${node.category}`);
  }

  // status
  if (node.status) {
    lines.push(`- status: ${node.status}`);
  }

  // priority
  if (node.priority) {
    lines.push(`- priority: ${node.priority}`);
  }

  // assignee (빈 값이면 건너뛰기)
  if (node.assignee && node.assignee !== '-') {
    lines.push(`- assignee: ${node.assignee}`);
  } else if (node.assignee === '-') {
    lines.push(`- assignee: -`);
  }

  // test-result (Task의 테스트 결과 - TSK-03-05)
  if (node.attributes?.['test-result']) {
    lines.push(`- test-result: ${node.attributes['test-result']}`);
  }

  // schedule (start와 end가 모두 있어야 출력)
  if (node.schedule?.start && node.schedule?.end) {
    lines.push(`- schedule: ${node.schedule.start} ~ ${node.schedule.end}`);
  }

  // tags (배열이 비어있지 않으면)
  if (node.tags && node.tags.length > 0) {
    lines.push(`- tags: ${node.tags.join(', ')}`);
  }

  // depends
  if (node.depends) {
    lines.push(`- depends: ${node.depends}`);
  }

  // requirements (배열이 비어있지 않으면)
  if (node.requirements && node.requirements.length > 0) {
    lines.push(`- requirements:`);
    for (const req of node.requirements) {
      lines.push(`  - ${req}`);
    }
  }

  // acceptance (배열이 비어있지 않으면)
  if (node.attributes?.acceptance && node.attributes.acceptance.length > 0) {
    lines.push(`- acceptance:`);
    for (const item of node.attributes.acceptance) {
      lines.push(`  - ${item}`);
    }
  }

  // tech-spec (배열이 비어있지 않으면)
  if (node.attributes?.['tech-spec'] && node.attributes['tech-spec'].length > 0) {
    lines.push(`- tech-spec:`);
    for (const item of node.attributes['tech-spec']) {
      lines.push(`  - ${item}`);
    }
  }

  // api-spec (배열이 비어있지 않으면)
  if (node.attributes?.['api-spec'] && node.attributes['api-spec'].length > 0) {
    lines.push(`- api-spec:`);
    for (const item of node.attributes['api-spec']) {
      lines.push(`  - ${item}`);
    }
  }

  // ui-spec (배열이 비어있지 않으면)
  if (node.attributes?.['ui-spec'] && node.attributes['ui-spec'].length > 0) {
    lines.push(`- ui-spec:`);
    for (const item of node.attributes['ui-spec']) {
      lines.push(`  - ${item}`);
    }
  }

  // prd-ref
  if (node.attributes?.['prd-ref']) {
    lines.push(`- prd-ref: ${node.attributes['prd-ref']}`);
  }

  // ref
  if (node.ref) {
    lines.push(`- ref: ${node.ref}`);
  }

  // TSK-03-06: completed (단계별 완료시각)
  if (node.completed && Object.keys(node.completed).length > 0) {
    lines.push(`- completed:`);
    for (const [key, value] of Object.entries(node.completed)) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  // progress (WP나 ACT 타입이고 값이 있으면)
  if ((node.type === 'wp' || node.type === 'act') && node.progress !== undefined && node.progress !== null) {
    // 숫자만 출력, % 포함 여부는 원본 형식 유지
    const progressStr = typeof node.progress === 'number' ? `${node.progress}%` : String(node.progress);
    lines.push(`- progress: ${progressStr}`);
  }

  return lines;
}
