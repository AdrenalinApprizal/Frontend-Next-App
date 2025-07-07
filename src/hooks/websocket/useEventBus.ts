import mitt from "mitt";
import { useEffect, useCallback } from "react";

export type EventTypes = {
  "unread-counts-updated": any[];
  "message-received": any;
  "message-sent": any;
  "message-read": string[];
  "message-deleted": {
    messageId: string;
    conversationId: string;
    type: "private" | "group";
  };
  "message-edited": {
    messageId: string;
    conversationId: string;
    content: string;
    type: "private" | "group";
  };
  "friend-status-changed": { userId: string; status: "online" | "offline" };
  "retry-failed-message": string;
  "typing-status-changed": {
    userId: string;
    recipientId: string;
    isTyping: boolean;
  };
  "user-status-changed": {
    userId: string;
    status: "online" | "offline";
    lastSeen?: string;
    timestamp?: string;
    formattedLastSeen?: string | null;
  };
  "private-message": any;
  "group-message": any;
  "refresh-messages": void;
  "friend-added": void;
  // Enhanced WebSocket events
  "websocket-connected": "messages" | "presence";
  "websocket-disconnected": "messages" | "presence";
  "connection-quality-changed": "excellent" | "good" | "poor" | "disconnected";
  // Additional events
  "message-reaction": any;
  "temp-message-replaced": { tempId: string; realId: string; content: string };
  "new-message-received": {
    messageId: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: string;
    formattedTimestamp?: string;
  };
  // Legacy support for existing components
  new_message: any;
  user_typing: any;
  typing: any;
  stop_typing: any;
  user_status: any;
  status: any;
  read: any;
  unread_count: any;
};

export const eventBus = mitt<EventTypes>();

/**
 * Hook to interact with the global event bus
 * Provides a clean API for subscribing to and emitting events
 */
export function useEventBus() {
  // Subscribe to an event
  const on = useCallback(
    <K extends keyof EventTypes>(
      event: K,
      handler: (data: EventTypes[K]) => void
    ) => {
      eventBus.on(event, handler);

      // Return cleanup function
      return () => {
        eventBus.off(event, handler);
      };
    },
    []
  );

  // Emit an event
  const emit = useCallback(
    <K extends keyof EventTypes>(event: K, data: EventTypes[K]) => {
      eventBus.emit(event, data);
    },
    []
  );

  // Subscribe to an event with automatic cleanup on unmount
  const useEvent = useCallback(
    <K extends keyof EventTypes>(
      event: K,
      handler: (data: EventTypes[K]) => void,
      dependencies: any[] = []
    ) => {
      useEffect(() => {
        const cleanup = on(event, handler);
        return cleanup;
      }, dependencies);
    },
    [on]
  );

  // Send private message through the event bus
  const sendPrivateMessage = useCallback(
    async (
      recipientId: string,
      content: string,
      type: string = "text"
    ): Promise<boolean> => {
      try {
        // Emit message-sent event to update UI immediately
        emit("message-sent", {
          recipient_id: recipientId,
          content,
          type,
          timestamp: new Date().toISOString(),
          sender_id: "current-user", // This should be replaced with actual user ID
          temp_id: `temp-${Date.now()}`,
          pending: true,
        });

        // Send the message to the backend API via proxy
        const response = await fetch("/api/proxy/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient_id: recipientId,
            content,
            type,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          // Emit message confirmation
          emit("message-received", result.data);

          return true;
        } else {
          throw new Error("Failed to send message");
        }
      } catch (error) {

        // Emit retry event for failed messages
        emit("retry-failed-message", recipientId);

        return false;
      }
    },
    [emit]
  );

  return {
    on,
    emit,
    useEvent,
    sendPrivateMessage,
    // Direct access to event bus for advanced usage
    eventBus,
  };
}

export default eventBus;
