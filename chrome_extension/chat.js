document.addEventListener('DOMContentLoaded', async () => {
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const clearChatButton = document.getElementById('clearChatButton');

    let modelName = '';
    let conversationHistory = []; // To store messages for context
    const storageKeyPrefix = 'ollamaBroChat_';

    // --- Storage Helper Functions ---
    function getStorageKey(currentModelName) {
        return `${storageKeyPrefix}${currentModelName.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    }

    async function saveChatHistory(currentModelName, history) {
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available. Chat history will not be saved.');
            return;
        }
        try {
            const key = getStorageKey(currentModelName);
            await chrome.storage.local.set({ [key]: { conversationHistory: history, timestamp: new Date().toISOString() } });
            console.log(`Chat history saved for ${currentModelName}`);
        } catch (error) {
            console.error('Error saving chat history:', error);
        }
    }

    async function loadChatHistory(currentModelName) {
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available. Chat history will not be loaded.');
            return false;
        }
        try {
            const key = getStorageKey(currentModelName);
            const data = await chrome.storage.local.get(key);
            if (data && data[key] && data[key].conversationHistory) {
                conversationHistory = data[key].conversationHistory;
                conversationHistory.forEach(msg => {
                    addMessageToChat(msg.role === 'user' ? 'You' : currentModelName, msg.content, msg.role === 'user' ? 'user-message' : 'bot-message');
                });
                console.log(`Chat history loaded for ${currentModelName}`);
                return true;
            }
        } catch (error) {
            console.error('Error loading chat history:', error);
        }
        return false;
    }

    async function clearStoredChatHistory(currentModelName) {
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available. Chat history will not be cleared from storage.');
            return;
        }
        try {
            const key = getStorageKey(currentModelName);
            await chrome.storage.local.remove(key);
            console.log(`Stored chat history cleared for ${currentModelName}`);
        } catch (error) {
            console.error('Error clearing stored chat history:', error);
        }
    }

    // Function to get model name from URL query parameters
    function getModelNameFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('model');
    }

    // Initialize: Get model name and display it
    modelName = getModelNameFromURL();
    if (modelName) {
        modelNameDisplay.textContent = `Chatting with: ${decodeURIComponent(modelName)}`;
        // Load chat history
        const historyLoaded = await loadChatHistory(modelName);
        if (!historyLoaded) {
            // Initial greeting only if no history was loaded
            addMessageToChat(modelName, `Hello! Ask me anything. (Model: ${decodeURIComponent(modelName)})`, 'bot-message');
        }
    } else {
        modelNameDisplay.textContent = 'Error: Model name not specified.';
        messageInput.disabled = true;
        sendButton.disabled = true;
        addMessageToChat('System', 'No model specified. Please select a model from the extension popup.', 'bot-message');
        return;
    }

    // Function to add a message to the chat container
    function addMessageToChat(sender, text, messageClass) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', messageClass);

        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;

        const textDiv = document.createElement('div');
        textDiv.textContent = text; // Using textContent to prevent XSS

        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(textDiv);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to the bottom
    }

    // Function to send message to the Ollama API via proxy
    async function sendMessageToOllama(prompt) {
        if (!prompt.trim()) return;

        addMessageToChat('You', prompt, 'user-message');
        messageInput.value = ''; // Clear input field
        loadingIndicator.style.display = 'block';
        sendButton.disabled = true;
        messageInput.disabled = true;

        // Add user message to conversation history
        conversationHistory.push({ role: 'user', content: prompt });
        await saveChatHistory(modelName, conversationHistory); // Save after adding user message

        const proxyUrl = 'http://localhost:3000/proxy/api/chat';

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: conversationHistory, // Send the whole history
                    stream: false // We are not handling streaming responses in this version
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error structure' }));
                console.error('Error from Ollama API:', response.status, errorData);
                addMessageToChat(modelName, `Error: ${errorData.error || response.statusText || 'Failed to get response.'}`, 'bot-message');
                // Remove last user message from history if bot failed, so user can retry the same prompt
                // Or, keep it, depending on desired retry behavior. For now, let's keep it.
            } else {
                const data = await response.json();
                if (data.message && data.message.content) {
                    addMessageToChat(modelName, data.message.content, 'bot-message');
                    // Add bot response to conversation history
                    conversationHistory.push({ role: 'assistant', content: data.message.content });
                    await saveChatHistory(modelName, conversationHistory); // Save after adding bot message
                } else {
                    addMessageToChat(modelName, 'Received an empty or unexpected response from the model.', 'bot-message');
                }
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            addMessageToChat('System', `Network Error: Could not connect to the proxy server or Ollama. Details: ${error.message}`, 'bot-message');
        } finally {
            loadingIndicator.style.display = 'none';
            sendButton.disabled = false;
            messageInput.disabled = false;
            messageInput.focus();
        }
    }

    // Event listeners
    sendButton.addEventListener('click', () => {
        sendMessageToOllama(messageInput.value);
    });

    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessageToOllama(messageInput.value);
        }
    });

    // console.log(`Chat initialized for model: ${modelName}`); // Moved or handled by loadChatHistory

    // Auto-focus message input when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            if (messageInput && !messageInput.disabled) {
                messageInput.focus();
            }
        }
    });

    // Event listener for Clear Chat History button
    if (clearChatButton) {
        clearChatButton.addEventListener('click', async () => {
            if (modelName && window.confirm(`Are you sure you want to clear the chat history for ${decodeURIComponent(modelName)}? This action cannot be undone.`)) {
                // Clear in-memory history
                conversationHistory = [];

                // Clear UI
                while (chatContainer.firstChild) {
                    chatContainer.removeChild(chatContainer.firstChild);
                }

                // Clear stored history
                await clearStoredChatHistory(modelName);

                // Add initial greeting back
                addMessageToChat(modelName, `Hello! Ask me anything. (Model: ${decodeURIComponent(modelName)})`, 'bot-message');
                
                // Ensure input is usable
                messageInput.disabled = false;
                sendButton.disabled = false;
                messageInput.focus();
                console.log(`Chat history cleared for ${modelName} by user.`);
            }
        });
    }
});
