<template>
  <Tag
    :value="statusLabel"
    :severity="statusSeverity"
    rounded
    :aria-label="`Status: ${statusLabel}`"
    :data-testid="`status-badge-${status}`"
  />
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'

interface Props {
  status: string
}

const props = defineProps<Props>()

/**
 * 상태 코드 파싱
 * "basic-design [bd]" → "bd"
 * "[bd]" → "bd"
 * "[ ]" → " " (공백 유지)
 * "unknown" → "unknown"
 */
const statusCode = computed(() => {
  const match = props.status.match(/\[([^\]]*)\]/)
  if (!match) return props.status
  // 공백 문자는 trim하지 않음
  const code = match[1]
  return code || props.status
})

/**
 * 상태 코드 → 레이블 매핑
 */
const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    ' ': '대기',
    'bd': '기본설계',
    'dd': '상세설계',
    'an': '분석',
    'ds': '설계',
    'im': '구현',
    'fx': '수정',
    'vf': '검증',
    'xx': '완료'
  }
  return labels[statusCode.value] || statusCode.value
})

/**
 * 상태 코드 → PrimeVue Severity 매핑
 */
const statusSeverity = computed(() => {
  const severities: Record<string, 'secondary' | 'info' | 'warning' | 'success'> = {
    ' ': 'secondary',
    'bd': 'info',
    'dd': 'info',
    'an': 'info',
    'ds': 'info',
    'im': 'warning',
    'fx': 'warning',
    'vf': 'success',
    'xx': 'success'
  }
  return severities[statusCode.value] || 'secondary'
})
</script>

<style scoped>
/* PrimeVue Tag 스타일은 전역 테마에서 처리 */
</style>
