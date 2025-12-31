<script setup lang="ts">
/**
 * AppHeader 컴포넌트 - PrimeVue Menubar Migration
 *
 * @migration TSK-08-04
 * - 커스텀 버튼 네비게이션 → PrimeVue Menubar
 * - MenuItem 모델 + Pass Through API
 * - start/end 슬롯으로 로고/프로젝트명 배치
 *
 * @see 010-basic-design.md
 * @see 011-ui-design.md
 * @see 020-detail-design.md
 * @see 021-design-review-opus-1.md (Minor 개선사항 적용)
 */

import { useToast } from 'primevue/usetoast'
import type { MenuItem } from 'primevue/menuitem'
import type { MenubarPassThroughOptions } from 'primevue/menubar'

// ============================================================
// Props
// ============================================================
interface Props {
  /**
   * 현재 프로젝트명
   * - props 우선, 없으면 projectStore에서 가져옴
   * - 둘 다 없으면 "프로젝트를 선택하세요" 표시
   */
  projectName?: string
}

const props = withDefaults(defineProps<Props>(), {
  projectName: ''
})

// ============================================================
// Composables
// ============================================================
const router = useRouter()
const route = useRoute()
const toast = useToast()
const projectStore = useProjectStore()
const configStore = useConfigStore()

// ============================================================
// MenuItem 모델
// ============================================================
/**
 * MenuItem 모델 (computed로 반응성 유지)
 *
 * @review Minor-02 적용: icon 필드 제거 (YAGNI 원칙)
 * @review Major-01 적용: command 필드 제거 (item 템플릿에서 handleItemClick 사용)
 * @note disabled 상태는 data.isDisabled로 관리, 클릭은 handleItemClick에서 처리
 */
const menuModel = computed<MenuItem[]>(() => [
  {
    key: 'dashboard',
    label: '대시보드',
    to: '/dashboard',
    data: { isDisabled: true }
  },
  {
    key: 'kanban',
    label: '칸반',
    to: '/kanban',
    data: { isDisabled: true }
  },
  {
    key: 'wbs',
    label: 'WBS',
    to: '/wbs',
    data: { isDisabled: false }
  }
])

// ============================================================
// Computed 속성
// ============================================================
/**
 * 표시할 프로젝트명 계산
 *
 * @returns 프로젝트명 또는 안내 메시지
 *
 * @priority
 * 1. props.projectName (부모 컴포넌트 전달)
 * 2. projectStore.projectName (전역 상태)
 * 3. '프로젝트를 선택하세요' (기본값)
 */
const displayProjectName = computed(() => {
  return props.projectName || projectStore.projectName || '프로젝트를 선택하세요'
})

/**
 * 프로젝트 선택 여부 확인
 */
const hasProject = computed(() => {
  return !!(props.projectName || projectStore.projectName)
})

/**
 * 프로젝트명 CSS 클래스 동적 생성
 */
const projectNameClass = computed(() => {
  return hasProject.value
    ? 'menubar-project-name'
    : 'menubar-project-name-empty'
})

/**
 * 활성 라우트 체크
 *
 * @param item - MenuItem 객체
 * @returns 현재 페이지 여부 (boolean)
 */
const isActiveRoute = (item: MenuItem): boolean => {
  const isDisabled = item.data?.isDisabled ?? false
  return route.path === item.to && !isDisabled
}

/**
 * 메뉴 아이템 CSS 클래스 동적 생성
 *
 * @param item - MenuItem 객체
 * @returns CSS 클래스 문자열
 */
const getMenuItemClass = (item: MenuItem): string => {
  const classes = ['menubar-item']
  const isDisabled = item.data?.isDisabled ?? false

  if (isDisabled) {
    classes.push('menubar-item-disabled')
  } else if (isActiveRoute(item)) {
    classes.push('menubar-item-active')
  }

  return classes.join(' ')
}

// ============================================================
// 이벤트 처리
// ============================================================
/**
 * 메뉴 아이템 클릭 핸들러 (item 템플릿용)
 *
 * @param event - 클릭 이벤트
 * @param item - MenuItem 객체
 *
 * @behavior
 * - disabled 메뉴: preventDefault() → 토스트 표시
 * - enabled 메뉴: 기본 동작 (라우팅)
 */
const handleItemClick = (event: Event, item: MenuItem) => {
  const isDisabled = item.data?.isDisabled ?? false

  if (isDisabled) {
    // 기본 동작 취소 (라우팅 방지)
    event.preventDefault()

    // "준비 중" 토스트 표시
    toast.add({
      severity: 'warn',
      summary: '알림',
      detail: '준비 중입니다',
      life: 3000
    })
  }
  // enabled 메뉴는 기본 동작으로 라우팅
}

// ============================================================
// Pass Through API 설정
// ============================================================
/**
 * PrimeVue Menubar Pass Through API 설정
 *
 * @purpose CSS 클래스 중앙화 원칙 준수
 */
const menubarPassThrough = computed<MenubarPassThroughOptions>(() => ({
  root: {
    class: 'app-menubar'
  },
  menu: {
    class: 'app-menubar-menu'
  },
  start: {
    class: 'app-menubar-start'
  },
  end: {
    class: 'app-menubar-end'
  }
}))
</script>

<template>
  <header
    data-testid="app-header"
    class="h-full w-full bg-bg-header"
    role="banner"
  >
    <Menubar :model="menuModel" :pt="menubarPassThrough">
      <!-- start 슬롯: 로고 -->
      <template #start>
        <NuxtLink
          to="/wbs"
          data-testid="app-logo"
          class="menubar-logo"
          aria-label="홈으로 이동"
        >
          orchay
        </NuxtLink>
      </template>

      <!-- item 템플릿: 메뉴 아이템 커스텀 렌더링 -->
      <template #item="{ item, props: itemProps }">
        <a
          v-bind="itemProps.action"
          :data-testid="`nav-menu-${item.key}`"
          :class="getMenuItemClass(item)"
          :aria-current="isActiveRoute(item) ? 'page' : undefined"
          :aria-disabled="item.data?.isDisabled ? 'true' : undefined"
          :aria-label="item.data?.isDisabled ? `${item.label} (준비 중)` : item.label"
          @click="handleItemClick($event, item)"
        >
          <span>{{ item.label }}</span>
        </a>
      </template>

      <!-- end 슬롯: 홈 디렉토리 변경 버튼 + 프로젝트명 -->
      <template #end>
        <div class="flex items-center gap-2">
          <Button
            v-tooltip.bottom="'홈 디렉토리 변경'"
            icon="pi pi-folder"
            severity="secondary"
            text
            rounded
            aria-label="홈 디렉토리 변경"
            data-testid="change-home-dir-btn"
            @click="configStore.openChangeDialog"
          />
          <span
            data-testid="project-name"
            :class="projectNameClass"
          >
            {{ displayProjectName }}
          </span>
        </div>
      </template>
    </Menubar>
  </header>
</template>
