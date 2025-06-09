import { ChatArea } from "@/components/chat/chat-area";
import { GroupDetail } from "@/components/chat/group-chat-area";

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

  // We'll just pass the ID and let the component handle data fetching
  // This is better for client components that need to fetch data

  console.log(
    `[MessagePage] Rendering chat for ${
      isGroup ? "group" : "user"
    } with ID: ${id}${name ? ` and name: ${name}` : ""}`
  );

  if (isGroup) {
    // Render the group chat interface
    return <GroupDetail groupId={id} />;
  } else {
    // Render the friend chat interface directly using ChatArea
    return (
      <ChatArea
        recipientId={id}
        recipientName={name || ""} // Use the provided name or empty string
        isGroup={false}
      />
    );
  }
}
