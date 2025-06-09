import { GroupDetail } from "@/components/chat/group-chat-area";

export default function GroupPage() {
  // Data mockup langsung tanpa menggunakan params.id
  const mockGroup = {
    id: "1",
    name: "Project Alpha Team",
    memberCount: 8,
  };

  return <GroupDetail groupId={mockGroup.id} />;
}
