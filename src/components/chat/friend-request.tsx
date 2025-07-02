"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { FaUser } from "react-icons/fa";

interface FriendRequestProps {
  request: any; // Using any type since it handles different response formats
  onAccept: (friendshipId: string) => void;
  onReject: (friendshipId: string) => void;
}

export function FriendRequest({
  request,
  onAccept,
  onReject,
}: FriendRequestProps) {
  if (!request) return null;

  // Extract the correct ID to use for actions
  const friendshipId = request.friendship_id || request.id || "";


  // Additional validation
  if (!friendshipId) {
    console.error("[FriendRequest] WARNING: No valid friendship ID found!");
    console.error("[FriendRequest] This will cause accept/reject to fail");
  }

  // User data might be in different fields depending on API response format
  const userData = request.user || request.friend || request;
  const userName = userData.name || userData.username || "Unknown User";
  const userAvatar = userData.avatar || userData.profile_pic || null;

  return (
    <div className="p-3 bg-white rounded-md border border-gray-200 shadow-sm flex items-center gap-3">
      <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
        {userAvatar ? (
          <img
            src={userAvatar}
            alt={userName}
            className="h-full w-full object-cover"
          />
        ) : (
          <FaUser className="h-5 w-5 text-gray-500" />
        )}
      </div>

      <div className="flex-grow">
        <h4 className="font-medium text-sm text-gray-800">{userName}</h4>
        <p className="text-xs text-gray-500">Wants to be your friend</p>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={() => onReject(friendshipId)}
          className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Reject"
        >
          <X size={16} className="text-gray-500" />
        </button>
        <button
          onClick={() => onAccept(friendshipId)}
          className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition-colors"
          aria-label="Accept"
        >
          <Check size={16} className="text-white" />
        </button>
      </div>
    </div>
  );
}
