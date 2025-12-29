<script setup lang="ts">
/**
 * WbsSearchBox 컴포넌트
 * WBS 트리 검색 입력 UI
 * - 검색어 입력 처리
 * - Debounce 적용 (300ms)
 * - 검색어 초기화
 *
 * @see TSK-04-01
 * @see 020-detail-design.md
 */

import { useWbsStore } from '~/stores/wbs'
import { useDebounceFn } from '@vueuse/core'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import Button from 'primevue/button'

const wbsStore = useWbsStore()

// 로컬 검색어 상태
const searchQuery = ref('')

// Debounced 검색어 업데이트 (300ms)
const debouncedSearch = useDebounceFn((query: string) => {
  wbsStore.setSearchQuery(query)
}, 300)

// 검색어 변경 감지
watch(searchQuery, (newQuery) => {
  debouncedSearch(newQuery)
})

// 검색어 초기화
const clearSearch = () => {
  searchQuery.value = ''
  wbsStore.setSearchQuery('')
}

// ESC 키 핸들러
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    clearSearch()
  }
}
</script>

<template>
  <div
    data-testid="wbs-search-box"
    class="wbs-search-box relative"
  >
    <IconField iconPosition="left">
      <InputIcon>
        <i class="pi pi-search text-text-secondary" />
      </InputIcon>
      <InputText
        v-model="searchQuery"
        data-testid="search-input"
        placeholder="Task ID 또는 제목으로 검색..."
        class="w-full bg-bg-card border-border text-text
               placeholder:text-gray-500
               focus:border-blue-500 focus:ring-1 focus:ring-blue-500
               transition-colors duration-200"
        role="searchbox"
        aria-label="Search WBS tree by Task ID or title"
        aria-describedby="search-hint"
        @keydown="handleKeydown"
      />
    </IconField>

    <!-- 검색어 초기화 버튼 (검색어 입력 시만 표시) -->
    <Button
      v-if="searchQuery"
      data-testid="clear-search-button"
      icon="pi pi-times"
      text
      rounded
      size="small"
      severity="secondary"
      @click="clearSearch"
      class="absolute right-2 top-1/2 -translate-y-1/2 hover:text-red-500 transition-colors"
      aria-label="Clear search"
    />

    <!-- 스크린 리더용 힌트 -->
    <span id="search-hint" class="sr-only">
      Type to filter tasks. Press ESC to clear.
    </span>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
