import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import WbsTreePanel from '../../../../app/components/wbs/WbsTreePanel.vue';
import { useWbsStore } from '../../../../app/stores/wbs';
import type { WbsNode } from '../../../../app/types';
import type { TreeNode } from 'primevue/treenode';

// Vue Router Mock
const mockRoute = {
  query: { project: 'test-project' }
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute
}));

// Mock Data (테스트 명세 섹션 4.1)
const MOCK_WBS_SIMPLE: WbsNode = {
  id: 'WP-01',
  type: 'wp',
  title: 'Auth Module',
  progress: 50,
  children: []
};

const MOCK_WBS_NESTED: WbsNode = {
  id: 'WP-01',
  type: 'wp',
  title: 'Auth Module',
  progress: 50,
  children: [
    {
      id: 'TSK-01-01',
      type: 'task',
      title: 'Login',
      status: '[bd]',
      children: []
    }
  ]
};

const MOCK_WBS_DEEP: WbsNode = {
  id: 'WP-01',
  type: 'wp',
  title: 'Auth Module',
  progress: 75,
  children: [
    {
      id: 'ACT-01-01',
      type: 'act',
      title: 'User Auth',
      progress: 60,
      children: [
        {
          id: 'TSK-01-01-01',
          type: 'task',
          title: 'Login Form',
          status: '[im]',
          children: []
        }
      ]
    }
  ]
};

// 테스트용 마운트 헬퍼
function mountComponent(options: any = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(WbsTreePanel, {
    global: {
      plugins: [
        pinia,
        [PrimeVue, {
          theme: {
            preset: Aura,
            options: { darkModeSelector: '.dark-mode' }
          }
        }]
      ],
      stubs: {
        WbsTreeHeader: true,
        Tree: true,
        ProgressSpinner: true,
        Message: true,
        Button: true,
        NodeIcon: true,
        StatusBadge: true,
        ...options.stubs
      }
    },
    ...options
  });
}

