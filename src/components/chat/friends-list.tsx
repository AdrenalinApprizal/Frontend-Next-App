"use client";

import { useState, useEffect } from "react";
import {
  Search,
  UserPlus,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { FaUser, FaTimes } from "react-icons/fa";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useFriendship } from "@/hooks/auth/useFriends";
import { usePresence } from "@/hooks/presence/usePresence";
import { useMessages } from "@/hooks/messages/useMessages";
import { NotificationDropdown } from "@/components/notification-dropdown";
import { SafeFriendRequest } from "@/components/chat/safe-friend-request";

export default function FriendsList() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [requestsHidden, setRequestsHidden] = useState(false);
  const [showAddFriendPopup, setShowAddFriendPopup] = useState(false);
  const [addByUsername, setAddByUsername] = useState("");
  const [isAddingByUsername, setIsAddingByUsername] = useState(false);

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
        console.log("[FriendsList] Starting initial data fetch");

        // Use Promise.allSettled to ensure both requests are attempted even if one fails
        const results = await Promise.allSettled([
          getFriends(),
          getFriendRequests(),
        ]);

        console.log(
          "[FriendsList] Initial data fetch results:",
          results.map(
            (r, i) =>
              `${i === 0 ? "getFriends" : "getFriendRequests"}: ${r.status}`
          )
        );

        // Debug: Log friend requests after fetching
        console.log(
          "[FriendsList Debug] Friend requests after fetch:",
          friendRequests
        );
        console.log(
          "[FriendsList Debug] Friend requests count:",
          friendRequests?.length || 0
        );

        if (friendRequests?.length > 0) {
          console.log(
            "[FriendsList Debug] Friend requests sample:",
            friendRequests[0]
          );
        }
      } catch (err) {
        console.error("[FriendsList] Error during initial data fetch:", err);
        // Even if there's an error, we'll continue with an empty array
      }
    };

    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Remove dependencies to prevent infinite loop

  // Add debugging useEffect for rendering updates
  useEffect(() => {
    // Debug logging for renders
    console.log(
      "[FriendsList Debug] Rendering friend requests:",
      friendRequests
    );
    console.log(
      "[FriendsList Debug] friendRequests length:",
      friendRequests?.length
    );

    if (friendRequests?.length > 0) {
      console.log(
        "[FriendsList Debug] Filtered incoming requests:",
        friendRequests.filter((request) => request?.direction === "incoming")
      );

      // Log sample request for debugging
      friendRequests.forEach((request, index) => {
        if (index < 3) {
          // Only log first 3 to avoid flooding console
          console.log(
            `[FriendsList Debug] Processing request ${index}:`,
            request
          );
        }
      });
    }
  }, [friendRequests]);

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await acceptFriendRequest(friendshipId);
      toast.success("Friend request accepted");
      await getFriendRequests();
      await getFriends();
    } catch (err) {
      console.error("[FriendsList] Failed to accept friend request:", err);
      toast.error("Failed to accept friend request");
    }
  };

  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await rejectFriendRequest(friendshipId);
      toast.success("Friend request rejected");
      await getFriendRequests();
    } catch (err) {
      console.error("[FriendsList] Failed to reject friend request:", err);
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
      console.error("[FriendsList] Failed to add friend by username:", err);
      toast.error(err.message || "Failed to send friend request");
    } finally {
      setIsAddingByUsername(false);
    }
  };

  // Handle friend selection
  const handleFriendSelect = async (friendId: string) => {
    try {
      // Fetch messages, history, and unread count when a friend is selected
      await getMessages(friendId);
      await getMessageHistory({
        type: "private",
        target_id: friendId,
      });
      await getUnreadCount();

      // Navigate to the chat with this friend
      router.push(`/chat/messages/${friendId}`);
    } catch (err) {
      console.error("[FriendsList] Error loading messages:", err);
      toast.error("Failed to load messages");
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFriends = [...filteredFriends].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

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
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Debug logs moved to useEffect to avoid void return in JSX */}

          {friendRequests?.length > 0 && (
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-gray-800 text-sm flex items-center">
                  Friend Requests
                  <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                    {friendRequests.length}
                  </span>
                </h2>
                <button
                  onClick={() => setRequestsHidden(!requestsHidden)}
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  {requestsHidden ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronUp size={16} />
                  )}
                </button>
              </div>

              {!requestsHidden && (
                <div className="space-y-2">
                  {/* Debug logs moved to avoid void return in JSX */}

                  {friendRequests
                    .filter((request) => {
                      if (!request) return false;

                      // Get the user/friend data, which might be in different fields
                      const userData = request.user || request.friend || {};

                      // Handle multiple API response formats for determining incoming requests
                      const isIncoming = request.direction === "incoming";
                      const isPending = request.status === "pending";
                      const isReceived = request.type === "received";

                      // Check if current user is the recipient (not the requestor)
                      const isRecipient =
                        request.recipient_id !== request.requestor_id;

                      // If it has none of these properties, default to showing it
                      if (
                        request.direction === undefined &&
                        request.status === undefined &&
                        request.type === undefined &&
                        request.recipient_id === undefined
                      ) {
                        return true;
                      }

                      return (
                        isIncoming || isPending || isReceived || isRecipient
                      );
                    })
                    .map((request) => (
                      <SafeFriendRequest
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

          {sortedFriends.length === 0 ? (
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
                <div
                  key={friend.id}
                  onClick={() => handleFriendSelect(friend.id)}
                  className={`flex items-center p-4 rounded-lg transition-colors cursor-pointer ${
                    pathname === `/chat/messages/${friend.id}`
                      ? "bg-blue-50 border border-blue-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  {/* Friend avatar */}
                  <div
                    className="relative mr-3"
                    key={`avatar-wrapper-${friend.id}`}
                  >
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                      {friend.avatar ? (
                        <img
                          key={`avatar-${friend.id}`}
                          src={friend.avatar}
                          alt={friend.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FaUser
                          key={`icon-${friend.id}`}
                          className="h-5 w-5 text-gray-500"
                        />
                      )}
                    </div>
                    {/* Online status indicator */}
                    {presence.getStatus(friend.id) === "online" && (
                      <div
                        key={`status-${friend.id}`}
                        className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"
                      ></div>
                    )}
                  </div>

                  {/* Friend info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {friend.name}
                      </h3>
                      <span className="text-xs text-gray-500 ml-1 whitespace-nowrap">
                        {friend.last_seen ? friend.last_seen : ""}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-gray-500 truncate max-w-[80%]">
                        {friend.status ||
                          (presence.getStatus(friend.id) === "online"
                            ? "Online"
                            : "Offline")}
                      </p>
                    </div>
                    {/* Show unread count if available */}
                    {friend.unread_count && friend.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center px-2 py-0.5 ml-2 text-xs font-medium leading-none text-red-100 bg-red-600 rounded-full">
                        {friend.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Friend Popup */}
      {showAddFriendPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl transform transition-all">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">
                Add a Friend
              </h2>
              <button
                type="button"
                onClick={() => setShowAddFriendPopup(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FaTimes size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!isAddingByUsername && addByUsername.trim()) {
                  handleAddFriendByUsername();
                }
              }}
            >
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={addByUsername}
                  onChange={(e) => setAddByUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  disabled={isAddingByUsername}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddFriendPopup(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded transition-colors mr-2"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  disabled={!addByUsername.trim() || isAddingByUsername}
                >
                  {isAddingByUsername ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
