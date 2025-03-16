document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const userScoreElement = document.getElementById('userScore');
    const llmScoreElement = document.getElementById('llmScore');
    const charCount = document.getElementById('char-count');
    
    let userScore = 0;
    let llmScore = 0;
    let conversationHistory = [];
    
    // Update character count
    userInput.addEventListener('input', () => {
        charCount.textContent = userInput.value.length;
    });
    
    // Initial system prompt for the LLM
    const systemPrompt = {
        role: "system",
        content: "You are an echo bot. Your only job is to repeat back EXACTLY what the user sends you, character for character, with no changes, additions, or responses. Don't introduce yourself, don't explain what you're doing, don't apologize, don't summarize, don't respond to questions. ONLY echo back the exact text the user sends you. Nothing more, nothing less."
    };
    
    // Add event listeners
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    async function handleSendMessage() {
        const userMessage = userInput.value.trim();
        if (!userMessage) return;
        
        // Check if message exceeds character limit
        if (userMessage.length > 16000) {
            alert('Message exceeds the maximum limit of 16,000 characters.');
            return;
        }
        
        // Display user message
        displayMessage(userMessage, 'user');
        
        // Add user message to history
        const newMessage = {
            role: "user",
            content: userMessage
        };
        conversationHistory.push(newMessage);
        
        // Limit conversation history
        conversationHistory = conversationHistory.slice(-10);
        
        // Clear input
        userInput.value = '';
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message llm-message';
        loadingDiv.textContent = 'Thinking...';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Send to LLM
            const completion = await websim.chat.completions.create({
                messages: [
                    systemPrompt,
                    ...conversationHistory
                ]
            });
            
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);
            
            const llmResponse = completion.content;
            
            // Display LLM response
            displayMessage(llmResponse, 'llm');
            
            // Add LLM response to history
            conversationHistory.push(completion);
            
            // Check if echo is correct
            checkEcho(userMessage, llmResponse);
            
        } catch (error) {
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);
            console.error('Error:', error);
            
            // Display error message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message llm-message';
            errorDiv.textContent = 'Error communicating with the LLM.';
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }
    
    function displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        // Create sender label
        const senderLabel = document.createElement('div');
        senderLabel.className = 'sender-label';
        senderLabel.textContent = sender === 'user' ? 'You:' : 'LLM:';
        messageDiv.appendChild(senderLabel);
        
        // Create message content with pre-formatting
        const messageContent = document.createElement('pre');
        messageContent.style.margin = '0';
        messageContent.style.whiteSpace = 'pre-wrap';
        messageContent.style.fontFamily = 'inherit';
        messageContent.textContent = message;
        messageDiv.appendChild(messageContent);
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function checkEcho(userMessage, llmResponse) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result';
        
        // Log values for debugging
        console.log('User message:', JSON.stringify(userMessage));
        console.log('LLM response:', JSON.stringify(llmResponse));
        
        // Trim both strings to handle potential whitespace issues
        const trimmedUserMessage = userMessage.trim();
        const trimmedLLMResponse = llmResponse.trim();
        
        if (trimmedUserMessage === trimmedLLMResponse) {
            // LLM succeeded
            llmScore++;
            llmScoreElement.textContent = llmScore;
            resultDiv.textContent = ' The LLM echoed correctly! LLM gets a point.';
            resultDiv.classList.add('success');
        } else {
            // LLM failed
            userScore++;
            userScoreElement.textContent = userScore;
            resultDiv.textContent = ' The LLM failed to echo correctly! You get a point.';
            resultDiv.classList.add('failure');
            
            // Show the difference for debugging
            resultDiv.title = `Expected: "${trimmedUserMessage}" | Got: "${trimmedLLMResponse}"`;
        }
        
        chatMessages.appendChild(resultDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});