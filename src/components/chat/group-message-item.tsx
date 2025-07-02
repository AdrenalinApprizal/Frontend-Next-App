import React, { useState, useRef, useEffect } from "react";
import {
  FaUser,
  FaClock,
  FaCheck,
  FaExclamationTriangle,
  FaFile,
  FaPencilAlt,
  FaTrash,
  FaEllipsisV,
  FaDownload,
} from "react-icons/fa";
import { formatMessageTimestamp } from "@/utils/timestampHelper";
import { toast } from "react-hot-toast";
import { useFiles } from "@/hooks/files/useFiles";

// Interface untuk MessageItem props
interface MessageItemProps {
  message: {
    id: string;
    content: string;
    sender: {
      id: string;
      name: string;
      avatar_url?: string | null;
    };
    timestamp: string;
    isCurrentUser: boolean;
    isEdited?: boolean;
    isDeleted?: boolean;
    attachment?: {
      type: "image" | "file";
      url: string;
      name: string;
      size?: string;
    };
    pending?: boolean;
    failed?: boolean;
    retrying?: boolean;
    delivered?: boolean;
    _isOptimisticMessage?: boolean;
  };
  onRetryClick?: (messageId: string) => void;
  onEditClick?: (messageId: string) => void; // Changed: no longer passes newContent
  onDeleteClick?: (messageId: string) => void;
}

