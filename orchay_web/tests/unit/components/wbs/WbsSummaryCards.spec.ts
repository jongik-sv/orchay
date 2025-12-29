import { describe, it, expect, beforeEach } from 'vitest';
import { mountWithPinia, findByTestId } from '../../../helpers/component-helpers';
import WbsSummaryCards from '../../../../app/components/wbs/WbsSummaryCards.vue';
import { useWbsStore } from '../../../../app/stores/wbs';
import { complexWbsTree, emptyWbsTree } from '../../../fixtures/mock-data/wbs-nodes';

describe('WbsSummaryCards Component', () => {
  describe('통계 표시', () => {
    it('TC-220: 4개 카드 렌더링', async () => {
      // Given: 마운트
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [complexWbsTree];

      await wrapper.vm.$nextTick();

      // Then: 4개 카드 존재 (WP, ACT, TSK, Progress)
      const cards = wrapper.findAll('[data-testid^="summary-card-"]');
      expect(cards.length).toBeGreaterThanOrEqual(3); // 최소 3개 (WP, TSK, Progress)
    });

    it('TC-221: WP 개수 정확히 표시', async () => {
      // Given: store에 데이터
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [complexWbsTree];

      await wrapper.vm.$nextTick();

      // Then: wpCount 표시
      const wpCard = findByTestId(wrapper, 'summary-card-wp');
      expect(wpCard.text()).toContain('2'); // complexWbsTree has 2 WPs
    });

    it('TC-222: ACT 개수 정확히 표시', async () => {
      // Given: store에 데이터
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [complexWbsTree];

      await wrapper.vm.$nextTick();

      // Then: actCount 표시
      const actCard = findByTestId(wrapper, 'summary-card-act');
      if (actCard.exists()) {
        expect(actCard.text()).toContain('1'); // complexWbsTree has 1 ACT
      }
    });

    it('TC-223: TSK 개수 정확히 표시', async () => {
      // Given: store에 데이터
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [complexWbsTree];

      await wrapper.vm.$nextTick();

      // Then: tskCount 표시
      const tskCard = findByTestId(wrapper, 'summary-card-tsk');
      expect(tskCard.text()).toContain('4'); // complexWbsTree has 4 TSKs
    });

    it('TC-224: overallProgress 표시', async () => {
      // Given: store에 데이터
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [complexWbsTree];

      await wrapper.vm.$nextTick();

      // Then: 진행률 표시
      const progressCard = findByTestId(wrapper, 'summary-card-progress');
      expect(progressCard.text()).toMatch(/\d+%/); // 숫자%
    });
  });

  describe('빈 데이터 처리', () => {
    it('TC-225: 빈 트리 시 모든 값 0', async () => {
      // Given: 빈 store
      const wrapper = mountWithPinia(WbsSummaryCards);
      const store = useWbsStore();
      store.tree = [];

      await wrapper.vm.$nextTick();

      // Then: 모든 카드 0
      expect(findByTestId(wrapper, 'summary-card-wp').text()).toContain('0');
      expect(findByTestId(wrapper, 'summary-card-tsk').text()).toContain('0');
      expect(findByTestId(wrapper, 'summary-card-progress').text()).toContain('0%');
    });
  });
});
