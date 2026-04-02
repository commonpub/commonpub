/**
 * Unified composable for real-time notification and message counts via a single SSE stream.
 * Replaces the separate useNotifications() and useMessages() EventSource connections.
 */
export function useRealtimeCounts() {
  const notificationCount = useState<number>('notification-count', () => 0);
  const messageCount = useState<number>('message-count', () => 0);
  const connected = useState<boolean>('realtime-connected', () => false);

  let eventSource: EventSource | null = null;
  let retryDelay = 5000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  const MAX_RETRY_DELAY = 60_000;

  function connect(): void {
    if (import.meta.server || eventSource) return;

    eventSource = new EventSource('/api/realtime/stream');
    connected.value = true;

    eventSource.onopen = () => {
      retryDelay = 5000;
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type: string; notifications?: number; messages?: number };
        if (data.type === 'counts') {
          if (typeof data.notifications === 'number') notificationCount.value = data.notifications;
          if (typeof data.messages === 'number') messageCount.value = data.messages;
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

  function decrementNotifications(): void {
    if (notificationCount.value > 0) notificationCount.value--;
  }

  function resetNotifications(): void {
    notificationCount.value = 0;
  }

  return {
    notificationCount: readonly(notificationCount),
    messageCount: readonly(messageCount),
    connected: readonly(connected),
    connect,
    disconnect,
    decrementNotifications,
    resetNotifications,
  };
}
