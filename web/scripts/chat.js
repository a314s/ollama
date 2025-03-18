document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const documentList = document.getElementById('document-list');

    let isProcessing = false;

    // Load uploaded documents
    loadDocuments();

    // Handle message sending
    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = chatInput.scrollHeight + 'px';
    });

    async function loadDocuments() {
        try {
            const response = await fetch('http://localhost:11434/api/documents');
            if (!response.ok) throw new Error('Failed to load documents');
            
            const documents = await response.json();
            displayDocuments(documents);
        } catch (error) {
            console.error('Error loading documents:', error);
        }
    }

    function displayDocuments(documents) {
        documentList.innerHTML = documents.map(doc => `
            <div class="document-item">
                <span class="document-name">${doc.name}</span>
                <span class="document-type">${doc.type}</span>
            </div>
        `).join('');
    }

    async function sendMessage() {
        if (isProcessing || !chatInput.value.trim()) return;

        const message = chatInput.value.trim();
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Display user message
        appendMessage(message, 'user');

        isProcessing = true;
        try {
            // Show typing indicator
            const typingIndicator = appendTypingIndicator();

            const response = await fetch('http://localhost:11434/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: message
                    }]
                })
            });

            if (!response.ok) throw new Error('Failed to get response');

            // Remove typing indicator
            typingIndicator.remove();

            // Handle streaming response
            const reader = response.body.getReader();
            let responseText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Decode and process the chunk
                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line) continue;
                    try {
                        const data = JSON.parse(line);
                        responseText += data.response;
                        updateLastMessage(responseText);
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }

            if (!responseText) {
                throw new Error('Empty response from server');
            }

        } catch (error) {
            console.error('Error sending message:', error);
            appendMessage('Sorry, there was an error processing your request.', 'system error');
        } finally {
            isProcessing = false;
        }
    }

    function appendMessage(content, type = 'system') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${formatMessage(content)}</p>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    function appendTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message system typing';
        indicator.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return indicator;
    }

    function updateLastMessage(content) {
        const lastMessage = chatMessages.querySelector('.message:last-child');
        if (lastMessage) {
            lastMessage.querySelector('p').innerHTML = formatMessage(content);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    function formatMessage(text) {
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Convert markdown-style code blocks
        text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
        
        // Convert markdown-style inline code
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Convert line breaks to <br>
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }
});