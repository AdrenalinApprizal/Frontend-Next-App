import { useCallback } from "react";
import { useWebSocketEvent } from "./useWebSocketListener";
import { eventBus } from "./useWebSocket";

/**
 * Hook for listening to user blocking events in groups
 * Implements WebSocket event handling for block/unblock operations
 */

interface BlockingEventData {
  group_id: string;
  user_id: string;
  blocked_user_id: string;
  action: "blocked" | "unblocked";
  timestamp: string;
}

interface UseBlockingListenerOptions {
  groupId?: string;
  onUserBlocked?: (data: BlockingEventData) => void;
  onUserUnblocked?: (data: BlockingEventData) => void;
  condition?: () => boolean;
}

/**
 * Hook for listening to group blocking events
 */
export function useBlockingListener({
  groupId,
  onUserBlocked,
  onUserUnblocked,
  condition,
}: UseBlockingListenerOptions) {
  // Handle user blocked event
  const handleUserBlocked = useCallback(
    (data: BlockingEventData) => {
      console.log("[BlockingListener] User blocked event:", data);

      // Only process if it's for the current group
      if (groupId && data.group_id !== groupId) {
        return;
      }

      onUserBlocked?.(data);

      // Emit event for cache refresh
      eventBus.emit("user-blocked-in-group", data);
    },
    [groupId, onUserBlocked]
  );

  // Handle user unblocked event
  const handleUserUnblocked = useCallback(
    (data: BlockingEventData) => {
      console.log("[BlockingListener] User unblocked event:", data);

      // Only process if it's for the current group
      if (groupId && data.group_id !== groupId) {
        return;
      }

      onUserUnblocked?.(data);

      // Emit event for cache refresh
      eventBus.emit("user-unblocked-in-group", data);
    },
    [groupId, onUserUnblocked]
  );

  // Set up WebSocket listeners
  const { start: startBlockedListener, stop: stopBlockedListener } =
    useWebSocketEvent("user_blocked_in_group", handleUserBlocked, {
      condition,
      autoStart: true,
    });

  const { start: startUnblockedListener, stop: stopUnblockedListener } =
    useWebSocketEvent("user_unblocked_in_group", handleUserUnblocked, {
      condition,
      autoStart: true,
    });

  // Return control functions
  return {
    startListening: () => {
      startBlockedListener();
      startUnblockedListener();
    },
    stopListening: () => {
      stopBlockedListener();
      stopUnblockedListener();
    },
  };
}

/**
 * Simplified hook for single blocking event
 */
export function useUserBlockedListener(
  onUserBlocked: (data: BlockingEventData) => void,
  options?: {
    groupId?: string;
    condition?: () => boolean;
  }
) {
  return useBlockingListener({
    groupId: options?.groupId,
    onUserBlocked,
    condition: options?.condition,
  });
}

/**
 * Simplified hook for single unblocking event
 */
export function useUserUnblockedListener(
  onUserUnblocked: (data: BlockingEventData) => void,
  options?: {
    groupId?: string;
    condition?: () => boolean;
  }
) {
  return useBlockingListener({
    groupId: options?.groupId,
    onUserUnblocked,
    condition: options?.condition,
  });
}
