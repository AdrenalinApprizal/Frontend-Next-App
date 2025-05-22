"use client";

import { FaUser } from "react-icons/fa";
import { Check, X } from "lucide-react";
import { FriendRequest, User } from "@/types/friends";

interface SafeFriendRequestProps {
  request: FriendRequest;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function SafeFriendRequest({
  request,
  onAccept,
  onReject,
}: SafeFriendRequestProps) {
  if (!request) {
    console.warn("[SafeFriendRequest] Received null/undefined request");
    return null;
  }

  // Get appropriate user data from different possible fields
  const userData: User = request.user || request.friend || ({} as User);
  const friendshipId = request.friendship_id || request.id || "";
  const username = userData?.username || userData?.name || "Unknown User";
  const profilePicture =
    userData?.profile_picture_url || userData?.avatar || userData?.avatar_url;
  const createdDate = request.created_at
    ? new Date(request.created_at).toLocaleDateString()
    : "";

  // Guard against missing friendship ID
  if (!friendshipId) {
    console.warn(
      "[SafeFriendRequest] Missing friendship ID in request:",
      request
    );
    return null;
  }

  return (
    <div className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {profilePicture ? (
            <img
              src={profilePicture}
              alt={username}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <FaUser className="text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium">{username}</p>
          <p className="text-xs text-gray-500">{createdDate}</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          className="text-green-500 hover:text-green-600 dark:hover:text-green-400"
          onClick={() => onAccept(friendshipId)}
          aria-label="Accept friend request"
        >
          <Check className="h-5 w-5" />
        </button>
        <button
          className="text-red-500 hover:text-red-600 dark:hover:text-red-400"
          onClick={() => onReject(friendshipId)}
          aria-label="Reject friend request"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
