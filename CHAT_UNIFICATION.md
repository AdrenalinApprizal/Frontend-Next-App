# Chat System Unification - Documentation

## Overview

Telah dilakukan unifikasi endpoint dan struktur data antara ChatArea dan MessagesList untuk memastikan konsistensi dalam menampilkan pesan di aplikasi chat.

## Perubahan yang Dilakukan

### 1. Hook `useMessages` Improvements

#### Fungsi Baru:

- **`getLastMessage(targetId, type)`**: Untuk mendapatkan pesan terakhir (digunakan MessagesList)
- **`getConversationHistory(targetId, type, page, limit)`**: Untuk mendapatkan riwayat percakapan (digunakan ChatArea)

#### Konsistensi:

- Semua fungsi sekarang menggunakan `getUnifiedMessages` sebagai backend
- Parameter yang konsisten: `target_id`, `type` ("private" | "group"), `page`, `limit`
- Error handling yang seragam

### 2. Shared Types (`/src/types/messages.ts`)

#### Interfaces Baru:

```typescript
- BaseMessage: Interface dasar untuk semua pesan
- ConversationMessage: Extends BaseMessage untuk chat area
- MessageListItem: Extends BaseMessage untuk message list
- ApiResponse<T>: Interface konsisten untuk response API
- MessageApiParams: Parameter API yang standar
```

#### Helper Functions:

```typescript
- normalizeApiResponse<T>(response): T[] - Normalisasi response array
- normalizeSingleMessage(response): BaseMessage | null - Normalisasi single message
```

### 3. MessagesList Updates

#### Perubahan Utama:

- Menggunakan `getLastMessage()` instead of manual `getUnifiedMessages()`
- Menggunakan shared types dari `/types/messages.ts`
- Konsisten logging untuk debugging
- Response normalization menggunakan helper functions

#### Endpoint yang Digunakan:

```typescript
// Untuk friends
const response = await getLastMessage(conversationId, "private");

// Untuk groups (masih menggunakan getGroupMessages dari useGroup hook)
const response = await getGroupMessages(conversationId, 1, 1);
```

### 4. ChatArea Updates

#### Perubahan Utama:

- Menggunakan `getConversationHistory()` instead of `getMessages()`
- Menggunakan shared types dari `/types/messages.ts`
- Response normalization menggunakan helper functions
- Consistent error handling

#### Endpoint yang Digunakan:

```typescript
// Untuk friends
const response = await getConversationHistory(friendId, "private", 1, 20);
```

## Endpoint Mapping

### Sebelum Unifikasi:

- **MessagesList**: `getUnifiedMessages({ target_id, type: "private", limit: 1, page: 1 })`
- **ChatArea**: `getMessages(friendId)` → internal delegation ke getUnifiedMessages

### Setelah Unifikasi:

- **MessagesList**: `getLastMessage(targetId, "private")` → `getUnifiedMessages({ target_id, type: "private", limit: 1, page: 1 })`
- **ChatArea**: `getConversationHistory(targetId, "private", 1, 20)` → `getUnifiedMessages({ target_id, type: "private", page: 1, limit: 20 })`

## Actual API Endpoints

Semua fungsi pada akhirnya memanggil endpoint yang sama dalam `useMessages`:

```typescript
// Primary endpoint
GET /messages/history?type=private&target_id={id}&limit={limit}&page={page}

// Fallback endpoint
GET /messages/private/{target_id}/history?limit={limit}&page={page}
```

## Benefits

### 1. Konsistensi Data

- Struktur response yang sama dari semua fungsi
- Consistent error handling
- Predictable data flow

### 2. Maintainability

- Centralized logic dalam useMessages hook
- Shared types untuk type safety
- Single source of truth untuk API calls

### 3. Debugging

- Consistent logging patterns
- Clear function names that indicate purpose
- Better error messages

### 4. Performance

- Reduced code duplication
- Optimized API calls
- Better caching potential

## Usage Examples

### Getting Last Message (MessagesList):

```typescript
// Before
const response = await getUnifiedMessages({
  target_id: friendId,
  type: "private",
  limit: 1,
  page: 1,
});

// After
const response = await getLastMessage(friendId, "private");
```

