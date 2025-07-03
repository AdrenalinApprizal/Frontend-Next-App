"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  UserPlus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import { FaUser, FaTimes, FaUserPlus } from "react-icons/fa";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useFriendship } from "@/hooks/auth/useFriends";
import usePresence, { PresenceStatus } from "@/hooks/presence/usePresence";
import { useMessages } from "@/hooks/messages/useMessages";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { FriendRequest } from "@/components/chat/friend-request";
import { formatMessageTimestamp } from "@/utils/timestampHelper";

export default function FriendsList() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [requestsHidden, setRequestsHidden] = useState(false);
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [addByUsername, setAddByUsername] = useState("");
  const [isAddingByUsername, setIsAddingByUsername] = useState(false);
  const [searchedFriends, setSearchedFriends] = useState<any[]>([]);
  const [isSearchingFriends, setIsSearchingFriends] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    loading: isLoading,
    error,
    friends,
    friendRequests,
    getFriends,
    getFriendRequests,
    addFriendByUsername,
    acceptFriendRequest,
    rejectFriendRequest,
    searchFriends,
    getBlockedUsers,
  } = useFriendship();

  const presence = usePresence();
  const {
    getMessages,
    getMessageHistory,
    getUnreadCount,
    loading: loadingMessages,
  } = useMessages();

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Use Promise.allSettled to ensure both requests are attempted even if one fails
        const results = await Promise.allSettled([
          getFriends(),
          getFriendRequests(),
          getBlockedUsers(), // Load blocked users on app startup
        ]);

        // If there are any friend requests, automatically show them
        if (friendRequests?.length > 0) {
          setRequestsHidden(false);
        }

        // Initialize presence status for all friends
        if (friends?.length > 0) {
          updateFriendsStatus();
        }
      } catch (err) {
        // Even if there's an error, we'll continue with an empty array
      }
    };

    // Connect to presence WebSocket when component mounts
    presence.connectWebSocket();
    presence.setInitialStatus();

    fetchInitialData();

    // Set up interval to refresh friend statuses periodically
    const statusInterval = setInterval(() => {
      updateFriendsStatus();
    }, 60000); // Every minute

    // Cleanup: Update status to offline when component unmounts
    return () => {
      presence.updateStatus("offline");
      // Don't disconnect the WebSocket here since other components might need it
      clearInterval(statusInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependencies to prevent infinite loop

  // Function to update all friends' status
  const updateFriendsStatus = async () => {
    try {
      if (friends?.length > 0) {
        // Get status for each friend individually
        friends.forEach((friend) => {
          presence.getUserStatus(friend.id);
        });
      }
    } catch (err) {
      
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      // Log each request's IDs
      friendRequests.forEach((req, index) => {
        ({
          friendship_id: req.friendship_id,
          id: req.id,
          user: req.user?.username || req.user?.name,
          full_object: req,
        });
      });

      await acceptFriendRequest(friendshipId);
      toast.success("Friend request accepted");
      await getFriendRequests();
      await getFriends();
    } catch (err: any) {
      
      toast.error("Failed to accept friend request: " + err.message);
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
      toast.success("Friend request rejected");
      await getFriendRequests();
    } catch (err) {
      toast.error("Failed to reject friend request");
    }
  };

  const handleAddFriendByUsername = async () => {
    if (!addByUsername.trim()) return;

    setIsAddingByUsername(true);
    try {
      await addFriendByUsername(addByUsername.trim());
      toast.success("Friend request sent successfully");
      setAddByUsername("");
      setShowAddFriendPopup(false); // Close modal after success
      await getFriendRequests(); // Refresh the requests list
    } catch (err: any) {
      toast.error(err.message || "Failed to send friend request");
    } finally {
      setIsAddingByUsername(false);
    }
  };

  // Handle friend selection
  const handleFriendSelect = async (friendId: string) => {
    try {
      // Find the friend data to get the name
      const friend = sortedFriends.find((f) => f.id === friendId);

      // Construct friend name with multiple fallbacks
      let friendName = "";
      if (friend) {
        if (friend.name) {
          friendName = friend.name;
        } else if (friend.first_name && friend.last_name) {
          friendName = `${friend.first_name} ${friend.last_name}`;
        } else if (friend.first_name) {
          friendName = friend.first_name;
        } else if (friend.display_name) {
          friendName = friend.display_name;
        } else if (friend.full_name) {
          friendName = friend.full_name;
        } else if (friend.username) {
          friendName = friend.username;
        }
      }


      // Fetch messages, history, and unread count when a friend is selected
      await getMessages(friendId);
      await getMessageHistory({
        type: "private",
        target_id: friendId,
      });
      await getUnreadCount();

      // Navigate to the chat with this friend, including name parameter if available
      const url = `/chat/messages/${friendId}${
        friendName ? `?name=${encodeURIComponent(friendName)}` : ""
      }`;
      router.push(url);
    } catch (err) {
      toast.error("Failed to load messages");
    }
  };

  // Debounced search function for friends
  const searchFriendsDebounced = () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchedFriends([]);
      return;
    }

    setIsSearchingFriends(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        // Try to use the API search if available
        const results = await searchFriends(searchQuery);
        setSearchedFriends(results);
      } catch (err) {
        setSearchedFriends([]);
      } finally {
        setIsSearchingFriends(false);
      }
    }, 300);
  };

  // Watch for changes in the search query
  useEffect(() => {
    if (searchQuery.trim()) {
      searchFriendsDebounced();
    } else {
      setSearchedFriends([]);
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Get friend presence status
  const getFriendStatus = (friendId: string): PresenceStatus => {
    // Get status with fallback to "offline" if undefined
    return presence.getStatus(friendId) || "offline";
  };

  // Get last active time
  const getLastActive = (friendId: string): string | null => {
    return presence.getLastActive(friendId);
  };

  // Format last active time using centralized helper
  const formatLastActive = (timestamp: string | null): string => {
    if (!timestamp) return "Offline";
    return formatMessageTimestamp({ timestamp, format: "relative" });
  };

  // Regular filtered friends (client-side filtering)
  const filteredFriends =
    friends?.filter((friend) =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  // Use either API search results or filtered friends
  const displayedFriends =
    searchedFriends.length > 0 ? searchedFriends : filteredFriends;

  // Sort friends by online status first, then alphabetically
  const sortedFriends = [...displayedFriends].sort((a, b) => {
    // Get presence status
    const statusA = getFriendStatus(a.id);
    const statusB = getFriendStatus(b.id);

    // Online users first
    if (statusA === "online" && statusB !== "online") return -1;
    if (statusB === "online" && statusA !== "online") return 1;

    // Then sort alphabetically
    return a.name.localeCompare(b.name);
  });

  // Filter only incoming friend requests (more Vue-like approach)
  const incomingRequests =
    friendRequests?.filter((request) => {
      if (!request) return false;

      // Check if it's an incoming request based on different API response formats
      if (request.direction === "incoming") return true;
      if (request.type === "received") return true;
      if (
        request.status === "pending" &&
        request.recipient_id !== request.requestor_id
      )
        return true;

      // Default case
      return false;
    }) || [];

  return (
    <div className="h-full flex flex-col p-6 bg-white">
      {/* Header with title and action button */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">Friends</h1>
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <NotificationDropdown />
          </div>
          <button
            onClick={() => setShowAddFriendPopup(true)}
            className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors shadow-sm"
            aria-label="Add Friend"
          >
            <UserPlus size={18} className="h-5 w-5" />
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
          placeholder="Search friends"
          className="pl-11 w-full p-3 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSearchingFriends && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-sm text-gray-500">Loading friends...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-center">
            <p className="text-red-500 font-medium">{error}</p>
            <button
              className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md text-sm transition-colors"
              onClick={() => {
                getFriends();
                getFriendRequests();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Friend Requests Section - Collapsible */}
          {incomingRequests.length > 0 && (
            <div className="mb-6 bg-blue-50 rounded-lg overflow-hidden border border-blue-100">
              <div
                className="flex justify-between items-center p-3 cursor-pointer bg-blue-100 hover:bg-blue-200 transition-colors"
                onClick={() => setRequestsHidden(!requestsHidden)}
              >
                <h2 className="font-medium text-blue-800 text-sm flex items-center">
                  <FaUserPlus className="mr-2 h-3.5 w-3.5" />
                  Friend Requests
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {incomingRequests.length}
                  </span>
                </h2>
                <button className="text-blue-700 hover:text-blue-900 p-1">
                  {requestsHidden ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
              </div>

              {!requestsHidden && (
                <div className="p-3 space-y-2 bg-blue-50">
                  {incomingRequests.map((request) => (
                    <FriendRequest
                      key={
                        request.friendship_id ||
                        request.id ||
                        `request-${Math.random()}`
                      }
                      request={request}
                      onAccept={handleAcceptRequest}
                      onReject={handleRejectRequest}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Friends List Section */}
          <div>
            <h2 className="font-medium text-gray-500 text-xs uppercase tracking-wider mb-3">
              {getFriendStatus("online") === "online" ? "Online" : "All"}{" "}
              Friends
              {sortedFriends.length > 0 && (
                <span className="ml-2 text-gray-400">
                  ({sortedFriends.length})
                </span>
              )}
            </h2>

            {sortedFriends.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-lg border border-gray-100">
                <FaUser className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">
                  {searchQuery
                    ? `No results for "${searchQuery}"`
                    : "No friends yet"}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Add friends to start chatting
                </p>
                <button
                  onClick={() => setShowAddFriendPopup(true)}
                  className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md flex items-center text-sm"
                >
                  <UserPlus size={14} className="mr-2" />
                  Add Friend
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {sortedFriends.map((friend) => (
                  <div
                    key={friend.id}
                    onClick={() => handleFriendSelect(friend.id)}
                    className={`flex items-center p-3 rounded-xl transition-all cursor-pointer ${
                      pathname === `/chat/messages/${friend.id}`
                        ? "bg-blue-50 border border-blue-200 shadow-sm"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                  >
                    {/* Friend avatar with status indicator */}
                    <div className="relative mr-3">
                      <div className="h-11 w-11 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                        {friend.avatar ? (
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              // If image fails to load, fall back to icon
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              (
                                e.currentTarget.parentElement as HTMLElement
                              ).classList.add("avatar-error");
                              (
                                e.currentTarget.parentElement as HTMLElement
                              ).innerHTML +=
                                '<svg class="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path></svg>';
                            }}
                          />
                        ) : (
                          <FaUser className="h-5 w-5 text-gray-500" />
                        )}
                      </div>

                      {/* Status indicator - simplified for online/offline */}
                      {(() => {
                        const status = getFriendStatus(friend.id);
                        const statusClass =
                          status === "online" ? "bg-green-500" : "bg-gray-400";

                        return status === "online" ? (
                          <div
                            className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full ${statusClass} border-2 border-white`}
                          ></div>
                        ) : null;
                      })()}
                    </div>

                    {/* Friend info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {friend.name}
                        </h3>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {friend.last_active
                            ? formatLastActive(friend.last_active)
                            : formatLastActive(getLastActive(friend.id))}
                        </span>
                      </div>

                      <div className="flex items-center mt-0.5">
                        {/* Status text */}
                        <p className="text-xs text-gray-500 truncate flex-1">
                          {getFriendStatus(friend.id) === "online"
                            ? "Active now"
                            : friend.username
                            ? `@${friend.username}`
                            : "offline"}
                        </p>

                        {/* Unread count badge */}
                        {friend.unread_count && friend.unread_count > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 ml-2 text-xs font-medium leading-none text-white bg-red-500 rounded-full">
                            {friend.unread_count}
                          </span>
                        )}

                        {/* Message icon for current chat */}
                        {pathname === `/chat/messages/${friend.id}` && (
                          <MessageSquare
                            size={14}
                            className="text-blue-500 ml-1"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Friend Popup - Enhanced styling */}
      {showAddFriendPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl transform transition-all">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                <FaUserPlus className="mr-2 h-5 w-5 text-blue-500" />
                Add a Friend
              </h2>
              <button
                type="button"
                onClick={() => setShowAddFriendPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Close"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              You can add a friend with their username. It's case sensitive!
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isAddingByUsername && addByUsername.trim()) {
                  handleAddFriendByUsername();
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={addByUsername}
                    onChange={(e) => setAddByUsername(e.target.value)}
                    placeholder="Enter friend's username"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all pl-10"
                    disabled={isAddingByUsername}
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                    <FaUser className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddFriendPopup(false)}
                  className="px-4 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300 flex items-center"
                  disabled={!addByUsername.trim() || isAddingByUsername}
                >
                  {isAddingByUsername ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} className="mr-2" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
