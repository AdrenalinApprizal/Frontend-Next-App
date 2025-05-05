import { FriendDetail } from "@/components/chat/friend-detail";
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

  // For a real app, you would fetch the actual chat data from an API
  // based on the id parameter and chat type

  if (isGroup) {
    // Render the group chat interface
    return (
      <GroupDetail
        groupId={id}
        groupName={getGroupName(id)} // Helper function to get group name
      />
    );
  } else {
    // Render the friend chat interface
    return (
      <FriendDetail
        friendId={id}
        friendName={getFriendName(id)} // Helper function to get friend name
      />
    );
  }
}

// Helper function to get friend name based on ID
// In a real app, this would be replaced by data from an API or state management
function getFriendName(id: string): string {
  // Mock data mapping
  const friendsMap: Record<string, string> = {
    "1": "Izhar Alif",
    "2": "Budi Santoso",
    "3": "Anita Wijaya",
    "4": "Sam Wilson",
    "5": "Maria Garcia",
  };

  return friendsMap[id] || "Unknown Friend";
}

// Helper function to get group name based on ID
// In a real app, this would be replaced by data from an API or state management
function getGroupName(id: string): string {
  // Mock data mapping
  const groupsMap: Record<string, string> = {
    "1": "Project Alpha Team",
    "2": "Marketing Department",
    "3": "Frontend Developers",
    "4": "Design Team",
    "5": "Company Announcements",
  };

  return groupsMap[id] || "Unknown Group";
}
