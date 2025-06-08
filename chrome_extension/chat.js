document.addEventListener('DOMContentLoaded', async () => {
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const clearChatButton = document.getElementById('clearChatButton');
    const modelSwitcherButton = document.getElementById('modelSwitcherButton');
    const modelSwitcherDropdown = document.getElementById('modelSwitcherDropdown');
    const conversationSidebar = document.getElementById('conversationSidebar');
    const newChatButton = document.getElementById('newChatButton');
    const collapseSidebarButton = document.getElementById('collapseSidebarButton');
    const conversationList = document.getElementById('conversationList');

    let currentModelName = '';
    const storageKeyPrefix = 'ollamaBroChat_';
    const sidebarStateKey = 'ollamaBroSidebarState';
    let availableModels = [];

    function getModelStorageKey(model) {
        const key = `${storageKeyPrefix}${model.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        console.log('[OllamaBro] getModelStorageKey - Model:', model, 'Generated Key:', key);
        return key;
    }

    async function loadModelChatState(modelToLoad) {
        console.log('[OllamaBro] loadModelChatState - Attempting to load for model:', modelToLoad);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return { conversations: {}, activeConversationId: null };
        }
        try {
            const key = getModelStorageKey(modelToLoad); // Key generation will also log
            const storageResult = await chrome.storage.local.get(key);
            console.log('[OllamaBro] loadModelChatState - Key used:', key, 'Data loaded from storage:', storageResult);

            let modelSpecificData = storageResult[key];

            if (modelSpecificData && typeof modelSpecificData === 'object') {
                // Data exists and is an object, proceed with checks
                // Ensure a deep copy for logging to avoid showing mutated object if it's referenced elsewhere
                try {
                    console.log(`Raw chat state loaded for ${modelToLoad}:`, JSON.parse(JSON.stringify(modelSpecificData)));
                } catch (e) {
                    console.warn(`[OllamaBro] loadModelChatState - Could not stringify modelSpecificData for logging for model ${modelToLoad}:`, modelSpecificData);
                }

                if (typeof modelSpecificData.conversations !== 'object' || modelSpecificData.conversations === null) {
                    console.warn(`[OllamaBro] loadModelChatState - 'conversations' property missing or not an object for model ${modelToLoad}. Initializing.`);
                    modelSpecificData.conversations = {};
                }
                if (typeof modelSpecificData.activeConversationId === 'undefined') {
                    console.warn(`[OllamaBro] loadModelChatState - 'activeConversationId' property missing for model ${modelToLoad}. Initializing to null.`);
                    modelSpecificData.activeConversationId = null;
                }
                return modelSpecificData;
            } else if (modelSpecificData) {
                // Data exists but is NOT an object (e.g., string, number, boolean due to corruption)
                console.warn(`[OllamaBro] loadModelChatState - Data for model ${modelToLoad} is not an object:`, modelSpecificData, ". Resetting to default structure.");
                return { conversations: {}, activeConversationId: null }; // Return default structure
            }
            // modelSpecificData is null or undefined (no data for this key)
            console.log(`[OllamaBro] loadModelChatState - No data found for ${modelToLoad}. Returning default structure.`);
            return { conversations: {}, activeConversationId: null }; // Default if nothing stored
        } catch (error) {
            console.error('Error loading chat state:', error);
            return { conversations: {}, activeConversationId: null };
        }
    }

    async function saveModelChatState(modelToSave, modelData) {
        console.log('[OllamaBro] saveModelChatState - Attempting to save for model:', modelToSave, 'Data:', modelData);
        if (!chrome.storage || !chrome.storage.local) {
            console.warn('Chrome storage API not available.');
            return;
        }
        try {
            const key = getModelStorageKey(modelToSave); // Key generation will also log
            await chrome.storage.local.set({ [key]: modelData });
            console.log('[OllamaBro] saveModelChatState - Key used:', key, 'Save successful.');
            console.log(`Chat state saved for ${modelToSave}`);
        } catch (error) {
            console.error('Error saving chat state:', error);
        }
    }

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function getConversationSummary(messages) {
        if (!messages || messages.length === 0) return 'New Chat';
        const firstUserMessage = messages.find(msg => msg.role === 'user');
        return firstUserMessage ? firstUserMessage.content.substring(0, 40) : 'Chat'; // Max 40 chars for summary
    }

    function addMessageToChatUI(sender, initialText, messageClass) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', messageClass);
        
        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;
        
        const textDiv = document.createElement('div');
        textDiv.classList.add('message-content'); // Added class for easier selection if needed
        textDiv.textContent = initialText;
        
        messageDiv.appendChild(senderDiv);
        messageDiv.appendChild(textDiv);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return textDiv; // Return the element where text is displayed
    }

    function updateBotMessageInUI(botTextElement, newContentChunk) {
        botTextElement.textContent += newContentChunk;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function displayConversationMessages(modelData, conversationId) {
        chatContainer.innerHTML = ''; // Clear current messages
        if (modelData.conversations[conversationId] && modelData.conversations[conversationId].messages) {
            modelData.conversations[conversationId].messages.forEach(msg => {
                addMessageToChatUI(msg.role === 'user' ? 'You' : currentModelName, msg.content, msg.role === 'user' ? 'user-message' : 'bot-message');
            });
        } else {
             addMessageToChatUI(currentModelName, `Hello! Start a new conversation with ${decodeURIComponent(currentModelName)}.`, 'bot-message');
        }
    }

    async function startNewConversation(modelForNewChat = currentModelName) {
        console.log(`Starting new conversation for model: ${modelForNewChat}`);
        let modelData = await loadModelChatState(modelForNewChat);
        const newConversationId = generateUUID();
        modelData.conversations[newConversationId] = {
            id: newConversationId,
            messages: [],
            summary: 'New Chat',
            lastMessageTime: Date.now()
        };
        modelData.activeConversationId = newConversationId;
        await saveModelChatState(modelForNewChat, modelData);
        displayConversationMessages(modelData, newConversationId);
        populateConversationSidebar(modelForNewChat, modelData);
        messageInput.focus();
        return newConversationId;
    }

    async function switchActiveConversation(modelToSwitch, newConversationId) {
        console.log(`Switching to conversation ${newConversationId} for model ${modelToSwitch}`);
        let modelData = await loadModelChatState(modelToSwitch);
        if (modelData.conversations[newConversationId]) {
            modelData.activeConversationId = newConversationId;
            await saveModelChatState(modelToSwitch, modelData);
            displayConversationMessages(modelData, newConversationId);
            populateConversationSidebar(modelToSwitch, modelData); // Refresh sidebar to highlight active
        } else {
            console.warn(`Conversation ${newConversationId} not found for model ${modelToSwitch}. Starting new one.`);
            await startNewConversation(modelToSwitch);
        }
        messageInput.focus();
    }

    async function handleDeleteConversation(modelOfConversation, conversationIdToDelete) {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        console.log(`Deleting conversation ${conversationIdToDelete} for model ${modelOfConversation}`);
        let modelData = await loadModelChatState(modelOfConversation);
        if (modelData.conversations[conversationIdToDelete]) {
            delete modelData.conversations[conversationIdToDelete];
            if (modelData.activeConversationId === conversationIdToDelete) {
                modelData.activeConversationId = null;
                const remainingConvIds = Object.keys(modelData.conversations);
                if (remainingConvIds.length > 0) {
                    // Switch to the most recent remaining conversation
                    const sortedRemaining = remainingConvIds.map(id => modelData.conversations[id])
                                                      .sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                    modelData.activeConversationId = sortedRemaining[0].id;
                    await saveModelChatState(modelOfConversation, modelData);
                    switchActiveConversation(modelOfConversation, modelData.activeConversationId);
                } else {
                    await saveModelChatState(modelOfConversation, modelData); // Save cleared activeId
                    await startNewConversation(modelOfConversation); // No convs left, start a new one
                }
            } else {
                await saveModelChatState(modelOfConversation, modelData);
                populateConversationSidebar(modelOfConversation, modelData); // Just refresh sidebar if deleted conv wasn't active
            }
        } else {
            console.warn(`Conversation ${conversationIdToDelete} not found for deletion.`);
        }
    }

    function populateConversationSidebar(modelForSidebar, modelData) {
        conversationList.innerHTML = ''; // Clear existing items
        if (!modelData || !modelData.conversations) return;

        const sortedConversations = Object.values(modelData.conversations)
            .sort((a, b) => b.lastMessageTime - a.lastMessageTime); // Newest first

        sortedConversations.forEach(conv => {
            const item = document.createElement('div');
            item.classList.add('conversation-item');
            item.dataset.conversationId = conv.id;
            if (conv.id === modelData.activeConversationId) {
                item.classList.add('active');
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('conversation-item-title');
            titleSpan.textContent = conv.summary || 'Chat';
            titleSpan.title = conv.summary || 'Chat'; // Tooltip for full title

            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-conversation-button');
            deleteButton.innerHTML = '&#x1F5D1;'; // Trash can icon
            deleteButton.title = 'Delete chat';
            deleteButton.dataset.conversationId = conv.id;

            item.appendChild(titleSpan);
            item.appendChild(deleteButton);
            conversationList.appendChild(item);

            item.addEventListener('click', (e) => {
                if (e.target === deleteButton || deleteButton.contains(e.target)) return; // Don't switch if delete is clicked
                switchActiveConversation(modelForSidebar, conv.id);
            });
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent item click event
                handleDeleteConversation(modelForSidebar, conv.id);
            });
        });
    }

    async function sendMessageToOllama(prompt) {
        if (!prompt || prompt.trim() === '') return;

        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            console.warn('No active or valid conversation found, attempting to start a new one.');
            // Attempt to start a new conversation and reload state
            await startNewConversation(currentModelName);
            modelData = await loadModelChatState(currentModelName);
            // If still no active conversation, something is wrong, so return.
            if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
                console.error('Failed to start or find an active conversation after attempting to create one.');
                addMessageToChatUI('System', 'Error: Could not establish an active conversation. Please try refreshing or creating a new chat manually.', 'error-message');
                return;
            }
        }
        const activeConvId = modelData.activeConversationId;
        const currentConversation = modelData.conversations[activeConvId];

        // Add user message to UI and save state
        addMessageToChatUI('You', prompt, 'user-message');
        currentConversation.messages.push({ role: 'user', content: prompt });
        currentConversation.summary = getConversationSummary(currentConversation.messages);
        currentConversation.lastMessageTime = Date.now();
        await saveModelChatState(currentModelName, modelData);
        populateConversationSidebar(currentModelName, modelData);

        messageInput.value = '';
        loadingIndicator.style.display = 'block';
        messageInput.disabled = true;
        sendButton.disabled = true;

        let botTextElement = addMessageToChatUI(currentModelName, '', 'bot-message');
        let fullBotResponse = '';

        try {
            console.log(`Sending to /proxy/api/chat with model: ${currentModelName} for streaming.`);
            const response = await fetch('http://localhost:3000/proxy/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: currentModelName,
                    messages: currentConversation.messages.filter(m => m.role === 'user' || m.role === 'assistant')
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to get error text from non-OK response.');
                console.error('Ollama API Error (stream):', response.status, errorText);
                throw new Error(`Ollama API Error: ${response.status} ${errorText || response.statusText}`);
            }

            if (!response.body) {
                throw new Error('Response body is null, cannot read stream.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    console.log('Stream finished reading.');
                    break;
                }
                buffer += decoder.decode(value, { stream: true });
                
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                    const line = buffer.substring(0, newlineIndex).trim();
                    buffer = buffer.substring(newlineIndex + 1);

                    if (line) {
                        try {
                            const parsedChunk = JSON.parse(line);
                            if (parsedChunk.message && parsedChunk.message.content) {
                                fullBotResponse += parsedChunk.message.content;
                                updateBotMessageInUI(botTextElement, parsedChunk.message.content);
                            }
                            // The 'done' property in each chunk usually indicates if that specific chunk is the last one from the model's generation for that turn, 
                            // but the overall stream ends when reader.read() returns done:true.
                            if (parsedChunk.done && parsedChunk.message && parsedChunk.message.content === '') {
                                // This often signifies the true end of a successful stream from Ollama
                                console.log('Ollama stream chunk indicated done:true with empty content.');
                            }
                        } catch (e) {
                            console.warn('Error parsing JSON chunk from stream:', e, 'Chunk:', line);
                        }
                    }
                }
            }
            
            // Process any remaining buffer content after the stream ends
            if (buffer.trim()) {
                 try {
                    const parsedChunk = JSON.parse(buffer.trim());
                    if (parsedChunk.message && parsedChunk.message.content) {
                        fullBotResponse += parsedChunk.message.content;
                        updateBotMessageInUI(botTextElement, parsedChunk.message.content);
                    }
                } catch (e) {
                    console.warn('Error parsing final JSON chunk from stream buffer:', e, 'Chunk:', buffer.trim());
                }
            }

            // After stream is complete and all chunks processed
            if (fullBotResponse.trim() !== '') {
                currentConversation.messages.push({ role: 'assistant', content: fullBotResponse });
                currentConversation.summary = getConversationSummary(currentConversation.messages);
                currentConversation.lastMessageTime = Date.now();
                await saveModelChatState(currentModelName, modelData);
                populateConversationSidebar(currentModelName, modelData);
            } else {
                if (botTextElement && botTextElement.parentElement && botTextElement.parentElement.classList.contains('message')) {
                    botTextElement.parentElement.remove(); // Remove the empty bot message placeholder
                }
                console.log('Bot response was empty after streaming.');
            }

        } catch (error) {
            console.error('Error sending message to Ollama or processing stream:', error);
            if (botTextElement) { // Ensure botTextElement exists before trying to update it
                updateBotMessageInUI(botTextElement, `\n\n--- ERROR: ${error.message} ---`);
            }
            // Optionally, add error to conversation history
            // currentConversation.messages.push({ role: 'system', content: `Streaming Error: ${error.message}` });
            // await saveModelChatState(currentModelName, modelData); // Consider if saving error state is desired
        } finally {
            loadingIndicator.style.display = 'none';
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    async function clearAllConversationsForModel(modelToClear) {
        if (!confirm(`Are you sure you want to clear ALL chat history for ${decodeURIComponent(modelToClear)}? This action cannot be undone.`)) {
            return;
        }
        console.log(`Clearing all conversations for model: ${modelToClear}`);
        let modelData = { conversations: {}, activeConversationId: null };
        await saveModelChatState(modelToClear, modelData);
        await startNewConversation(modelToClear); // This will also update UI and sidebar
    }

    async function switchModel(newModelName) {
        const oldModelName = currentModelName;
        if (newModelName === oldModelName) return;
        console.log('[OllamaBro] switchModel - Switching from:', oldModelName, 'to:', newModelName);
        console.log(`Switching model to: ${newModelName}`);
        currentModelName = newModelName;
        modelNameDisplay.textContent = `Chatting with: ${decodeURIComponent(currentModelName)}`;
        
        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName); // Start new if no active or no convs
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();
    }

    async function fetchAvailableModels() {
        if (availableModels.length > 0) return availableModels;
        const proxyUrl = 'http://localhost:3000/proxy/api/tags';
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) {
                console.error('Failed to fetch models:', response.status, await response.text());
                return [];
            }
            const data = await response.json();
            availableModels = data.models ? data.models.map(m => m.name) : [];
            return availableModels;
        } catch (error) {
            console.error('Error fetching available models:', error);
            return [];
        }
    }

    function populateModelDropdown(models, currentModel) {
        modelSwitcherDropdown.innerHTML = ''; // Clear previous items
        const ul = document.createElement('ul');

        if (models.length === 0) {
            const noModelsItem = document.createElement('li');
            noModelsItem.textContent = 'No models found.';
            noModelsItem.classList.add('model-dropdown-item', 'no-models'); // Add a class for styling if needed
            ul.appendChild(noModelsItem);
            modelSwitcherDropdown.appendChild(ul);
            return;
        }

        models.forEach(mName => {
            const li = document.createElement('li');
            const a = document.createElement('a');
            a.href = '#';
            a.textContent = mName;
            a.dataset.modelName = mName;
            
            li.classList.add('model-dropdown-item');
            if (mName === currentModel) {
                li.classList.add('active-model');
            }

            a.addEventListener('click', async (e) => {
                e.preventDefault();
                if (mName !== currentModelName) { // Prevent re-switching to the same model
                    await switchModel(mName);
                }
                modelSwitcherDropdown.style.display = 'none';
                // Re-populate to update active class, or just update class directly
                // For simplicity, direct class update is better if switchModel doesn't recall populate.
                // Assuming switchModel updates currentActiveModel globally.
                const allItems = ul.querySelectorAll('li.model-dropdown-item');
                allItems.forEach(item => item.classList.remove('active-model'));
                li.classList.add('active-model');
            });
            li.appendChild(a);
            ul.appendChild(li);
        });
        modelSwitcherDropdown.appendChild(ul);
    }

    async function init() {
        const urlModel = new URLSearchParams(window.location.search).get('model');
        if (!urlModel) {
            modelNameDisplay.textContent = 'Error: Model name not specified.';
            addMessageToChatUI('System', 'No model specified. Select a model.', 'bot-message');
            messageInput.disabled = true; sendButton.disabled = true;
            return;
        }
        currentModelName = urlModel;
        console.log('[OllamaBro] init - Initializing chat for model from URL:', currentModelName);
        modelNameDisplay.textContent = `Chatting with: ${decodeURIComponent(currentModelName)}`;

        let modelData = await loadModelChatState(currentModelName);
        if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
            await startNewConversation(currentModelName);
        } else {
            displayConversationMessages(modelData, modelData.activeConversationId);
            populateConversationSidebar(currentModelName, modelData);
        }
        
        messageInput.disabled = false;
        sendButton.disabled = false;
        messageInput.focus();

        // Sidebar collapse/expand persistence
        const savedSidebarState = await chrome.storage.local.get(sidebarStateKey);
        if (savedSidebarState && savedSidebarState[sidebarStateKey] === 'collapsed') {
            conversationSidebar.classList.add('collapsed');
            collapseSidebarButton.innerHTML = '&#x2192;'; // Right arrow
        } else {
            conversationSidebar.classList.remove('collapsed');
            collapseSidebarButton.innerHTML = '&#x2190;'; // Left arrow
        }
    }

    // Event Listeners
    sendButton.addEventListener('click', () => sendMessageToOllama(messageInput.value));
    messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessageToOllama(messageInput.value); });
    
    clearChatButton.addEventListener('click', () => clearAllConversationsForModel(currentModelName));
    
    newChatButton.addEventListener('click', () => startNewConversation(currentModelName));

    modelSwitcherButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (modelSwitcherDropdown.style.display === 'block') {
            modelSwitcherDropdown.style.display = 'none';
        } else {
            const models = await fetchAvailableModels();
            populateModelDropdown(models, currentModelName);
            modelSwitcherDropdown.style.display = 'block';
        }
    });

    document.addEventListener('click', (e) => {
        if (!modelSwitcherButton.contains(e.target) && !modelSwitcherDropdown.contains(e.target)) {
            modelSwitcherDropdown.style.display = 'none';
        }
    });

    collapseSidebarButton.addEventListener('click', async () => {
        conversationSidebar.classList.toggle('collapsed');
        const isCollapsed = conversationSidebar.classList.contains('collapsed');
        collapseSidebarButton.innerHTML = isCollapsed ? '&#x2192;' : '&#x2190;'; // Right/Left arrow
        await chrome.storage.local.set({ [sidebarStateKey]: isCollapsed ? 'collapsed' : 'expanded' });
    });

    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') messageInput.focus(); });

    init();

});
