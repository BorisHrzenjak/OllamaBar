document.addEventListener('DOMContentLoaded', () => {
    const modelNameDisplay = document.getElementById('modelNameDisplay');
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const loadingIndicator = document.getElementById('loadingIndicator');

    let modelName = '';
    let conversationHistory = []; // To store messages for context

    // Function to get model name from URL query parameters
    function getModelNameFromURL() {
        const params = new URLSearchParams(window.location.search);
        return params.get('model');
    }

    // Initialize: Get model name and display it
    modelName = getModelNameFromURL();
    if (modelName) {
        modelNameDisplay.textContent = `Chatting with: ${decodeURIComponent(modelName)}`;
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

    // Initial greeting or instruction
    addMessageToChat(modelName, `Hello! Ask me anything. (Model: ${decodeURIComponent(modelName)})`, 'bot-message');
    console.log(`Chat initialized for model: ${modelName}`);
});
