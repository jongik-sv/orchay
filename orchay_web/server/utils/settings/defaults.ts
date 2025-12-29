/**
 * 기본 설정 상수 정의
 * Task: TSK-02-03-01
 * 기술설계: 010-tech-design.md 섹션 4
 *
 * 설정 파일이 없을 경우 사용할 기본값을 정의합니다.
 */

import type {
  Column,
  ColumnsConfig,
  WorkflowDefinition,
  WorkflowTransition,
  WorkflowsConfig,
} from '../../../types/settings';

// ============================================================
// 기본 columns.json (칸반 컬럼)
// PRD 5.1 기반 6단계 칸반 컬럼
// ============================================================

export const DEFAULT_COLUMNS: ColumnsConfig = {
  version: '1.0',
  columns: [
    {
      id: 'todo',
      name: 'Todo',
      statusCode: '[ ]',
      order: 1,
      color: '#6b7280',
      description: '대기 중인 작업',
    },
    {
      id: 'design',
      name: 'Design',
      statusCode: '[bd]',
      order: 2,
      color: '#3b82f6',
      description: '기본설계 진행 중',
    },
    {
      id: 'detail',
      name: 'Detail',
      statusCodes: ['[dd]', '[an]', '[ds]'],
      order: 3,
      color: '#8b5cf6',
      description: '상세설계/분석/설계 진행 중',
    },
    {
      id: 'implement',
      name: 'Implement',
      statusCodes: ['[im]', '[fx]'],
      order: 4,
      color: '#f59e0b',
      description: '구현/수정 진행 중',
    },
    {
      id: 'verify',
      name: 'Verify',
      statusCode: '[vf]',
      order: 5,
      color: '#22c55e',
      description: '검증 진행 중',
    },
    {
      id: 'done',
      name: 'Done',
      statusCode: '[xx]',
      order: 6,
      color: '#10b981',
      description: '완료된 작업',
    },
  ],
};

// ============================================================
// 기본 workflows.json (워크플로우 규칙) - v2.0 확장 스키마
// categories: workflows 키에서 파생 (development, defect, infrastructure)
// actions: workflows[category].actions + commands.isAction에서 파생
// PRD 5.2 기반 카테고리별 상태 전이 규칙
// ============================================================

