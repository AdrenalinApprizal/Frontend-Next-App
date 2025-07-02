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
import { useSession } from "next-auth/react";

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
  const { data: session } = useSession();

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

  // Attachments state
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedAttachment, setSelectedAttachment] =
    useState<AttachmentItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [friendsList, setFriendsList] = useState<Friend[]>([]);

  // Pagination state
  const [pagination, setPagination] = useState<Pagination>({
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
      blockedAt: blockedUser?.blocked_at, // Add blocked timestamp for future use
    };
  });

  // Count of blocked members (using actual blockedUsers list)
  const blockedMembersCount = membersWithStatus.filter(
    (member) => member.isBlocked
  ).length;

  

  // Additional debug: check each member against blocked users
  membersWithStatus.forEach((member) => {
    const userId = member.id || member.user_id || "";
    const blockedUser = blockedUsers.find(
      (bu) =>
        bu.user_id === userId ||
        bu.user_id === member.id ||
        bu.user_id === member.user_id
    );
    
  }); // Function to handle blocking a member with real API and confirmation dialog
  const handleBlockMember = async (memberId: string) => {
    // Find the member to show in confirmation dialog
    const memberToBlock = membersWithStatus.find((m) => m.id === memberId);
    if (!memberToBlock) return;

    // Handle if user wants to block themselves
    // Get current user ID from context, localStorage, or session
    const currentUserId = session?.user?.id || "";

    if (memberId === currentUserId || memberToBlock.user_id === currentUserId) {
      toast.error("You cannot block yourself", {
        duration: 3000,
        style: {
          background: "#fee2e2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
      });
      setActiveDropdown(null);
      return;
    }

    // Check if the member is an owner
    if (memberToBlock.role === "owner") {
      toast.error("You cannot block the group owner", {
        duration: 3000,
        style: {
          background: "#fee2e2",
          color: "#dc2626",
          border: "1px solid #fecaca",
        },
      });
      setActiveDropdown(null);
      return;
    }

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


      // Refresh the page after a timeout
      setTimeout(() => {
        window.location.reload();
      }, 500);
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


      // Refresh the page after a timeout
      setTimeout(() => {
        window.location.reload();
      }, 500);
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

  // Load data when group details change
  useEffect(() => {
    loadAttachments();
  }, [groupDetails.id]);

  // Load group attachments from message history
  const loadAttachments = async () => {
    if (!groupDetails?.id || isLoading) return;

    try {
      setIsLoading(true);

      // Fetch group message history to get attachments
      const response = await fetch(
        `/api/proxy/messages/history?type=group&target_id=${groupDetails.id}&limit=100`
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

      // Enhanced detection for file/attachment messages
      const attachmentMessages = messages.filter((msg: any) => {
        // Direct API documentation format
        if (msg.attachment_url && msg.message_type === "file") {
          return true;
        }

        // Fallback for messages with file type and attachment emoji
        if (msg.message_type === "file" && msg.content?.startsWith("📎 ")) {
          return true;
        }

        // Alternative API formats might use different properties
        if (msg.type === "file" || msg.type === "attachment") {
          return true;
        }

        // Look for URL-like properties in file messages
        if (
          (msg.file_url || msg.url || msg.media_url) &&
          (msg.message_type === "file" || msg.content?.startsWith("📎 "))
        ) {
          return true;
        }

        // Check for attachments array in some API structures
        if (
          msg.attachments &&
          Array.isArray(msg.attachments) &&
          msg.attachments.length > 0
        ) {
          return true;
        }

        return false;
      });


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

          // First try to get the direct attachment_url from the message
          let attachmentUrl = msg.attachment_url;

          // If no attachment_url provided, try alternative approach
          if (!attachmentUrl) {
            // Check if this message format includes file_id
            if (msg.file_id) {
              attachmentUrl = `/api/proxy/files/${msg.file_id}`;
            }
            // Extract URL from the object if it exists
            else if (typeof msg === "object" && msg !== null) {
              // Sometimes URL might be hidden in nested properties or with different names
              const possibleUrlProps = [
                "url",
                "file_url",
                "media_url",
                "download_url",
              ];
              for (const prop of possibleUrlProps) {
                if (msg[prop] && typeof msg[prop] === "string") {
                  attachmentUrl = msg[prop];
                  break;
                }
              }
            }
          }

          // Log warning if we still couldn't find a URL
          if (!attachmentUrl) {
            console.warn(
              `Message has file type but no attachment URL: ${JSON.stringify(
                msg
              )}`
            );
          }

          return {
            file_id: msg.message_id || msg.id,
            filename: filename,
            size: 0, // Size not available from message history
            mime_type: mimeType,
            url: attachmentUrl,
            uploaded_at:
              msg.sent_at || msg.created_at || new Date().toISOString(),
          };
        }
      );

      // Filter out any attachments without URLs
      const validAttachments = attachmentData.filter(
        (attachment) => !!attachment.url
      );

      setAttachments(validAttachments);

      // Set pagination
      setPagination({
        current_page: 1,
        total_pages: 1,
        total_items: validAttachments.length,
        items_per_page: validAttachments.length,
        has_more_pages: false,
      });

      setCurrentPage(1);
    } catch (error) {
      console.error("Error loading group attachments:", error);
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
      if (!attachment.url) {
        throw new Error("No download URL available for this attachment");
      }

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

  // Format file size for display
  const formatFileSize = (size: number): string => {
    if (!size) return "Unknown size";

    if (size < 1024) return `${size} bytes`;
    else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    else if (size < 1024 * 1024 * 1024)
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    else return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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

  // Handle sharing file
  const handleShareFile = async () => {
    if (!selectedAttachment) return;

    const selectedFriendIds = friendsList
      .filter((friend) => friend.shareSelected)
      .map((friend) => friend.id);

    if (selectedFriendIds.length === 0) {
      toast.error("Please select at least one friend to share with");
      return;
    }

    toast.success("File sharing feature coming soon!");
    closeShareDialog();
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

  // Attachment preview functions
  const openAttachmentPreview = (attachment: AttachmentItem) => {
    setSelectedAttachment(attachment);
    setShowPreview(true);
  };

  const closeAttachmentPreview = () => {
    setShowPreview(false);
    setSelectedAttachment(null);
  };

  // Helper function to check if attachment is an image
  const isImage = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  const currentAttachmentIndex = selectedAttachment
    ? attachments.findIndex(
        (item) => item.file_id === selectedAttachment.file_id
      )
    : -1;

  const hasPreviousAttachment = currentAttachmentIndex > 0;
  const hasNextAttachment = currentAttachmentIndex < attachments.length - 1;

  const navigateAttachment = (direction: "prev" | "next") => {
    const currentIndex = currentAttachmentIndex;
    if (currentIndex === -1) return;

    if (direction === "prev" && currentIndex > 0) {
      setSelectedAttachment(attachments[currentIndex - 1]);
    } else if (direction === "next" && currentIndex < attachments.length - 1) {
      setSelectedAttachment(attachments[currentIndex + 1]);
    }
  };

  // Initialize friends list for sharing
  useEffect(() => {
    if (apiFriends && apiFriends.length > 0) {
      setFriendsList(
        apiFriends.map((friend) => ({
          ...friend,
          shareSelected: false,
        }))
      );
    }
  }, [apiFriends]);

  return (
    <div className="w-full h-full border-l border-gray-200 bg-white overflow-y-auto shadow-lg">
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
                  {member.id != session?.user.id && (
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
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-black font-medium">
            Attachments
            <span className="text-gray-500 text-sm">
              {" "}
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
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://via.placeholder.com/100?text=Image";
                          }}
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
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showShareDialog(attachment);
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
                            onError={(e) => {
                              e.currentTarget.src =
                                "https://via.placeholder.com/100?text=Image";
                            }}
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
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
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
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          showShareDialog(attachment);
                        }}
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

      {/* Media Preview Modal - Removed outdated references, kept only attachment preview */}
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
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/400?text=Image+Not+Available";
                  }}
                />
              ) : (
                <div className="bg-white rounded-lg p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <FaFile className="h-8 w-8 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {selectedAttachment.filename}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {formatFileSize(selectedAttachment.size)}
                  </p>
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

                <button
                  onClick={() => showShareDialog(selectedAttachment)}
                  className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 flex items-center"
                >
                  <FaShareAlt className="h-4 w-4 mr-2" />
                  Share
                </button>
              </div>

              {/* Navigation arrows */}
              {hasPreviousAttachment && (
                <div className="absolute inset-y-0 left-0 flex items-center">
                  <button
                    onClick={() => navigateAttachment("prev")}
                    className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                </div>
              )}

              {hasNextAttachment && (
                <div className="absolute inset-y-0 right-0 flex items-center">
                  <button
                    onClick={() => navigateAttachment("next")}
                    className="bg-black bg-opacity-50 hover:bg-opacity-70 p-2 rounded-full text-white"
                  >
                    <ChevronRight className="h-6 w-6" />
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
                  {isImage(selectedAttachment.mime_type) ? (
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-200">
                      <img
                        src={selectedAttachment.url}
                        alt={selectedAttachment.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src =
                            "https://via.placeholder.com/100?text=Image";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-blue-100 flex items-center justify-center">
                      <FaFile className="h-5 w-5 text-blue-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {selectedAttachment.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(selectedAttachment.size)}
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
                        {friend.avatar_url || friend.profile_picture_url ? (
                          <img
                            src={
                              friend.avatar_url || friend.profile_picture_url
                            }
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
    </div>
  );
}
