<template>
  <img
    :src="resolvedSrc"
    :alt="alt"
    :width="width"
    :height="height"
    class="prose-img"
    loading="lazy"
  />
</template>

<script setup lang="ts">
/**
 * Custom ProseImg - MDC 이미지 컴포넌트 오버라이드
 *
 * 순수 <img> 태그만 사용하여 Vue Router 충돌 방지
 */

const props = defineProps<{
  src?: string
  alt?: string
  width?: string | number
  height?: string | number
}>()

// 이미지 경로 해석
const resolvedSrc = computed(() => {
  if (!props.src) return ''

  // 절대 경로 또는 외부 URL은 그대로 사용
  if (props.src.startsWith('http://') ||
      props.src.startsWith('https://') ||
      props.src.startsWith('//') ||
      props.src.startsWith('data:')) {
    return props.src
  }

  // 루트 경로(/)로 시작하는 경우 public 폴더 참조
  if (props.src.startsWith('/')) {
    return props.src
  }

  // 상대 경로는 그대로 반환
  return props.src
})
</script>

<style scoped>
.prose-img {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}
</style>
