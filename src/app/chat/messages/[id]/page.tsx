import { ChatArea } from "@/components/chat/chat-area";
import { GroupDetail } from "@/components/chat/group-detail";

// Define the props for the page component
interface MessagePageProps {
  params: {
    id: string;
  };
  searchParams: {
    type?: string;
  };
}

export default function MessagePage({
  params,
  searchParams,
}: MessagePageProps) {
  const { id } = params;
  const isGroup = searchParams.type === "group";

  // We'll just pass the ID and let the component handle data fetching
  // This is better for client components that need to fetch data

  console.log(
    `[MessagePage] Rendering chat for ${
      isGroup ? "group" : "user"
    } with ID: ${id}`
  );

  if (isGroup) {
    // Render the group chat interface
    return (
      <GroupDetail
        groupId={id}
        groupName="" // Name will be fetched in the component
      />
    );
  } else {
    // Render the friend chat interface directly using ChatArea
    return (
      <ChatArea
        recipientId={id}
        recipientName="" // Name will be fetched in the component
        isGroup={false}
      />
    );
  }
}
