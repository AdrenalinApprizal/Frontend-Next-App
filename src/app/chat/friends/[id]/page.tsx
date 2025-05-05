import { FriendDetail } from "@/components/chat/friend-detail";

export default function FriendPage() {
  // Data mockup langsung tanpa menggunakan params.id
  const mockFriend = {
    id: "1",
    name: "John Doe",
    status: "online",
  };

  return <FriendDetail friendId={mockFriend.id} friendName={mockFriend.name} />;
}
