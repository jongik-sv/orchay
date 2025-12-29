<script setup lang="ts">
/**
 * AppLayout 컴포넌트
 * - Flex 기반 고정/유동 레이아웃
 * - WBS Tree: 600px 고정
 * - Detail: 나머지 전체 폭 (flex-1)
 * - Header + 좌우 분할 Content
 *
 * @see TSK-08-03
 * @see 020-detail-design.md
 */
</script>

<template>
  <div
    data-testid="app-layout"
    class="min-w-[1200px] h-screen flex flex-col bg-bg"
  >
    <!-- Header 영역 (56px 고정) -->
    <header
      data-testid="app-header-container"
      class="h-[56px] w-full flex-shrink-0 bg-bg-header border-b border-border"
      role="banner"
    >
      <slot name="header">
        <!-- 기본 헤더 (슬롯 미제공 시) -->
        <div class="h-full flex items-center px-4">
          <span class="text-text font-semibold">orchay</span>
        </div>
      </slot>
    </header>

    <!-- Content 영역 (Flex 기반 고정/유동 레이아웃) -->
    <main
      data-testid="app-content"
      class="flex-1 flex overflow-hidden"
      role="main"
    >
      <!-- 좌측 패널 (WBS Tree 영역) - 600px 고정 -->
      <aside
        data-testid="left-panel"
        class="w-[600px] flex-shrink-0 h-full bg-bg-sidebar overflow-auto"
        role="complementary"
        aria-label="WBS Tree Panel"
      >
        <slot name="left">
          <!-- 기본 좌측 패널 (슬롯 미제공 시) -->
          <div class="p-4 text-text-secondary">
            Left Panel (WBS Tree)
          </div>
        </slot>
      </aside>

      <!-- 구분선 -->
      <div class="w-[1px] flex-shrink-0 bg-border" />

      <!-- 우측 패널 (Detail 영역) - 나머지 전체 폭 -->
      <section
        data-testid="right-panel"
        class="flex-1 min-w-0 h-full bg-bg overflow-auto"
        role="region"
        aria-label="Task Detail"
      >
        <slot name="right">
          <!-- 기본 우측 패널 (슬롯 미제공 시) -->
          <div class="p-4 text-text-secondary">
            Right Panel (Task Detail)
          </div>
        </slot>
      </section>
    </main>
  </div>
</template>
