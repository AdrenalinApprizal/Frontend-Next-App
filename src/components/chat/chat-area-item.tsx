import React, { useRef, useEffect, useMemo, useState } from "react";
import {
  FaUser,
  FaClock,
  FaCheck,
  FaExclamationTriangle,
  FaFile,
  FaEllipsisV,
  FaPencilAlt,
  FaTrash,
  FaDownload,
} from "react-icons/fa";
import { formatMessageTimestamp } from "@/utils/timestampHelper";
import { OptimizedAvatar } from "../optimized-avatar";
import { useFiles } from "@/hooks/files/useFiles";
import { toast } from "react-hot-toast";

// Helper function to validate avatar URLs including data URLs
const validateAvatarUrl = (avatarUrl: string): string | null => {
  if (!avatarUrl) return null;

  // Validate data URL (base64)
  if (avatarUrl.startsWith("data:")) {
    const maxSize = 2 * 1024 * 1024; // 2MB limit
    if (avatarUrl.length > maxSize) {
      return null;
    }

    // Validate data URL format
    const dataUrlRegex =
      /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,/;
    if (!dataUrlRegex.test(avatarUrl)) {
      return null;
    }
  }

  return avatarUrl;
};

// ImageWithRetry component to handle expired URLs
interface ImageWithRetryProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  messageId: string;
}