### Getting Conversation History (ChatArea):

```typescript
// Before
const response = await getMessages(friendId);

// After
const response = await getConversationHistory(friendId, "private", 1, 20);
```

## Testing Recommendations

1. **Test MessagesList**: Pastikan preview pesan terakhir ditampilkan dengan benar
2. **Test ChatArea**: Pastikan riwayat pesan lengkap dimuat dengan pagination
3. **Test Error Handling**: Pastikan error ditangani konsisten di kedua komponen
4. **Test Real-time Updates**: Pastikan WebSocket updates bekerja di kedua komponen

## Migration Notes

- Tidak ada breaking changes untuk user experience
- API calls tetap menggunakan endpoint yang sama
- Performance improvements melalui optimized helper functions
- Better TypeScript support dengan shared types

## Message Deletion & Editing Synchronization

### Problem

Ketika message dihapus atau diedit di ChatArea/GroupChatArea, perubahan tidak langsung terlihat di MessagesList karena kedua komponen menggunakan state yang terpisah.

### Solution

Implementasi real-time synchronization menggunakan EventBus untuk komunikasi antar komponen, untuk **private chat** dan **group chat**.

### Implementation Details

#### 1. Event Types Baru (`useEventBus.ts`)

```typescript
"message-deleted": { messageId: string; conversationId: string; type: "private" | "group" }
"message-edited": { messageId: string; conversationId: string; content: string; type: "private" | "group" }
```

#### 2. ChatArea Changes (Private Chat)

- **Delete Message**: Emit `message-deleted` event setelah sukses delete
- **Edit Message**: Emit `message-edited` event setelah sukses edit

#### 3. GroupChatArea Changes (Group Chat) ✅ **NEW**

- **Delete Message**: Emit `message-deleted` event dengan `type: "group"`
- **Edit Message**: Emit `message-edited` event dengan `type: "group"`
- Menggunakan `deleteGroupMessage()` dan `editGroupMessage()` dari useGroup hook

#### 4. MessagesList Changes (Universal)

- **Event Listeners**: Listen untuk `message-deleted` dan `message-edited` events
- **Type-aware Refresh**:
  - `type: "private"` → `getFriends()`
  - `type: "group"` → `getGroups()`
- **State Update**: Update local state immediately untuk responsiveness
- **Visual Indicator**: Styling khusus untuk deleted messages (italic, gray)

#### 5. Helper Functions (Enhanced)

- `getMessageDisplayContent()`: Normalisasi konten pesan dengan handling untuk deleted messages
- `getLastMessageForConversation()`: Unified function untuk private dan group
  - Private: `getLastMessage(conversationId, "private")`
  - Group: `getGroupLastMessage(conversationId)` ✅ **NEW**
- `normalizeMessageResponse()`: Consistent response normalization

### Flow for Both Private & Group Chat

#### Private Chat Flow:

1. User deletes/edits message di ChatArea
2. ChatArea calls `deleteMessage()` / `editMessage()` API
3. ChatArea update local state
4. ChatArea emits event: `{ type: "private", conversationId: friendId }`
5. MessagesList receives event dan calls `getFriends()`
6. MessagesList refreshes private chat previews

#### Group Chat Flow: ✅ **NEW**

1. User deletes/edits message di GroupChatArea
2. GroupChatArea calls `deleteGroupMessage()` / `editGroupMessage()` API
3. GroupChatArea update local state
4. GroupChatArea emits event: `{ type: "group", conversationId: groupId }`
5. MessagesList receives event dan calls `getGroups()`
6. MessagesList refreshes group chat previews

### API Consistency

#### Unified Endpoints:

- **Private Messages**: `getLastMessage(targetId, "private")` → `/messages/history?type=private&target_id=${targetId}&limit=1`
- **Group Messages**: `getGroupLastMessage(groupId)` → `/groups/${groupId}/messages?limit=1`

#### Response Normalization:

Both functions return consistent structure melalui `normalizeMessageResponse()` helper.

### Benefits

- ✅ Real-time synchronization untuk private **dan** group chat
- ✅ Immediate UI feedback
- ✅ Server consistency
- ✅ Visual distinction untuk deleted messages
- ✅ Type-aware event handling
- ✅ Unified API approach
- ✅ Error handling yang robust

