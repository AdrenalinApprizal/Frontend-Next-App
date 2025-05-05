"use client";

import { useState } from "react";
import { Search, Plus, UserPlus, Users } from "lucide-react";
import { FaUser, FaTimes, FaUsers, FaEnvelope } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";

type MessageType = "friend" | "group";

// Tipe data untuk pesan
interface Message {
  id: string;
  sender: {
    name: string;
    avatar?: string;
  };
  content: string;
  timestamp: string;
  read: boolean;
  unreadCount?: number;
  type: MessageType; // Add type to distinguish between friend and group messages
}

// Interface untuk friend data
interface Friend {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  selected?: boolean;
}

export function MessagesList() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"all" | "friends" | "groups">(
    "all"
  );
  const [showNewChatPopup, setShowNewChatPopup] = useState(false);
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [showCreateGroupPopup, setShowCreateGroupPopup] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  // Mock friends data for group creation
  const [friends, setFriends] = useState<Friend[]>([
    { id: "1", name: "Izhar Alif", username: "izhar", avatar: undefined },
    { id: "2", name: "Budi Santoso", username: "budi", avatar: undefined },
    { id: "3", name: "Anita Wijaya", username: "anita", avatar: undefined },
    { id: "4", name: "Dimas Prakoso", username: "dimas", avatar: undefined },
    { id: "5", name: "Lina Susanti", username: "lina", avatar: undefined },
  ]);

  // Data dummy untuk contoh pesan
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: {
        name: "Izhar Alif",
      },
      content: "Halo, semoga project ini cepat selesai!",
      timestamp: "10:20 AM",
      read: true,
      unreadCount: 0,
      type: "friend",
    },
    {
      id: "2",
      sender: {
        name: "Budi Santoso",
      },
      content: "Kapan kita meeting lagi?",
      timestamp: "09:45 AM",
      read: true,
      unreadCount: 0,
      type: "friend",
    },
    {
      id: "3",
      sender: {
        name: "Anita Wijaya",
      },
      content: "Dokumen sudah saya kirim via email",
      timestamp: "Yesterday",
      read: false,
      unreadCount: 1,
      type: "friend",
    },
    {
      id: "4",
      sender: {
        name: "Frontend Developers",
      },
      content: "Tolong review PR saya ya",
      timestamp: "Yesterday",
      read: false,
      unreadCount: 3,
      type: "group",
    },
    {
      id: "5",
      sender: {
        name: "Project Alpha Team",
      },
      content: "Meeting diundur jadi besok ya",
      timestamp: "Apr 28",
      read: true,
      unreadCount: 0,
      type: "group",
    },
  ]);

  // Filter messages based on active tab
  const filteredMessages = messages.filter((message) => {
    if (activeTab === "all") return true;
    return message.type === activeTab.slice(0, -1); // removes the 's' from 'friends' or 'groups'
  });

  // Convert timestamp to comparable value for sorting by newest first
  const getTimestampValue = (timestamp: string): number => {
    // Current date references
    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    const yesterday = new Date(today - 86400000).getTime(); // 24 hours in milliseconds

    // Handle different timestamp formats
    if (timestamp.includes("AM") || timestamp.includes("PM")) {
      // It's a time from today
      return now.getTime();
    } else if (timestamp === "Yesterday") {
      return yesterday;
    } else if (
      timestamp.includes("Apr") ||
      timestamp.includes("May") ||
      timestamp.includes("Jun") ||
      timestamp.includes("Jul")
    ) {
      // It's a month/date format, convert to timestamp
      const currentYear = now.getFullYear();
      const dateObj = new Date(`${timestamp}, ${currentYear}`);
      return dateObj.getTime();
    }

    // Default (older messages)
    return 0;
  };

  // Sort messages from newest to oldest
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    return getTimestampValue(b.timestamp) - getTimestampValue(a.timestamp);
  });

  const toggleFriendSelection = (id: string) => {
    setFriends(
      friends.map((friend) =>
        friend.id === id ? { ...friend, selected: !friend.selected } : friend
      )
    );
  };

  const handleAddFriend = () => {
    // Here you would typically make an API call to search for the user
    // For now, we'll just close the popup
    setShowAddFriendPopup(false);
    setFriendUsername("");
    // Feedback would be shown in a real implementation
    alert(`Friend request sent to: ${friendUsername}`);
  };

  const handleCreateGroup = () => {
    // Here you would typically make an API call to create the group
    // For now, we'll just close the popup
    setShowCreateGroupPopup(false);
    setGroupName("");
    setGroupDescription("");
    // Reset selected friends
    setFriends(friends.map((friend) => ({ ...friend, selected: false })));
    // Feedback would be shown in a real implementation
    alert(`Group "${groupName}" created successfully!`);
  };

  // Function to open the appropriate popup based on selection
  const handleOption = (option: "friend" | "group") => {
    setShowNewChatPopup(false);
    if (option === "friend") {
      setShowAddFriendPopup(true);
    } else {
      setShowCreateGroupPopup(true);
    }
  };

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action button */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Messages</h1>
        <button
          onClick={() => setShowNewChatPopup(true)}
          className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
          title="New Chat"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex mb-5 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("all")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "friends"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Friends
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`py-2.5 px-5 text-sm font-medium transition-colors ${
            activeTab === "groups"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Groups
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search messages"
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
        />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-auto">
        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <FaEnvelope className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No messages yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Start a conversation with friends or groups
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedMessages.map((message) => (
              <Link
                key={message.id}
                href={
                  message.type === "friend"
                    ? `/chat/messages/${message.id}`
                    : `/chat/messages/${message.id}?type=group`
                }
              >
                <div
                  className={`flex items-start p-4 rounded-lg transition-colors ${
                    (message.type === "friend" &&
                      pathname === `/chat/messages/${message.id}`) ||
                    (message.type === "group" &&
                      pathname === `/chat/messages/${message.id}` &&
                      pathname.includes("type=group"))
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 mr-3 flex-shrink-0 flex items-center justify-center">
                    {message.sender.avatar ? (
                      <img
                        src={message.sender.avatar}
                        alt={message.sender.name}
                        className="h-full w-full object-cover"
                      />
                    ) : message.type === "friend" ? (
                      <FaUser className="h-5 w-5 text-gray-500" />
                    ) : (
                      <FaUsers className="h-5 w-5 text-gray-500" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row with name and timestamp */}
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {message.sender.name}
                      </h3>
                      <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">
                        {message.timestamp}
                      </span>
                    </div>

                    {/* Second row with message and badge */}
                    <div className="flex justify-between items-start mt-1">
                      <p className="text-xs text-gray-600 truncate flex-1">
                        {message.content}
                      </p>
                      {!message.read &&
                        message.unreadCount &&
                        message.unreadCount > 0 && (
                          <div className="ml-2 h-5 w-5 min-w-5 bg-blue-500 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0">
                            {message.unreadCount}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Chat Options Popup */}
      {showNewChatPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">New Chat</h2>
              <button
                onClick={() => setShowNewChatPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleOption("friend")}
                className="flex items-center w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="p-2 bg-blue-100 rounded-full mr-3">
                  <UserPlus size={20} className="text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Add a Friend</div>
                  <div className="text-xs text-gray-500">
                    Find and add new friends
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleOption("group")}
                className="flex items-center w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="p-2 bg-green-100 rounded-full mr-3">
                  <Users size={20} className="text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Create a Group</div>
                  <div className="text-xs text-gray-500">
                    Start a group conversation
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Friend Popup */}
      {showAddFriendPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 animate-fade-in">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Add a Friend
              </h2>
              <button
                onClick={() => setShowAddFriendPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={friendUsername}
                onChange={(e) => setFriendUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowAddFriendPopup(false)}
                className="px-4 py-2 mr-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFriend}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                disabled={!friendUsername.trim()}
              >
                Add Friend
              </button>
            </div>
          </div>
        </div>
      )}

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
