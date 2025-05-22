"use client";

import { useState, useEffect, useRef } from "react";
import { Search, UserPlus, Check, X, Plus, Users } from "lucide-react";
import { FaUsers, FaUser, FaTimes } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { useGroup, Group as ApiGroup } from "@/hooks/auth/useGroup";
import { useFriendship } from "@/hooks/auth/useFriends";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationDropdown } from "@/components/notification-dropdown";

// Interface for group data
interface Group {
  id: string;
  name: string;
  lastActivity: string;
  memberCount: number;
  avatar?: string;
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count?: number;
}

// Interface for group invitation data
interface GroupInvitation {
  id: string;
  name: string;
  invitedBy: string;
  avatar?: string;
}

// Interface for friend data used in group creation
interface Friend {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  selected?: boolean;
}

export function GroupsList() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [invitationsHidden, setInvitationsHidden] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");

  // Avatar related state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Form validation errors
  const [errors, setErrors] = useState<{
    name?: string;
    members?: string;
    avatar?: string;
    general?: string;
  }>({});

  const [error, setError] = useState<string | null>(null);

  // Fetch groups using React Query and our useGroup hook
  const {
    getGroups,
    groups: hookGroups,
    loading: groupsLoading,
    error: groupsError,
  } = useGroup();

  // Fetch all groups on component mount
  useEffect(() => {
    getGroups();
  }, []);

  // Fetch friends using useFriendship hook
  const {
    friends: hookFriends,
    loading: friendsLoading,
    getFriends,
  } = useFriendship();

  // Load friends data on component mount
  useEffect(() => {
    getFriends();
  }, []);

  // Format timestamp for last message - matches Vue template
  const formatTimestamp = (dateString: string) => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();

      if (isToday) {
        // Format as time if today - like h:mm a (2:30 PM)
        return date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        // Format as relative time
        return formatLastActivity(dateString);
      }
    } catch (error) {
      return dateString;
    }
  };

  // Update groups state when data is fetched
  useEffect(() => {
    if (hookGroups) {
      const formattedGroups: Group[] = hookGroups.map((group: ApiGroup) => ({
        id: group.id,
        name: group.name,
        lastActivity: formatLastActivity(group.updated_at),
        memberCount: group.member_count,
        avatar: group.avatar_url,
        last_message: group.last_message,
        unread_count: group.unread_count,
      }));
      setGroups(formattedGroups);
    }
  }, [hookGroups]);

  // Update friends state when data is fetched
  useEffect(() => {
    if (hookFriends) {
      const formattedFriends: Friend[] = hookFriends.map((friend: any) => ({
        id: friend.id,
        name: friend.full_name || friend.username,
        username: friend.username,
        avatar: friend.avatar_url,
        selected: false,
      }));
      setFriends(formattedFriends);
    }
  }, [hookFriends]);

  // Format the last activity date
  const formatLastActivity = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();

    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return "Just now";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      if (days === 1) return "Yesterday";
      return `${days} days ago`;
    } else {
      // Format as month and day
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  };

  // Group invitations data
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([
    {
      id: "inv1",
      name: "Development Team",
      invitedBy: "Izhar Alif",
      avatar: undefined,
    },
    {
      id: "inv2",
      name: "UI/UX Discussion",
      invitedBy: "Izhar Alif",
      avatar: undefined,
    },
  ]);

  // Handler for accepting group invitation
  const handleAcceptInvitation = (invitationId: string) => {
    const invitation = groupInvitations.find((inv) => inv.id === invitationId);

    setGroupInvitations((prevInvitations) =>
      prevInvitations.filter((invitation) => invitation.id !== invitationId)
    );

    // Show success toast notification
    if (invitation) {
      toast.success(`You've joined "${invitation.name}"`);
    }

    // In a real app, you would also call an API to accept the invitation and add the group to your list
  };

  // Handler for rejecting group invitation
  const handleRejectInvitation = (invitationId: string) => {
    const invitation = groupInvitations.find((inv) => inv.id === invitationId);

    setGroupInvitations((prevInvitations) =>
      prevInvitations.filter((invitation) => invitation.id !== invitationId)
    );

    // Show info toast notification
    if (invitation) {
      toast.success(`Invitation to "${invitation.name}" declined`);
    }

    // In a real app, you would also call an API to reject the invitation
  };

  const {
    createGroup,
    loading: groupCreationLoading,
    error: groupCreationError,
  } = useGroup();

  // Filtered friends based on search
  const filteredFriends = friends.filter(
    (friend) =>
      !friendSearch ||
      friend.name.toLowerCase().includes(friendSearch.toLowerCase()) ||
      friend.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  // Validate form before submission
  const validateForm = () => {
    const formErrors: {
      name?: string;
      members?: string;
      avatar?: string;
      general?: string;
    } = {};

    if (!groupName.trim()) {
      formErrors.name = "Group name is required";
    }

    const selectedCount = friends.filter((friend) => friend.selected).length;
    if (selectedCount === 0) {
      formErrors.members = "Please select at least one member";
    }

    setErrors(formErrors);
    return Object.keys(formErrors).length === 0;
  };

  // Handler for creating a group
  const handleCreateGroup = async () => {
    // Validate form
    if (!validateForm()) return;

    try {
      setIsCreating(true);
      setError(null);

      // Get selected friend IDs
      const selectedFriendIds = friends
        .filter((friend) => friend.selected)
        .map((friend) => friend.id);

      // Create group with the useGroup hook
      await createGroup({
        name: groupName,
        description: groupDescription,
        members: selectedFriendIds,
        avatar: avatarFile,
      });

      // Show success toast
      toast.success(`Group "${groupName}" created successfully`);

      // Reset form and close popup
      resetForm();
      setShowCreateGroupPopup(false);
    } catch (error: any) {
      console.error("Error creating group:", error);
      setErrors({
        general: error.message || "Failed to create group. Please try again.",
      });
      toast.error("Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  // Reset form fields
  const resetForm = () => {
    setGroupName("");
    setGroupDescription("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setFriendSearch("");
    setFriends(friends.map((friend) => ({ ...friend, selected: false })));
    setErrors({});

    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  // Clear avatar selection
  const clearAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  // Toggle friend selection for the group
  const toggleFriendSelection = (id: string) => {
    setFriends((prevFriends) =>
      prevFriends.map((friend) =>
        friend.id === id ? { ...friend, selected: !friend.selected } : friend
      )
    );
  };

  // Handle avatar upload
  const handleAvatarUpload = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  // Process avatar changes
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setAvatarFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(null);
    }
  };

  // Filter groups based on search query
  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort groups alphabetically (A-Z)
  const sortedGroups = [...filteredGroups].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action button */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Groups</h1>
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <NotificationDropdown />
          </div>
          <button
            onClick={() => setShowCreateGroupPopup(true)}
            className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors shadow-sm"
            aria-label="Create Group"
          >
            <Plus size={18} className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups"
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
        />
      </div>

      {/* Group Invitations Section */}
      {groupInvitations.length > 0 && (
        <div className="mb-5">{/* ...existing code for invitations... */}</div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-auto">
        {groupsLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
            <p className="text-gray-500">Loading groups...</p>
          </div>
        ) : groupsError ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <FaUsers className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-red-500 font-medium">Failed to load groups</p>
            <p className="text-sm text-gray-400 mt-2">Please try again later</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <FaUsers className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : "No groups yet"}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Create a group to start collaborating
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGroups.map((group) => (
              <Link key={group.id} href={`/chat/groups/${group.id}`}>
                <div
                  className={`flex items-center p-4 rounded-lg transition-colors ${
                    pathname === `/chat/groups/${group.id}`
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Group avatar */}
                  <div className="relative mr-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {group.avatar ? (
                        <img
                          src={group.avatar}
                          alt={group.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FaUsers className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </div>

                  {/* Group info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {group.name}
                      </h3>
                      <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">
                        {group.last_message
                          ? formatTimestamp(group.last_message.created_at)
                          : group.lastActivity}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      {group.last_message ? (
                        <p className="text-xs text-gray-600 truncate max-w-[80%]">
                          <span className="font-medium">
                            {group.last_message.sender_name}
                          </span>
                          : {group.last_message.content}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 italic">
                          No messages yet
                        </p>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {group.memberCount}
                      </span>
                    </div>
                    {group.unread_count && group.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 ml-2 text-xs font-medium leading-none text-red-100 bg-red-600 rounded-full">
                        {group.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Popup */}
      {showCreateGroupPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Create a Group
              </h2>
              <button
                onClick={() => setShowCreateGroupPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {errors.general && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
                {errors.general}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Enter group description"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition-all"
                rows={2}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Avatar
              </label>
              <div className="flex items-center">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center border border-gray-300">
                  {avatarPreview ? (
                    <img
                      src={avatarPreview}
                      alt="Avatar Preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Users size={36} className="text-gray-400" />
                  )}
                </div>
                <div className="ml-5">
                  <button
                    onClick={handleAvatarUpload}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Upload Image
                  </button>
                  {avatarPreview && (
                    <p className="mt-2 text-xs text-gray-500">
                      <button
                        onClick={clearAvatar}
                        className="text-red-500 hover:underline"
                      >
                        Remove
                      </button>
                    </p>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  ref={avatarInputRef}
                  className="hidden"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Friends
              </label>
              {friends.length === 0 ? (
                <div className="text-sm text-gray-500 p-2">
                  No friends to add. Add some friends first.
                </div>
              ) : (
                <div>
                  <div className="relative mb-2">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      placeholder="Search friends..."
                      className="w-full pl-10 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredFriends.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">
                        No friends found
                      </div>
                    ) : (
                      filteredFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className={`flex items-center p-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                            friend.selected ? "bg-blue-50" : ""
                          }`}
                          onClick={() => toggleFriendSelection(friend.id)}
                        >
                          <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex-shrink-0 flex items-center justify-center">
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
                          <div className="flex-1">
                            <p className="font-medium text-sm">{friend.name}</p>
                            <p className="text-xs text-gray-500">
                              @{friend.username}
                            </p>
                          </div>
                          {friend.selected && (
                            <div className="h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {errors.members && (
                <p className="mt-1 text-sm text-red-500">{errors.members}</p>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateGroupPopup(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                disabled={isCreating}
              >
                {!isCreating ? (
                  <>
                    <Users size={16} className="mr-2" />
                    <span>Create Group</span>
                  </>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    <span>Creating...</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
