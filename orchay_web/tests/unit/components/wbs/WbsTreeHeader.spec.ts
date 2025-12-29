import { describe, it, expect, vi } from 'vitest';
import { mountWithPinia, findByTestId } from '../../../helpers/component-helpers';
import WbsTreeHeader from '../../../../app/components/wbs/WbsTreeHeader.vue';
import { useWbsStore } from '../../../../app/stores/wbs';

describe('WbsTreeHeader Component', () => {
  describe('렌더링', () => {
    it('TC-230: 타이틀 표시', () => {
      // Given: props
      const wrapper = mountWithPinia(WbsTreeHeader, {
        props: { title: 'Test WBS' }
      });

      // Then: 타이틀 렌더링
      expect(wrapper.text()).toContain('Test WBS');
    });

    it('TC-231: 아이콘 표시', () => {
      // Given: 마운트
      const wrapper = mountWithPinia(WbsTreeHeader);

      // Then: 아이콘 존재
      const icon = wrapper.find('.pi-sitemap');
      expect(icon.exists()).toBe(true);
    });
  });

  describe('펼치기/접기 기능', () => {
    it('TC-232: 전체 펼치기 버튼 클릭', async () => {
      // Given: 마운트
      const wrapper = mountWithPinia(WbsTreeHeader);
      const store = useWbsStore();
      const expandSpy = vi.spyOn(store, 'expandAll');

      // When: 펼치기 버튼 클릭
      const expandBtn = findByTestId(wrapper, 'expand-all-btn');
      await expandBtn.trigger('click');

      // Then: expandAll 호출
      expect(expandSpy).toHaveBeenCalled();
    });

    it('TC-233: 전체 접기 버튼 클릭', async () => {
      // Given: 마운트
      const wrapper = mountWithPinia(WbsTreeHeader);
      const store = useWbsStore();
      const collapseSpy = vi.spyOn(store, 'collapseAll');

      // When: 접기 버튼 클릭
      const collapseBtn = findByTestId(wrapper, 'collapse-all-btn');
      await collapseBtn.trigger('click');

      // Then: collapseAll 호출
      expect(collapseSpy).toHaveBeenCalled();
    });
  });

  describe('검색 박스 통합', () => {
    it('TC-234: WbsSearchBox 포함', () => {
      // Given: 마운트
      const wrapper = mountWithPinia(WbsTreeHeader);

      // Then: 검색 박스 존재
      const searchBox = wrapper.findComponent({ name: 'WbsSearchBox' });
      expect(searchBox.exists()).toBe(true);
    });
  });
});
