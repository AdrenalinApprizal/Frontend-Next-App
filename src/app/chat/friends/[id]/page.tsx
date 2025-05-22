import { ChatArea } from "@/components/chat/chat-area";

export default function FriendPage() {
  // Data mockup langsung tanpa menggunakan params.id
  const mockFriend = {
    id: "1",
    name: "John Doe",
    status: "online",
  };

  return (
    <ChatArea
      recipientId={mockFriend.id}
      recipientName={mockFriend.name}
      isGroup={false}
    />
  );
}
