document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const userScoreElement = document.getElementById('userScore');
    const llmScoreElement = document.getElementById('llmScore');
    const charCount = document.getElementById('char-count');
    const galleryItems = document.getElementById('gallery-items');

    // Initialize WebsimSocket for multiplayer functionality
    const room = new WebsimSocket();

    let userScore = 0;
    let llmScore = 0;
    let conversationHistory = [];

    // Load gallery items on page load
    loadGalleryItems();

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
        if (userMessage.length > 500) {
            alert('Message exceeds the maximum limit of 500 characters.');
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

            // Create diff log in separate container
            const diffAnalysis = displayDiffLog(trimmedUserMessage, trimmedLLMResponse);

            // Add to gallery when user wins
            addToGallery(trimmedUserMessage, diffAnalysis);
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

        // Length comparison
        const lengthDiv = document.createElement('div');
        lengthDiv.textContent = `Expected length: ${expected.length} | Actual length: ${actual.length}`;
        diffAnalysisContent.appendChild(lengthDiv);

        // Find and display differences using a better approach
        const diffHTML = findAndDisplayCompactDifferences(diffAnalysisContent, expected, actual);

        return {
            expected: expected,
            actual: actual,
            diffHTML: diffAnalysisContent.innerHTML
        };
    }

    function findAndDisplayCompactDifferences(container, expected, actual) {
        if (expected === actual) {
            const div = document.createElement('div');
            div.textContent = 'No differences found, but strings may contain invisible characters.';
            container.appendChild(div);
            return div.outerHTML;
        }

        // Find chunks of differences
        let diffs = [];
        let i = 0;
        let diffStart = -1;

        // Find all differences
        while (i < Math.max(expected.length, actual.length)) {
            if ((i >= expected.length && i < actual.length) ||
                (i >= actual.length && i < expected.length) ||
                (expected[i] !== actual[i])) {

                if (diffStart === -1) diffStart = i;
            } else if (diffStart !== -1) {
                // End of a difference chunk
                diffs.push({
                    start: diffStart,
                    end: i,
                    expectedChunk: expected.substring(diffStart, i),
                    actualChunk: actual.substring(diffStart, i)
                });
                diffStart = -1;
            }
            i++;
        }

        // Add the last diff if there is one
        if (diffStart !== -1) {
            diffs.push({
                start: diffStart,
                end: i,
                expectedChunk: expected.substring(diffStart, i),
                actualChunk: actual.substring(diffStart, i)
            });
        }

        // If too many differences, merge nearby ones
        if (diffs.length > 0) {
            const mergedDiffs = mergeCloseDifferences(diffs, expected, actual);
            return displayCompactDifferences(container, mergedDiffs, expected, actual);
        } else {
            // No visible differences but strings are different - check for invisible chars
            const div = document.createElement('div');
            div.innerHTML = 'Strings differ but have no visible differences. Check for invisible characters:<br>';
            div.innerHTML += `Expected (escaped): ${escapeString(expected)}<br>`;
            div.innerHTML += `Actual (escaped): ${escapeString(actual)}`;
            container.appendChild(div);
            return div.outerHTML;
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
        let allDiffHTML = '';

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
            allDiffHTML += diffDiv.outerHTML;

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
                allDiffHTML += charCodesDiv.outerHTML;
            }
        });

        // If more than 3 differences, add a summary
        if (diffs.length > 3) {
            const summaryDiv = document.createElement('div');
            summaryDiv.style.marginTop = '15px';
            summaryDiv.style.fontWeight = 'bold';
            summaryDiv.textContent = `Found ${diffs.length} difference regions in total.`;
            container.appendChild(summaryDiv);
            allDiffHTML += summaryDiv.outerHTML;
        }

        return allDiffHTML;
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
        return str.replace(/[^\x20-\x7E]/g, char => {
            return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        });
    }

    // Add winning entry to gallery database
    async function addToGallery(userMessage, diffAnalysis) {
        try {
            await room.collection('gallery_items').create({
                message: userMessage,
                diffAnalysis: diffAnalysis
            });
        } catch (error) {
            console.error('Error adding to gallery:', error);
        }
    }

    // Load gallery items from database
    function loadGalleryItems() {
        room.collection('gallery_items').subscribe(function (items) {
            renderGalleryItems(items);
        });
    }

    // Render gallery items in UI
    function renderGalleryItems(items) {
        galleryItems.innerHTML = '';

        if (items.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = 'No winning entries yet. Try to trick the LLM!';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.padding = '20px';
            emptyMessage.style.color = '#666';
            galleryItems.appendChild(emptyMessage);
            return;
        }

        // Sort by newest first
        items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        items.forEach(item => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';

            const username = document.createElement('div');
            username.className = 'gallery-username';
            username.textContent = item.username;
            galleryItem.appendChild(username);

            const content = document.createElement('div');
            content.className = 'gallery-content';
            content.textContent = item.message;
            galleryItem.appendChild(content);

            const diff = document.createElement('div');
            diff.className = 'gallery-diff';

            // Create a simplified version of the diff for the gallery
            const diffSummary = document.createElement('div');
            diffSummary.innerHTML = `Expected: "${escapeHtml(item.diffAnalysis.expected)}"<br>`;
            diffSummary.innerHTML += `Actual: "${escapeHtml(item.diffAnalysis.actual)}"`;
            diff.appendChild(diffSummary);

            galleryItem.appendChild(diff);

            const date = document.createElement('div');
            date.className = 'gallery-date';
            date.textContent = new Date(item.created_at).toLocaleString();
            galleryItem.appendChild(date);

            galleryItems.appendChild(galleryItem);
        });
    }
});