// Component untuk menampilkan pesan chat
const GroupMessageItem: React.FC<MessageItemProps> = ({
  message,
  onRetryClick,
  onEditClick,
  onDeleteClick,
}) => {
  // State for showing/hiding message actions menu
  const [showActions, setShowActions] = useState(false);
  // State for download loading
  const [isDownloading, setIsDownloading] = useState(false);
  // Removed edit-related state since we no longer edit in the bubble

  // Hooks
  const { downloadFile } = useFiles();

  // Ref for dropdown to handle outside clicks
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close dropdown
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

  // CRITICAL FIX: Enhanced logic to determine if message is from current user
  const isDefinitelyCurrentUser =
    message.isCurrentUser === true ||
    message.sender.name === "You" ||
    message._isOptimisticMessage === true ||
    // Additional check for optimistic messages
    message.id?.startsWith("temp-");

  // Handler for edit button click
  const handleEditClick = () => {
    if (onEditClick) {
      onEditClick(message.id); // Just pass the message ID
    }
    setShowActions(false);
  };

  // Remove edit-related handlers since we're no longer editing in the bubble
  // const handleSaveEdit = () => { ... } - REMOVED
  // const handleCancelEdit = () => { ... } - REMOVED

  // Handler for delete button click
  const handleDeleteClick = async () => {
    // Show confirmation using react-hot-toast
    const shouldDelete = await new Promise<boolean>((resolve) => {
      toast(
        (t) => (
          <div className="flex flex-col">
            <p className="font-medium">Delete Message</p>
            <p className="text-sm text-gray-600 mb-3">
              Are you sure you want to delete this message? This action cannot
              be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(false);
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          style: { minWidth: "300px" },
        }
      );
    });

    if (!shouldDelete) return;

    if (onDeleteClick) {
      onDeleteClick(message.id);
    }
    setShowActions(false);
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
      console.error("Download failed:", error);
      toast.error("Failed to download file");
    } finally {
      setIsDownloading(false);
    }
  };

  // Close menu when clicking outside
  const handleClickOutside = () => {
    // This function is now handled by useEffect
  };

  // Toggle actions menu
  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowActions(!showActions);
  };

  return (
    <div
      key={message.id}
      className={`flex ${
        isDefinitelyCurrentUser ? "justify-end" : "justify-start"
      } mb-3 sm:mb-4`}
      data-message-id={message.id}
      data-is-current={isDefinitelyCurrentUser ? "true" : "false"}
    >
      {/* Avatar untuk pengguna lain */}
      {!isDefinitelyCurrentUser && (
        <div className="mr-2 sm:mr-3">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            {message.sender.avatar_url ? (
              <img
                src={message.sender.avatar_url}
                alt={message.sender.name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  // Fallback ke icon jika gambar gagal dimuat
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove(
                    "hidden"
                  );
                }}
              />
            ) : (
              <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />
            )}
            <FaUser className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 hidden" />
          </div>
        </div>
      )}

      <div className="flex flex-col max-w-[85%] sm:max-w-[75%] lg:max-w-[70%]">
        {/* Nama pengirim dengan styling yang ditingkatkan */}
        <div
          className={`text-xs sm:text-sm text-gray-600 mb-1 ${
            isDefinitelyCurrentUser ? "self-end" : "ml-1"
          }`}
        >
          {isDefinitelyCurrentUser ? "You" : message.sender.name}
        </div>

        {/* Message bubble dengan interaksi yang ditingkatkan */}
        <div
          className={`rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 relative group shadow-sm ${
            message.isDeleted
              ? "bg-gray-200 text-gray-500 italic"
              : isDefinitelyCurrentUser
              ? message.failed
                ? "bg-red-100 text-red-800 border border-red-300 cursor-pointer hover:bg-red-200"
                : "bg-blue-500 text-white"
              : "bg-white border border-gray-200 text-gray-800 hover:shadow-md"
          } transition-all duration-200`}
          onClick={
            message.failed && onRetryClick
              ? () => onRetryClick(message.id)
              : undefined
          }
          title={
            message.failed ? "Click to retry sending this message" : undefined
          }
        >
          {/* Message actions dropdown for current user's messages */}
          {isDefinitelyCurrentUser &&
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

          {/* Indikator status yang ditingkatkan */}
          {message.pending && (
            <div className="absolute top-1 right-1 sm:top-0 sm:right-0 sm:-mt-1 sm:-mr-1">
              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}

          {message.retrying && (
            <div className="absolute top-1 right-1 sm:top-0 sm:right-0 sm:-mt-1 sm:-mr-1">
              <div className="animate-pulse rounded-full h-3 w-3 sm:h-4 sm:w-4 bg-yellow-500"></div>
            </div>
          )}

          {/* Tampilan attachment dengan penanganan yang ditingkatkan */}
          {message.attachment && (
            <div className="mb-1">
              {message.attachment.type === "image" ? (
                <img
                  src={message.attachment.url}
                  alt={message.attachment.name}
                  className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity max-h-48 sm:max-h-56"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(message.attachment!.url, "_blank");
                  }}
                  onError={(e) => {
                    console.error(
                      "Image failed to load:",
                      message.attachment!.url
                    );
                    e.currentTarget.style.display = "none";
                  }}
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
                  className="text-blue-500 hover:underline flex items-center space-x-1 transition-colors p-1.5 bg-gray-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-xs"
                  title={`Download ${message.attachment!.name}`}
                >
                  {isDownloading ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-500 border-t-transparent" />
                  ) : (
                    <FaFile className="text-gray-500 text-xs h-3 w-3" />
                  )}
                  <span className="text-xs truncate max-w-28 sm:max-w-32">
                    {message.attachment!.name}
                  </span>
                  {!isDownloading && (
                    <FaDownload className="text-gray-400 text-xs h-2.5 w-2.5" />
                  )}
                </button>
              )}
            </div>
          )}

          {/* Regular message content - no more edit mode in bubble */}
          <p className="text-sm sm:text-base break-words whitespace-pre-wrap leading-relaxed">
            {message.isDeleted ? "This message was deleted" : message.content}
          </p>

          {/* Timestamp and status indicators */}
          <div className="flex items-center justify-end space-x-1 mt-1 sm:mt-2">
            {message.isEdited && !message.isDeleted && (
              <span className="text-xs opacity-75">(edited)</span>
            )}

            {message.failed && (
              <span className="text-xs text-red-600 font-medium">Failed</span>
            )}

            <span className="text-xs opacity-75">
              {formatMessageTimestamp({
                timestamp: message.timestamp,
                format: "time",
              })}
            </span>

            {/* Ikon status yang ditingkatkan untuk pesan dari pengguna saat ini */}
            {isDefinitelyCurrentUser && (
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
                  message.delivered && (
                    <FaCheck className="h-3 w-3 opacity-75" />
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupMessageItem;
