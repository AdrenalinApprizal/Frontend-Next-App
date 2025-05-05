"use client";

import { useState } from "react";
import { Search, UserPlus, Check, X, Users } from "lucide-react";
import { FaUsers, FaUser, FaTimes } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";

// Interface for group data
interface Group {
  id: string;
  name: string;
  lastActivity: string;
  memberCount: number;
  avatar?: string;
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

  // Mock friends data for group creation
  const [friends, setFriends] = useState<Friend[]>([
    { id: "1", name: "Izhar Alif", username: "izhar", avatar: undefined },
    { id: "2", name: "Budi Santoso", username: "budi", avatar: undefined },
    { id: "3", name: "Anita Wijaya", username: "anita", avatar: undefined },
    { id: "4", name: "Dimas Prakoso", username: "dimas", avatar: undefined },
    { id: "5", name: "Lina Susanti", username: "lina", avatar: undefined },
  ]);

  // Mock data for groups list
  const [groups, setGroups] = useState<Group[]>([
    {
      id: "1",
      name: "Project Alpha Team",
      lastActivity: "Just now",
      memberCount: 8,
      avatar: undefined,
    },
    {
      id: "2",
      name: "Marketing Department",
      lastActivity: "5 minutes ago",
      memberCount: 15,
      avatar: undefined,
    },
    {
      id: "3",
      name: "Frontend Developers",
      lastActivity: "1 hour ago",
      memberCount: 6,
      avatar: undefined,
    },
    {
      id: "4",
      name: "Design Team",
      lastActivity: "Yesterday",
      memberCount: 4,
      avatar: undefined,
    },
    {
      id: "5",
      name: "Company Announcements",
      lastActivity: "Apr 28",
      memberCount: 42,
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

  // Handler for creating a group
  const handleCreateGroup = () => {
    // Here you would typically make an API call to create the group
    // For now, we'll just close the popup
    setShowCreateGroupPopup(false);

    // Reset form fields
    const selectedFriends = friends
      .filter((friend) => friend.selected)
      .map((friend) => friend.name);
    const friendsList =
      selectedFriends.length > 1
        ? selectedFriends.slice(0, -1).join(", ") +
          " and " +
          selectedFriends.slice(-1)
        : selectedFriends[0];

    toast.success(`Group "${groupName}" created with ${friendsList}`);

    setGroupName("");
    setGroupDescription("");
    // Reset selected friends
    setFriends(friends.map((friend) => ({ ...friend, selected: false })));
  };

  // Handler for toggling friend selection
  const toggleFriendSelection = (id: string) => {
    setFriends(
      friends.map((friend) =>
        friend.id === id ? { ...friend, selected: !friend.selected } : friend
      )
    );
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
        <button
          onClick={() => setShowCreateGroupPopup(true)}
          className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
          aria-label="Create Group"
        >
          <UserPlus size={16} />
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search groups"
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Group Invitations Section */}
      {groupInvitations.length > 0 && (
        <div className="mb-5">
          {invitationsHidden ? (
            // Collapsed view - shows a summary with count
            <div
              className="border border-blue-200 rounded-xl shadow-sm overflow-hidden cursor-pointer hover:bg-blue-50 transition-all"
              onClick={() => setInvitationsHidden(false)}
            >
              <div className="p-4 flex items-center justify-between bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-6 bg-blue-500 rounded-r"></div>
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <span className="font-semibold text-gray-800 text-sm">
                        Group Invitations
                      </span>
                      <span className="ml-2 bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {groupInvitations.length}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {groupInvitations.length === 1
                        ? `Invitation to join "${groupInvitations[0].name}"`
                        : `Invitations to "${groupInvitations[0].name}" and ${
                            groupInvitations.length - 1
                          } other${groupInvitations.length > 2 ? "s" : ""}`}
                    </p>
                  </div>
                </div>
                <div className="text-blue-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            // Expanded view - shows all group invitations
            <>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <div className="w-1 h-6 bg-blue-500 rounded-r mr-2"></div>
                  <h2 className="font-semibold text-gray-800 text-sm">
                    Group Invitations{" "}
                    <span className="ml-1 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                      {groupInvitations.length}
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => setInvitationsHidden(true)}
                  className="text-xs text-blue-500 hover:text-blue-700 transition-colors flex items-center"
                >
                  <span>Collapse</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3 w-3 ml-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
              </div>
              <div className="border border-blue-200 rounded-xl shadow-sm divide-y divide-gray-200 overflow-hidden">
                {groupInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="p-4 bg-white hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 to-blue-600 mr-4 flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm">
                          {invitation.avatar ? (
                            <img
                              src={invitation.avatar}
                              alt={invitation.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FaUsers className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {invitation.name}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center mt-1">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-3 w-3 mr-1"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Invited by {invitation.invitedBy}
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRejectInvitation(invitation.id)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-red-100 hover:text-red-600 transition-all transform hover:scale-105"
                          aria-label="Reject Invitation"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 hover:text-blue-700 transition-all transform hover:scale-105"
                          aria-label="Accept Invitation"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 ml-16">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                        <svg
                          className="mr-1.5 h-2 w-2 text-blue-400"
                          fill="currentColor"
                          viewBox="0 0 8 8"
                        >
                          <circle cx="4" cy="4" r="3" />
                        </svg>
                        New Group
                      </span>
                    </div>
                  </div>
                ))}
                {groupInvitations.length > 0 && (
                  <div className="bg-gray-50 p-3 text-center">
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {groupInvitations.length > 2
                        ? "View all invitations"
                        : "Manage invitations"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Groups list */}
      <div className="flex-1 overflow-auto">
        {filteredGroups.length === 0 ? (
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
              <Link
                key={group.id}
                href={`/chat/messages/${group.id}?type=group`}
              >
                <div
                  className={`flex items-center p-4 rounded-lg transition-colors ${
                    pathname === `/chat/messages/${group.id}?type=group`
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Group avatar */}
                  <div className="mr-3">
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
                        {group.lastActivity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-1">
                      {group.memberCount} members
                    </p>
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
                <FaTimes size={16} />
              </button>
            </div>

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
                Select Friends
              </label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                {friends.map((friend) => (
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
                    <input
                      type="checkbox"
                      checked={!!friend.selected}
                      onChange={() => {}} // Handled by the div onClick
                      className="h-4 w-4 text-blue-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateGroupPopup(false)}
                className="px-4 py-2 mr-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                disabled={!groupName.trim() || !friends.some((f) => f.selected)}
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
