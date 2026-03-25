// Simple toast notification composable

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => []);

  function show(message: string, type: Toast['type'] = 'info', duration = 3000): void {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }

  function success(message: string): void {
    show(message, 'success');
  }

  function error(message: string): void {
    show(message, 'error', 5000);
  }

  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts: readonly(toasts), show, success, error, dismiss };
}