## Group Chat Consistency Fixes

### Problem Resolved

Group chat memiliki perilaku yang berbeda dengan private chat:

1. **Delete Messages**: Pesan dihapus langsung hilang, tidak seperti private chat yang menampilkan "This message was deleted"
2. **Edit Messages**: Status `isEdited` tidak dipertahankan, indikator "(edited)" tidak muncul
3. **State Management**: Local state optimistic updates tidak dipertahankan saat background refresh

### Solution Implemented

#### 1. Delete Message Consistency ✅

```typescript
// Before: Message dihapus langsung
setMessages((prev) => prev.filter((msg) => msg.id !== messageId));

// After: Message dipertahankan sebagai deleted
setMessages((prev) =>
  prev.map((msg) =>
    msg.id === messageId
      ? {
          ...msg,
          pending: false,
          isDeleted: true,
          content: "This message was deleted",
        }
      : msg
  )
);
```

#### 2. Edit Message State Preservation ✅

```typescript
// Added updated_at field ke GroupMessage interface
interface GroupMessage {
  // ...existing fields...
  updated_at?: string; // For edit tracking
}

// Enhanced edit handling dengan proper state management
setMessages((prev) =>
  prev.map((msg) =>
    msg.id === editingMessageId
      ? {
          ...msg,
          content: messageContent,
          isEdited: true,
          pending: false,
          updated_at: new Date().toISOString(),
        }
      : msg
  )
);
```

#### 3. State Preservation di fetchGroupMessages ✅

```typescript
// Enhanced local state preservation
const mergedMessages = sortedMessages.map((apiMessage) => {
  const existingMessage = existingMessagesMap.get(apiMessage.id);

  // For deleted messages, always preserve the deleted state
  if (existingMessage?.isDeleted) {
    return {
      ...existingMessage,
      timestamp: apiMessage.timestamp || existingMessage.timestamp,
    };
  }

  // For edited messages, preserve the edited state
  if (existingMessage?.isEdited && !existingMessage.pending) {
    return {
      ...apiMessage,
      isEdited: true,
      content: existingMessage.content,
      updated_at: existingMessage.updated_at,
    };
  }

  return apiMessage;
});
```

#### 4. WebSocket Message Handling ✅

```typescript
// Preserve deleted/edited messages dari WebSocket updates
const messagesWithoutOptimistic = prevMessages.filter((msg) => {
  // Always keep deleted or edited messages
  if (msg.isDeleted || msg.isEdited) return true;

  // ... rest of filtering logic
});
```

#### 5. Visual Consistency ✅

```typescript
// GroupMessageItem styling sama dengan ChatAreaItem
className={`${
  message.isDeleted
    ? "bg-gray-200 text-gray-500 italic"  // Consistent untuk semua deleted messages
    : isDefinitelyCurrentUser
    ? message.failed
      ? "bg-red-100 text-red-800 border border-red-300"
      : "bg-blue-500 text-white"
    : "bg-white border border-gray-200 text-gray-800"
}`}

// Edit indicator preserved
{message.isEdited && !message.isDeleted && (
  <span className="text-xs opacity-75">(edited)</span>
)}
```

### Benefits

- ✅ **Consistent UX**: Group chat dan private chat sekarang berperilaku identik
- ✅ **State Persistence**: Local state optimistic updates dipertahankan
- ✅ **Visual Indicators**: Deleted messages ditampilkan konsisten dengan styling italic gray
- ✅ **Edit Tracking**: "(edited)" indicator ditampilkan untuk pesan yang diedit
- ✅ **Error Handling**: Revert operations memulihkan state yang benar
- ✅ **Real-time Sync**: EventBus notifications tetap bekerja untuk kedua chat types

### CRITICAL FIXES: Group Chat State Preservation (Message Disappearing Bug)

### Root Cause Analysis ✅

Identified the **critical issue** causing messages to still disappear after delete/edit:

1. **Background Refresh Overwriting State**:

   - `fetchGroupMessages` was being called automatically after delete/edit operations
   - This background refresh would overwrite local state with API data
   - API doesn't return deleted/edited state, so messages would revert

