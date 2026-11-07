import { inject, provide, reactive, type InjectionKey } from 'vue';

export type Toast = { id: number; tone: 'success' | 'info'; message: string };

export type ToastApi = {
  toasts: Toast[];
  push: (message: string, tone?: Toast['tone']) => void;
  dismiss: (id: number) => void;
};

/**
 * Toast state is created per app instance by <UiToaster> and shared through provide/inject, never a
 * module-level variable: module state in SSR code leaks across requests (R-WEB-04).
 */
const key: InjectionKey<ToastApi> = Symbol('ui-toasts');
let nextId = 1; // ids only need to be unique within the page; carries no user data

export function provideToasts(): ToastApi {
  const api: ToastApi = reactive({
    toasts: [] as Toast[],
    push(message: string, tone: Toast['tone'] = 'success') {
      this.toasts.push({ id: nextId++, tone, message });
    },
    dismiss(id: number) {
      this.toasts = this.toasts.filter((t: Toast) => t.id !== id);
    },
  });
  provide(key, api);
  return api;
}

/** Success and info only: errors that block use belong in a banner or inline message. */
export function useToast(): Pick<ToastApi, 'push'> {
  const api = inject(key, null);
  if (!api) throw new Error('useToast() needs a <UiToaster> ancestor');
  return { push: (message, tone) => api.push(message, tone) };
}
