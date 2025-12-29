<template>
  <!-- 외부 링크나 정적 자산은 일반 a 태그 사용 -->
  <a
    v-if="isExternal || isStaticAsset"
    :href="href"
    :target="linkTarget"
    :rel="isExternal ? 'noopener noreferrer' : undefined"
  >
    <slot />
  </a>
  <!-- 내부 라우트만 NuxtLink 사용 -->
  <NuxtLink
    v-else
    :href="href"
    :target="target"
  >
    <slot />
  </NuxtLink>
</template>

<script setup lang="ts">
/**
 * Custom ProseA - MDC 링크 컴포넌트 오버라이드
 *
 * 정적 자산(이미지 등)과 외부 링크는 일반 <a> 태그 사용
 * Vue Router 경고 방지
 */

const props = defineProps<{
  href?: string
  target?: string
}>()

// 외부 링크 판별
const isExternal = computed(() => {
  if (!props.href) return false
  return props.href.startsWith('http://') ||
         props.href.startsWith('https://') ||
         props.href.startsWith('//')
})

// 정적 자산 경로 판별 (이미지, 파일 등)
const isStaticAsset = computed(() => {
  if (!props.href) return false
  const staticExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.mp3', '.mp4', '.wav', '.avi', '.mov',
    '.css', '.js', '.json', '.xml', '.txt', '.md'
  ]
  const lowerHref = props.href.toLowerCase()
  return staticExtensions.some(ext => lowerHref.endsWith(ext))
})

// 링크 타겟 결정
const linkTarget = computed(() => {
  if (props.target) return props.target
  if (isExternal.value) return '_blank'
  return undefined
})
</script>
