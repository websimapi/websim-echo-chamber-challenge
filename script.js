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
        content: "You are an echo bot. Your only job is to repeat back EXACTLY what the user sends you, character for character, with no changes, additions, or responses. You must preserve all Unicode characters, emojis, symbols, and special characters exactly as they appear. Don't introduce yourself, don't explain what you're doing, don't apologize, don't summarize, don't respond to questions. Do not truncate the input, even if it contains complex Unicode characters or surrogate pairs. Mirror the exact string you receive with perfect fidelity. Reply with ONLY the exact characters the user sends, preserving all spacing, line breaks, and special characters. Nothing more, nothing less."
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
        if (userMessage.length > 2000) {
            alert('Message exceeds the maximum limit of 2,000 characters.');
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
        charCount.textContent = '0';
        
        // Show loading indicator
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message llm-message';
        loadingDiv.textContent = 'Thinking...';
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Send to LLM with explicit JSON response format
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
            
            // Check if echo is correct - compare character by character
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
        
        // Log values for debugging with code points
        console.log('User message:', [...userMessage].map(c => c.codePointAt(0).toString(16)).join(' '));
        console.log('LLM response:', [...llmResponse].map(c => c.codePointAt(0).toString(16)).join(' '));
        
        // Compare exactly without trimming to preserve whitespace
        if (userMessage === llmResponse) {
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
            
            // Create diff log in separate container
            displayDiffLog(userMessage, llmResponse);
        }
        
        chatMessages.appendChild(resultDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayDiffLog(expected, actual) {
        // Clear previous diff analysis
        const diffAnalysisContent = document.getElementById('diff-analysis-content');
        diffAnalysisContent.innerHTML = '';
        
        // Add summary
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'diff-summary';
        summaryDiv.textContent = 'Difference Analysis:';
        diffAnalysisContent.appendChild(summaryDiv);
        
        findAndDisplayCompactDifferences(diffAnalysisContent, expected, actual);
    }

    function findAndDisplayCompactDifferences(container, expected, actual) {
        if (expected === actual) {
            const div = document.createElement('div');
            div.textContent = 'No differences found, but strings may contain invisible characters.';
            container.appendChild(div);
            return;
        }

        // Display character lengths
        const lengthDiv = document.createElement('div');
        lengthDiv.innerHTML = `<strong>Expected length:</strong> ${expected.length} | <strong>Actual length:</strong> ${actual.length || '(empty)'}`;
        container.appendChild(lengthDiv);

        // Show code points for the first 10 characters to help diagnose issues
        const codePointsDiv = document.createElement('div');
        codePointsDiv.style.fontFamily = 'monospace';
        codePointsDiv.style.marginTop = '10px';
        codePointsDiv.innerHTML = '<strong>First few characters as code points:</strong><br>';
        
        // Expected
        codePointsDiv.innerHTML += 'Expected: ';
        for (let i = 0; i < Math.min(expected.length, 10); i++) {
            const char = expected[i];
            const codePoint = char.codePointAt(0);
            codePointsDiv.innerHTML += `U+${codePoint.toString(16).padStart(4, '0')} `;
        }
        if (expected.length > 10) codePointsDiv.innerHTML += '...';
        
        // Actual
        codePointsDiv.innerHTML += '<br>Actual: ';
        if (actual.length === 0) {
            codePointsDiv.innerHTML += '(empty)';
        } else {
            for (let i = 0; i < Math.min(actual.length, 10); i++) {
                const char = actual[i];
                const codePoint = char.codePointAt(0);
                codePointsDiv.innerHTML += `U+${codePoint.toString(16).padStart(4, '0')} `;
            }
            if (actual.length > 10) codePointsDiv.innerHTML += '...';
        }
        
        container.appendChild(codePointsDiv);

        // Find chunks of differences using code points to handle surrogate pairs correctly
        let diffs = [];
        let i = 0, j = 0;
        let diffStart = -1;
        
        const expectedArray = [...expected]; // Split into code points
        const actualArray = [...actual];     // Split into code points
        
        // Find all differences
        while (i < expectedArray.length || j < actualArray.length) {
            if ((i >= expectedArray.length && j < actualArray.length) || 
                (j >= actualArray.length && i < expectedArray.length) || 
                (expectedArray[i] !== actualArray[j])) {
                
                if (diffStart === -1) diffStart = i;
            } else if (diffStart !== -1) {
                // End of a difference chunk
                diffs.push({
                    start: diffStart,
                    end: i,
                    expectedChunk: expectedArray.slice(diffStart, i).join(''),
                    actualChunk: actualArray.slice(diffStart, j).join('')
                });
                diffStart = -1;
            }
            
            if (i < expectedArray.length) i++;
            if (j < actualArray.length) j++;
        }
        
        // Add the last diff if there is one
        if (diffStart !== -1) {
            diffs.push({
                start: diffStart,
                end: i,
                expectedChunk: expectedArray.slice(diffStart, i).join(''),
                actualChunk: actualArray.slice(diffStart, j).join('')
            });
        }
        
        // Display differences
        if (diffs.length > 0) {
            const mergedDiffs = mergeCloseDifferences(diffs, expected, actual);
            displayCompactDifferences(container, mergedDiffs, expected, actual);
        }
    }

    function mergeCloseDifferences(diffs, expected, actual) {
        if (diffs.length <= 1) return diffs;
        
        const mergedDiffs = [diffs[0]];
        const maxGap = 5; // Maximum gap between differences to merge
        
        for (let i = 1; i < diffs.length; i++) {
            const currentDiff = diffs[i];
            const lastMergedDiff = mergedDiffs[mergedDiffs.length - 1];
            
            if (currentDiff.start - lastMergedDiff.end <= maxGap) {
                // Merge with previous diff
                lastMergedDiff.end = currentDiff.end;
                lastMergedDiff.expectedChunk = expected.substring(lastMergedDiff.start, currentDiff.end);
                lastMergedDiff.actualChunk = actual.substring(lastMergedDiff.start, currentDiff.end);
            } else {
                mergedDiffs.push(currentDiff);
            }
        }
        
        return mergedDiffs;
    }

    function displayCompactDifferences(container, diffs, expected, actual) {
        diffs.forEach((diff, index) => {
            const diffDiv = document.createElement('div');
            diffDiv.className = 'diff-inline';
            
            // Context before
            const contextBefore = Math.max(0, diff.start - 15);
            let beforeText = '';
            if (contextBefore > 0) beforeText = '...';
            beforeText += expected.substring(contextBefore, diff.start);
            
            // Context after
            const contextAfter = Math.min(expected.length, diff.end + 15);
            let afterText = expected.substring(diff.end, contextAfter);
            if (contextAfter < expected.length) afterText += '...';
            
            // Create HTML
            let html = `<strong>Diff ${index + 1}:</strong> `;
            html += `<span class="context">${beforeText}</span>`;
            
            // Show the exact difference
            html += `<span class="diff-block diff-removed">${escapeHtml(diff.expectedChunk || '')}</span>`;
            html += ` → `;
            html += `<span class="diff-block diff-added">${escapeHtml(diff.actualChunk || '')}</span>`;
            
            html += `<span class="context">${afterText}</span>`;
            
            diffDiv.innerHTML = html;
            container.appendChild(diffDiv);
            
            // If the diff is a single character or very short, show character codes
            if (diff.expectedChunk.length <= 3 || diff.actualChunk.length <= 3) {
                const charCodesDiv = document.createElement('div');
                charCodesDiv.style.marginLeft = '20px';
                charCodesDiv.style.fontSize = '0.9em';
                charCodesDiv.style.fontFamily = 'monospace';
                
                let expectedCodes = '';
                for (let i = 0; i < diff.expectedChunk.length; i++) {
                    const code = diff.expectedChunk.charCodeAt(i);
                    expectedCodes += `U+${code.toString(16).padStart(4, '0')} `;
                }
                
                let actualCodes = '';
                for (let i = 0; i < diff.actualChunk.length; i++) {
                    const code = diff.actualChunk.charCodeAt(i);
                    actualCodes += `U+${code.toString(16).padStart(4, '0')} `;
                }
                
                charCodesDiv.innerHTML = `Expected: ${expectedCodes || '(empty)'}<br>Actual: ${actualCodes || '(empty)'}`;
                container.appendChild(charCodesDiv);
            }
        });
        
        // If more than 3 differences, add a summary
        if (diffs.length > 3) {
            const summaryDiv = document.createElement('div');
            summaryDiv.style.marginTop = '15px';
            summaryDiv.style.fontWeight = 'bold';
            summaryDiv.textContent = `Found ${diffs.length} difference regions in total.`;
            container.appendChild(summaryDiv);
        }
    }

    function escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
            .replace(/ /g, '·') // Show spaces as dots
            .replace(/\n/g, '↵\n'); // Show newlines
    }

    function escapeString(str) {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            const char = str[i];
            const code = char.codePointAt(0);
            // Check if it's a surrogate pair
            if (code > 0xFFFF) {
                // Skip the second half of the surrogate pair
                i++;
            }
            result += `\\u${code.toString(16).padStart(4, '0')} `;
        }
        return result;
    }
});