2. **WebSocket Updates Competing with Local State**:

   - WebSocket messages could overwrite locally deleted/edited messages
   - Insufficient filtering in WebSocket handler
   - New incoming messages would replace local state

3. **Insufficient Merge Priority**:
   - Local state preservation logic wasn't robust enough
   - API data was given equal or higher priority than local state
   - Pending operations tracking was incomplete

### Critical Fixes Applied ✅

#### 1. Removed Destructive Background Refreshes

```typescript
// BEFORE (causing state loss):
setTimeout(() => {
  if (!hasPendingOperations) {
    fetchGroupMessages(1, 20); // ❌ This overwrites local state
  }
}, 2000);

// AFTER (state preserved):
// No background refresh - state is already correctly updated locally
```

#### 2. Enhanced WebSocket State Protection

```typescript
// CRITICAL: Always keep deleted or edited messages - they should never be overwritten
if (msg.isDeleted || msg.isEdited) {
  console.log(
    `[GroupChat] Preserving ${msg.isDeleted ? "deleted" : "edited"} message ${
      msg.id
    }`
  );
  return true; // ✅ Block any WebSocket updates
}

// Filter out WebSocket messages that would conflict with local state
const safeNewMessages = uniqueNewMessages.filter((newMsg) => {
  const existingMessage = prevMessages.find(
    (existing) => existing.id === newMsg.id
  );
  if (
    existingMessage &&
    (existingMessage.isDeleted || existingMessage.isEdited)
  ) {
    console.log(
      `[GroupChat] Blocking WebSocket update for ${
        existingMessage.isDeleted ? "deleted" : "edited"
      } message`
    );
    return false; // ✅ Prevent state overwrite
  }
  return true;
});
```

#### 3. Absolute Local State Priority

```typescript
// CRITICAL: If we have local state for delete/edit operations, ALWAYS preserve it
if (existingMessage.isDeleted) {
  return {
    ...existingMessage, // ✅ Keep ALL local state
    timestamp: apiMessage.timestamp || existingMessage.timestamp, // Only update timestamp
  };
}

if (existingMessage.isEdited) {
  return {
    ...existingMessage, // ✅ Keep ALL local state including content
    timestamp: apiMessage.timestamp || existingMessage.timestamp,
  };
}
```

### Comparison with ChatArea (Working Implementation) ✅

**ChatArea doesn't have this issue because:**

1. ✅ Uses session storage for persistence
2. ✅ No automatic background refreshes after operations
3. ✅ Strong local state preservation in WebSocket handlers
4. ✅ Conservative merge behavior prioritizing local state

**GroupChatArea now matches ChatArea behavior:**

1. ✅ Removed automatic background refreshes
2. ✅ Strong local state protection from WebSocket updates
3. ✅ Absolute priority for local deleted/edited state
4. ✅ Conservative merge behavior

### Expected Results After Fixes ✅

1. **Delete (Unsend)**:

   - ✅ Message immediately shows "This message was deleted" (italic gray)
   - ✅ State persists through any API refresh or WebSocket update
   - ✅ Message NEVER disappears or reverts to original content

2. **Edit**:

   - ✅ Message immediately shows edited content with "(edited)" indicator
   - ✅ Edited state and content persist through all data updates
   - ✅ Message NEVER reverts to original content

3. **Consistency**:
   - ✅ Group chat behavior now identical to private chat
   - ✅ Same visual styling and state persistence

### Files Modified ✅

- `/src/components/chat/group-chat-area.tsx` - Critical state preservation fixes
- `/CHAT_UNIFICATION.md` - Updated documentation

## ENDPOINT UNIFICATION: Simplified Edit/Delete Operations ✅

### Issue Resolved

Group chat was using complex fallback logic with multiple endpoints that could fail. Updated to use the unified endpoints as specified:

### New Unified Endpoints Used:

- **Edit Message**: `PUT /messages/{id}` with `{ content: "new content" }`
- **Delete Message**: `DELETE /messages/{id}` (no body required)

### Changes in useGroup.ts:

#### Before (Complex Fallback Logic):

