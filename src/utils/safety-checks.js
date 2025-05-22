// Add a try-catch wrapper for accessing user properties in friend requests
// Place this right after the filter function in friends-list.tsx, around line 240
console.log(
  "[FriendsList Debug] Adding safety checks for friend request rendering"
);

try {
  // Before mapping through the requests, make sure to have safety checks
  const safeRenderRequests = friendRequests
    .filter((request) => request !== null && request !== undefined)
    .map((request) => {
      // Get appropriate user data from different possible fields
      const userData = request.user || request.friend || {};
      const friendshipId = request.friendship_id || request.id || "";
      const username = userData.username || userData.name || "Unknown User";
      const profilePicture =
        userData.profile_picture_url || userData.avatar || userData.avatar_url;
      const createdDate = request.created_at
        ? new Date(request.created_at).toLocaleDateString()
        : "";

      return {
        ...request,
        safeUser: userData,
        safeFriendshipId: friendshipId,
        safeUsername: username,
        safeProfilePicture: profilePicture,
        safeCreatedDate: createdDate,
      };
    });

  console.log(
    "[FriendsList Debug] Safe request objects prepared:",
    safeRenderRequests.length
  );
} catch (err) {
  console.error("[FriendsList] Error preparing safe request objects:", err);
}

// Safety check wrapper for request mapping in chat-area.tsx
// Add to fetchRecipientData function
try {
  // Add null/undefined checks for recipient data
  if (recipientData) {
    const safeRecipientName =
      recipientData.name || recipientData.username || "Unknown User";
    console.log(`[ChatArea] Setting recipient name to: ${safeRecipientName}`);
    setRecipientName(safeRecipientName);

    // Create a safe version of friendDetails
    const safeFriendDetails = {
      id: recipientId,
      name: safeRecipientName,
      email:
        recipientData.email ||
        `${safeRecipientName.toLowerCase().replace(/\s/g, ".")}@example.com`,
      phone: recipientData.phone || "+1 555-123-4567",
      location: recipientData.location || "Not specified",
      status: recipientData.status || "offline",
    };
    console.log("[ChatArea] Created safe friend details");
  }
} catch (err) {
  console.error("[ChatArea] Error setting safe recipient data:", err);
}
