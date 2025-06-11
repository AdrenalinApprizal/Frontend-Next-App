import { GroupDetail } from "@/components/chat/group-chat-area";
import { ChatArea } from "@/components/chat/chat-area";

// Define the props for the page component
interface MessagePageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    type?: string;
    name?: string;
  }>;
}

export default async function MessagePage({
  params,
  searchParams,
}: MessagePageProps) {
  const { id } = await params;
  const { type, name } = await searchParams;
  const isGroup = type === "group";

  if (isGroup) {
    // Render the group chat interface
    return <GroupDetail groupId={id} />;
  } else {
    // Render the private chat interface
    return <ChatArea recipientId={id} recipientName={name || `User ${id}`} />;
  }
}
