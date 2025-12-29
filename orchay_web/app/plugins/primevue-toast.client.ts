/**
 * PrimeVue ToastService 플러그인
 * Toast 컴포넌트 사용을 위한 서비스 등록
 *
 * @see TSK-01-02-02
 */

import ToastService from 'primevue/toastservice'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ToastService)
})
