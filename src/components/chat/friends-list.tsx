"use client";

import { useState } from "react";
import { Search, UserPlus, Check, X } from "lucide-react";
import { FaUser, FaTimes } from "react-icons/fa";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "react-hot-toast";

// Interface for friend data
interface Friend {
  id: string;
  name: string;
  lastSeen: string;
  status: "online" | "offline";
  avatar?: string;
  username?: string;
  selected?: boolean;
}

// Interface for friend request data
interface FriendRequest {
  id: string;
  name: string;
  avatar?: string;
}

export function FriendsList() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [requestsHidden, setRequestsHidden] = useState(false);

  // Friend requests data
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([
    {
      id: "req1",
      name: "ChatGijax 2",
      avatar: undefined,
    },
    {
      id: "req2",
      name: "ChatGijax",
      avatar: undefined,
    },
  ]);

  const [friends, setFriends] = useState<Friend[]>([
    {
      id: "1",
      name: "John Doe",
      lastSeen: "Just now",
      status: "online",
      avatar: undefined,
      username: "johndoe",
    },
    {
      id: "2",
      name: "Jane Smith",
      lastSeen: "5 minutes ago",
      status: "offline",
      avatar: undefined,
      username: "janesmith",
    },
    {
      id: "3",
      name: "Alex Johnson",
      lastSeen: "Online",
      status: "online",
      avatar: undefined,
      username: "alexjohnson",
    },
    {
      id: "4",
      name: "Sam Wilson",
      lastSeen: "1 hour ago",
      status: "offline",
      avatar: undefined,
      username: "samwilson",
    },
    {
      id: "5",
      name: "Maria Garcia",
      lastSeen: "Online",
      status: "online",
      avatar: undefined,
      username: "mariagarcia",
    },
  ]);

  // Handler for accepting friend request
  const handleAcceptRequest = (requestId: string) => {
    // Find the request to get the name for the toast notification
    const request = friendRequests.find((req) => req.id === requestId);

    setFriendRequests((prevRequests) =>
      prevRequests.filter((request) => request.id !== requestId)
    );

    // Show success toast notification
    if (request) {
      toast.success(`You're now friends with ${request.name}`);
    }

    // In a real app, you would also call an API to accept the request and add the user to your friends list
  };

  // Handler for rejecting friend request
  const handleRejectRequest = (requestId: string) => {
    const request = friendRequests.find((req) => req.id === requestId);

    setFriendRequests((prevRequests) =>
      prevRequests.filter((request) => request.id !== requestId)
    );

    // Show info toast notification
    if (request) {
      toast.success(`Friend request from ${request.name} rejected`);
    }

    // In a real app, you would also call an API to reject the request
  };

  // Handler for adding a friend
  const handleAddFriend = () => {
    // Here you would typically make an API call to search for the user
    if (!friendUsername.trim()) {
      toast.error("Please enter a username");
      return;
    }

    // For now, we'll just close the popup
    setShowAddFriendPopup(false);

    // Show success toast notification
    toast.success(`Friend request sent to ${friendUsername}`);

    setFriendUsername("");
  };

  // Filter friends based on search query
  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort friends alphabetically (A-Z)
  const sortedFriends = [...filteredFriends].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action button */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Friends</h1>
        <button
          onClick={() => setShowAddFriendPopup(true)}
          className="p-2.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
          aria-label="Add Friend"
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
          placeholder="Search friends"
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Friend Requests Section */}
      {friendRequests.length > 0 && (
        <div className="mb-5">
          {requestsHidden ? (
            // Collapsed view - shows a summary with count
            <div
              className="border border-blue-200 rounded-xl shadow-sm overflow-hidden cursor-pointer hover:bg-blue-50 transition-all"
              onClick={() => setRequestsHidden(false)}
            >
              <div className="p-4 flex items-center justify-between bg-white">
                <div className="flex items-center space-x-3">
                  <div className="w-1 h-6 bg-blue-500 rounded-r"></div>
                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <span className="font-semibold text-gray-800 text-sm">
                        Friend Requests
                      </span>
                      <span className="ml-2 bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                        {friendRequests.length}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {friendRequests.length === 1
                        ? `${friendRequests[0].name} wants to be your friend`
                        : `${friendRequests[0].name} and ${
                            friendRequests.length - 1
                          } other${friendRequests.length > 2 ? "s" : ""}`}
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
            // Expanded view - shows all friend requests
            <>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center">
                  <div className="w-1 h-6 bg-blue-500 rounded-r mr-2"></div>
                  <h2 className="font-semibold text-gray-800 text-sm">
                    Friend Requests{" "}
                    <span className="ml-1 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                      {friendRequests.length}
                    </span>
                  </h2>
                </div>
                <button
                  onClick={() => setRequestsHidden(true)}
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
                {friendRequests.map((request) => (
                  <div
                    key={request.id}
                    className="p-4 bg-white hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gradient-to-r from-blue-400 to-blue-600 mr-4 flex-shrink-0 flex items-center justify-center border-2 border-white shadow-sm">
                          {request.avatar ? (
                            <img
                              src={request.avatar}
                              alt={request.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FaUser className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {request.name}
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
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 10-1.414-1.414L11 10.586V7z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Invited by Izhar Alif
                          </p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-red-100 hover:text-red-600 transition-all transform hover:scale-105"
                          aria-label="Reject Request"
                        >
                          <X size={18} />
                        </button>
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 hover:text-blue-700 transition-all transform hover:scale-105"
                          aria-label="Accept Request"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {friendRequests.length > 0 && (
                  <div className="bg-gray-50 p-3 text-center">
                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {friendRequests.length > 2
                        ? "View all requests"
                        : "Manage requests"}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Friends list */}
      <div className="flex-1 overflow-auto">
        {filteredFriends.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6">
            <FaUser className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">
              {searchQuery
                ? `No results for "${searchQuery}"`
                : "No friends yet"}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Add friends to start chatting
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedFriends.map((friend) => (
              <Link key={friend.id} href={`/chat/messages/${friend.id}`}>
                <div
                  className={`flex items-center p-4 rounded-lg transition-colors ${
                    pathname === `/chat/messages/${friend.id}`
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar with online status */}
                  <div className="relative mr-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {friend.avatar ? (
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FaUser className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                    {friend.status === "online" && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></div>
                    )}
                  </div>

                  {/* Friend info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {friend.name}
                      </h3>
                      <span className="text-xs text-gray-500 ml-1">
                        {friend.status === "online"
                          ? "Online"
                          : friend.lastSeen}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-1">
                      @{friend.username}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}
