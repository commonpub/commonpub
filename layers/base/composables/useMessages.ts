/** Composable for real-time unread message count. Delegates to unified SSE stream. */
export function useMessages() {
  const { messageCount, connected, connect, disconnect } = useRealtimeCounts();

  return {
    count: messageCount,
    connected,
    connect,
    disconnect,
  };
}
