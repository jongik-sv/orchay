import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import { POLLING } from './constants';

/**
 * Vue 컴포넌트 마운트 헬퍼
 */
export function mountWithPinia<T = any>(
  component: any,
  options: any = {}
): VueWrapper<T> {
  const pinia = createPinia();
  setActivePinia(pinia);

  return mount(component, {
    global: {
      plugins: [
        pinia,
        [PrimeVue, {
          theme: {
            preset: Aura,
            options: {
              darkModeSelector: '.dark-mode'
            }
          }
        }]
      ],
      stubs: options.stubs || {}
    },
    ...options
  });
}

/**
 * data-testid로 요소 찾기
 */
export function findByTestId(
  wrapper: VueWrapper<any>,
  testId: string
) {
  return wrapper.find(`[data-testid="${testId}"]`);
}

/**
 * 비동기 작업 대기 (Vue nextTick + setTimeout)
 */
export async function waitFor(ms: number = 0): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 모든 pending Promise 완료 대기
 */
export async function flushPromises(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * 조건이 만족될 때까지 폴링
 */
export async function waitUntil(
  fn: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = POLLING.DEFAULT_TIMEOUT, interval = POLLING.DEFAULT_INTERVAL } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await fn()) return;
    await waitFor(interval);
  }

  throw new Error(`waitUntil timeout after ${timeout}ms`);
}
