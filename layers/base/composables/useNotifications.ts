/** Composable for real-time notification count. Delegates to unified SSE stream. */
export function useNotifications() {
  const { notificationCount, connected, connect, disconnect, decrementNotifications, resetNotifications } = useRealtimeCounts();

  return {
    count: notificationCount,
    connected,
    connect,
    disconnect,
    decrement: decrementNotifications,
    reset: resetNotifications,
  };
}