export const DEFAULT_WORKFLOWS: WorkflowsConfig = {
  version: '2.0',
  states: {
    '[ ]': { id: 'todo', label: '시작', labelEn: 'Todo', icon: 'pi-inbox', color: '#6b7280', severity: 'secondary', progressWeight: 0, phase: 'todo' },
    '[bd]': { id: 'basic-design', label: '기본설계', labelEn: 'Basic Design', icon: 'pi-pencil', color: '#3b82f6', severity: 'info', progressWeight: 20, phase: 'design' },
    '[dd]': { id: 'detail-design', label: '상세설계', labelEn: 'Detail Design', icon: 'pi-file-edit', color: '#8b5cf6', severity: 'info', progressWeight: 40, phase: 'design' },
    '[ap]': { id: 'approve', label: '승인', labelEn: 'Approve', icon: 'pi-check-square', color: '#10b981', severity: 'success', progressWeight: 50, phase: 'design' },
    '[im]': { id: 'implement', label: '구현', labelEn: 'Implement', icon: 'pi-code', color: '#f59e0b', severity: 'warning', progressWeight: 60, phase: 'implement' },
    '[vf]': { id: 'verify', label: '검증', labelEn: 'Verify', icon: 'pi-verified', color: '#22c55e', severity: 'success', progressWeight: 80, phase: 'implement' },
    '[xx]': { id: 'done', label: '완료', labelEn: 'Done', icon: 'pi-check-circle', color: '#10b981', severity: 'success', progressWeight: 100, phase: 'done' },
    '[an]': { id: 'analysis', label: '분석', labelEn: 'Analysis', icon: 'pi-search', color: '#f59e0b', severity: 'warning', progressWeight: 30, phase: 'design' },
    '[fx]': { id: 'fix', label: '수정', labelEn: 'Fix', icon: 'pi-wrench', color: '#ef4444', severity: 'danger', progressWeight: 60, phase: 'implement' },
    '[ds]': { id: 'design', label: '설계', labelEn: 'Design', icon: 'pi-sitemap', color: '#3b82f6', severity: 'info', progressWeight: 30, phase: 'design' },
  },
  commands: {
    start: { label: '시작', labelEn: 'Start', icon: 'pi-play', severity: 'primary' },
    design: { label: '설계', labelEn: 'Design', icon: 'pi-pencil', severity: 'info' },
    draft: { label: '상세설계', labelEn: 'Draft', icon: 'pi-pencil', severity: 'info' },
    approve: { label: '승인', labelEn: 'Approve', icon: 'pi-check', severity: 'success' },
    build: { label: '구현', labelEn: 'Build', icon: 'pi-wrench', severity: 'warning' },
    verify: { label: '검증', labelEn: 'Verify', icon: 'pi-verified', severity: 'success' },
    done: { label: '완료', labelEn: 'Done', icon: 'pi-check-circle', severity: 'success' },
    fix: { label: '수정', labelEn: 'Fix', icon: 'pi-wrench', severity: 'danger' },
    skip: { label: '건너뛰기', labelEn: 'Skip', icon: 'pi-forward', severity: 'secondary' },
    ui: { label: 'UI설계', labelEn: 'UI Design', icon: 'pi-palette', severity: 'info', isAction: true },
    review: { label: '리뷰', labelEn: 'Review', icon: 'pi-eye', severity: 'secondary', isAction: true },
    apply: { label: '적용', labelEn: 'Apply', icon: 'pi-check', severity: 'secondary', isAction: true },
    test: { label: '테스트', labelEn: 'Test', icon: 'pi-bolt', severity: 'warning', isAction: true },
    audit: { label: '코드리뷰', labelEn: 'Audit', icon: 'pi-search', severity: 'secondary', isAction: true },
    patch: { label: '패치', labelEn: 'Patch', icon: 'pi-file-edit', severity: 'secondary', isAction: true },
  },
  workflows: {
    development: {
      name: 'Development Workflow',
      states: ['[ ]', '[bd]', '[dd]', '[ap]', '[im]', '[vf]', '[xx]'],
      transitions: [
        { from: '[ ]', to: '[bd]', command: 'start' },
        { from: '[bd]', to: '[dd]', command: 'draft' },
        { from: '[dd]', to: '[ap]', command: 'approve' },
        { from: '[ap]', to: '[im]', command: 'build' },
        { from: '[im]', to: '[vf]', command: 'verify' },
        { from: '[vf]', to: '[xx]', command: 'done' },
      ],
      actions: { '[bd]': ['ui'], '[dd]': ['review', 'apply'], '[im]': ['test', 'audit', 'patch'], '[vf]': ['test'] },
    },
    defect: {
      name: 'Defect Workflow',
      states: ['[ ]', '[an]', '[fx]', '[vf]', '[xx]'],
      transitions: [
        { from: '[ ]', to: '[an]', command: 'start' },
        { from: '[an]', to: '[fx]', command: 'fix' },
        { from: '[fx]', to: '[vf]', command: 'verify' },
        { from: '[vf]', to: '[xx]', command: 'done' },
      ],
      actions: { '[fx]': ['test', 'audit', 'patch'], '[vf]': ['test'] },
    },
    infrastructure: {
      name: 'Infrastructure Workflow',
      states: ['[ ]', '[ds]', '[im]', '[xx]'],
      transitions: [
        { from: '[ ]', to: '[ds]', command: 'start' },
        { from: '[ ]', to: '[im]', command: 'skip' },
        { from: '[ds]', to: '[im]', command: 'build' },
        { from: '[im]', to: '[xx]', command: 'done' },
      ],
      actions: { '[im]': ['test', 'audit', 'patch'] },
    },
    'simple-dev': {
      name: 'Simple Development Workflow',
      states: ['[ ]', '[dd]', '[im]', '[xx]'],
      transitions: [
        { from: '[ ]', to: '[dd]', command: 'design' },
        { from: '[dd]', to: '[im]', command: 'build' },
        { from: '[im]', to: '[xx]', command: 'done' },
      ],
      actions: { '[dd]': ['ui', 'review', 'apply'], '[im]': ['test', 'audit', 'patch'] },
    },
  },
};

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 상태 코드로 컬럼 찾기
 * @param statusCode 상태 코드 (예: '[im]')
 * @returns 해당 컬럼 또는 undefined
 */
export function findColumnByStatus(statusCode: string): Column | undefined {
  return DEFAULT_COLUMNS.columns.find((col: Column) => {
    if (col.statusCode === statusCode) return true;
    if (col.statusCodes?.includes(statusCode)) return true;
    return false;
  });
}

/**
 * 카테고리 ID로 워크플로우 찾기
 * @param categoryId 카테고리 ID (예: 'development')
 * @returns 해당 워크플로우 또는 undefined
 */
export function findWorkflowByCategory(categoryId: string): WorkflowDefinition | undefined {
  return DEFAULT_WORKFLOWS.workflows[categoryId];
}

/**
 * 현재 상태에서 사용 가능한 전이 목록 조회
 * @param workflowId 워크플로우 ID
 * @param currentState 현재 상태 코드
 * @returns 사용 가능한 전이 목록
 */
export function getAvailableTransitions(workflowId: string, currentState: string): WorkflowTransition[] {
  const workflow = DEFAULT_WORKFLOWS.workflows[workflowId];
  if (!workflow) return [];
  return workflow.transitions.filter((t: WorkflowTransition) => t.from === currentState);
}

/**
 * 현재 상태에서 사용 가능한 액션 명령어 목록 조회
 * @param categoryId 카테고리 ID
 * @param currentState 현재 상태 코드
 * @returns 사용 가능한 액션 명령어 목록
 */
export function getAvailableActionCommands(categoryId: string, currentState: string): string[] {
  const workflow = DEFAULT_WORKFLOWS.workflows[categoryId];
  if (!workflow || !workflow.actions) return [];
  return workflow.actions[currentState] || [];
}
