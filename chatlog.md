## OllamaBro: Implemented Chat Persistence (Steps 7-11)

**Goal:** Add persistence to chat conversations so they are remembered when a chat tab is closed and reopened.

**Changes Made:**

1.  **`chrome_extension/manifest.json`:**
    *   Added the `"storage"` permission to allow the extension to use `chrome.storage.local`.

2.  **`chrome_extension/chat.js`:**
    *   The main `DOMContentLoaded` event listener was made `async`.
    *   Added helper functions:
        *   `getStorageKey(modelName)`: Creates a unique storage key for each model (e.g., `ollamaBroChat_phi4_latest`).
        *   `saveChatHistory(modelName, history)`: Saves the `conversationHistory` array to `chrome.storage.local` under the model-specific key.
        *   `loadChatHistory(modelName)`: Attempts to load `conversationHistory` from `chrome.storage.local`. If found, it populates the chat UI with the messages.
    *   **Initialization Logic:**
        *   When the chat page loads, it now calls `loadChatHistory` for the current model.
        *   The initial greeting message ("Hello! Ask me anything...") is only displayed if no prior chat history is loaded.
    *   **Message Sending Logic (`sendMessageToOllama`):**
        *   After a user message is added to `conversationHistory`, `saveChatHistory` is called.
        *   After a bot response is added to `conversationHistory`, `saveChatHistory` is called again.

**Outcome:** Chat conversations are now saved locally per model. When a user reopens a chat tab for a model they've previously chatted with, the conversation history is restored. New models start with a fresh chat.


## OllamaBro: Auto-focus Message Input (Step 15-16)

**Goal:** Automatically focus the message input field when the user switches to the chat tab.

**Changes Made:**

1.  **`chrome_extension/chat.js`:**
    *   Added an event listener for `document.visibilitychange`.
    *   When the chat tab becomes `visible` (and the input is not disabled), `messageInput.focus()` is called.

**Outcome:** The message input field now automatically gains focus when the user navigates to the chat tab, improving usability.


## OllamaBro: Clear Chat History Feature (Steps 24-29)

**Goal:** Allow users to clear the chat history for the current model.

**Changes Made:**

1.  **`chrome_extension/chat.html`:**
    *   Added a "Clear History" button (`#clearChatButton`) to the header.

2.  **`chrome_extension/chat.js`:**
    *   Added a reference to the `#clearChatButton`.
    *   Created a new `async` function `clearStoredChatHistory(modelName)` to remove the specific model's chat data from `chrome.storage.local.remove()`.
    *   Added an event listener to the "Clear History" button:
        *   Prompts the user with `window.confirm()` before clearing.
        *   If confirmed: Clears the in-memory `conversationHistory` array, removes all message `div`s from the `chatContainer`, calls `clearStoredChatHistory(modelName)`, and then re-adds the initial greeting message for the model.

**Outcome:** Users can now clear the chat history for a specific model, which removes it from both the UI and local storage.


## OllamaBro: Clear History Button UI Enhancement (Steps 37-40)

**Goal:** Improve the visual appearance and placement of the "Clear Chat History" button.

**Changes Made:**

1.  **`chrome_extension/chat.html`:**
    *   **Button Content:** Replaced the text "Clear History" with an SVG trash bin icon inside the `<button id="clearChatButton">`.
    *   Added a `title="Clear Chat History"` attribute to the button for accessibility.
    *   **Styling (CSS):**
        *   Modified the `header` style to include `position: relative;` for positioning context.
        *   Added new CSS rules for `#clearChatButton` to:
            *   Position it absolutely in the top-right corner of the header, vertically centered.
            *   Remove default button background and border.
            *   Style the SVG icon for size (22x22px) and color (white stroke).
            *   Add a hover effect for the icon (lighter stroke color).

**Outcome:** The "Clear Chat History" button is now a visually appealing trash bin icon located in the top-right corner of the chat header, improving the overall UI aesthetics. The functionality remains the same as the button's ID was not changed.


## OllamaBro: Enhanced User Message Bubble Visibility (Step 23)

**Goal:** Make user message bubbles in the chat interface more distinct and "pop" more.

**Changes Made:**

1.  **`chrome_extension/chat.html` (CSS):**
    *   The `.user-message` CSS class was updated.
    *   Added the property `border: 1px solid var(--theme-border-secondary);` to give user messages a defined border using the existing theme's secondary border color.
    *   The existing `box-shadow: var(--theme-shadow-soft);` is inherited from the general `.message` class and contributes to the "pop" effect.

**Outcome:** User message bubbles now have a border, making them visually more distinct from the background and assistant messages, improving the overall chat readability.


## Cascade Update - Step 23 (Chat Streaming Fix)

**USER Objective:** Implement Streaming LLM Responses in OllamaBro Chrome Extension.

**Action Taken:**
Applied significant restructuring to the `sendMessageToOllama` function in `chrome_extension/chat.js` to correctly implement streaming responses and address UI state issues.

**Key Changes in `sendMessageToOllama`:**
1.  **Corrected `try...catch...finally` Structure:** Ensured the entire message sending, stream fetching, processing, and UI update flow is within a robust error handling structure.
2.  **User Message Persistence:** User's message is now added to history and saved *before* the API call.
3.  **UI State Management:** Loading indicator and input field states are managed correctly, with the `finally` block ensuring they reset after success or failure. This specifically addresses the persistent loading indicator.
4.  **Streaming Request Setup:** The `fetch` call correctly sends the `model` and `messages` payload for Ollama, relying on the proxy for enabling streaming.
5.  **Stream Processing Logic:** Maintained the core logic for reading the `ReadableStream`, decoding NDJSON chunks, and incrementally updating the UI.
6.  **Improved Error Handling:** Errors during fetch or stream processing are caught and displayed in the chat UI.
7.  **Conversation State Update:** The full assistant response is saved to history after the stream completes.

**Expected Outcome:** Streaming should now function correctly, the loading indicator issue should be resolved, and overall chat stability improved.


## Cascade Update - Step 34 (Fix ERR_FILE_NOT_FOUND for Fetch)

**USER Objective:** Resolve `net::ERR_FILE_NOT_FOUND` error when sending messages.

**Issue Identified:**
The `fetch` call in `sendMessageToOllama` was using a relative URL (`/proxy/api/chat`). In the context of a Chrome extension, this resolves to `chrome-extension://<extension-id>/proxy/api/chat`, which doesn't exist, causing the error.

**Action Taken:**
Modified `chrome_extension/chat.js` to change the `fetch` URL in `sendMessageToOllama` to the absolute path of the proxy server: `http://localhost:3000/proxy/api/chat`.

**Key Change in `sendMessageToOllama`:**
*   Updated `fetch('/proxy/api/chat', ...)` to `fetch('http://localhost:3000/proxy/api/chat', ...)`. Similar to how `fetchAvailableModels` correctly targets the proxy.

**Expected Outcome:** The `net::ERR_FILE_NOT_FOUND` error should be resolved, and the chat messages should now be correctly sent to the proxy server for streaming.
