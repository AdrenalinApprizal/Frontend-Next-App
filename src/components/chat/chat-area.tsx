"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { FaUser, FaPaperPlane } from "react-icons/fa";
import { useMessages, type Message } from "@/hooks/messages/useMessages";
import { useFriendship } from "@/hooks/auth/useFriends";
import { usePresence } from "@/hooks/presence/usePresence";
import { toast } from "react-hot-toast";
import { useWebSocketContext } from "@/hooks/websocket/WebSocketProvider";
import { eventBus } from "@/hooks/websocket/useWebSocket";

// Extended Message interface with UI status properties
interface ChatMessage extends Message {
  pending?: boolean;
  error?: boolean;
  retrying?: boolean;
  retryCount?: number;
  errorMessage?: string;
}

// Define props interface for the component
interface ChatAreaProps {
  recipientId?: string;
  recipientName?: string;
  isGroup?: boolean;
}

// Export both as default and named export for flexibility
export function ChatArea({
  recipientId,
  recipientName,
  isGroup = false,
}: ChatAreaProps) {
  // Use either provided recipientId or extract from URL params
  const params = useParams();
  const friendId =
    recipientId || (params?.friendId as string) || (params?.id as string);
  const { data: session } = useSession();
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages: apiMessages,
    loading: loadingMessages,
    error,
    sendMessage,
    getMessages,
  } = useMessages();

  // Local messages state for optimistic UI updates and rendering
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  // Use localMessages as our source of truth but initialize from apiMessages
  useEffect(() => {
    if (apiMessages && apiMessages.length > 0) {
      setLocalMessages(apiMessages as ChatMessage[]);
    }
  }, [apiMessages]);

  const { getFriendById, recipientData, setRecipientData } = useFriendship();
  const presence = usePresence();

  // Track pending messages for optimistic UI updates
  const [pendingMessages, setPendingMessages] = useState<{
    [key: string]: boolean;
  }>({});

  // Import WebSocket context
  const {
    connect,
    sendPrivateMessage,
    isConnected,
    subscribeToPrivateMessages,
    unsubscribeFromPrivateMessages,
  } = useWebSocketContext();

  useEffect(() => {
    if (friendId) {
      // Reset messages when switching to a new friend
      setLocalMessages([]);

      // Log the initialization
      console.log(
        `[ChatArea] Initializing chat with recipient ID: ${friendId}`
      );

      // 1. Load friend details
      getFriendById(friendId as string)
        .then((response) => {
          console.log("[ChatArea] Friend details loaded:", response);
          if (response) {
            setRecipientData({
              ...response,
              display_name:
                response.full_name || response.display_name || response.name,
            });
          }
        })
        .catch((err) => {
          console.error("[ChatArea] Error loading friend details:", err);
          toast.error("Could not load contact information");
        });

      // 2. Load initial messages - single API call, no polling
      const loadInitialMessages = async () => {
        try {
          console.log(
            `[Chat] Loading initial messages for conversation with ${friendId}`
          );

          // Add error handling for invalid friendId
          if (!friendId || typeof friendId !== "string") {
            throw new Error(`Invalid friendId: ${friendId}`);
          }

          // Set a timeout to prevent hanging requests
          const fetchPromise = getMessages(friendId);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Request timed out")), 10000);
          });

          const messageResponse: any = await Promise.race([
            fetchPromise,
            timeoutPromise,
          ]);

          console.log("[Chat] GET /messages response received");

          // Process the response
          const hasValidData =
            messageResponse?.data &&
            Array.isArray(messageResponse.data) &&
            messageResponse.data.length > 0;
          const hasValidMessages =
            messageResponse?.messages &&
            Array.isArray(messageResponse?.messages) &&
            messageResponse?.messages?.length > 0;

          if (hasValidData || hasValidMessages) {
            const messagesToStore = hasValidData
              ? messageResponse.data
              : hasValidMessages
              ? messageResponse.messages
              : [];

            console.log(
              `[Chat] Loaded ${messagesToStore.length} messages via GET /messages`
            );
            setLocalMessages(messagesToStore as ChatMessage[]);
          } else {
            console.log("[Chat] No messages found, showing empty chat");
            setLocalMessages([]);
          }
        } catch (err: any) {
          const errorMessage = err?.message || "Unknown error";
          console.error(`[Chat] Error loading messages: ${errorMessage}`, err);
          setLocalMessages([]);
          toast.error(
            `Could not load messages: ${errorMessage.substring(0, 50)}${
              errorMessage.length > 50 ? "..." : ""
            }`,
            { duration: 4000, id: "message-load-error" }
          );
        }
      };

      // 3. Ensure WebSocket is connected - with retry and waiting logic
      const ensureWebSocketConnected = async () => {
        if (isConnected) {
          console.log(
            "[Chat] WebSocket already connected, proceeding with chat initialization"
          );
          return true;
        }

        console.log(
          "[Chat] WebSocket not connected, connecting now to GET /messages/ws"
        );

        // Start connection attempt
        connect();

        // Wait for connection with timeout and retries
        let retries = 0;
        const maxRetries = 3;
        const retryDelay = 2000; // 2 seconds between retries

        while (retries < maxRetries) {
          console.log(
            `[Chat] Waiting for WebSocket connection... (attempt ${
              retries + 1
            }/${maxRetries})`
          );

          // Check if connected immediately after connect() call
          if (isConnected) {
            console.log("[Chat] WebSocket successfully connected");
            return true;
          }

          // Wait for connection to establish
          await new Promise((resolve) => setTimeout(resolve, retryDelay));

          // Check again after waiting
          if (isConnected) {
            console.log("[Chat] WebSocket connected after waiting");
            return true;
          }

          retries++;
        }

        // If we reached here, connection failed after all retries
        console.error(
          "[Chat] Failed to establish WebSocket connection after multiple attempts"
        );
        toast.error(
          "Could not establish real-time connection. Some features may be limited.",
          {
            duration: 5000,
            id: "websocket-connection-error",
          }
        );

        return false;
      };

      // Wait for WebSocket connection before continuing
      ensureWebSocketConnected().then(() => {
        // 4. Subscribe to messages from this friend only after connection is established or attempts exhausted
        if (isConnected) {
          console.log(
            `[Chat] Subscribing to private messages with ${friendId}`
          );
          subscribeToPrivateMessages(friendId);
        } else {
          console.warn(
            `[Chat] Cannot subscribe to messages with ${friendId} - WebSocket not connected`
          );
        }
      });

      // 5. Set up event listener for new messages via WebSocket
      const handleNewWebSocketMessage = (message: any) => {
        // Check if this message is relevant to current conversation
        if (
          message &&
          ((message.sender_id === friendId &&
            message.recipient_id === session?.user?.id) ||
            (message.recipient_id === friendId &&
              message.sender_id === session?.user?.id))
        ) {
          console.log("[Chat] Received new WebSocket message", message);

          // Add message to state if it's not already there
          setLocalMessages((prevMessages: ChatMessage[]) => {
            // Check if we already have this message
            if (prevMessages.some((msg) => msg.id === message.id)) {
              return prevMessages;
            }

            // Add the new message
            return [...prevMessages, message as ChatMessage];
          });
        }
      };

      // Register event listener for WebSocket messages
      eventBus.on("new_message", handleNewWebSocketMessage);

      // Initialize chat with proper sequence:
      // 1. Ensure WebSocket connection first (will happen in parallel)
      const connectionPromise = ensureWebSocketConnected();

      // 2. Load initial messages (don't wait for WebSocket to complete)
      loadInitialMessages();

      // 3. After WebSocket connection is established, subscribe to private messages
      connectionPromise.then(() => {
        if (isConnected) {
          console.log(
            `[Chat] WebSocket connected, subscribing to private messages with ${friendId}`
          );
          subscribeToPrivateMessages(friendId);
        }
      });

      // Clean up function
      return () => {
        // Only unsubscribe if we were connected
        if (isConnected) {
          console.log(
            `[Chat] Unsubscribing from private messages with ${friendId}`
          );
          unsubscribeFromPrivateMessages(friendId);
        } else {
          console.log(
            "[Chat] No need to unsubscribe - WebSocket was not connected"
          );
        }

        // Always remove event listeners regardless of connection state
        console.log("[Chat] Removing WebSocket event listeners");
        eventBus.off("new_message", handleNewWebSocketMessage);
      };
    }
  }, [
    friendId,
    getMessages,
    getFriendById,
    isConnected,
    connect,
    subscribeToPrivateMessages,
    unsubscribeFromPrivateMessages,
    session?.user?.id,
  ]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  // To prevent multiple send attempts when clicking rapidly
  const isSendingRef = useRef<boolean>(false);

  // Improved send message function using WebSocket for real-time communication
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !friendId) return;

    // Prevent rapid clicking causing multiple sends
    if (isSendingRef.current) {
      console.log("[Chat] Send in progress, ignoring duplicate request");
      return;
    }

    // Set sending flag to true
    isSendingRef.current = true;

    const messageContent = message.trim();
    // Clear message input early for better UX
    setMessage("");

    // Create a temporary message for optimistic UI update
    const tempId = `temp-${Date.now()}`;

    // Update pending status
    setPendingMessages((prev) => ({ ...prev, [tempId]: true }));

    const tempMessage = {
      id: tempId,
      sender_id: session?.user?.id || "",
      recipient_id: friendId,
      content: messageContent,
      type: "text",
      read: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sender: {
        id: session?.user?.id || "",
        name: session?.user?.name || "You",
        profile_picture_url: session?.user?.image,
      },
      // Visual indicators for the message state
      pending: true,
      error: false,
    };

    // Add to local messages immediately for better UX
    setLocalMessages((prevMessages: ChatMessage[]) => [
      ...prevMessages,
      tempMessage,
    ]);

    // Scroll to bottom immediately after adding message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);

    // Define a sendWithRetry function for better error handling
    const sendWithRetry = async (
      retryCount = 0,
      maxRetries = 3
    ): Promise<any> => {
      try {
        // Log attempt number if retrying
        if (retryCount > 0) {
          console.log(
            `[Chat] Retry attempt ${retryCount} for message to ${friendId}`
          );

          // Update UI to show retrying status
          setLocalMessages((prevMessages: Message[]) =>
            prevMessages.map((msg: Message) =>
              msg.id === tempId
                ? { ...msg, pending: true, retrying: true, error: false }
                : msg
            )
          );
        } else {
          console.log(
            `[Chat] Sending message to ${friendId}: ${messageContent.substring(
              0,
              20
            )}...`
          );
        }

        // Prefer WebSocket for sending messages if connected, fall back to HTTP if not
        let response;

        if (isConnected) {
          // Using WebSocket to send the message
          console.log(
            `[Chat] Using WebSocket to send message to recipient: ${friendId}`
          );

          const sendPromise = sendPrivateMessage(friendId, messageContent);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("WebSocket send timed out")),
              8000
            );
          });

          try {
            // Race between the WebSocket send operation and timeout
            response = await Promise.race([sendPromise, timeoutPromise]);
            console.log(
              "[Chat] Message sent via WebSocket successfully",
              response
            );
          } catch (wsError) {
            console.error(
              "[Chat] WebSocket send failed, falling back to HTTP API:",
              wsError
            );
            // Fall back to HTTP API if WebSocket fails
            const sendPromise = sendMessage(friendId as string, messageContent);
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error("HTTP API timed out")), 10000);
            });

            response = await Promise.race([sendPromise, timeoutPromise]);
            console.log(
              "[Chat] Message sent via HTTP API as fallback",
              response
            );
          }
        } else {
          // WebSocket not connected, use HTTP API directly
          console.log(
            `[Chat] WebSocket not connected, using HTTP API to send message to: ${friendId}`
          );

          const sendPromise = sendMessage(friendId as string, messageContent);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("HTTP API timed out")), 10000);
          });

          response = await Promise.race([sendPromise, timeoutPromise]);
        }

        // Success: clear pending status and update the message
        setPendingMessages((prev) => {
          const newState = { ...prev };
          delete newState[tempId];
          return newState;
        });

        // Replace temp message with real message data
        setLocalMessages((prevMessages: ChatMessage[]) =>
          prevMessages.map((msg: ChatMessage) => {
            if (msg.id === tempId) {
              // Handle response data safely with type assertions
              const responseObj = response as any; // Use type assertion for dynamic access
              const responseData =
                responseObj?.data || responseObj?.message || responseObj || {};
              const newMessageId =
                responseObj?.data?.id ||
                responseObj?.message?.id ||
                responseObj?.id ||
                msg.id;

              return {
                ...msg,
                ...responseData,
                id: newMessageId,
                pending: false,
                retrying: false,
                error: false,
              };
            }
            return msg;
          })
        );

        return response;
      } catch (error: any) {
        console.error(
          `[Chat] Error sending message (attempt ${retryCount + 1}):`,
          error
        );

        // If we haven't reached max retries, try again with exponential backoff
        if (retryCount < maxRetries) {
          const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000); // Exponential backoff capped at 8 seconds

          console.log(
            `[Chat] Will retry in ${backoffTime}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          // Update UI to show retry pending
          setLocalMessages((prevMessages: Message[]) =>
            prevMessages.map((msg: Message) =>
              msg.id === tempId
                ? {
                    ...msg,
                    pending: true,
                    retrying: true,
                    retryCount: retryCount + 1,
                    error: false,
                  }
                : msg
            )
          );

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, backoffTime));

          // Recursive retry with incremented count
          return sendWithRetry(retryCount + 1, maxRetries);
        }

        // All retries failed
        setPendingMessages((prev) => {
          const newState = { ...prev };
          delete newState[tempId];
          return newState;
        });

        setLocalMessages((prevMessages: Message[]) =>
          prevMessages.map((msg: Message) =>
            msg.id === tempId
              ? {
                  ...msg,
                  pending: false,
                  retrying: false,
                  error: true,
                  errorMessage: error?.message || "Failed to send message",
                }
              : msg
          )
        );

        throw error; // Rethrow for outer catch block to handle
      }
    };

    // Execute the send with retry logic
    try {
      const response = await sendWithRetry();
      console.log(`[Chat] Message sent successfully:`, response);
    } catch (error) {
      console.error("[Chat] All send attempts failed:", error);
      toast.error("Failed to send message. Tap to retry.", {
        duration: 4000,
        icon: "⚠️",
      });
    } finally {
      // Reset sending flag regardless of outcome
      isSendingRef.current = false;
    }
  };

  // Format friend's name with preference for full_name or display_name
  const friendName = recipientData?.full_name
    ? recipientData.full_name
    : recipientData?.display_name ||
      recipientData?.name ||
      recipientName ||
      "Chat";

  // Safely check if user is online with error handling
  const isOnline = (() => {
    try {
      return recipientData &&
        presence &&
        typeof presence.getStatus === "function"
        ? presence.getStatus(recipientData.id) === "online"
        : false;
    } catch (err) {
      console.warn("[Chat] Error checking online status:", err);
      return false; // Default to offline if there's an error
    }
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b flex items-center">
        <div className="relative mr-3">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
            {recipientData?.avatar ? (
              <img
                src={recipientData.avatar}
                alt={friendName}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUser className="h-5 w-5 text-gray-500" />
            )}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
          )}
        </div>
        <div>
          <h2 className="font-medium text-gray-900">{friendName}</h2>
          <p className="text-xs text-gray-500">
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        {loadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-red-500">
            {error}
          </div>
        ) : localMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p>No messages yet</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {localMessages
              .filter((msg) => msg && typeof msg === "object")
              .map((msg) => {
                // Determine if the message is from the current user
                const isCurrentUser = msg.sender_id === session?.user?.id;

                // Handle message status indicators with null/undefined checks
                const isPending =
                  !!msg.pending || (msg.id && !!pendingMessages[msg.id]);
                const hasError = msg.error === true;

                // Ensure we have a valid message ID before rendering
                if (!msg.id) {
                  console.error(
                    "[ChatArea] Encountered message without ID:",
                    msg
                  );
                  return null;
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex ${
                      isCurrentUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-xs md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg px-4 py-2 ${
                        isCurrentUser
                          ? hasError
                            ? "bg-red-100 text-red-800 rounded-br-none"
                            : "bg-blue-500 text-white rounded-br-none"
                          : "bg-white text-gray-800 border rounded-bl-none"
                      } ${isPending ? "opacity-70" : ""}`}
                    >
                      <p>{msg.content}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p
                          className={`text-xs ${
                            isCurrentUser
                              ? hasError
                                ? "text-red-600"
                                : "text-blue-100"
                              : "text-gray-400"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </p>
                        {isPending && !msg.retrying && (
                          <span className="ml-1 text-xs">Sending...</span>
                        )}
                        {isPending && msg.retrying && (
                          <span className="ml-1 text-xs flex items-center">
                            <span className="animate-pulse mr-1">⟳</span>
                            Retrying {msg.retryCount}/{3}...
                          </span>
                        )}
                        {hasError && (
                          <span
                            className="ml-1 text-xs text-red-600 cursor-pointer hover:underline flex items-center"
                            onClick={() => {
                              // Retry sending the message
                              const retryContent = msg.content;
                              // Remove the failed message
                              setLocalMessages(
                                localMessages.filter(
                                  (m: Message) => m.id !== msg.id
                                )
                              );
                              // Clear the input field in case user typed something else
                              const prevMsg = message;
                              setMessage(retryContent);
                              // Submit the form programmatically
                              setTimeout(() => {
                                const form = document.querySelector("form");
                                form?.dispatchEvent(
                                  new Event("submit", {
                                    cancelable: true,
                                    bubbles: true,
                                  })
                                );
                                // If user had typed something else, restore it after small delay
                                if (prevMsg && prevMsg !== retryContent) {
                                  setTimeout(() => setMessage(prevMsg), 200);
                                }
                              }, 100);
                            }}
                          >
                            <span className="mr-1">⟳</span>Tap to retry
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSendMessage} className="px-6 py-4 border-t">
        <div className="flex items-center">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            type="submit"
            disabled={!message.trim()}
            className={`ml-2 rounded-full p-2 ${
              message.trim()
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            <FaPaperPlane />
          </button>
        </div>
      </form>
    </div>
  );
}

// Also add default export for compatibility
export default ChatArea;
