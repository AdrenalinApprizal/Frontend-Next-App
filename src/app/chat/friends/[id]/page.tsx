"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ChatArea } from "@/components/chat/chat-area";
import { useFriendship } from "@/hooks/auth/useFriends";

export default function FriendPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const friendId = params.id as string;
  const { getFriendById, friends } = useFriendship();
  const [friendData, setFriendData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Get friend name from URL search params if provided (e.g., from navigation)
  const providedName = searchParams.get("name");

  useEffect(() => {
    const fetchFriendData = async () => {
      if (!friendId) return;

      try {
        setLoading(true);

        // First check if friend exists in the cached friends list
        const cachedFriend = friends.find((f) => f.id === friendId);
        if (cachedFriend) {
          cachedFriend;
          setFriendData(cachedFriend);
          setLoading(false);
          return;
        }

        // Try to get from API
        const friend = await getFriendById(friendId);

        setFriendData(friend);
      } catch (error) {
        // Set fallback data with provided name if available
        setFriendData({
          id: friendId,
          name: providedName || "User",
          status: "offline",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFriendData();
  }, [friendId, getFriendById, friends, providedName]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-gray-500">Loading chat...</p>
        </div>
      </div>
    );
  }

  // Build display name with priority: providedName > API data > fallback
  let displayName = "User";

  // First priority: provided name from navigation
  if (providedName && !providedName.startsWith("User ")) {
    displayName = providedName;
  }
  // Second priority: API data
  else if (friendData) {
    // Check if this is real API data vs fallback data
    const isApiFallback =
      friendData.name?.startsWith("User ") && friendData.name?.includes("...");

    if (!isApiFallback) {
      // Use real API data: first_name + last_name, then full_name, then name, then username
      if (friendData.first_name && friendData.last_name) {
        displayName = `${friendData.first_name} ${friendData.last_name}`;
      } else if (friendData.full_name) {
        displayName = friendData.full_name;
      } else if (friendData.name) {
        displayName = friendData.name;
      } else if (friendData.username) {
        displayName = friendData.username;
      }
      displayName;
    } else {
      // If API returned fallback but we have a provided name, use it
      if (providedName) {
        displayName = providedName;
      } else {
        // Last resort: use the API fallback
        displayName = friendData.name || "User";
      }
    }
  }

  return (
    <ChatArea
      recipientId={friendId}
      recipientName={displayName}
      isGroup={false}
    />
  );
}
