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
    let localWinningInputs = JSON.parse(localStorage.getItem('winningInputs') || '[]');
    let hardMode = false; // Default is normal mode

    // Load gallery items on page load
    loadGalleryItems();

    // Setup gallery toggle
    setupGalleryToggle();
    
    // Setup mode toggle
    setupModeToggle();

    // Update character count
    userInput.addEventListener('input', () => {
        charCount.textContent = userInput.value.length;
        
        // If in hard mode, restrict to only a-z and space
        if (hardMode) {
            userInput.value = userInput.value.replace(/[^a-z ]/g, '');
        }
    });

    // Initial system prompt for the LLM
    const systemPrompt = {
        role: "system",
        content: "You are an echo bot. Your only job is to repeat back EXACTLY what the user sends you, character for character, with no changes, additions, or responses. Preserve all whitespace, formatting, and special characters exactly as received. Don't introduce yourself, don't explain what you're doing, don't apologize, don't summarize, don't respond to questions. ONLY echo back the exact text the user sends you. Nothing more, nothing less."
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

        // In hard mode, additional validation
        if (hardMode && /[^a-z ]/g.test(userMessage)) {
            alert('Hard mode only allows lowercase a-z letters and spaces.');
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

            // Create retry countdown message
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message llm-message';
            errorDiv.innerHTML = `Error communicating with the LLM. <span class="retry-countdown">Retrying in 7...</span>`;
            errorDiv.style.cursor = 'pointer';
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Start countdown and setup retry
            let countdown = 7;
            const countdownEl = errorDiv.querySelector('.retry-countdown');
            
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownEl.textContent = `Retrying in ${countdown}...`;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    retryLLMRequest(userMessage);
                }
            }, 1000);
            
            // Allow clicking to retry immediately
            errorDiv.addEventListener('click', () => {
                clearInterval(countdownInterval);
                retryLLMRequest(userMessage);
            });
        }
    }

    function displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;

        // Create sender label with icon
        const senderLabel = document.createElement('div');
        senderLabel.className = 'sender-label';
        senderLabel.innerHTML = sender === 'user' ? '👤 You:' : '🤖 LLM:';
        messageDiv.appendChild(senderLabel);

        // Create message content with pre-formatting
        const messageContent = document.createElement('pre');
        messageContent.style.margin = '0';
        messageContent.style.whiteSpace = 'pre-wrap';
        messageContent.style.fontFamily = 'inherit';
        messageContent.textContent = message;
        messageDiv.appendChild(messageContent);

        // Add message with animation
        messageDiv.style.opacity = '0';
        chatMessages.appendChild(messageDiv);
        
        // Trigger reflow for animation
        void messageDiv.offsetWidth;
        messageDiv.style.opacity = '1';
        messageDiv.style.transition = 'opacity 0.3s ease-in-out';
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function retryLLMRequest(userMessage) {
        // Show loading indicator with animation
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message llm-message';
        loadingDiv.innerHTML = '<div class="sender-label">🤖 LLM:</div><div style="display: flex; align-items: center;"><span>Retrying</span><span class="loading-dots">...</span></div>';
        chatMessages.appendChild(loadingDiv);
        
        // Animate the loading dots
        const loadingDots = loadingDiv.querySelector('.loading-dots');
        let dotCount = 0;
        const dotAnimation = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            loadingDots.textContent = '.'.repeat(dotCount);
        }, 300);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        
        try {
            // Send to LLM
            const completion = await websim.chat.completions.create({
                messages: [
                    systemPrompt,
                    ...conversationHistory
                ]
            });

            // Clear dot animation
            clearInterval(dotAnimation);
            
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
            // Clear dot animation
            clearInterval(dotAnimation);
            
            // Remove loading indicator
            chatMessages.removeChild(loadingDiv);
            console.error('Error:', error);

            // Create retry countdown message with enhanced styling
            const errorDiv = document.createElement('div');
            errorDiv.className = 'message llm-message';
            errorDiv.innerHTML = `<div class="sender-label">🤖 LLM:</div><div>Error communicating with the LLM. <span class="retry-countdown">Retrying in 7...</span></div>`;
            errorDiv.style.cursor = 'pointer';
            chatMessages.appendChild(errorDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            
            // Start countdown and setup retry
            let countdown = 7;
            const countdownEl = errorDiv.querySelector('.retry-countdown');
            
            const countdownInterval = setInterval(() => {
                countdown--;
                countdownEl.textContent = `Retrying in ${countdown}...`;
                
                if (countdown <= 0) {
                    clearInterval(countdownInterval);
                    retryLLMRequest(userMessage);
                }
            }, 1000);
            
            // Allow clicking to retry immediately
            errorDiv.addEventListener('click', () => {
                clearInterval(countdownInterval);
                retryLLMRequest(userMessage);
            });
        }
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
            resultDiv.innerHTML = '✅ The LLM echoed correctly! LLM gets a point.';
            resultDiv.classList.add('success');
        } else {
            // LLM failed
            userScore++;
            userScoreElement.textContent = userScore;
            resultDiv.innerHTML = '❌ The LLM failed to echo correctly! You get a point.';
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
            .replace(/ /g, '␣') // Show spaces as visible space character
            .replace(/\n/g, '↵\n') // Show newlines
            .replace(/\t/g, '→   '); // Show tabs
    }

    function escapeString(str) {
        return str.replace(/[^\x20-\x7E]/g, char => {
            return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
        });
    }

    // Load gallery items from database
    function loadGalleryItems(mode = 'normal') {
        const collectionName = mode === 'hard' ? 'gallery_items_hard' : 'gallery_items';
        room.collection(collectionName).subscribe(function (items) {
            renderGalleryItems(items);
        });
    }

    // Add winning entry to gallery database
    async function addToGallery(userMessage, diffAnalysis) {
        try {
            // Check if similar message exists in local winning inputs
            if (isSimilarToExistingWins(userMessage)) {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'result';
                warningDiv.textContent = 'Similar winning input already exists. Try something more unique!';
                warningDiv.style.backgroundColor = '#fff3cd';
                warningDiv.style.color = '#856404';
                chatMessages.appendChild(warningDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                return;
            }

            // Check if exact duplicate exists in the database
            const collectionName = hardMode ? 'gallery_items_hard' : 'gallery_items';
            const existingEntries = await room.collection(collectionName).filter({ message: userMessage }).getList();
            if (existingEntries.length > 0) {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'result';
                warningDiv.textContent = 'This exact winning input already exists in the gallery!';
                warningDiv.style.backgroundColor = '#fff3cd';
                warningDiv.style.color = '#856404';
                chatMessages.appendChild(warningDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                return;
            }

            // Store in local storage
            localWinningInputs.push(userMessage);
            localStorage.setItem('winningInputs', JSON.stringify(localWinningInputs));

            // Add to database
            await room.collection(collectionName).create({
                message: userMessage,
                diffAnalysis: diffAnalysis,
                mode: hardMode ? 'hard' : 'normal'
            });
        } catch (error) {
            console.error('Error adding to gallery:', error);
        }
    }

    // Check if message is similar to existing wins
    function isSimilarToExistingWins(message) {
        return localWinningInputs.some(winningMessage => {
            // Simple similarity check - if more than 80% similar
            const longerString = message.length > winningMessage.length ? message : winningMessage;
            const shorterString = message.length > winningMessage.length ? winningMessage : message;
            
            // If strings are too different in length, they're not similar
            if (shorterString.length < longerString.length * 0.7) return false;
            
            // Check for direct substring match (for small messages)
            if (shorterString.length < 10) {
                return longerString.includes(shorterString);
            }
            
            // For longer strings, check for similarity based on character count
            let matchCount = 0;
            for (let i = 0; i < shorterString.length; i++) {
                if (longerString.includes(shorterString[i])) {
                    matchCount++;
                }
            }
            return matchCount / shorterString.length > 0.8;
        });
    }

    // Setup gallery toggle
    function setupGalleryToggle() {
        const galleryTitle = document.querySelector('.gallery-container h3');
        const galleryContainer = document.querySelector('.gallery-container');
        
        // Create tabs for normal and hard mode
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'gallery-tabs';
        
        const normalTab = document.createElement('div');
        normalTab.className = 'gallery-tab active';
        normalTab.textContent = 'Normal Mode';
        normalTab.addEventListener('click', () => {
            normalTab.classList.add('active');
            hardTab.classList.remove('active');
            loadGalleryItems('normal');
        });
        
        const hardTab = document.createElement('div');
        hardTab.className = 'gallery-tab';
        hardTab.textContent = 'Hard Mode';
        hardTab.addEventListener('click', () => {
            hardTab.classList.add('active');
            normalTab.classList.remove('active');
            loadGalleryItems('hard');
        });
        
        tabsContainer.appendChild(normalTab);
        tabsContainer.appendChild(hardTab);
        galleryContainer.insertBefore(tabsContainer, galleryItems);
        
        // Create toggle button
        const toggleButton = document.createElement('button');
        toggleButton.className = 'gallery-toggle';
        toggleButton.innerHTML = '👁️ Show';
        galleryTitle.appendChild(toggleButton);
        
        // Create blur overlay
        const blurOverlay = document.createElement('div');
        blurOverlay.className = 'gallery-blur';
        
        const blurMessage = document.createElement('div');
        blurMessage.className = 'gallery-blur-message';
        blurMessage.textContent = 'Click to view winning strategies';
        
        blurOverlay.appendChild(blurMessage);
        galleryItems.parentElement.appendChild(blurOverlay);
        
        // Toggle gallery visibility - on button click
        toggleButton.addEventListener('click', toggleGallery);
        
        // Toggle gallery visibility - on anywhere in gallery clicked
        blurOverlay.addEventListener('click', toggleGallery);
        
        // Toggle function
        function toggleGallery() {
            if (blurOverlay.style.display === 'none') {
                blurOverlay.style.display = 'flex';
                toggleButton.innerHTML = '👁️ Show';
                
                // Animation for appearing
                blurOverlay.style.opacity = '0';
                setTimeout(() => {
                    blurOverlay.style.opacity = '1';
                }, 10);
            } else {
                // Animation for disappearing
                blurOverlay.style.opacity = '0';
                setTimeout(() => {
                    blurOverlay.style.display = 'none';
                    toggleButton.innerHTML = '🔍 Hide';
                }, 300);
            }
        }
    }
    
    // Setup mode toggle
    function setupModeToggle() {
        // Create mode toggle container
        const modeToggle = document.createElement('div');
        modeToggle.className = 'mode-toggle';
        
        // Normal mode button
        const normalModeBtn = document.createElement('button');
        normalModeBtn.className = 'mode-button active';
        normalModeBtn.textContent = 'Normal Mode';
        normalModeBtn.addEventListener('click', () => switchMode('normal'));
        
        // Hard mode button
        const hardModeBtn = document.createElement('button');
        hardModeBtn.className = 'mode-button';
        hardModeBtn.textContent = 'Hard Mode';
        hardModeBtn.addEventListener('click', () => switchMode('hard'));
        
        // Add buttons to toggle
        modeToggle.appendChild(normalModeBtn);
        modeToggle.appendChild(hardModeBtn);
        
        // Add toggle to container
        document.querySelector('.container').appendChild(modeToggle);
        
        // Function to switch modes
        function switchMode(mode) {
            hardMode = mode === 'hard';
            
            if (hardMode) {
                normalModeBtn.classList.remove('active');
                hardModeBtn.classList.add('active');
                userInput.placeholder = "Hard mode: only a-z and spaces allowed";
                // Clear input when switching to hard mode
                userInput.value = userInput.value.replace(/[^a-z ]/g, '');
            } else {
                hardModeBtn.classList.remove('active');
                normalModeBtn.classList.add('active');
                userInput.placeholder = "Type your message here...";
            }
            
            // Update character counter
            charCount.textContent = userInput.value.length;
        }
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