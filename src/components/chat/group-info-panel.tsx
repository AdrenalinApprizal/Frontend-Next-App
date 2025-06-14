"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaUsers,
  FaFile,
  FaImage,
  FaTimes,
  FaLink,
  FaUser,
  FaUserPlus,
  FaEllipsisV,
  FaCheck,
  FaBan,
  FaDownload,
  FaShareAlt,
} from "react-icons/fa";
import { X, Search, UserMinus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { useGroup } from "@/hooks/auth/useGroup";
import usePresence from "@/hooks/presence/usePresence";
import { useFriendship } from "@/hooks/auth/useFriends";

interface GroupProfileInfoProps {
  groupName: string;
  groupDetails: GroupDetails;
  onClose: () => void;
  onUpdateGroup?: (groupId: string, groupData: any) => void;
}

interface GroupMember {
  id: string;
  name: string;
  status: "online" | "offline" | "busy" | "away";
  role: "admin" | "owner" | "member";
  avatar_url?: string;
  isBlocked?: boolean;
  lastSeen?: string;
  user_id?: string; // Added to support API consistency
}

interface GroupDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  avatar_url?: string;
}

interface Friend {
  id: string;
  name: string;
  username: string;
  profile_picture_url?: string;
  avatar_url?: string; // API response field
  avatar?: string; // Legacy field
  selected?: boolean;
  shareSelected?: boolean;
}

interface MediaItem {
  id: string;
  url: string;
  name: string;
  size?: string;
  type: "image" | "file";
  date?: string;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_more_pages: boolean;
}