```typescript
// editGroupMessage - trying 3 different endpoints
// 1. PUT /messages/{id} with group_id
// 2. PUT /groups/{groupId}/messages/{messageId}
// 3. PATCH /messages/{id} with group_id

// deleteGroupMessage - trying 3 different endpoints
// 1. DELETE /messages/{id} with group_id in body
// 2. DELETE /groups/{groupId}/messages/{messageId}
// 3. DELETE /messages/{id}?group_id={groupId}
```

#### After (Unified Simple Endpoints): ✅

```typescript
// editGroupMessage - single endpoint
PUT /messages/{messageId}
Body: { content: "new content" }

// deleteGroupMessage - single endpoint
DELETE /messages/{messageId}
No body required
```

### Benefits:

1. **Simplified Logic**: No more complex fallback chains
2. **Consistent with Private Chat**: Uses same endpoints as private messages
3. **Backend Compatibility**: Works with unified message system
4. **Reduced Error Surface**: Single endpoint means fewer failure points
5. **Cleaner Logging**: Simplified debug output

### Expected Resolution:

The previous "still disappearing" issue should now be resolved because:

1. ✅ Using correct unified endpoints
2. ✅ No complex fallback logic to interfere with responses
3. ✅ Consistent API behavior between private and group chat
4. ✅ State preservation logic already fixed (previous commits)

## TEMP MESSAGE ID BUG FIX ✅

### Issue Identified

User correctly pointed out that edit/delete was using temporary IDs like `temp-1751371951767-0.060699365700019214` instead of real message IDs from the server.

### Root Cause Analysis:

1. **Optimistic Messages**: When sending new messages, temporary IDs are created for immediate UI feedback
2. **Poor ID Replacement**: When server responds with real message ID, the temp ID wasn't being properly replaced
3. **Edit Attempts on Temp IDs**: Users could try to edit messages that still had temp IDs, causing API calls with invalid IDs

### Critical Fix Applied ✅

#### 1. Proper ID Replacement After Send:

```typescript
// BEFORE: Only updated status, kept temp ID
setMessages((prev) =>
  prev.map((msg) =>
    msg.id === tempId ? { ...msg, pending: false, delivered: true } : msg
  )
);

// AFTER: Replace temp ID with real server ID ✅
setMessages((prev) =>
  prev.map((msg) => {
    if (msg.id === tempId) {
      const realMessageId = response.message_id;
      console.log(`Replacing temp ID ${tempId} with real ID ${realMessageId}`);
      return { ...msg, id: realMessageId, pending: false, delivered: true };
    }
    return msg;
  })
);
```

#### 2. Enhanced WebSocket Optimistic Removal:

```typescript
// Enhanced logic to properly match temp messages with real WebSocket updates
const hasMatchingRealMessage = uniqueNewMessages.some((newMsg) => {
  // Check for direct ID match first
  if (newMsg.id === msg.id) return true;

  // For temp messages, check by content and sender
  if (msg.id.startsWith("temp-")) {
    return (
      newMsg.sender.id === msg.sender.id &&
      newMsg.content === msg.content &&
      Math.abs(
        new Date(newMsg.timestamp).getTime() - new Date(msg.timestamp).getTime()
      ) < 10000
    );
  }
  return false;
});
```

#### 3. Protective Edit Handler:

```typescript
// CRITICAL: Prevent editing temp messages
if (editingMessageId.startsWith("temp-")) {
  console.error(
    `CRITICAL ERROR: Attempting to edit temp message ${editingMessageId}`
  );
  toast.error("Cannot edit this message. Please try refreshing the page.");
  return;
}
```

### Expected Results ✅

1. **Proper API Calls**: Edit/delete will use real message IDs like `messages/abc123` instead of `messages/temp-...`
2. **No Temp ID Errors**: Backend will receive valid message IDs
3. **Better User Experience**: No more failed edit/delete operations due to invalid IDs
4. **Consistent State**: Messages maintain their proper IDs throughout their lifecycle

### Testing Points:

- [x] Send message → Real ID replaces temp ID
- [x] Edit message → Uses real ID, not temp ID
- [x] Delete message → Uses real ID, not temp ID
- [x] WebSocket updates → Properly remove optimistic messages
- [x] Temp ID protection → Prevents invalid edit attempts

---