// data-testid로 요소 찾기
function findByTestId(wrapper: any, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`);
}

describe('WbsTreePanel Component (TSK-08-01 PrimeVue Migration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock route
    mockRoute.query = { project: 'test-project' };
  });

  // ============================================================
  // UT-001: convertToTreeNodes 함수 테스트
  // ============================================================
  describe('convertToTreeNodes (UT-001)', () => {
    it('단순 WP 노드를 TreeNode로 변환한다', async () => {
      // Given: 단순 WP 노드 데이터
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_SIMPLE];
      store.loading = false;

      await wrapper.vm.$nextTick();

      // When: treeNodes computed 계산
      const vm = wrapper.vm as any;
      const treeNodes = vm.treeNodes as TreeNode[];

      // Then: 올바른 TreeNode 구조
      expect(treeNodes).toHaveLength(1);
      expect(treeNodes[0].key).toBe('WP-01');
      expect(treeNodes[0].label).toBe('Auth Module');
      expect(treeNodes[0].data.node).toBeDefined();
      expect(treeNodes[0].data.node.id).toBe('WP-01');
      expect(treeNodes[0].children).toBeUndefined();
    });

    it('중첩 구조 (WP → TSK)를 재귀적으로 변환한다', async () => {
      // Given: 중첩 구조 데이터
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_NESTED];
      store.loading = false;

      await wrapper.vm.$nextTick();

      // When: treeNodes computed 계산
      const vm = wrapper.vm as any;
      const treeNodes = vm.treeNodes as TreeNode[];

      // Then: 자식 노드도 변환됨
      expect(treeNodes).toHaveLength(1);
      expect(treeNodes[0].children).toHaveLength(1);
      expect(treeNodes[0].children![0].key).toBe('TSK-01-01');
      expect(treeNodes[0].children![0].label).toBe('Login');
      expect(treeNodes[0].children![0].data.node.status).toBe('[bd]');
    });

    it('3단계 계층 구조 (WP → ACT → TSK)를 변환한다', async () => {
      // Given: 깊은 중첩 데이터
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;

      await wrapper.vm.$nextTick();

      // When: treeNodes computed 계산
      const vm = wrapper.vm as any;
      const treeNodes = vm.treeNodes as TreeNode[];

      // Then: 모든 레벨이 변환됨
      expect(treeNodes[0].children).toHaveLength(1);
      expect(treeNodes[0].children![0].key).toBe('ACT-01-01');
      expect(treeNodes[0].children![0].children).toHaveLength(1);
      expect(treeNodes[0].children![0].children![0].key).toBe('TSK-01-01-01');
    });

    it('빈 배열을 빈 배열로 변환한다', async () => {
      // Given: 빈 트리
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [];
      store.loading = false;

      await wrapper.vm.$nextTick();

      // When: treeNodes computed 계산
      const vm = wrapper.vm as any;
      const treeNodes = vm.treeNodes as TreeNode[];

      // Then: 빈 배열
      expect(treeNodes).toHaveLength(0);
    });
  });

  // ============================================================
  // UT-002: expandedKeys computed 테스트
  // ============================================================
  describe('expandedKeys computed (UT-002)', () => {
    it('Set<string>을 Record<string, boolean>으로 변환한다', async () => {
      // Given: expandedNodes가 설정된 store
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;
      store.expandedNodes.clear();
      store.expandedNodes.add('WP-01');
      store.expandedNodes.add('ACT-01-01');

      await wrapper.vm.$nextTick();

      // When: expandedKeys computed 계산
      const vm = wrapper.vm as any;
      const expandedKeys = vm.expandedKeys;

      // Then: Record 형식으로 변환됨
      expect(expandedKeys).toEqual({
        'WP-01': true,
        'ACT-01-01': true
      });
    });

    it('빈 Set은 빈 객체로 변환한다', async () => {
      // Given: 빈 expandedNodes
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_SIMPLE];
      store.loading = false;
      store.expandedNodes.clear();

      await wrapper.vm.$nextTick();

      // When: expandedKeys computed 계산
      const vm = wrapper.vm as any;
      const expandedKeys = vm.expandedKeys;

      // Then: 빈 객체
      expect(expandedKeys).toEqual({});
    });

    it('단일 노드 확장 상태를 올바르게 변환한다', async () => {
      // Given: 단일 노드 확장
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;
      store.expandedNodes.clear();
      store.expandedNodes.add('TSK-01-01-01');

      await wrapper.vm.$nextTick();

      // When: expandedKeys computed 계산
      const vm = wrapper.vm as any;
      const expandedKeys = vm.expandedKeys;

      // Then: 단일 키만 포함
      expect(expandedKeys).toEqual({ 'TSK-01-01-01': true });
    });
  });

  // ============================================================
  // UT-003: updateExpandedKeys 이벤트 핸들러 테스트
  // ============================================================
  describe('updateExpandedKeys (UT-003)', () => {
    it('node-expand 이벤트 시 expandedNodes에 노드 키를 추가한다', async () => {
      // Given: 컴포넌트 마운트
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;
      store.expandedNodes.clear();

      await wrapper.vm.$nextTick();

      // When: updateExpandedKeys 호출 (노드 확장)
      const vm = wrapper.vm as any;
      vm.updateExpandedKeys({ key: 'WP-01', label: 'Auth Module', data: { node: MOCK_WBS_DEEP } });

      // Then: expandedNodes에 추가됨
      expect(store.expandedNodes.has('WP-01')).toBe(true);
    });

    it('node-collapse 이벤트 시 expandedNodes에서 노드 키를 제거한다', async () => {
      // Given: 노드가 이미 확장된 상태
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;
      store.expandedNodes.clear();
      store.expandedNodes.add('WP-01');

      await wrapper.vm.$nextTick();

      // When: updateExpandedKeys 호출 (노드 축소 - 토글)
      const vm = wrapper.vm as any;
      vm.updateExpandedKeys({ key: 'WP-01', label: 'Auth Module', data: { node: MOCK_WBS_DEEP } });

      // Then: expandedNodes에서 제거됨
      expect(store.expandedNodes.has('WP-01')).toBe(false);
    });
  });

  // ============================================================
  // 상태 UI 테스트
  // ============================================================
  describe('상태별 UI 렌더링', () => {
    it('로딩 상태 시 loading-state가 표시된다', async () => {
      // Given: 로딩 중 store
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.loading = true;

      await wrapper.vm.$nextTick();

      // Then: 로딩 상태 표시
      expect(findByTestId(wrapper, 'loading-state').exists()).toBe(true);
    });

    it('에러 상태 시 error-state와 retry-button이 표시된다', async () => {
      // Given: 에러 상태 store
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.error = 'Failed to load WBS';
      store.loading = false;

      await wrapper.vm.$nextTick();

      // Then: 에러 상태 표시
      expect(findByTestId(wrapper, 'error-state').exists()).toBe(true);
      expect(findByTestId(wrapper, 'retry-button').exists()).toBe(true);
    });

    it('빈 데이터 시 empty-state-no-wbs가 표시된다', async () => {
      // Given: 빈 트리 store
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [];
      store.loading = false;
      store.error = null;

      await wrapper.vm.$nextTick();

      // Then: 빈 상태 표시
      expect(findByTestId(wrapper, 'empty-state-no-wbs').exists()).toBe(true);
    });

    it('projectId 미존재 시 no-project-state가 표시된다 (설계리뷰 IMP-02)', async () => {
      // Given: projectId 없는 route
      mockRoute.query = {}; // projectId 제거

      const wrapper = mountComponent();
      const store = useWbsStore();
      store.loading = false;

      await wrapper.vm.$nextTick();

      // Then: 프로젝트 미존재 상태 표시
      expect(findByTestId(wrapper, 'no-project-state').exists()).toBe(true);
    });
  });

  // ============================================================
  // handleNodeClick 이벤트 테스트
  // ============================================================
  describe('handleNodeClick', () => {
    it('노드 클릭 시 node-selected 이벤트를 발생시킨다', async () => {
      // Given: 컴포넌트 마운트
      const wrapper = mountComponent();
      const store = useWbsStore();
      store.tree = [MOCK_WBS_DEEP];
      store.loading = false;

      await wrapper.vm.$nextTick();

      // When: handleNodeClick 호출
      const vm = wrapper.vm as any;
      vm.handleNodeClick('TSK-01-01-01');

      // Then: node-selected 이벤트 발생
      expect(wrapper.emitted('node-selected')).toBeTruthy();
      expect(wrapper.emitted('node-selected')![0]).toEqual(['TSK-01-01-01']);
    });
  });
});
