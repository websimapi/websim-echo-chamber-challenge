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
        if (userMessage.length > 8000) {
            alert('Message exceeds the maximum limit of 8,000 characters.');
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
            
            // Create diff log
            chatMessages.appendChild(resultDiv);
            displayDiffLog(trimmedUserMessage, trimmedLLMResponse);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return;
        }
        
        chatMessages.appendChild(resultDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayDiffLog(expected, actual) {
        const diffLogDiv = document.createElement('div');
        diffLogDiv.className = 'diff-log';
        
        // Add summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'diff-summary';
        summaryDiv.textContent = 'Difference Analysis:';
        diffLogDiv.appendChild(summaryDiv);
        
        // Length comparison
        const lengthDiv = document.createElement('div');
        lengthDiv.textContent = `Expected length: ${expected.length} | Actual length: ${actual.length}`;
        diffLogDiv.appendChild(lengthDiv);
        
        // Character differences
        let maxLength = Math.max(expected.length, actual.length);
        if (maxLength > 500) {
            // For very long strings, find and show only the differences
            findAndDisplayDifferences(diffLogDiv, expected, actual);
        } else {
            // For shorter strings, show character by character comparison
            characterByCharacterComparison(diffLogDiv, expected, actual);
        }
        
        chatMessages.appendChild(diffLogDiv);
    }

    function findAndDisplayDifferences(container, expected, actual) {
        // Find chunks where differences occur
        let diffs = [];
        let i = 0;
        let matchStartIndex = 0;
        
        while (i < expected.length || i < actual.length) {
            if (i >= expected.length || i >= actual.length || expected[i] !== actual[i]) {
                // Found a difference, look for next matching chunk
                let matchFound = false;
                let j = i + 1;
                const searchWindow = 20; // How far ahead to look for matches
                
                while (!matchFound && j < Math.min(i + searchWindow, Math.max(expected.length, actual.length))) {
                    if (j < expected.length && j < actual.length && expected[j] === actual[j]) {
                        // Found a potential match point
                        let k = 0;
                        while (j + k < expected.length && 
                               j + k < actual.length && 
                               expected[j + k] === actual[j + k] &&
                               k < 5) { // Ensure we have at least 5 matching chars
                            k++;
                        }
                        if (k >= 5) { // We found a good match point
                            diffs.push({
                                expectedStart: i,
                                expectedEnd: j,
                                actualStart: i,
                                actualEnd: j
                            });
                            i = j;
                            matchFound = true;
                            break;
                        }
                    }
                    j++;
                }
                
                if (!matchFound) {
                    // If we didn't find a good match point, just advance
                    i++;
                }
            } else {
                i++;
            }
        }
        
        // Display context around each difference
        if (diffs.length === 0 && expected !== actual) {
            // No specific differences found but strings are different
            // (might be an issue with invisible characters)
            const div = document.createElement('div');
            div.innerHTML = 'Strings differ but no visible differences found. Check for invisible characters.<br>';
            div.innerHTML += `Expected (escaped): ${escapeString(expected)}<br>`;
            div.innerHTML += `Actual (escaped): ${escapeString(actual)}`;
            container.appendChild(div);
        } else {
            diffs.forEach(diff => {
                const contextSize = 10; // Characters of context before and after
                
                const expectedStart = Math.max(0, diff.expectedStart - contextSize);
                const expectedEnd = Math.min(expected.length, diff.expectedEnd + contextSize);
                const actualStart = Math.max(0, diff.actualStart - contextSize);
                const actualEnd = Math.min(actual.length, diff.actualEnd + contextSize);
                
                const div = document.createElement('div');
                div.style.marginBottom = '10px';
                
                let expectedText = '';
                if (expectedStart > 0) expectedText += '...';
                expectedText += expected.substring(expectedStart, diff.expectedStart);
                expectedText += `<span class="diff-highlight diff-removed">${expected.substring(diff.expectedStart, diff.expectedEnd)}</span>`;
                expectedText += expected.substring(diff.expectedEnd, expectedEnd);
                if (expectedEnd < expected.length) expectedText += '...';
                
                let actualText = '';
                if (actualStart > 0) actualText += '...';
                actualText += actual.substring(actualStart, diff.actualStart);
                actualText += `<span class="diff-highlight diff-added">${actual.substring(diff.actualStart, diff.actualEnd)}</span>`;
                actualText += actual.substring(diff.actualEnd, actualEnd);
                if (actualEnd < actual.length) actualText += '...';
                
                div.innerHTML = `<strong>Expected:</strong> ${expectedText}<br><strong>Actual:</strong> ${actualText}`;
                container.appendChild(div);
            });
        }
    }

    function characterByCharacterComparison(container, expected, actual) {
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        
        // Create header row
        const headerRow = document.createElement('tr');
        const indexHeader = document.createElement('th');
        indexHeader.textContent = 'Index';
        const expectedHeader = document.createElement('th');
        expectedHeader.textContent = 'Expected';
        const actualHeader = document.createElement('th');
        actualHeader.textContent = 'Actual';
        
        headerRow.appendChild(indexHeader);
        headerRow.appendChild(expectedHeader);
        headerRow.appendChild(actualHeader);
        table.appendChild(headerRow);
        
        // Create rows for each character
        for (let i = 0; i < Math.max(expected.length, actual.length); i++) {
            const row = document.createElement('tr');
            
            // Index cell
            const indexCell = document.createElement('td');
            indexCell.textContent = i;
            row.appendChild(indexCell);
            
            // Expected character cell
            const expectedCell = document.createElement('td');
            if (i < expected.length) {
                expectedCell.textContent = expected[i] === ' ' ? '␣' : expected[i];
                expectedCell.title = `Char code: ${expected.charCodeAt(i)}`;
            } else {
                expectedCell.textContent = '';
            }
            
            // Actual character cell
            const actualCell = document.createElement('td');
            if (i < actual.length) {
                actualCell.textContent = actual[i] === ' ' ? '␣' : actual[i];
                actualCell.title = `Char code: ${actual.charCodeAt(i)}`;
            } else {
                actualCell.textContent = '';
            }
            
            // Highlight differences
            if (i >= expected.length) {
                actualCell.classList.add('diff-added');
            } else if (i >= actual.length) {
                expectedCell.classList.add('diff-removed');
            } else if (expected[i] !== actual[i]) {
                expectedCell.classList.add('diff-removed');
                actualCell.classList.add('diff-added');
            }
            
            row.appendChild(expectedCell);
            row.appendChild(actualCell);
            table.appendChild(row);
        }
        
        container.appendChild(table);
    }

    function escapeString(str) {
        return str.replace(/[^\x20-\x7E]/g, char => {
            return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        });
    }
});