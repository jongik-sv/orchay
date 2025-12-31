<template>
  <div class="dark">
    <!-- PrimeVue Toast 컴포넌트 (전역) -->
    <Toast position="top-center" />

    <!-- 홈 디렉토리 설정 다이얼로그 -->
    <SetupDialog />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
