import { useEffect, useRef, useCallback } from "react";
import { eventBus } from "./useWebSocket";

/**
 * useWebSocketListener Hook - React adaptation of Vue WebSocket listener patterns
 *
 * This hook provides automatic event listening with cleanup for WebSocket events.
 * It's inspired by Vue's automatic cleanup patterns and provides a cleaner way
 * to listen to WebSocket events in React components.
 *
 * Features:
 * - Automatic cleanup on component unmount
 * - Support for multiple event listeners
 * - Type-safe event handling
 * - Debounced event handling for high-frequency events
 * - Event listener pausing/resuming
 * - Conditional event listening
 */

// Event listener configuration
interface EventListenerConfig {
  event: string;
  handler: (...args: any[]) => void;
  debounceMs?: number; // Debounce time in milliseconds
  condition?: () => boolean; // Conditional listener - only trigger if condition is true
  once?: boolean; // Listen only once
}

// Hook options
interface UseWebSocketListenerOptions {
  autoStart?: boolean; // Automatically start listening when hook mounts
  pauseWhenHidden?: boolean; // Pause listening when page/tab is hidden
}

/**
 * Enhanced WebSocket listener hook with Vue-inspired patterns
 * This must be called within a React component or custom hook
 */
export function useWebSocketListener(
  listeners: EventListenerConfig[],
  options: UseWebSocketListenerOptions = {}
): {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  isListening: () => boolean;
} {
  const { autoStart = true, pauseWhenHidden = false } = options;

  // Refs for managing state - these MUST be inside the function component
  const listenersRef = useRef<EventListenerConfig[]>(listeners);
  const isListeningRef = useRef(false);
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const isVisibleRef = useRef(true);

  // Update listeners ref when listeners change
  useEffect(() => {
    listenersRef.current = listeners;
  }, [listeners]);

  // Handle page visibility changes
  useEffect(() => {
    if (!pauseWhenHidden) return;

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        pause();
      } else {
        resume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseWhenHidden]);

  // Create a debounced handler
  const createDebouncedHandler = useCallback(
    (event: string, handler: (...args: any[]) => void, debounceMs: number) => {
      return (...args: any[]) => {
        // Clear existing timer
        const existingTimer = debounceTimersRef.current.get(event);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Set new timer
        const timer = setTimeout(() => {
          handler(...args);
          debounceTimersRef.current.delete(event);
        }, debounceMs);

        debounceTimersRef.current.set(event, timer);
      };
    },
    []
  );

  // Create a conditional handler
  const createConditionalHandler = useCallback(
    (handler: (...args: any[]) => void, condition: () => boolean) => {
      return (...args: any[]) => {
        if (condition()) {
          handler(...args);
        }
      };
    },
    []
  );

  // Start listening to events
  const start = useCallback(() => {
    if (isListeningRef.current) return;

    listenersRef.current.map((l) => l.event);

    listenersRef.current.forEach((config) => {
      let handler = config.handler;

      // Apply conditional wrapper if specified
      if (config.condition) {
        handler = createConditionalHandler(handler, config.condition);
      }

      // Apply debouncing if specified
      if (config.debounceMs && config.debounceMs > 0) {
        handler = createDebouncedHandler(
          config.event,
          handler,
          config.debounceMs
        );
      }

      // Register the event listener
      if (config.once) {
        // For one-time listeners, wrap with automatic cleanup
        const onceHandler = (...args: any[]) => {
          handler(...args);
          eventBus.off(config.event, onceHandler);
        };
        eventBus.on(config.event, onceHandler);
      } else {
        eventBus.on(config.event, handler);
      }
    });

    isListeningRef.current = true;
  }, [createDebouncedHandler, createConditionalHandler]);

  // Stop listening to events
  const stop = useCallback(() => {
    if (!isListeningRef.current) return;


    // Clear all debounce timers
    debounceTimersRef.current.forEach((timer) => {
      clearTimeout(timer);
    });
    debounceTimersRef.current.clear();

    // Remove all event listeners
    listenersRef.current.forEach((config) => {
      eventBus.off(config.event, config.handler);
    });

    isListeningRef.current = false;
  }, []);

  // Pause listening (without removing listeners)
  const pause = useCallback(() => {
    if (!isListeningRef.current) return;

    stop();
  }, [stop]);

  // Resume listening
  const resume = useCallback(() => {
    if (isListeningRef.current || !isVisibleRef.current) return;

    start();
  }, [start]);

  // Restart listeners (stop and start again)
  const restart = useCallback(() => {
    stop();
    setTimeout(() => start(), 0); // Use setTimeout to ensure cleanup completes
  }, [stop, start]);

  // Check if currently listening
  const isListening = useCallback(() => {
    return isListeningRef.current;
  }, []);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart) {
      start();
    }

    // Always stop on unmount
    return () => {
      stop();
    };
  }, [autoStart, start, stop]);

  // Return control functions
  return {
    start,
    stop,
    pause,
    resume,
    restart,
    isListening,
  };
}

/**
 * Simplified hook for single event listening
 */
export function useWebSocketEvent(
  event: string,
  handler: (...args: any[]) => void,
  options?: {
    debounceMs?: number;
    condition?: () => boolean;
    once?: boolean;
    autoStart?: boolean;
  }
) {
  const listenerConfig: EventListenerConfig = {
    event,
    handler,
    debounceMs: options?.debounceMs,
    condition: options?.condition,
    once: options?.once,
  };

  return useWebSocketListener([listenerConfig], {
    autoStart: options?.autoStart,
  });
}

/**
 * Hook for listening to typing events with built-in debouncing
 */
export function useTypingListener(
  onTyping: (data: {
    userId: string;
    recipientId: string;
    isTyping: boolean;
  }) => void,
  options?: {
    debounceMs?: number;
    condition?: () => boolean;
  }
) {
  return useWebSocketEvent("typing-status-changed", onTyping, {
    debounceMs: options?.debounceMs || 100, // Default 100ms debounce for typing
    condition: options?.condition,
  });
}

/**
 * Hook for listening to new messages
 */
export function useNewMessageListener(
  onNewMessage: (message: any) => void,
  options?: {
    condition?: () => boolean;
    once?: boolean;
  }
) {
  return useWebSocketEvent("new_message", onNewMessage, {
    condition: options?.condition,
    once: options?.once,
  });
}

/**
 * Hook for listening to presence updates
 */
export function usePresenceListener(
  onPresenceUpdate: (data: {
    userId: string;
    status: string;
    lastSeen?: string;
  }) => void,
  options?: {
    debounceMs?: number;
    condition?: () => boolean;
  }
) {
  return useWebSocketEvent("user-status-changed", onPresenceUpdate, {
    debounceMs: options?.debounceMs || 500, // Default 500ms debounce for presence
    condition: options?.condition,
  });
}

/**
 * Hook for listening to message read status changes
 */
export function useMessageReadListener(
  onMessageRead: (messageIds: string[]) => void,
  options?: {
    condition?: () => boolean;
  }
) {
  return useWebSocketEvent("messages-read", onMessageRead, {
    condition: options?.condition,
  });
}

/**
 * Hook for listening to unread count updates
 */
export function useUnreadCountListener(
  onUnreadCountUpdate: (counts: any) => void,
  options?: {
    condition?: () => boolean;
  }
) {
  return useWebSocketEvent("unread-counts-updated", onUnreadCountUpdate, {
    condition: options?.condition,
  });
}