const ImageWithRetry: React.FC<ImageWithRetryProps> = ({
  src,
  alt,
  className,
  onClick,
  messageId,
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 2;

  const refreshImageUrl = async () => {
    if (retryCount >= maxRetries) {
      setHasError(true);
      return;
    }

    setIsLoading(true);
    setRetryCount((prev) => prev + 1);

    try {
      // Try to refresh the URL by making a request to get updated attachment info
      const response = await fetch(`/api/proxy/messages/${messageId}`);
      if (response.ok) {
        const messageData = await response.json();
        if (messageData.attachment && messageData.attachment.url) {
          setImageSrc(messageData.attachment.url);
          setHasError(false);
        } else {
          setHasError(true);
        }
      } else {
        setHasError(true);
      }
    } catch (error) {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleError = () => {
    // Check if URL might be expired (contains AWS signature parameters)
    const isExpiredUrl =
      imageSrc.includes("X-Amz-Expires") || imageSrc.includes("X-Amz-Date");

    if (isExpiredUrl && retryCount < maxRetries) {
      refreshImageUrl();
    } else {
      setHasError(true);
    }
  };

  const handleRetry = () => {
    setRetryCount(0);
    setHasError(false);
    refreshImageUrl();
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-100 rounded border border-gray-300">
        <FaExclamationTriangle className="text-yellow-500 mb-2" size={24} />
        <p className="text-sm text-gray-600 mb-2">Gambar gagal dimuat</p>
        <p className="text-xs text-gray-500 mb-3">
          URL mungkin sudah kadaluarsa
        </p>
        <button
          onClick={handleRetry}
          className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "Memuat..." : "Coba Lagi"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={className}
        onClick={onClick}
        onError={handleError}
        style={{ display: isLoading ? "none" : "block" }}
      />
    </div>
  );
};

// Interface untuk ChatAreaItem props
interface ChatAreaItemProps {
  message: {
    id: string;
    message_id?: string;
    sender_id?: string;
    recipient_id?: string;
    receiver_id?: string;
    chat_room_id?: string;
    conversation_id?: string;
    room_id?: string;
    content: string;
    timestamp?: string;
    raw_timestamp?: string;
    sent_at?: string;
    created_at: string;
    updated_at?: string;
    type?: string;
    isCurrentUser: boolean;
    read?: boolean;
    is_read?: boolean;
    isEdited?: boolean;
    isDeleted?: boolean;
    is_deleted?: boolean;
    pending?: boolean;
    failed?: boolean;
    retrying?: boolean;
    delivered?: boolean;
    attachment?: {
      type: "image" | "file";
      url: string;
      name: string;
      size?: string;
    };
    sender?: {
      id: string;
      name: string;
      avatar_url?: string | null;
    };
    errorMessage?: string;
    retryCount?: number;
    fromWebSocket?: boolean;
    receivedViaWebSocket?: boolean;
    sourceApi?: boolean;
    recipient?: any;
    sent?: boolean;
    message_type?: string;
  };
  recipient: {
    id: string;
    name: string;
    avatar?: string;
    profile_picture_url?: string;
  };
  onRetryClick?: (message: any) => void;
  onEditClick?: (messageId: string) => void;
  onDeleteClick?: (messageId: string) => void;
  // Note: Edit functionality is handled via text bar, but buttons are in bubble for UX
}

const ChatAreaItem: React.FC<ChatAreaItemProps> = ({
  message,
  recipient,
  onRetryClick,
  onEditClick,
  onDeleteClick,
}) => {
  // Local state for dropdown
  const [showActions, setShowActions] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Files hook for download functionality
  const { downloadFile } = useFiles();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowActions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handlers - only for triggering actions, editing is done via text bar
  const handleEditClick = () => {
    setShowActions(false);
    if (onEditClick) {
      onEditClick(message.id);
    }
  };

  const handleDeleteClick = () => {
    setShowActions(false);
    if (onDeleteClick) {
      onDeleteClick(message.id);
    }
  };

  const handleRetryClick = () => {
    if (onRetryClick) {
      onRetryClick(message);
    }
  };

  // Handle file download
  const handleDownloadFile = async (
    e: React.MouseEvent,
    fileUrl: string,
    fileName: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Extract file ID from URL
    let fileId = "";
    if (fileUrl.includes("/api/proxy/files/")) {
      const urlParts = fileUrl.split("/");
      fileId = urlParts[urlParts.length - 1];
    } else {
      toast.error("Invalid file URL");
      return;
    }

    try {
      setIsDownloading(true);
      await downloadFile(fileId);
      toast.success(`Downloading ${fileName}...`);
    } catch (error) {
      // Check if URL might be expired and try to refresh
      const isExpiredUrl =
        fileUrl.includes("X-Amz-Expires") || fileUrl.includes("X-Amz-Date");

      if (isExpiredUrl) {
        try {
          // Try to get fresh URL from message data
          const response = await fetch(`/api/proxy/messages/${message.id}`);
          if (response.ok) {
            const messageData = await response.json();
            if (messageData.attachment && messageData.attachment.url) {
              // Extract new file ID and retry download
              const newFileUrl = messageData.attachment.url;
              if (newFileUrl.includes("/api/proxy/files/")) {
                const newUrlParts = newFileUrl.split("/");
                const newFileId = newUrlParts[newUrlParts.length - 1];
                await downloadFile(newFileId);
                toast.success(`Downloading ${fileName}...`);
                return;
              }
            }
          }
        } catch (refreshError) {}
      }

      toast.error("Failed to download file. URL mungkin sudah kadaluarsa.");
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  // === BUBBLE CHAT AVATAR PRIORITY SYSTEM ===
  // Get sender info with fallback strategy
  const senderName = message.isCurrentUser
    ? "You"
    : message.sender?.name || recipient.name || "Unknown";

  // Avatar Priority System for Bubble Chat:
  // 1. message.sender.avatar_url (from enhanced message data)
  // 2. message.sender.profile_picture_url (alternative field)
  // 3. recipient.profile_picture_url (if message is from chat partner)
  // 4. recipient.avatar (final fallback)
  // 5. null (will show FaUser icon)
  const senderAvatar = useMemo(() => {
    if (message.isCurrentUser) {
      return null; // Current user messages don't show avatar
    }

    // Priority 1: message.sender.avatar_url (from cache enhancement)
    if (message.sender?.avatar_url) {
      return message.sender.avatar_url;
    }

    // Priority 2: message.sender.profile_picture_url (alternative field)
    const senderExtended = message.sender as any;
    if (senderExtended?.profile_picture_url) {
      return senderExtended.profile_picture_url;
    }

    // Priority 3: recipient.profile_picture_url (for chat partner messages)
    if (recipient.profile_picture_url) {
      return recipient.profile_picture_url;
    }

    // Priority 4: recipient.avatar (final fallback)
    if (recipient.avatar) {
      return recipient.avatar;
    }

    return null; // No avatar available
  }, [
    message.isCurrentUser,
    message.sender?.avatar_url,
    message.sender,
    recipient.profile_picture_url,
    recipient.avatar,
    message.id,
    message.sender_id,
  ]);

  // Validate avatar URL with data URL validation
  const validatedAvatar = useMemo(() => {
    const validated = senderAvatar ? validateAvatarUrl(senderAvatar) : null;

    return validated;
  }, [senderAvatar, message.id]);

  return (
    <div
      className={`flex ${
        message.isCurrentUser ? "justify-end" : "justify-start"
      } mb-3 sm:mb-4`}
      data-message-id={message.id}
    >
      {/* Avatar for other users */}
      {!message.isCurrentUser && (
        <div className="mr-2">
          <OptimizedAvatar
            src={validatedAvatar}
            alt={senderName}
            size="md"
            className="flex-shrink-0"
          />
        </div>
      )}

      {/* Message bubble wrapper */}
      <div
        className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 relative group shadow-sm ${
          message.isDeleted
            ? "bg-gray-200 text-gray-500 italic"
            : message.isCurrentUser
            ? message.failed
              ? "bg-red-100 text-red-800 border border-red-300 cursor-pointer hover:bg-red-200"
              : "bg-blue-500 text-white"
            : "bg-white border border-gray-200 text-gray-800 hover:shadow-md"
        } transition-all duration-200`}
        onClick={message.failed ? handleRetryClick : undefined}
        title={
          message.failed ? "Click to retry sending this message" : undefined
        }
      >
        {/* Message actions dropdown for current user's messages */}
        {message.isCurrentUser &&
          !message.isDeleted &&
          !message.pending &&
          !message.failed &&
          !message.retrying &&
          onEditClick &&
          onDeleteClick && (
            <div className="absolute top-2 right-2" ref={dropdownRef}>
              <button
                onClick={toggleActions}
                className="text-white hover:text-blue-200 p-1.5 rounded-full focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-20 hover:bg-opacity-40 touch-manipulation"
              >
                <FaEllipsisV className="h-3 w-3" />
              </button>

              {/* Dropdown menu */}
              {showActions && (
                <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="py-1">
                    <button
                      onClick={handleEditClick}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
                    >
                      <FaPencilAlt className="mr-2 text-xs" /> Edit
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center transition-colors"
                    >
                      <FaTrash className="mr-2 text-xs" /> Unsend
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Status indicators */}
        {message.pending && (
          <div className="absolute top-0 right-0 -mt-1 -mr-1">
            <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent"></div>
          </div>
        )}

        {message.retrying && (
          <div className="absolute top-0 right-0 -mt-1 -mr-1">
            <div className="animate-pulse rounded-full h-3 w-3 bg-yellow-500"></div>
          </div>
        )}

        {/* Attachment display */}
        {message.attachment && (
          <div className="mb-1">
            {message.attachment.type === "image" ? (
              <ImageWithRetry
                src={message.attachment.url}
                alt={message.attachment.name}
                className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity max-h-48"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(message.attachment!.url, "_blank");
                }}
                messageId={message.id}
              />
            ) : (
              <button
                onClick={(e) =>
                  handleDownloadFile(
                    e,
                    message.attachment!.url,
                    message.attachment!.name
                  )
                }
                disabled={isDownloading}
                className="text-blue-500 hover:underline flex items-center space-x-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                title={`Download ${message.attachment!.name}`}
              >
                {isDownloading ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent" />
                ) : (
                  <FaFile className="text-gray-500 h-3 w-3" />
                )}
                <span className="text-xs truncate max-w-32">
                  {message.attachment!.name}
                </span>
                {!isDownloading && (
                  <FaDownload className="h-2.5 w-2.5 text-gray-400" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Message content - simplified since editing is only via text bar */}
        <div>
          <p className="text-sm break-words whitespace-pre-wrap">
            {message.isDeleted ? "This message was deleted" : message.content}
          </p>

          {/* Error message for failed messages */}
          {message.failed && message.errorMessage && (
            <p className="text-xs text-red-300 mt-1 italic">
              {message.errorMessage}
            </p>
          )}
        </div>

        {/* Timestamp and status indicators */}
        <div className="flex items-center justify-end space-x-1 mt-1">
          {message.isEdited && !message.isDeleted && (
            <span className="text-xs opacity-75">(edited)</span>
          )}

          {message.failed && (
            <span className="text-xs text-red-600 font-medium">
              Failed{" "}
              {message.retryCount && message.retryCount > 0
                ? `(${message.retryCount})`
                : ""}
            </span>
          )}

          <span className="text-xs opacity-75">
            {formatMessageTimestamp({
              timestamp: message.timestamp,
              raw_timestamp: message.raw_timestamp,
              created_at: message.created_at,
              sent_at: message.sent_at,
              format: "time",
            }) || "No Time"}
          </span>

          {/* Status icons for current user messages */}
          {message.isCurrentUser && (
            <div className="ml-1">
              {message.pending && <FaClock className="h-3 w-3 opacity-75" />}
              {message.retrying && (
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent opacity-75"></div>
              )}
              {message.failed && (
                <FaExclamationTriangle className="h-3 w-3 text-red-300" />
              )}
              {!message.pending &&
                !message.failed &&
                !message.retrying &&
                message.delivered && <FaCheck className="h-3 w-3 opacity-75" />}
              {!message.pending &&
                !message.failed &&
                !message.retrying &&
                message.read && (
                  <FaCheck className="h-3 w-3 opacity-75 text-blue-300" />
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatAreaItem;
