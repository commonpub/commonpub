/** Composable for real-time notification count via SSE */
export function useNotifications() {
  const count = useState<number>('notification-count', () => 0);
  const connected = useState<boolean>('notification-connected', () => false);

  let eventSource: EventSource | null = null;
  let retryDelay = 5000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRY_DELAY = 60_000;

  function connect(): void {
    if (import.meta.server || eventSource) return;

    eventSource = new EventSource('/api/notifications/stream');
    connected.value = true;

    eventSource.onopen = () => {
      retryDelay = 5000; // Reset backoff on successful connection
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; count?: number };
        if (data.type === 'count' && typeof data.count === 'number') {
          count.value = data.count;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    eventSource.onerror = () => {
      connected.value = false;
      // EventSource readyState 2 = CLOSED (server rejected, e.g. 401)
      const wasClosed = eventSource?.readyState === 2;
      eventSource?.close();
      eventSource = null;
      // If the connection was fully closed (auth error, 401, etc.), don't retry
      if (wasClosed) return;
      // Exponential backoff: 5s → 10s → 20s → 40s → 60s cap
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
    };
  }

  function disconnect(): void {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    eventSource?.close();
    eventSource = null;
    connected.value = false;
    retryDelay = 5000;
  }

  function decrement(): void {
    if (count.value > 0) count.value--;
  }

  function reset(): void {
    count.value = 0;
  }

  return {
    count: readonly(count),
    connected: readonly(connected),
    connect,
    disconnect,
    decrement,
    reset,
  };
}
