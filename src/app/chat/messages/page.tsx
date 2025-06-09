import { useState } from "react";
import { FaUser, FaPaperPlane } from "react-icons/fa";
import { Paperclip } from "lucide-react";

export default function MessagesPage() {

  return (
    <div className="h-full flex flex-col justify-center items-center bg-gray-50">
      <div className="text-center p-6">
        <div className="h-16 w-16 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center">
          <FaUser className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Messages</h2>
        <p className="text-gray-500 max-w-sm">
          Select a message to view or start a new conversation.
        </p>
      </div>
    </div>
  );
}