export default function GroupProfileInfo({
  groupName,
  groupDetails: initialGroupDetails,
  onClose,
  onUpdateGroup,
}: GroupProfileInfoProps) {
  // Group data management hooks
  const {
    blockGroupUser,
    unblockGroupUser,
    addGroupMembers,
    getGroupBlocks,
    blockedUsers,
    loading,
    error,
  } = useGroup();

  // Friends data management hook
  const {
    loading: friendsLoading,
    error: friendsError,
    friends: apiFriends,
    getFriends,
  } = useFriendship();

  // Presence hook for realtime user status
  const presence = usePresence();

  // Component state
  const [groupDetails, setGroupDetails] =
    useState<GroupDetails>(initialGroupDetails);
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "members"
  );
  const [showAddMemberPopup, setShowAddMemberPopup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);

  // Media and files state
  const [groupMedia, setGroupMedia] = useState<MediaItem[]>([]);
  const [groupFiles, setGroupFiles] = useState<MediaItem[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isLoadingMoreMedia, setIsLoadingMoreMedia] = useState(false);
  const [isLoadingMoreFiles, setIsLoadingMoreFiles] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<MediaItem | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [currentMediaPage, setCurrentMediaPage] = useState(1);
  const [currentFilesPage, setCurrentFilesPage] = useState(1);

  // Pagination state
  const [mediaPagination, setMediaPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });

  const [filesPagination, setFilesPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const friendsFetchedRef = useRef(false);

  // Fetch friends and blocked users when component mounts (only once)
  useEffect(() => {
    if (!friendsFetchedRef.current && !friendsLoading) {
      friendsFetchedRef.current = true;

      // Fetch both friends and blocked users in parallel
      Promise.allSettled([getFriends(), getGroupBlocks(groupDetails.id)])
        .then((results) => {
          console.log("[GroupInfoPanel] Initialization completed:");
          console.log("- Friends fetch:", results[0].status);
          console.log("- Blocked users fetch:", results[1].status);
        })
        .catch(() => {
          // Reset the flag on error to allow retry
          friendsFetchedRef.current = false;
        });
    }
  }, [groupDetails.id]); // Include groupDetails.id in dependencies

  // Get available friends (excluding current group members)
  const availableFriends = apiFriends.filter((friend) => {
    // Check if friend is already a group member
    const isAlreadyMember = groupDetails.members.some(
      (member) => member.id === friend.id || member.user_id === friend.id
    );
    return !isAlreadyMember;
  });

  // Filter available friends based on search query
  const filteredFriends = availableFriends.filter(
    (friend) =>
      friend.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleMemberDropdown = (memberId: string) => {
    setActiveDropdown(activeDropdown === memberId ? null : memberId);
  };

  // Get member status from presence system
  const getMemberStatus = (
    userId: string
  ): "online" | "offline" | "busy" | "away" => {
    return presence.getStatus(userId) || "offline";
  };

  // Format last active time in a human-readable format
  const formatLastActive = (userId: string): string => {
    const lastActive = presence.getLastActive(userId);
    if (!lastActive) return "Not available";

    try {
      const lastActiveDate = new Date(lastActive);
      // Basic implementation of time distance
      const now = new Date();
      const diffInSeconds = Math.floor(
        (now.getTime() - lastActiveDate.getTime()) / 1000
      );

      if (diffInSeconds < 60) return "Just now";

      const diffInMinutes = Math.floor(diffInSeconds / 60);
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;

      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours} hr ago`;

      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7)
        return `${diffInDays} day${diffInDays > 1 ? "s" : ""} ago`;

      return lastActiveDate.toLocaleDateString();
    } catch (error) {
      return "Not available";
    }
  };

  // Members with presence status information
  const membersWithStatus = groupDetails.members.map((member) => {
    // Handle both id and user_id fields
    const userId = member.id || member.user_id || "";
    const status = getMemberStatus(userId);
    const lastActive = formatLastActive(userId);

    // Check if user is blocked by looking in the blockedUsers list
    // API returns blocked_users with user_id and blocked_at fields
    const blockedUser = blockedUsers.find((blockedUser) => {
      return (
        blockedUser.user_id === userId ||
        blockedUser.user_id === member.id ||
        blockedUser.user_id === member.user_id
      );
    });

    const isBlocked = !!blockedUser;
    const blockedAt = blockedUser?.blocked_at;

    return {
      ...member,
      presenceStatus: status,
      lastActive,
      isBlocked,
      blockedAt, // Add blocked timestamp for future use
    };
  });

  // Count of blocked members (using actual blockedUsers list)
  const blockedMembersCount = membersWithStatus.filter(
    (member) => member.isBlocked
  ).length;

  // Debug logging for blocked users
  console.log("[GroupInfoPanel] Blocked users data:", {
    blockedUsersCount: blockedUsers.length,
    blockedMembersCount,
    blockedUsers: blockedUsers.map((u) => ({
      user_id: u.user_id,
      blocked_at: u.blocked_at,
    })),
    allMembers: groupDetails.members.map((m) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.name,
    })),
    membersWithBlocks: membersWithStatus
      .filter((m) => m.isBlocked)
      .map((m) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.name,
        isBlocked: m.isBlocked,
        blockedAt: m.blockedAt,
      })),
    groupId: groupDetails.id,
  });

  // Additional debug: check each member against blocked users
  membersWithStatus.forEach((member) => {
    const userId = member.id || member.user_id || "";
    const blockedUser = blockedUsers.find(
      (bu) =>
        bu.user_id === userId ||
        bu.user_id === member.id ||
        bu.user_id === member.user_id
    );
    console.log(
      `[GroupInfoPanel] Member ${
        member.name
      } (${userId}): blocked=${!!blockedUser}`,
      {
        member: { id: member.id, user_id: member.user_id },
        blockedUser: blockedUser
          ? { user_id: blockedUser.user_id, blocked_at: blockedUser.blocked_at }
          : null,
      }
    );
  }); // Function to handle blocking a member with real API and confirmation dialog
  const handleBlockMember = async (memberId: string) => {
    // Find the member to show in confirmation dialog
    const memberToBlock = membersWithStatus.find((m) => m.id === memberId);
    if (!memberToBlock) return;

    // Show confirmation dialog using toast
    const confirmBlock = await new Promise<boolean>((resolve) => {
      toast(
        (t) => (
          <div className="flex flex-col">
            <p className="font-medium">Block User</p>
            <p className="text-sm text-gray-600 mb-2">
              Are you sure you want to block{" "}
              <span className="font-semibold">{memberToBlock.name}</span>? Their
              messages will be hidden in this group chat.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  resolve(true);
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Block
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

    if (!confirmBlock) return;

    try {
      // Call the API to block the user
      await blockGroupUser(groupDetails.id, memberId);

      // Show success notification
      toast.success(`User ${memberToBlock.name} blocked successfully`);

      // Close the dropdown
      setActiveDropdown(null);

      // Refresh blocked users list to ensure UI is up to date
      await getGroupBlocks(groupDetails.id);

      console.log("[GroupInfoPanel] User blocked, blocked users updated");
    } catch (error: any) {
      console.error("Error blocking user:", error);
      toast.error(error.message || "Failed to block user");
    }
  };

  // Function to handle unblocking a member with real API
  const handleUnblockMember = async (memberId: string) => {
    try {
      // Call the API to unblock the user
      await unblockGroupUser(groupDetails.id, memberId);

      // Show success notification
      toast.success("User unblocked successfully");

      // Close the dropdown
      setActiveDropdown(null);

      // Refresh blocked users list to ensure UI is up to date
      await getGroupBlocks(groupDetails.id);

      console.log("[GroupInfoPanel] User unblocked, blocked users updated");
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      toast.error(error.message || "Failed to unblock user");
    }
  };

  const toggleFriendSelection = (id: string) => {
    setSelectedFriends((prevSelected) => {
      const isCurrentlySelected = prevSelected.some(
        (friend) => friend.id === id
      );
      if (isCurrentlySelected) {
        // Remove from selection
        return prevSelected.filter((friend) => friend.id !== id);
      } else {
        // Add to selection
        const friendToAdd = apiFriends.find((friend) => friend.id === id);
        if (friendToAdd) {
          return [...prevSelected, { ...friendToAdd, selected: true }];
        }
        return prevSelected;
      }
    });
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) {
      toast.error("Please select at least one friend to add");
      return;
    }

    try {
      const memberIds = selectedFriends.map((friend) => friend.id);
      await addGroupMembers(groupDetails.id, memberIds);

      // Update local group details with new members
      const newMembers = selectedFriends.map((friend) => ({
        id: friend.id,
        name: friend.name || friend.username,
        status: "offline" as const,
        role: "member" as const,
        avatar_url: friend.avatar_url || friend.profile_picture_url,
        user_id: friend.id,
      }));

      setGroupDetails((prev) => ({
        ...prev,
        members: [...prev.members, ...newMembers],
        memberCount: prev.memberCount + selectedFriends.length,
      }));

      // Reset selection and close popup
      setSelectedFriends([]);
      setShowAddMemberPopup(false);
      setSearchQuery("");

      toast.success(`${selectedFriends.length} member(s) added to the group!`);

      // Call the update callback if provided
      if (onUpdateGroup) {
        onUpdateGroup(groupDetails.id, {
          members: [...groupDetails.members, ...newMembers],
          memberCount: groupDetails.memberCount + selectedFriends.length,
        });
      }
    } catch (error: any) {
      console.error("Error adding members:", error);
      toast.error(error.message || "Failed to add members to the group");
    }
  };

  // Current media index for navigation
  const currentMediaIndex = selectedMedia
    ? groupMedia.findIndex((item) => item.id === selectedMedia.id)
    : -1;

  const hasPreviousMedia = currentMediaIndex > 0;
  const hasNextMedia = currentMediaIndex < groupMedia.length - 1;

  const navigateMedia = (direction: "prev" | "next") => {
    if (!selectedMedia) return;

    if (direction === "prev" && currentMediaIndex > 0) {
      setSelectedMedia(groupMedia[currentMediaIndex - 1]);
    } else if (
      direction === "next" &&
      currentMediaIndex < groupMedia.length - 1
    ) {
      setSelectedMedia(groupMedia[currentMediaIndex + 1]);
    }
  };

  // Format file size for display
  const formatFileSize = (sizeStr?: string): string => {
    if (!sizeStr) return "Unknown size";
    return sizeStr;
  };

  // Function to get thumbnail URL (mock implementation)
  const getThumbnailUrl = (fileId: string): string => {
    const media = groupMedia.find((item) => item.id === fileId);
    return media?.url || "https://via.placeholder.com/150";
  };

  // Function to get file URL (mock implementation)
  const getFileUrl = (fileId: string): string => {
    const media = groupMedia.find((item) => item.id === fileId);
    return media?.url || "#";
  };

  // Function to download a file (mock implementation)
  const downloadFile = (fileId: string) => {
    toast.success(`File download started: ${fileId}`);
  };

  // Function to share a file with users
  const shareFileWithUsers = async ({
    fileId,
    userIds,
  }: {
    fileId: string;
    userIds: string[];
  }) => {
    toast.success(`File shared with ${userIds.length} users`);
    return true;
  };

  // Function to show share dialog
  const showShareDialog = (file: MediaItem) => {
    setSelectedFile(file);
    setShowShareModal(true);
    // TODO: Implement share functionality with API friends
    console.log("Share dialog opened for file:", file);
  };

  // Function to close share dialog
  const closeShareDialog = () => {
    setShowShareModal(false);
    setSelectedFile(null);
  };

  // Function to handle file sharing
  const handleShareFile = async () => {
    if (!selectedFile) return;

    // TODO: Implement file sharing with API friends
    toast.success("File sharing feature coming soon!");
    closeShareDialog();
  };

  // Function to toggle friend share selection
  const toggleShareSelection = (id: string) => {
    // TODO: Implement share selection with API friends
    console.log("Toggle share selection for friend:", id);
  };

  // Function to open media preview
  const openMediaPreview = (media: MediaItem) => {
    setSelectedMedia(media);
    setShowMediaPreview(true);
  };

  // Function to close media preview
  const closeMediaPreview = () => {
    setShowMediaPreview(false);
    setSelectedMedia(null);
  };

  return (
    <div className="w-80 h-full border-l border-gray-200 bg-white overflow-y-auto shadow-lg">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center">
            {groupDetails.avatar_url ? (
              <img
                src={groupDetails.avatar_url}
                alt={groupDetails.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUsers className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <h2 className="text-xl text-black font-semibold">{groupName}</h2>
          <p className="text-gray-500 text-sm">{groupDetails.description}</p>
        </div>
      </div>

      {/* Members Section */}
      <div className="border-b border-gray-200">
        <div
          className="p-4 flex justify-between items-center cursor-pointer"
          onClick={() =>
            setExpandedSection(expandedSection === "members" ? null : "members")
          }
        >
          <div className="flex items-center">
            <h3 className="font-medium text-black">
              Members{" "}
              <span className="text-gray-500">
                ({groupDetails.memberCount})
              </span>
            </h3>
          </div>
          <div className="text-gray-500 text-sm">
            {expandedSection === "members" ? "▲" : "▼"}
          </div>
        </div>

        {expandedSection === "members" && (
          <div className="px-4 pb-4">
            {blockedMembersCount > 0 && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center text-red-700">
                  <FaBan className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">
                    {blockedMembersCount} member
                    {blockedMembersCount > 1 ? "s" : ""} blocked
                  </span>
                </div>
                <p className="text-xs text-red-600 mt-1">
                  Blocked members cannot send or receive messages in this group
                </p>
              </div>
            )}

            <button
              onClick={() => setShowAddMemberPopup(true)}
              className="mb-4 flex items-center text-blue-500 hover:text-blue-600 text-sm"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                <FaUserPlus className="h-4 w-4" />
              </div>
              Add Member
            </button>

            <div className="space-y-3">
              {membersWithStatus.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                    member.isBlocked
                      ? "bg-red-50 border border-red-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center">
                    <div className="relative mr-3">
                      <div
                        className={`w-8 h-8 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center ${
                          member.isBlocked ? "opacity-60 grayscale" : ""
                        }`}
                      >
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FaUser className="h-4 w-4 text-gray-500" />
                        )}
                      </div>

                      {/* Blocked indicator overlay */}
                      {member.isBlocked && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-20 rounded-full">
                          <FaBan className="h-3 w-3 text-red-600" />
                        </div>
                      )}

                      {/* Status indicator - only show if not blocked */}
                      {!member.isBlocked && (
                        <div
                          className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white ${
                            member.presenceStatus === "online"
                              ? "bg-green-500"
                              : member.presenceStatus === "busy"
                              ? "bg-red-500"
                              : member.presenceStatus === "away"
                              ? "bg-yellow-500"
                              : "bg-gray-400"
                          }`}
                        ></div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            member.isBlocked
                              ? "text-gray-500 line-through"
                              : "text-black"
                          }`}
                        >
                          {member.name}
                        </span>
                        {member.isBlocked && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                            Blocked
                          </span>
                        )}
                      </div>

                      {!member.isBlocked && (
                        <>
                          {member.presenceStatus === "online" ? (
                            <span className="text-xs text-green-500 font-medium">
                              Online
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {member.lastActive}
                            </span>
                          )}
                        </>
                      )}

                      {member.isBlocked && (
                        <span className="text-xs text-red-500">
                          User blocked • Cannot receive messages
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      className={`p-1 rounded-full transition-colors ${
                        member.isBlocked
                          ? "text-red-400 hover:text-red-600 hover:bg-red-100"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMemberDropdown(member.id);
                      }}
                    >
                      <FaEllipsisV className="h-3 w-3" />
                    </button>

                    {activeDropdown === member.id && (
                      <div
                        ref={dropdownRef}
                        className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden"
                      >
                        <button
                          className={`flex w-full text-left px-4 py-3 text-sm items-center transition-colors ${
                            member.isBlocked
                              ? "hover:bg-green-50 text-green-700"
                              : "hover:bg-red-50 text-red-700"
                          }`}
                          onClick={() =>
                            member.isBlocked
                              ? handleUnblockMember(member.id)
                              : handleBlockMember(member.id)
                          }
                          disabled={loading}
                        >
                          {member.isBlocked ? (
                            <>
                              <FaCheck className="mr-3 h-4 w-4 text-green-600" />
                              <div className="flex flex-col">
                                <span className="font-medium text-green-700">
                                  Unblock User
                                </span>
                                <span className="text-xs text-green-600">
                                  Allow messages again
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <FaBan className="mr-3 h-4 w-4 text-red-600" />
                              <div className="flex flex-col">
                                <span className="font-medium text-red-700">
                                  Block User
                                </span>
                                <span className="text-xs text-red-600">
                                  Stop receiving messages
                                </span>
                              </div>
                            </>
                          )}

                          {loading && (
                            <div className="ml-auto">
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50"></div>
                            </div>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Media Section */}
      <div className="border-t border-gray-200 pt-6">
        {/* Enhanced Blocked Users Section with better UX - Show only if there are blocked users */}
        {membersWithStatus.some((member) => member.isBlocked) && (
          <div className="mb-6 bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-red-700 flex items-center">
                  <FaBan className="mr-2" />
                  Blocked Users
                  <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                    {membersWithStatus.filter((m) => m.isBlocked).length}
                  </span>
                </h3>
                <p className="text-xs text-red-600 mt-1">
                  Messages from these users are hidden in the chat
                </p>
              </div>
            </div>

            <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {membersWithStatus
                .filter((member) => member.isBlocked)
                .map((member) => (
                  <div
                    key={`blocked-${member.id}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-white border border-red-100 shadow-sm"
                  >
                    <div className="flex items-center">
                      {/* User avatar with blocked indicator */}
                      <div className="relative">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover opacity-60 grayscale"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center opacity-60">
                            <FaUser className="text-gray-500" />
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          <FaBan className="text-white text-xs" />
                        </div>
                      </div>

                      <div className="ml-3">
                        <p className="font-medium text-gray-800 line-through">
                          {member.name}
                        </p>
                        <p className="text-xs text-red-500">
                          Blocked on{" "}
                          {member.blockedAt
                            ? new Date(member.blockedAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )
                            : "unknown date"}
                        </p>
                      </div>
                    </div>

                    <button
                      className="text-green-600 hover:text-green-800 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded text-xs font-medium flex items-center transition duration-150"
                      onClick={() => handleUnblockMember(member.id)}
                      disabled={loading}
                    >
                      <FaCheck className="mr-1.5" />
                      Unblock
                      {loading && (
                        <div className="ml-1.5">
                          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <h3 className="text-lg font-semibold mb-4">Media</h3>

        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium text-black">
            Media
            <span className="text-gray-500 text-sm">
              {" "}
              ({groupMedia.length})
            </span>
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
          {isLoadingMedia ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : groupMedia.length === 0 ? (
            <div className="py-4 text-center text-gray-500">No media files</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {groupMedia.slice(0, 3).map((item) => (
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
            <span className="text-gray-500 text-sm">
              {" "}
              ({groupFiles.length})
            </span>
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
          {isLoadingFiles ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : groupFiles.length === 0 ? (
            <div className="py-4 text-center text-gray-500">No files</div>
          ) : (
            <div className="space-y-3">
              {groupFiles.slice(0, 3).map((file) => (
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
                      onClick={() => downloadFile(file.id)}
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

      {/* Add Member Popup */}
      {showAddMemberPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Members</h2>
              <button
                onClick={() => setShowAddMemberPopup(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
              {friendsLoading ? (
                <div className="p-4 text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Loading friends...</p>
                </div>
              ) : friendsError ? (
                <div className="p-4 text-center text-red-500">
                  <p className="text-sm">Failed to load friends</p>
                  <button
                    onClick={getFriends}
                    className="text-blue-500 text-xs mt-1 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {searchQuery
                    ? "No friends found matching your search"
                    : "No friends available to add"}
                </div>
              ) : (
                filteredFriends.map((friend) => {
                  const isSelected = selectedFriends.some(
                    (selected) => selected.id === friend.id
                  );
                  return (
                    <div
                      key={friend.id}
                      className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${
                        isSelected ? "bg-blue-50" : ""
                      }`}
                      onClick={() => toggleFriendSelection(friend.id)}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center">
                          {friend.avatar_url || friend.profile_picture_url ? (
                            <img
                              src={
                                friend.avatar_url || friend.profile_picture_url
                              }
                              alt={friend.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FaUser className="h-5 w-5 text-gray-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{friend.name}</p>
                          <p className="text-gray-500 text-xs">
                            @{friend.username}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <FaCheck className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddMemberPopup(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={selectedFriends.length === 0 || loading}
              >
                {loading
                  ? "Adding..."
                  : `Add ${
                      selectedFriends.length > 0
                        ? `(${selectedFriends.length})`
                        : ""
                    } to Group`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {showMediaPreview && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
          <div className="bg-white rounded-lg overflow-hidden shadow-lg max-w-3xl w-full">
            <div className="relative">
              <img
                src={selectedMedia?.url}
                alt={selectedMedia?.name}
                className="w-full h-auto max-h-[70vh] object-contain"
              />
              <button
                onClick={closeMediaPreview}
                className="absolute top-3 right-3 p-2 rounded-full bg-white bg-opacity-80 hover:bg-opacity-100"
              >
                <X className="h-5 w-5 text-gray-800" />
              </button>

              {/* Navigation arrows */}
              {hasPreviousMedia && (
                <button
                  onClick={() => navigateMedia("prev")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {hasNextMedia && (
                <button
                  onClick={() => navigateMedia("next")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black bg-opacity-50 hover:bg-opacity-70 text-white"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            <div className="p-4 bg-white">
              <h3 className="text-lg font-semibold">{selectedMedia?.name}</h3>
              <p className="text-sm text-gray-500">{selectedMedia?.size}</p>

              <div className="flex space-x-3 mt-3">
                <button
                  onClick={() =>
                    selectedMedia && downloadFile(selectedMedia.id)
                  }
                  className="px-4 py-2 bg-blue-500 text-white rounded-md flex items-center hover:bg-blue-600"
                >
                  <FaDownload className="mr-2" />
                  Download
                </button>

                <button
                  onClick={() =>
                    selectedMedia && showShareDialog(selectedMedia)
                  }
                  className="px-4 py-2 bg-green-500 text-white rounded-md flex items-center hover:bg-green-600"
                >
                  <FaShareAlt className="mr-2" />
                  Share
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
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-4 text-center text-gray-500">
                <p>File sharing feature coming soon!</p>
                <p className="text-sm mt-2">
                  This feature will be available with the next update.
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleShareFile}
                className="px-4 py-2 bg-gray-300 text-gray-500 rounded hover:bg-gray-400 cursor-not-allowed"
                disabled={true}
              >
                Share (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      )}

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
              {isLoadingMoreMedia && (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {groupMedia.map((item) => (
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
                    onClick={() => {
                      setIsLoadingMoreMedia(true);
                      // Mock loading more media
                      setTimeout(() => {
                        setIsLoadingMoreMedia(false);
                        toast.success("More media loaded");
                      }, 1000);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    disabled={isLoadingMoreMedia}
                  >
                    {isLoadingMoreMedia ? "Loading..." : "Load More"}
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

              {/* File list for modal */}
              <div className="space-y-3">
                {groupFiles.map((file) => (
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
                    onClick={() => {
                      setIsLoadingMoreFiles(true);
                      // Mock loading more files
                      setTimeout(() => {
                        setIsLoadingMoreFiles(false);
                        toast.success("More files loaded");
                      }, 1000);
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
    </div>
  );
}
