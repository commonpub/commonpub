/** Composable for real-time unread message count via SSE */
export function useMessages() {
  const count = useState<number>('message-count', () => 0);
  const connected = useState<boolean>('message-connected', () => false);

  let eventSource: EventSource | null = null;
  let retryDelay = 5000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRY_DELAY = 60_000;

  function connect(): void {
    if (import.meta.server || eventSource) return;

    eventSource = new EventSource('/api/messages/stream');
    connected.value = true;

    eventSource.onopen = () => {
      retryDelay = 5000;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; count?: number };
        if (data.type === 'count' && typeof data.count === 'number') {
          count.value = data.count;
        }
      } catch { /* ignore */ }
    };

    eventSource.onerror = () => {
      connected.value = false;
      const wasClosed = eventSource?.readyState === 2;
      eventSource?.close();
      eventSource = null;
      if (wasClosed) return;
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

  return {
    count: readonly(count),
    connected: readonly(connected),
    connect,
    disconnect,
  };
}
