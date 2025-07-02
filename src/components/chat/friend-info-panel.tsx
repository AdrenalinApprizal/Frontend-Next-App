"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FaTimes,
  FaUser,
  FaEnvelope,
  FaDownload,
  FaFile,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { useFriendship } from "@/hooks/auth/useFriends";
import { useFiles } from "@/hooks/files/useFiles";
import toast from "react-hot-toast";

interface Friend {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  profile_picture_url?: string;
  avatar?: string;
  shareSelected?: boolean;
  status?: "online" | "offline";
  phone?: string;
  last_seen?: string;
  unread_count?: number;
  display_name?: string;
  full_name?: string;
  avatar_url?: string;
  created_at?: string;
}

interface FriendDetails {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  status: "online" | "offline";
  avatar?: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  username?: string;
  avatar_url?: string;
  display_name?: string;
  full_name?: string;
}

// Updated interface to match API response
interface AttachmentItem {
  file_id: string;
  filename: string;
  size: number;
  mime_type: string;
  url: string;
  uploaded_at: string;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_more_pages: boolean;
}

interface FriendInfoPanelProps {
  friendDetails?: FriendDetails;
  onClose: () => void;
}

const FriendInfoPanel: React.FC<FriendInfoPanelProps> = ({
  friendDetails,
  onClose,
}) => {
  // State management - simplified to single attachments list
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Modal states
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Selection states
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentItem | null>(null);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 8,
    has_more_pages: false,
  });

  // Hooks
  const { friends } = useFriendship();
  const {
    getUserFiles,
    downloadFile: downloadFileAction,
    shareFile,
    formatFileSize,
  } = useFiles();

  // Computed values
  const displayName = useMemo(() => {
    if (!friendDetails) return "User";

    return friendDetails.first_name && friendDetails.last_name
      ? `${friendDetails.first_name} ${friendDetails.last_name}`
      : friendDetails.name;
  }, [friendDetails]);

  const currentAttachmentIndex = useMemo(() => {
    if (!selectedAttachment) return -1;
    return attachments.findIndex(
      (item) => item.file_id === selectedAttachment.file_id
    );
  }, [selectedAttachment, attachments]);

  const hasPreviousAttachment = useMemo(() => {
    return currentAttachmentIndex > 0;
  }, [currentAttachmentIndex]);

  const hasNextAttachment = useMemo(() => {
    return currentAttachmentIndex < attachments.length - 1;
  }, [currentAttachmentIndex, attachments.length]);

  // Helper function to check if attachment is an image
  const isImage = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  // Initialize friends list
  useEffect(() => {
    if (friends) {
      setFriendsList(
        friends.map((friend) => ({
          ...friend,
          shareSelected: false,
        }))
      );
    }
  }, [friends]);

  // Load data when friend details change
  useEffect(() => {
    if (friendDetails?.id) {
      setCurrentPage(1);
      loadAttachments();
    }
  }, [friendDetails?.id]);

  // Load user attachments from message history
  const loadAttachments = async () => {
    if (!friendDetails?.id) return;

    try {
      setIsLoading(true);

      // Fetch message history to get attachments
      const response = await fetch(
        `/api/proxy/messages/history?type=private&target_id=${friendDetails.id}&limit=100`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Extract messages array from response
      let messages = [];
      if (data?.data && Array.isArray(data.data)) {
        messages = data.data;
      } else if (data?.messages && Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (Array.isArray(data)) {
        messages = data;
      }

      // Filter messages that have attachments
      const attachmentMessages = messages.filter(
        (msg: any) => msg.attachment_url && msg.message_type === "file"
      );

      // Convert messages to attachment format
      const attachmentData: AttachmentItem[] = attachmentMessages.map(
        (msg: any) => {
          const filename = msg.content?.replace("📎 ", "") || "Unknown File";

          // Try to determine mime type from filename extension
          let mimeType = "application/octet-stream";
          const extension = filename.split(".").pop()?.toLowerCase();
          if (extension) {
            const imageExtensions = [
              "jpg",
              "jpeg",
              "png",
              "gif",
              "webp",
              "svg",
            ];
            const documentExtensions = ["pdf", "doc", "docx", "txt"];

            if (imageExtensions.includes(extension)) {
              mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
            } else if (documentExtensions.includes(extension)) {
              mimeType =
                extension === "pdf"
                  ? "application/pdf"
                  : extension === "doc"
                  ? "application/msword"
                  : extension === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : "text/plain";
            }
          }

          return {
            file_id: msg.message_id || msg.id,
            filename: filename,
            size: 0, // Size not available from message history
            mime_type: mimeType,
            url: msg.attachment_url,
            uploaded_at:
              msg.sent_at || msg.created_at || new Date().toISOString(),
          };
        }
      );

      setAttachments(attachmentData);

      // Set basic pagination
      setPagination({
        current_page: 1,
        total_pages: 1,
        total_items: attachmentData.length,
        items_per_page: attachmentData.length,
        has_more_pages: false,
      });
      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading attachments from messages:", error);
      // Silently handle error
      setAttachments([]); // Set empty array as fallback
    } finally {
      setIsLoading(false);
    }
  };

  // Load more attachments - disabled for message history approach
  const loadMoreAttachments = async () => {
    // Since we load all attachments from message history in one request,
    // this function is no longer needed but kept for UI compatibility
  };

  // Download file using attachment URL
  const downloadFile = async (attachment: AttachmentItem) => {
    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = attachment.url;
      link.download = attachment.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("File download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  // Show share dialog
  const showShareDialog = (attachment: AttachmentItem) => {
    setSelectedAttachment(attachment);
    setShowShareModal(true);

    // Reset share selections
    setFriendsList((prev) =>
      prev.map((friend) => ({
        ...friend,
        shareSelected: false,
      }))
    );
  };

  // Close share dialog
  const closeShareDialog = () => {
    setShowShareModal(false);
    setSelectedAttachment(null);
  };

  // Toggle friend selection in share dialog
  const toggleShareSelection = (friendId: string) => {
    setFriendsList((prev) =>
      prev.map((friend) =>
        friend.id === friendId
          ? { ...friend, shareSelected: !friend.shareSelected }
          : friend
      )
    );
  };

  // Handle sharing file
  const handleShareFile = async () => {
    if (!selectedAttachment) return;

    const selectedUserIds = friendsList
      .filter((friend) => friend.shareSelected)
      .map((friend) => friend.id);

    if (selectedUserIds.length === 0) return;

    try {
      await shareFile(selectedAttachment.file_id, selectedUserIds);
      toast.success("File shared successfully");

      // Reset selection state
      setFriendsList((prev) =>
        prev.map((friend) => ({
          ...friend,
          shareSelected: false,
        }))
      );

      closeShareDialog();
    } catch (error) {
      console.error("Error sharing file:", error);
      // Silently handle error - file service might not be available
    }
  };

  // Attachment preview functions
  const openAttachmentPreview = (attachment: AttachmentItem) => {
    setSelectedAttachment(attachment);
    setShowPreview(true);
  };

  const closeAttachmentPreview = () => {
    setShowPreview(false);
    setSelectedAttachment(null);
  };

  const navigateAttachment = (direction: "prev" | "next") => {
    const currentIndex = currentAttachmentIndex;
    if (currentIndex === -1) return;

    if (direction === "prev" && currentIndex > 0) {
      setSelectedAttachment(attachments[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < attachments.length - 1) {
      setSelectedAttachment(attachments[currentIndex + 1]);
    }
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Profile</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close profile"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center ring-2 ring-gray-100">
            {friendDetails?.avatar || friendDetails?.profile_picture_url ? (
              <img
                src={friendDetails.avatar || friendDetails.profile_picture_url}
                alt={friendDetails.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUser className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <h2 className="text-black text-xl font-semibold text-center">
            {displayName}
          </h2>
          <p className="text-gray-500 text-sm">
            @{friendDetails?.username || friendDetails?.name || "user"}
          </p>
          <div className="flex items-center space-x-2 mt-2">
            <div
              className={`w-3 h-3 rounded-full ${
                friendDetails?.status === "online"
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
            />
            <span className="text-sm text-gray-600 capitalize">
              {friendDetails?.status || "offline"}
            </span>
          </div>
        </div>
      </div>

      {/* Attachments Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-black font-medium">
            Attachments
            <span className="text-gray-500 text-sm">
              ({attachments.length})
            </span>
          </h3>
          <button
            onClick={() => setShowAttachmentsModal(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>

        {/* Attachments List */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {attachments.length === 0 && !isLoading ? (
            <div className="py-4 text-center text-gray-500">No attachments</div>
          ) : (
            <div className="space-y-3">
              {attachments.slice(0, 5).map((attachment) => (
                <div
                  key={attachment.file_id}
                  className="flex items-center bg-gray-50 p-2 rounded-md hover:bg-gray-100 cursor-pointer"
                  onClick={() => openAttachmentPreview(attachment)}
                >
                  <div className="mr-3">
                    {isImage(attachment.mime_type) ? (
                      <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200">
                        <img
                          src={attachment.url}
                          alt={attachment.filename}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                        <FaFile className="h-5 w-5 text-blue-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">
                      {attachment.filename}
                    </p>
                  </div>
                  <div className="ml-2 flex">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(attachment);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-500"
                      title="Download"
                    >
                      <FaDownload className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-medium text-lg">All Attachments</h3>
              <button
                onClick={() => setShowAttachmentsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            <div
              className="overflow-y-auto p-4"
              style={{ maxHeight: "calc(90vh - 8rem)" }}
            >
              {isLoadingMore && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div
                    key={attachment.file_id}
                    className="flex items-center bg-gray-50 p-3 rounded-md hover:bg-gray-100 cursor-pointer"
                    onClick={() => openAttachmentPreview(attachment)}
                  >
                    <div className="mr-3">
                      {isImage(attachment.mime_type) ? (
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-200">
                          <img
                            src={attachment.url}
                            alt={attachment.filename}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-blue-100 flex items-center justify-center">
                          <FaFile className="h-6 w-6 text-blue-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium truncate">
                        {attachment.filename}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-2 flex">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(attachment);
                        }}
                        className="p-2 text-gray-500 hover:text-blue-500"
                        title="Download"
                      >
                        <FaDownload className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more button */}
              {pagination.has_more_pages && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={loadMoreAttachments}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Dialog */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-lg">Share File</h3>
              <button
                onClick={closeShareDialog}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            {selectedAttachment && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md flex items-center">
                <div className="mr-3">
                  <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                    <FaFile className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {selectedAttachment.filename}
                  </p>
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Share with:
              </label>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
                {friendsList.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center justify-between p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      friend.shareSelected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => toggleShareSelection(friend.id)}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex items-center justify-center">
                        {friend.avatar || friend.profile_picture_url ? (
                          <img
                            src={friend.avatar || friend.profile_picture_url}
                            alt={friend.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FaUser className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                      <span className="text-sm">{friend.name}</span>
                    </div>
                    {friend.shareSelected && (
                      <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <FaCheck className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleShareFile}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!friendsList.some((friend) => friend.shareSelected)}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {showPreview && selectedAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={closeAttachmentPreview}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <FaTimes className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center">
              {isImage(selectedAttachment.mime_type) ? (
                <img
                  src={selectedAttachment.url}
                  alt={selectedAttachment.filename}
                  className="max-h-[80vh] max-w-full object-contain"
                />
              ) : (
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <FaFile className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedAttachment.filename}
                  </h3>
                  <p className="text-sm text-gray-600">
                    This file type cannot be previewed
                  </p>
                </div>
              )}

              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={() => downloadFile(selectedAttachment)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 flex items-center"
                >
                  <FaDownload className="h-4 w-4 mr-2" />
                  Download
                </button>
              </div>

              {/* Navigation arrows */}
              {hasPreviousAttachment && (
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <button
                    onClick={() => navigateAttachment("prev")}
                    className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                  >
                    <FaChevronLeft className="h-6 w-6" />
                  </button>
                </div>
              )}

              {hasNextAttachment && (
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    onClick={() => navigateAttachment("next")}
                    className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                  >
                    <FaChevronRight className="h-6 w-6" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendInfoPanel;
