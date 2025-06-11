import React, { useState } from "react";
import {
  FaUser,
  FaClock,
  FaCheck,
  FaExclamationTriangle,
  FaFile,
  FaPencilAlt,
  FaTrash,
  FaEllipsisV,
} from "react-icons/fa";

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
  onEditClick?: (messageId: string, currentContent: string) => void;
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
  // State for editing
  const [isEditing, setIsEditing] = useState(false);
  // State for edited content
  const [editedContent, setEditedContent] = useState(message.content);

  // CRITICAL FIX: Enhanced logic to determine if message is from current user
  const isDefinitelyCurrentUser =
    message.isCurrentUser === true ||
    message.sender.name === "You" ||
    message._isOptimisticMessage === true ||
    // Additional check for optimistic messages
    message.id?.startsWith("temp-");

  // Debug info untuk setiap pesan yang di-render
  console.log(
    `🟢 DETAILED: Rendering message in GroupMessageItem ID ${message.id}:`,
    {
      content: message.content,
      isCurrentUser: message.isCurrentUser,
      forcedIsCurrentUser: isDefinitelyCurrentUser,
      senderName: message.sender.name,
      senderId: message.sender.id,
      messageId: message.id,
      isOptimistic: message._isOptimisticMessage,
      isTemp: message.id?.startsWith("temp-"),
      allMessageProps: Object.keys(message),
      showActions,
      isEditing,
    }
  );

  // Handler for edit button click
  const handleEditClick = () => {
    setIsEditing(true);
    setEditedContent(message.content);
    setShowActions(false);
  };

  // Handler for save edit
  const handleSaveEdit = () => {
    if (onEditClick && editedContent !== message.content) {
      onEditClick(message.id, editedContent);
    }
    setIsEditing(false);
  };

  // Handler for cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  // Handler for delete button click
  const handleDeleteClick = () => {
    if (onDeleteClick) {
      onDeleteClick(message.id);
    }
    setShowActions(false);
  };

  // Close menu when clicking outside
  const handleClickOutside = () => {
    if (showActions) {
      setShowActions(false);
    }
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
      } mb-4`}
      data-message-id={message.id}
      data-is-current={isDefinitelyCurrentUser ? "true" : "false"}
      onClick={handleClickOutside}
    >
      {/* Avatar untuk pengguna lain */}
      {!isDefinitelyCurrentUser && (
        <div className="mr-2">
          <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
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
              <FaUser className="h-5 w-5 text-gray-500" />
            )}
            <FaUser className="h-5 w-5 text-gray-500 hidden" />
          </div>
        </div>
      )}

      <div className="flex flex-col max-w-[70%]">
        {/* Nama pengirim dengan styling yang ditingkatkan */}
        <div
          className={`text-xs text-gray-600 mb-1 ${
            isDefinitelyCurrentUser ? "self-end" : "ml-1"
          }`}
        >
          {isDefinitelyCurrentUser ? "You" : message.sender.name}
        </div>

        {/* Message bubble dengan interaksi yang ditingkatkan */}
        <div
          className={`rounded-lg px-4 py-2 relative group ${
            isDefinitelyCurrentUser
              ? message.isDeleted
                ? "bg-gray-200 text-gray-500 italic"
                : message.failed
                ? "bg-red-100 text-red-800 border border-red-300 cursor-pointer hover:bg-red-200"
                : "bg-blue-500 text-white"
              : "bg-white border border-gray-200 text-gray-800"
          }`}
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
              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                <button
                  onClick={toggleActions}
                  className="text-white hover:text-blue-200 p-1 rounded-full focus:outline-none opacity-70 hover:opacity-100 transition-opacity"
                >
                  <FaEllipsisV className="h-3 w-3" />
                </button>

                {/* Dropdown menu */}
                {showActions && (
                  <div className="absolute right-0 mt-1 w-32 bg-white rounded-md shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={handleEditClick}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <FaPencilAlt className="mr-2" /> Edit
                      </button>
                      <button
                        onClick={handleDeleteClick}
                        className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center"
                      >
                        <FaTrash className="mr-2" /> Unsend
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Indikator status yang ditingkatkan */}
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

          {/* Tampilan attachment dengan penanganan yang ditingkatkan */}
          {message.attachment && (
            <div className="mb-2">
              {message.attachment.type === "image" ? (
                <img
                  src={message.attachment.url}
                  alt={message.attachment.name}
                  className="max-w-full h-auto rounded cursor-pointer hover:opacity-90 transition-opacity"
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
                <a
                  href={message.attachment.url}
                  download={message.attachment.name}
                  className="text-blue-500 hover:underline flex items-center space-x-2 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaFile className="text-gray-600" />
                  <span className="text-sm ml-1">
                    {message.attachment.name}
                    {message.attachment.size && ` (${message.attachment.size})`}
                  </span>
                </a>
              )}
            </div>
          )}

          {/* Edit mode */}
          {isEditing ? (
            <div className="w-full">
              <textarea
                className="w-full p-2 text-sm border rounded text-gray-800"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex justify-end mt-2 space-x-2">
                <button
                  className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300 text-gray-800"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button
                  className="px-2 py-1 text-xs bg-blue-500 rounded hover:bg-blue-600 text-white"
                  onClick={handleSaveEdit}
                  disabled={editedContent.trim() === ""}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* Regular message content */
            <p className="text-sm break-words whitespace-pre-wrap">
              {message.isDeleted ? "This message was deleted" : message.content}
            </p>
          )}

          {/* Timestamp and status indicators */}
          {!isEditing && (
            <div className="flex items-center justify-end space-x-1 mt-1">
              {message.isEdited && !message.isDeleted && (
                <span className="text-xs opacity-75">(edited)</span>
              )}

              {message.failed && (
                <span className="text-xs text-red-600 font-medium">Failed</span>
              )}

              <span className="text-xs opacity-75">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              {/* Ikon status yang ditingkatkan untuk pesan dari pengguna saat ini */}
              {isDefinitelyCurrentUser && (
                <div className="ml-1">
                  {message.pending && (
                    <FaClock className="h-3 w-3 opacity-75" />
                  )}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupMessageItem;
