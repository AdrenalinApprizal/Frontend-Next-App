"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FaTimes,
  FaUser,
  FaEnvelope,
  FaDownload,
  FaShareAlt,
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

interface MediaItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
  thumbnail_url?: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string;
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
  // State management
  const [userMedia, setUserMedia] = useState<MediaItem[]>([]);
  const [userFiles, setUserFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMoreFiles, setIsLoadingMoreFiles] = useState(false);

  // Modal states
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);

  // Selection states
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  // Pagination states
  const [currentMediaPage, setCurrentMediaPage] = useState(1);
  const [currentFilesPage, setCurrentFilesPage] = useState(1);
  const [mediaPagination, setMediaPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 8,
    has_more_pages: false,
  });
  const [filesPagination, setFilesPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 8,
    has_more_pages: false,
  });

  // Hooks
  const { friends } = useFriendship();
  const {
    getUserMedia,
    getUserFiles,
    downloadFile: downloadFileAction,
    shareFile,
    getFileUrl,
    getThumbnailUrl,
    formatFileSize,
  } = useFiles();

  // Computed values
  const displayName = useMemo(() => {
    if (!friendDetails) return "User";

    return friendDetails.first_name && friendDetails.last_name
      ? `${friendDetails.first_name} ${friendDetails.last_name}`
      : friendDetails.name;
  }, [friendDetails]);

  const currentMediaIndex = useMemo(() => {
    if (!selectedMedia) return -1;
    return userMedia.findIndex((item) => item.id === selectedMedia.id);
  }, [selectedMedia, userMedia]);

  const hasPreviousMedia = useMemo(() => {
    return currentMediaIndex > 0;
  }, [currentMediaIndex]);

  const hasNextMedia = useMemo(() => {
    return currentMediaIndex < userMedia.length - 1;
  }, [currentMediaIndex, userMedia.length]);

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
      setCurrentMediaPage(1);
      setCurrentFilesPage(1);
      loadUserMedia();
      loadUserFiles();
    }
  }, [friendDetails?.id]);

  // Load user media files
  const loadUserMedia = async () => {
    if (!friendDetails?.id) return;

    try {
      setIsLoading(true);
      const response = await getUserMedia(friendDetails.id, "all", 1, 8);

      if (response?.data) {
        setUserMedia(response.data);
      }
      if (response?.pagination) {
        setMediaPagination(response.pagination);
      }
      setCurrentMediaPage(1);
    } catch (error) {
      console.error("Error loading media:", error);
      // Silently handle error - file service might not be available
    } finally {
      setIsLoading(false);
    }
  };

  // Load more media
  const loadMoreMedia = async () => {
    if (!friendDetails?.id || isLoadingMore) return;

    try {
      setIsLoadingMore(true);
      const nextPage = currentMediaPage + 1;

      const response = await getUserMedia(friendDetails.id, "all", nextPage, 8);

      if (response?.data) {
        setUserMedia((prev) => [...prev, ...response.data]);
      }
      if (response?.pagination) {
        setMediaPagination(response.pagination);
      }
      setCurrentMediaPage(nextPage);
    } catch (error) {
      console.error("Error loading more media:", error);
      // Silently handle error - file service might not be available
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Load user files
  const loadUserFiles = async () => {
    if (!friendDetails?.id) return;

    try {
      setIsLoadingFiles(true);
      const response = await getUserFiles(friendDetails.id, 1, 8);

      if (response?.data) {
        setUserFiles(response.data);
      }
      if (response?.pagination) {
        setFilesPagination(response.pagination);
      }
      setCurrentFilesPage(1);
    } catch (error) {
      console.error("Error loading files:", error);
      // Silently handle error - file service might not be available
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Load more files
  const loadMoreFiles = async () => {
    if (!friendDetails?.id || isLoadingMoreFiles) return;

    try {
      setIsLoadingMoreFiles(true);
      const nextPage = currentFilesPage + 1;

      const response = await getUserFiles(friendDetails.id, nextPage, 8);

      if (response?.data) {
        setUserFiles((prev) => [...prev, ...response.data]);
      }
      if (response?.pagination) {
        setFilesPagination(response.pagination);
      }
      setCurrentFilesPage(nextPage);
    } catch (error) {
      console.error("Error loading more files:", error);
      // Silently handle error - file service might not be available
    } finally {
      setIsLoadingMoreFiles(false);
    }
  };

  // Download file
  const downloadFile = async (fileId: string) => {
    try {
      await downloadFileAction(fileId);
      toast.success("File download started");
    } catch (error) {
      console.error("Error downloading file:", error);
      // Silently handle error - file service might not be available
    }
  };

  // Show share dialog
  const showShareDialog = (file: FileItem | MediaItem) => {
    setSelectedFile(file as FileItem);
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
    setSelectedFile(null);
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
    if (!selectedFile) return;

    const selectedUserIds = friendsList
      .filter((friend) => friend.shareSelected)
      .map((friend) => friend.id);

    if (selectedUserIds.length === 0) return;

    try {
      await shareFile(selectedFile.id, selectedUserIds);
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

  // Media preview functions
  const openMediaPreview = (media: MediaItem) => {
    setSelectedMedia(media);
    setShowMediaPreview(true);
  };

  const closeMediaPreview = () => {
    setShowMediaPreview(false);
    setSelectedMedia(null);
  };

  const navigateMedia = (direction: "prev" | "next") => {
    const currentIndex = currentMediaIndex;
    if (currentIndex === -1) return;

    if (direction === "prev" && currentIndex > 0) {
      setSelectedMedia(userMedia[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < userMedia.length - 1) {
      setSelectedMedia(userMedia[currentIndex + 1]);
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

      {/* Media Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-black font-medium">
            Media
            <span className="text-gray-500 text-sm">({userMedia.length})</span>
          </h3>
          <button
            onClick={() => setShowMediaModal(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>

        {/* Media Grid */}
        <div className="relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {userMedia.length === 0 && !isLoading ? (
            <div className="py-4 text-center text-gray-500">No media files</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {userMedia.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="aspect-square bg-gray-200 rounded-md overflow-hidden cursor-pointer relative group"
                  onClick={() => openMediaPreview(item)}
                >
                  <img
                    src={getThumbnailUrl(item.id)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(item.id);
                      }}
                      className="bg-white text-blue-500 p-2 rounded-full"
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

      {/* Files Section */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-black font-medium">
            File
            <span className="text-gray-500 text-sm">({userFiles.length})</span>
          </h3>
          <button
            onClick={() => setShowFilesModal(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>

        {/* File List */}
        <div className="relative">
          {isLoadingFiles && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          {userFiles.length === 0 && !isLoadingFiles ? (
            <div className="py-4 text-center text-gray-500">No files</div>
          ) : (
            <div className="space-y-3">
              {userFiles.slice(0, 3).map((file) => (
                <div
                  key={file.id}
                  className="flex items-center bg-gray-50 p-2 rounded-md hover:bg-gray-100"
                >
                  <div className="mr-3">
                    <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                      <FaFile className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="ml-2 flex">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadFile(file.id);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-500"
                      title="Download"
                    >
                      <FaDownload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showShareDialog(file);
                      }}
                      className="p-1 text-gray-500 hover:text-blue-500"
                      title="Share"
                    >
                      <FaShareAlt className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Media Modal */}
      {showMediaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-medium text-lg">Media Files</h3>
              <button
                onClick={() => setShowMediaModal(false)}
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

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {userMedia.map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square bg-gray-200 rounded-md overflow-hidden cursor-pointer relative group"
                    onClick={() => openMediaPreview(item)}
                  >
                    <img
                      src={getThumbnailUrl(item.id)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(item.id);
                        }}
                        className="bg-white text-blue-500 p-2 rounded-full"
                      >
                        <FaDownload className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more button */}
              {mediaPagination.has_more_pages && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={loadMoreMedia}
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

      {/* Files Modal */}
      {showFilesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="font-medium text-lg">Files</h3>
              <button
                onClick={() => setShowFilesModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes className="h-5 w-5" />
              </button>
            </div>

            <div
              className="overflow-y-auto p-4"
              style={{ maxHeight: "calc(90vh - 8rem)" }}
            >
              {isLoadingMoreFiles && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <div className="space-y-3">
                {userFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center bg-gray-50 p-3 rounded-md hover:bg-gray-100"
                  >
                    <div className="mr-3">
                      <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                        <FaFile className="h-5 w-5 text-blue-500" />
                      </div>
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                    <div className="ml-2 flex">
                      <button
                        onClick={() => downloadFile(file.id)}
                        className="p-2 text-gray-500 hover:text-blue-500"
                        title="Download"
                      >
                        <FaDownload className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => showShareDialog(file)}
                        className="p-2 text-gray-500 hover:text-blue-500"
                        title="Share"
                      >
                        <FaShareAlt className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Load more button */}
              {filesPagination.has_more_pages && (
                <div className="flex justify-center mt-4">
                  <button
                    onClick={loadMoreFiles}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                    disabled={isLoadingMoreFiles}
                  >
                    {isLoadingMoreFiles ? "Loading..." : "Load More"}
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

            {selectedFile && (
              <div className="mb-4 p-3 bg-gray-50 rounded-md flex items-center">
                <div className="mr-3">
                  <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                    <FaFile className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedFile.size)}
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

      {/* Media Preview Modal */}
      {showMediaPreview && selectedMedia && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={closeMediaPreview}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <FaTimes className="h-6 w-6" />
            </button>

            <div className="flex flex-col items-center">
              <img
                src={getFileUrl(selectedMedia.id)}
                alt=""
                className="max-h-[80vh] max-w-full object-contain"
              />

              <div className="mt-4 flex justify-center space-x-4">
                <button
                  onClick={() => downloadFile(selectedMedia.id)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 flex items-center"
                >
                  <FaDownload className="h-4 w-4 mr-2" />
                  Download
                </button>

                <button
                  onClick={() => showShareDialog(selectedMedia)}
                  className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center"
                >
                  <FaShareAlt className="h-4 w-4 mr-2" />
                  Share
                </button>
              </div>

              {/* Navigation arrows */}
              {hasPreviousMedia && (
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <button
                    onClick={() => navigateMedia("prev")}
                    className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                  >
                    <FaChevronLeft className="h-6 w-6" />
                  </button>
                </div>
              )}

              {hasNextMedia && (
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    onClick={() => navigateMedia("next")}
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
