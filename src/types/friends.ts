export interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  display_name?: string;
  full_name?: string;
  email?: string;
  profile_picture_url?: string;
  avatar_url?: string;
  avatar?: string;
  created_at?: string;
  status?: "online" | "offline"; // Updated to only allow 'online' | 'offline'
  phone?: string;
  location?: string;
}

export interface FriendRequest {
  friendship_id?: string;
  id?: string;
  user?: User;
  friend?: User;
  created_at?: string;
  direction?: "incoming" | "outgoing";
  status?: "pending" | "accepted" | "rejected";
  type?: "sent" | "received";
  requestor_id?: string;
  recipient_id?: string;
  friend_id?: string;
}
