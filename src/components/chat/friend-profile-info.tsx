"use client";

import { useState, useRef } from "react";
import {
  FaUser,
  FaFile,
  FaImage,
  FaTimes,
  FaLink,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUserPlus,
  FaDownload,
  FaShareAlt,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { toast } from "react-hot-toast";

interface FriendDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  location: string;
  status: "online" | "offline";
  avatar?: string;
}

interface Friend {
  id: string;
  name: string;
  avatar?: string;
  shareSelected?: boolean;
}

interface MediaItem {
  id: string;
  url: string;
  type: string;
}

interface FileItem {
  id: string;
  name: string;
  size: string;
  date: string;
}

interface UserProfileInfoProps {
  username?: string;
  friendDetails?: FriendDetails;
  onClose?: () => void;
}

export default function UserProfileInfo({
  username,
  friendDetails,
  onClose,
}: UserProfileInfoProps) {
  // Menggunakan data dari friendDetails jika tersedia, atau fallback ke username
  const displayName = friendDetails?.name || username || "User";

  // State for modal displays
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMoreFiles, setIsLoadingMoreFiles] = useState(false);

  // Mock data for media, files, and friends list
  const [userMedia, setUserMedia] = useState<MediaItem[]>([
    { id: "1", url: "/images/voxtalogo.png", type: "image" },
    { id: "2", url: "/images/voxtalogo.png", type: "image" },
    { id: "3", url: "/images/voxtalogo.png", type: "image" },
    { id: "4", url: "/images/voxtalogo.png", type: "image" },
    { id: "5", url: "/images/voxtalogo.png", type: "image" },
  ]);

  const [userFiles, setUserFiles] = useState<FileItem[]>([
    {
      id: "1",
      name: "Project_Proposal.pdf",
      size: "1.2 MB",
      date: "12 Apr 2025",
    },
    { id: "2", name: "Meeting_Notes.docx", size: "604 KB", date: "2 Mar 2025" },
    { id: "3", name: "Budget_2025.xlsx", size: "845 KB", date: "15 Feb 2025" },
  ]);

  // Mock friends list for sharing functionality
  const [friendsList, setFriendsList] = useState<Friend[]>([
    { id: "101", name: "Rudi Setiawan", shareSelected: false },
    { id: "102", name: "Lina Kartika", shareSelected: false },
    { id: "103", name: "Budi Santoso", shareSelected: false },
    { id: "104", name: "Ratna Dewi", shareSelected: false },
    { id: "105", name: "Dimas Prasetyo", shareSelected: false },
  ]);

  // Media preview navigation functions
  const currentMediaIndex = selectedMedia
    ? userMedia.findIndex((item) => item.id === selectedMedia.id)
    : -1;

  const hasPreviousMedia = currentMediaIndex > 0;
  const hasNextMedia = currentMediaIndex < userMedia.length - 1;

  // Helper functions for file operations
  const formatFileSize = (size: string) => size; // In a real app, this would convert bytes to human-readable format

  const getThumbnailUrl = (id: string) => {
    const media = userMedia.find((item) => item.id === id);
    return media?.url || "";
  };

  const getFileUrl = (id: string) => {
    const media = userMedia.find((item) => item.id === id);
    return media?.url || "";
  };

  // Toggle friend selection in the Share dialog
  const toggleFriendSelection = (id: string) => {
    setFriendsList(
      friendsList.map((friend) =>
        friend.id === id
          ? { ...friend, shareSelected: !friend.shareSelected }
          : friend
      )
    );
  };

  // Download file
  const handleDownload = (fileId: string) => {
    // In a real app, this would trigger an actual download
    toast.success("File download started");
  };

  // Show share dialog
  const showShareDialog = (file: FileItem) => {
    setSelectedFile(file);
    setShowShareModal(true);
    // Reset share selections
    setFriendsList(
      friendsList.map((friend) => ({
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

  // Share file with users
  const handleShareFile = () => {
    if (!selectedFile) return;

    const selectedUserIds = friendsList
      .filter((friend) => friend.shareSelected)
      .map((friend) => friend.id);

    if (selectedUserIds.length === 0) return;

    // In a real app, this would call an API to share the file
    toast.success("File shared successfully");

    // Reset selection state
    setFriendsList(
      friendsList.map((friend) => ({
        ...friend,
        shareSelected: false,
      }))
    );

    closeShareDialog();
  };

  // Media preview functionality
  const openMediaPreview = (media: MediaItem) => {
    setSelectedMedia(media);
    setShowMediaPreview(true);
  };

  const closeMediaPreview = () => {
    setShowMediaPreview(false);
    setSelectedMedia(null);
  };

  const navigateMedia = (direction: "prev" | "next") => {
    if (currentMediaIndex === -1) return;

    if (direction === "prev" && currentMediaIndex > 0) {
      setSelectedMedia(userMedia[currentMediaIndex - 1]);
    } else if (
      direction === "next" &&
      currentMediaIndex < userMedia.length - 1
    ) {
      setSelectedMedia(userMedia[currentMediaIndex + 1]);
    }
  };

  // Load more functionality (mock implementation)
  const loadMoreMedia = () => {
    setIsLoadingMore(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsLoadingMore(false);
      toast.success("More media loaded");
    }, 1000);
  };

  const loadMoreFiles = () => {
    setIsLoadingMoreFiles(true);
    // Simulate API call delay
    setTimeout(() => {
      setIsLoadingMoreFiles(false);
      toast.success("More files loaded");
    }, 1000);
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        {onClose && (
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaTimes size={20} />
            </button>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center">
            {friendDetails?.avatar ? (
              <img
                src={friendDetails.avatar}
                alt={friendDetails.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUser className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <p className="text-gray-500 text-sm">
            {friendDetails?.status === "online" ? "Online" : "Offline"} • Last
            seen today at 2:45 PM
          </p>
        </div>
      </div>

      {/* Contact Information Section - New */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium mb-4">Contact Information</h3>

        {friendDetails?.email && (
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <FaEnvelope className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <p className="text-sm">{friendDetails.email}</p>
            </div>
          </div>
        )}

        {friendDetails?.phone && (
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <FaPhone className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Phone</p>
              <p className="text-sm">{friendDetails.phone}</p>
            </div>
          </div>
        )}

        {friendDetails?.joinDate && (
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <FaCalendarAlt className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Joined</p>
              <p className="text-sm">{friendDetails.joinDate}</p>
            </div>
          </div>
        )}

        {friendDetails?.location && (
          <div className="flex items-center">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
              <FaMapMarkerAlt className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Location</p>
              <p className="text-sm">{friendDetails.location}</p>
            </div>
          </div>
        )}
      </div>

      {/* Media Section - Updated */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">
            Media{" "}
            <span className="text-gray-500 text-sm">({userMedia.length})</span>
          </h3>
          <button
            onClick={() => setShowMediaModal(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="relative">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : userMedia.length === 0 ? (
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
                        handleDownload(item.id);
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

      {/* Files Section - Updated */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">
            File{" "}
            <span className="text-gray-500 text-sm">({userFiles.length})</span>
          </h3>
          <button
            onClick={() => setShowFilesModal(true)}
            className="text-sm text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>
        <div className="relative">
          {isLoadingFiles ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : userFiles.length === 0 ? (
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
                      onClick={() => handleDownload(file.id)}
                      className="p-1 text-gray-500 hover:text-blue-500"
                      title="Download"
                    >
                      <FaDownload className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => showShareDialog(file)}
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
                          handleDownload(item.id);
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
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMoreMedia}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
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

              {/* File list for modal */}
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
                        onClick={() => handleDownload(file.id)}
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
              <div className="flex justify-center mt-4">
                <button
                  onClick={loadMoreFiles}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  disabled={isLoadingMoreFiles}
                >
                  {isLoadingMoreFiles ? "Loading..." : "Load More"}
                </button>
              </div>
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
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex items-center justify-center">
                        {friend.avatar ? (
                          <img
                            src={friend.avatar}
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
      {showMediaPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative w-full max-w-4xl">
            <button
              onClick={closeMediaPreview}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <FaTimes className="h-6 w-6" />
            </button>

            {selectedMedia && (
              <div className="flex flex-col items-center">
                <img
                  src={getFileUrl(selectedMedia.id)}
                  alt=""
                  className="max-h-[80vh] max-w-full object-contain"
                />

                <div className="mt-4 flex justify-center space-x-4">
                  <button
                    onClick={() => handleDownload(selectedMedia.id)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 flex items-center"
                  >
                    <FaDownload className="h-4 w-4 mr-2" />
                    Download
                  </button>

                  <button
                    onClick={() => {
                      // Convert media to file format for sharing
                      const mediaAsFile = {
                        id: selectedMedia.id,
                        name: `Image-${selectedMedia.id}.jpg`,
                        size: "Unknown size",
                        date: new Date().toLocaleDateString(),
                      };
                      showShareDialog(mediaAsFile);
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center"
                  >
                    <FaShareAlt className="h-4 w-4 mr-2" />
                    Share
                  </button>
                </div>

                {/* Navigation arrows for multiple media items */}
                <div className="absolute inset-y-0 left-0 flex items-center">
                  {hasPreviousMedia && (
                    <button
                      onClick={() => navigateMedia("prev")}
                      className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                    >
                      <FaChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                </div>

                <div className="absolute inset-y-0 right-0 flex items-center">
                  {hasNextMedia && (
                    <button
                      onClick={() => navigateMedia("next")}
                      className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                    >
                      <FaChevronRight className="h-6 w-6" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
