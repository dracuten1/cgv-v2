import { ref } from 'vue';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: ToastAction;
  duration?: number;
}

const toasts = ref<ToastItem[]>([]);

export function useToast() {
  const show = (
    message: string,
    type: ToastType = 'info',
    action?: ToastAction,
    duration = 4000
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastItem = { id, type, message, action, duration };
    toasts.value.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  };

  const success = (message: string, duration = 4000) => show(message, 'success', undefined, duration);
  const error = (message: string, duration = 5000) => show(message, 'error', undefined, duration);
  const info = (message: string, duration = 4000) => show(message, 'info', undefined, duration);
  const warning = (message: string, duration = 4500) => show(message, 'warning', undefined, duration);

  const dismiss = (id: string) => {
    const index = toasts.value.findIndex((t) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  return {
    toasts,
    show,
    success,
    error,
    info,
    warning,
    dismiss,
  };
}
