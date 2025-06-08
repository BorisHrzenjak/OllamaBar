document.addEventListener('DOMContentLoaded', async () => {
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // Ensure loading indicator is hidden on initialization
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
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

    function getCurrentConversationMessages(modelData) {
        if (modelData && modelData.activeConversationId && modelData.conversations && modelData.conversations[modelData.activeConversationId]) {
            return modelData.conversations[modelData.activeConversationId].messages || [];
        }
        return [];
    }

    function generateFilename(extension, modelName, messages) {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const summary = getConversationSummary(messages).replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 30) || 'chat';
        const cleanModelName = modelName.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
        return `${summary}_${cleanModelName}_${timestamp}.${extension}`;
    }

    async function copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Copied!';
                buttonElement.disabled = true;
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                    buttonElement.disabled = false;
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to copy text: ', err);
            if (buttonElement) {
                const originalInnerHTML = buttonElement.innerHTML;
                buttonElement.textContent = 'Error';
                setTimeout(() => {
                    buttonElement.innerHTML = originalInnerHTML;
                }, 1500);
            }
        }
    }

    function downloadMessage(text, filename, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function parseAndStyleThinking(text) {
        const fragment = document.createDocumentFragment();
        // Ensure text is a string; treat null/undefined as empty string
        if (typeof text !== 'string' || text === null) {
            if (text === null || typeof text === 'undefined') text = '';
            else text = String(text);
        }

        const regex = /<\s*think\s*>([\s\S]*?)<\/\s*think\s*>/gi; // Handles raw <think> tags, case-insensitive, allows spaces
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the <think> tag
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            // Add the <think> content, styled
            const thinkingSpan = document.createElement('span');
            thinkingSpan.className = 'thinking-block';
            thinkingSpan.textContent = match[1]; // Content between <think> and </think>
            fragment.appendChild(thinkingSpan);
            lastIndex = regex.lastIndex;
        }

        // Add any remaining text after the last </think>
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        return fragment;
    }

    function addMessageToChatUI(sender, initialText, messageClass, modelDataForFilename) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', messageClass);

        // Sender name (You or Model Name)
        const senderDiv = document.createElement('div');
        senderDiv.classList.add('message-sender');
        senderDiv.textContent = sender;
        messageDiv.appendChild(senderDiv);

        // Message text content wrapper
        const textContentDiv = document.createElement('div');
        textContentDiv.classList.add('message-text-content'); 
        if (messageClass === 'bot-message') {
            // Ensure initialText is treated as a string, even if null or undefined, before parsing
            const textToParse = (initialText === null || typeof initialText === 'undefined') ? '' : String(initialText);
            const fragment = parseAndStyleThinking(textToParse);
            textContentDiv.appendChild(fragment);
            textContentDiv.dataset.fullMessage = textToParse; // Initialize dataset for consistency
        } else {
            textContentDiv.textContent = initialText; // User messages don't need parsing for <think> tags
        }
        messageDiv.appendChild(textContentDiv);

        if (messageClass === 'bot-message') {
            const actionsDiv = document.createElement('div');
            actionsDiv.classList.add('message-actions');

            // Copy Button
            const copyButton = document.createElement('button');
            copyButton.classList.add('action-button', 'copy-button');
            copyButton.title = 'Copy to clipboard';

            const svgCopyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgCopyIcon.setAttribute('viewBox', '0 0 24 24');
            svgCopyIcon.setAttribute('fill', 'currentColor');
            svgCopyIcon.setAttribute('width', '18'); 
            svgCopyIcon.setAttribute('height', '18');

            const pathCopy = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathCopy.setAttribute('d', 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z');

            svgCopyIcon.appendChild(pathCopy);
            copyButton.appendChild(svgCopyIcon);

            copyButton.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent message click if any
                copyToClipboard(textContentDiv.textContent, copyButton);
            });
            actionsDiv.appendChild(copyButton);

            // Download TXT Button
            const downloadTxtButton = document.createElement('button');
            downloadTxtButton.classList.add('action-button', 'download-txt-button');
            downloadTxtButton.title = 'Download as .txt';

            const svgTxtIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgTxtIcon.setAttribute('viewBox', '0 0 24 24');
            svgTxtIcon.setAttribute('fill', 'currentColor');
            svgTxtIcon.setAttribute('width', '18');
            svgTxtIcon.setAttribute('height', '18');

            const pathTxt = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathTxt.setAttribute('d', 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z');

            svgTxtIcon.appendChild(pathTxt);
            downloadTxtButton.appendChild(svgTxtIcon);

            downloadTxtButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('txt', currentModelName, currentMessages);
                downloadMessage(textContentDiv.textContent, filename, 'text/plain;charset=utf-8');
            });
            actionsDiv.appendChild(downloadTxtButton);

            // Download MD Button
            const downloadMdButton = document.createElement('button');
            downloadMdButton.classList.add('action-button', 'download-md-button');
            downloadMdButton.title = 'Download as .md';

            const svgMdIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgMdIcon.setAttribute('viewBox', '0 0 24 24');
            svgMdIcon.setAttribute('fill', 'currentColor');
            svgMdIcon.setAttribute('width', '18');
            svgMdIcon.setAttribute('height', '18');

            const pathMd = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathMd.setAttribute('d', 'M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z');

            svgMdIcon.appendChild(pathMd);
            downloadMdButton.appendChild(svgMdIcon);

            downloadMdButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                const currentMessages = getCurrentConversationMessages(await loadModelChatState(currentModelName));
                const filename = generateFilename('md', currentModelName, currentMessages);
                // Basic MD: just the text. Could be enhanced to include sender.
                const mdContent = `## ${sender}\n\n${textContentDiv.textContent}`;
                downloadMessage(mdContent, filename, 'text/markdown;charset=utf-utf-8');
            });
            actionsDiv.appendChild(downloadMdButton);

            messageDiv.appendChild(actionsDiv);
        }

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
        
        return textContentDiv; // Return the element where text is displayed for streaming
    }

    function updateBotMessageInUI(botTextElement, newContentChunk) {
        const previousRawFullText = botTextElement.dataset.fullMessage || ''; // Get raw from previous step
        const currentRawFullText = previousRawFullText + newContentChunk; // Accumulate raw
        
        // Clear existing content and apply parsing to the whole updated text
        botTextElement.innerHTML = ''; // Clear previous spans/text nodes
        const fragment = parseAndStyleThinking(currentRawFullText); // Parse accumulated raw
        botTextElement.appendChild(fragment);
        
        // Store the full accumulated raw message content (with tags) in the botTextElement's data attribute
        botTextElement.dataset.fullMessage = currentRawFullText; 

        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function displayConversationMessages(modelData, conversationId) {
        chatContainer.innerHTML = ''; // Clear current messages
        if (modelData.conversations[conversationId] && modelData.conversations[conversationId].messages) {
            modelData.conversations[conversationId].messages.forEach(msg => {
                addMessageToChatUI(msg.role === 'user' ? 'You' : currentModelName, msg.content, msg.role === 'user' ? 'user-message' : 'bot-message', modelData);
            });
        } else {
             addMessageToChatUI(currentModelName, `Hello! Start a new conversation with ${decodeURIComponent(currentModelName)}.`, 'bot-message', modelData);
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
            await startNewConversation(currentModelName);
            modelData = await loadModelChatState(currentModelName);
            if (!modelData.activeConversationId || !modelData.conversations[modelData.activeConversationId]) {
                console.error('Failed to start or find an active conversation after attempting to create one.');
                addMessageToChatUI('System', 'Error: Could not establish an active conversation. Please try refreshing or creating a new chat manually.', 'error-message', modelData);
                return;
            }
        }
        const activeConvId = modelData.activeConversationId;
        const currentConversation = modelData.conversations[activeConvId];

        // Add user message to UI and save state
        addMessageToChatUI('You', prompt, 'user-message', modelData);
        currentConversation.messages.push({ role: 'user', content: prompt });
        currentConversation.summary = getConversationSummary(currentConversation.messages);
        currentConversation.lastMessageTime = Date.now();
        // Do not save yet, save after bot response or error

        messageInput.value = '';
        // Only show loading indicator when actually sending a request
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
        messageInput.disabled = true;
        sendButton.disabled = true;

        const botTextElement = addMessageToChatUI(currentModelName, '', 'bot-message', modelData);

        try {
            console.log(`Sending to /proxy/api/chat with model: ${currentModelName} for streaming.`);
            const response = await fetch('http://localhost:3000/proxy/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: currentModelName,
                    messages: currentConversation.messages.filter(m => m.role === 'user' || m.role === 'assistant'), // Send only user/assistant messages
                    stream: true
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Failed to get error text from non-OK response.');
                console.error('Ollama API Error (stream):', response.status, errorText);
                throw new Error(`Ollama API Error: ${response.status} ${errorText || response.statusText}`);
            }

            if (!response.body) {
                throw new Error('ReadableStream not available in response body.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let done = false;

            console.log('Starting to read stream...');
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    console.log('Raw chunk from stream:', chunk); // Log raw chunk
                    const jsonResponses = chunk.split('\n').filter(Boolean);
                    jsonResponses.forEach(jsonStr => {
                        console.log('Processing JSON string:', jsonStr); // Log JSON string before parsing
                        try {
                            const jsonResponse = JSON.parse(jsonStr);
                            console.log('Parsed JSON response:', jsonResponse); // Log parsed object

                            if (jsonResponse.message && typeof jsonResponse.message.content === 'string') {
                                console.log('Extracted text (jsonResponse.message.content):', jsonResponse.message.content);
                                updateBotMessageInUI(botTextElement, jsonResponse.message.content);
                            } else {
                                console.log('jsonResponse.message.content is missing, not a string, or message object itself is missing.');
                                // It's possible for 'done' messages to have no content, which is fine.
                                if (!jsonResponse.done) {
                                     console.warn('Received a non-done chunk without message.content text.');
                                }
                            }

                            if (jsonResponse.done) {
                                console.log('Stream finished by Ollama (jsonResponse.done is true)');
                                done = true; 
                            }
                        } catch (e) {
                            console.warn('Failed to parse JSON chunk from stream:', jsonStr, e);
                        }
                    });
                }
            }
            console.log('Stream reading complete.');

            const finalBotMessageToSave = botTextElement.dataset.fullMessage || botTextElement.textContent; // Fallback to textContent if dataset is somehow not set
            currentConversation.messages.push({ role: 'assistant', content: finalBotMessageToSave });
            currentConversation.summary = getConversationSummary(currentConversation.messages);
            currentConversation.lastMessageTime = Date.now();

        } catch (error) {
            console.error('Error sending message to Ollama or processing stream:', error);
            let errorMessage = 'Error communicating with the model. Please check the proxy server and Ollama status.';
            if (error.message && error.message.includes('Ollama API Error')) {
                errorMessage = error.message; 
            }
            updateBotMessageInUI(botTextElement, `\n\n[Error: ${errorMessage}]`);
            // Get the current content from the botTextElement to avoid using undefined variables
            const currentBotContent = botTextElement.dataset.fullMessage || botTextElement.textContent || '';
            currentConversation.messages.push({ role: 'assistant', content: currentBotContent + `\n\n[Error: ${errorMessage}]` }); 
            currentConversation.lastMessageTime = Date.now();
        } finally {
            console.log('sendMessageToOllama finally block completed');
            // Always hide the loading indicator when done, with null check
            if (loadingIndicator) {
                loadingIndicator.style.display = 'none';
            }
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
            
            await saveModelChatState(currentModelName, modelData);
            populateConversationSidebar(currentModelName, modelData); 
            console.log('UI unlocked, state saved, sidebar repopulated in finally block.');
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
