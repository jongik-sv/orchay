import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountWithPinia, findByTestId, waitFor } from '../../../helpers/component-helpers';
import WbsSearchBox from '../../../../app/components/wbs/WbsSearchBox.vue';
import { useWbsStore } from '../../../../app/stores/wbs';

describe('WbsSearchBox Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('검색 기능', () => {
    it('TC-210: 검색어 입력 시 debounce 적용', async () => {
      // Given: 컴포넌트 마운트
      const wrapper = mountWithPinia(WbsSearchBox);
      const store = useWbsStore();
      const setSearchSpy = vi.spyOn(store, 'setSearchQuery');

      const input = findByTestId(wrapper, 'search-input');

      // When: 빠르게 타이핑
      await input.setValue('T');
      await input.setValue('TS');
      await input.setValue('TSK');

      // Then: 즉시 호출되지 않음
      expect(setSearchSpy).not.toHaveBeenCalled();

      // Wait: debounce 시간 (300ms)
      await waitFor(350);

      // Then: 한 번만 호출
      expect(setSearchSpy).toHaveBeenCalledTimes(1);
      expect(setSearchSpy).toHaveBeenCalledWith('TSK');
    });

    it('TC-211: X 버튼 클릭 시 검색어 초기화', async () => {
      // Given: 검색어 입력된 상태
      const wrapper = mountWithPinia(WbsSearchBox);
      const store = useWbsStore();

      const input = findByTestId(wrapper, 'search-input');
      await input.setValue('test query');
      await waitFor(350);

      // When: X 버튼 클릭
      const clearBtn = findByTestId(wrapper, 'search-clear');
      await clearBtn.trigger('click');

      // Then: 검색어 초기화
      expect(store.searchQuery).toBe('');
      expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('TC-212: X 버튼은 검색어 있을 때만 표시', async () => {
      // Given: 빈 검색어
      const wrapper = mountWithPinia(WbsSearchBox);

      // Then: X 버튼 숨김
      let clearBtn = wrapper.find('[data-testid="search-clear"]');
      expect(clearBtn.exists()).toBe(false);

      // When: 검색어 입력
      const input = findByTestId(wrapper, 'search-input');
      await input.setValue('test');
      await wrapper.vm.$nextTick();

      // Then: X 버튼 표시
      clearBtn = findByTestId(wrapper, 'search-clear');
      expect(clearBtn.exists()).toBe(true);
    });

    it('TC-213: 특수문자 검색어 처리', async () => {
      // Given: 컴포넌트 마운트
      const wrapper = mountWithPinia(WbsSearchBox);
      const store = useWbsStore();

      const input = findByTestId(wrapper, 'search-input');

      // When: 특수문자 포함 검색어
      await input.setValue('TSK-01 [bd]');
      await waitFor(350);

      // Then: 특수문자 포함 검색어가 정상 처리됨
      expect(store.searchQuery).toBe('TSK-01 [bd]');
    });
  });
});
