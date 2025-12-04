document.addEventListener('DOMContentLoaded', () => {
    const replayContainer = document.getElementById('replay-container');
    const player0Content = document.getElementById('player0-content');
    const player1Content = document.getElementById('player1-content');
    const boardElement = document.getElementById('tictactoe-board');
    const nextBtn = document.getElementById('next-btn');
    const turnIndicator = document.getElementById('turn-indicator');

    let gameData = null;
    let currentTurnIndex = -1;
    let isTyping = false;
    let typeInterval = null;
    let currentFullText = "";
    let currentTypedIndex = 0;

    // Load data from global variable (embedded in game_data.js)
    if (typeof SELFPLAY_LOG !== 'undefined') {
        gameData = SELFPLAY_LOG;
        initializeGame();
    } else {
        console.error('Game data not found. Ensure game_data.js is loaded.');
        updateTurnIndicator("Error: Could not load game data.");
    }

    function initializeGame() {
        // Initial board state (empty)
        renderBoard("___\n___\n___");
        updateTurnIndicator("Click 'Next Step'<br>to start the replay");
        nextBtn.disabled = false;

        // Ensure clean initial state for chat boxes (removes HTML whitespace)
        player0Content.innerHTML = '<span class="placeholder-text">Click \'Next Step\' to start replay...<br>Player 0 reasoning...</span>';
        player1Content.innerHTML = '<span class="placeholder-text">Click \'Next Step\' to start replay...<br>Player 1 reasoning...</span>';
    }

    function renderBoard(stateString) {
        boardElement.innerHTML = '';
        const rows = stateString.split('\n');
        rows.forEach((row, rowIndex) => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'board-row';
            for (let colIndex = 0; colIndex < row.length; colIndex++) {
                const cellChar = row[colIndex];
                const cellDiv = document.createElement('div');
                cellDiv.className = 'board-cell';
                if (cellChar === 'X') {
                    cellDiv.classList.add('cell-x');
                    cellDiv.textContent = 'X';
                } else if (cellChar === 'O') {
                    cellDiv.classList.add('cell-o');
                    cellDiv.textContent = 'O';
                }
                rowDiv.appendChild(cellDiv);
            }
            boardElement.appendChild(rowDiv);
        });
    }

    function updateTurnIndicator(text) {
        turnIndicator.innerHTML = text;
    }

    function typeWriter(targetElement, text, player, onComplete) {
        isTyping = true;
        currentFullText = text;
        currentTypedIndex = 0;
        targetElement.innerHTML = ''; // Clear previous content

        // Create a span for the text and a cursor
        const textSpan = document.createElement('span');
        const cursorSpan = document.createElement('span');
        cursorSpan.className = 'typing-cursor';
        cursorSpan.textContent = '▋';
        targetElement.appendChild(textSpan);
        targetElement.appendChild(cursorSpan);

        // Scroll to bottom
        targetElement.scrollTop = targetElement.scrollHeight;

        // Parse text into segments: tags and content
        // Regex to capture tags: <think>, </think>, <answer>, </answer>
        const tagRegex = /(<\/?(?:think|answer)>)/g;
        const parts = text.split(tagRegex);

        let segments = [];
        let inAnswerBlock = false;
        const tagClass = player === 0 ? 'tag-p0' : 'tag-p1';

        // Helper to check if a part is a tag
        const isTag = (str) => ['<think>', '</think>', '<answer>', '</answer>'].includes(str);

        parts.forEach(part => {
            if (!part) return;
            if (isTag(part)) {
                // It's a tag
                segments.push({
                    type: 'tag',
                    text: part,
                    className: tagClass
                });

                // Add newline after </think> to separate answer
                if (part === '</think>') {
                    segments.push({
                        type: 'text',
                        text: '\n',
                        className: null
                    });
                }

                // Update state
                if (part === '<answer>') inAnswerBlock = true;
                if (part === '</answer>') inAnswerBlock = false;
            } else {
                // It's content
                segments.push({
                    type: 'text',
                    text: part,
                    className: inAnswerBlock ? tagClass : null
                });
            }
        });

        let currentSegmentIndex = 0;
        let charIndexInSegment = 0;

        clearInterval(typeInterval);
        typeInterval = setInterval(() => {
            if (currentSegmentIndex < segments.length) {
                const segment = segments[currentSegmentIndex];
                const char = segment.text.charAt(charIndexInSegment);

                // Determine if we should wrap this character in a colored span
                // We wrap if it's a tag OR if it's highlighted text
                if (segment.className) {
                    // Check if we can reuse the last node to prevent fragmentation
                    // IMPORTANT: Check lastChild (any node), not lastElementChild, to preserve order
                    let lastNode = textSpan.lastChild;
                    let currentSpan = null;

                    if (lastNode && lastNode.nodeType === Node.ELEMENT_NODE && lastNode.className === segment.className) {
                        currentSpan = lastNode;
                    } else {
                        currentSpan = document.createElement('span');
                        currentSpan.className = segment.className;
                        textSpan.appendChild(currentSpan);
                    }

                    if (char === '\n') {
                        // For newlines inside a span, we might need a BR, but textContent handles \n as whitespace.
                        // However, CSS white-space: pre-wrap handles \n.
                        // But if we want explicit BR:
                        // currentSpan.appendChild(document.createElement('br'));
                        // Let's stick to textContent for simplicity with pre-wrap, 
                        // UNLESS it causes issues. The previous code used BR for newlines.
                        // If we are inside a span, BR is safer.
                        currentSpan.appendChild(document.createElement('br'));
                    } else {
                        currentSpan.appendChild(document.createTextNode(char));
                    }
                } else {
                    // Normal text
                    if (char === '\n') {
                        textSpan.appendChild(document.createElement('br'));
                    } else {
                        textSpan.appendChild(document.createTextNode(char));
                    }
                }

                charIndexInSegment++;
                if (charIndexInSegment >= segment.text.length) {
                    currentSegmentIndex++;
                    charIndexInSegment = 0;
                }

                // Auto scroll
                targetElement.scrollTop = targetElement.scrollHeight;
            } else {
                finishTyping(onComplete);
            }
        }, 5); // Faster typing speed for better UX with tags
    }

    function finishTyping(onComplete) {
        clearInterval(typeInterval);
        isTyping = false;
        // Remove cursor
        const cursor = document.querySelector('.typing-cursor');
        if (cursor) cursor.remove();

        if (onComplete) onComplete();
    }

    function completeTypingImmediately() {
        clearInterval(typeInterval);
        const activeContent = currentTurnIndex % 2 === 0 ? player0Content : player1Content;
        const player = currentTurnIndex % 2;

        // Format the full text with colored tags
        // Regex to capture tags: <think>, </think>, <answer>, </answer>
        const tagRegex = /(<\/?(?:think|answer)>)/g;
        const parts = currentFullText.split(tagRegex);

        let formattedHTML = "";
        const tagClass = player === 0 ? 'tag-p0' : 'tag-p1';
        let inAnswerBlock = false;

        const isTag = (str) => ['<think>', '</think>', '<answer>', '</answer>'].includes(str);

        parts.forEach(part => {
            if (!part) return;
            if (isTag(part)) {
                // Tag
                formattedHTML += `<span class="${tagClass}">${part.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;

                // Add newline after </think>
                if (part === '</think>') {
                    formattedHTML += '<br>';
                }

                if (part === '<answer>') inAnswerBlock = true;
                if (part === '</answer>') inAnswerBlock = false;
            } else {
                // Content
                let content = part.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                if (inAnswerBlock) {
                    formattedHTML += `<span class="${tagClass}">${content}</span>`;
                } else {
                    formattedHTML += content;
                }
            }
        });

        activeContent.innerHTML = formattedHTML;
        isTyping = false;
        // Scroll to bottom
        activeContent.scrollTop = activeContent.scrollHeight;
    }

    nextBtn.addEventListener('click', () => {
        if (!gameData) return;

        if (isTyping) {
            // If currently typing, finish immediately
            completeTypingImmediately();

            const turn = gameData.history[currentTurnIndex];

            // Update board to next state
            if (currentTurnIndex + 1 < gameData.history.length) {
                renderBoard(gameData.history[currentTurnIndex + 1].state);
            } else if (currentTurnIndex === gameData.history.length - 1) {
                // End of game, maybe show final state if available in a special way
                // But usually the last item in history is the last move.
            }

            // Update indicator with action info
            const player = turn.player;
            // Robust escaping for action string
            let action = turn.actions || "";
            // Replace < and > with HTML entities
            action = action.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const nextPlayer = (player === 0) ? 1 : 0;

            // Format: 
            // Player 0 chose action <X(1,1)>
            // Turn x completed.
            // Now Player 1 taking action...

            let message = `Player ${player} chose action <code>${action}</code><br>`;
            message += `Turn ${currentTurnIndex + 1} completed.<br>`;

            // Check if there is a next turn
            if (currentTurnIndex + 1 < gameData.history.length) {
                message += `Now Player ${nextPlayer} taking action...`;
            } else {
                message += `Game Over`;
                nextBtn.innerHTML = 'Restart Replay <i class="fas fa-redo"></i>';
                // Allow one more click to reset
                currentTurnIndex++;
            }

            turnIndicator.innerHTML = message;

            return;
        }

        // Start next turn
        currentTurnIndex++;

        if (currentTurnIndex >= gameData.history.length) {
            // Reset game
            currentTurnIndex = -1;
            initializeGame();
            nextBtn.innerHTML = '&nbsp;&nbsp;Next Step <i class="fas fa-chevron-right"></i>';

            // Clear chat boxes
            player0Content.innerHTML = '<span class="placeholder-text">Click \'Next Step\' to start replay...<br>Player 0 reasoning...</span>';
            player1Content.innerHTML = '<span class="placeholder-text">Click \'Next Step\' to start replay...<br>Player 1 reasoning...</span>';

            // Reset active states
            player0Content.parentElement.classList.remove('active', 'dimmed');
            player1Content.parentElement.classList.remove('active', 'dimmed');

            return;
        }

        const turn = gameData.history[currentTurnIndex];

        // Special case for end of game marker if any
        if (turn.player < 0) {
            // This is likely the end state
            renderBoard(turn.state);
            updateTurnIndicator("Game Over! Result: " + (gameData.frames.length > 0 ? "Check frames" : "Draw"));
            nextBtn.innerHTML = 'Restart Replay <i class="fas fa-redo"></i>';
            nextBtn.disabled = false;
            // Increment index so next click triggers reset
            currentTurnIndex++;
            return;
        }

        // 1. Update board to start of turn state
        renderBoard(turn.state);

        // 2. Determine who is playing
        const isPlayer0 = turn.player === 0;
        const activeContent = isPlayer0 ? player0Content : player1Content;
        const otherContent = isPlayer0 ? player1Content : player0Content;

        // Dim the other player
        activeContent.parentElement.classList.remove('dimmed');
        activeContent.parentElement.classList.add('active');
        otherContent.parentElement.classList.add('dimmed');
        otherContent.parentElement.classList.remove('active');

        updateTurnIndicator(`Player ${turn.player} is thinking...`);

        // 3. Start typing reasoning
        // Clean up the response tag if present
        let reasoning = turn.llm_response || "";
        // Optional: strip <think> tags if you want, but user asked to show reasoning.
        // The log has <think>...</think><answer>...</answer>
        // We can display it as is, or format it. 
        // Let's display raw text but handle newlines.

        typeWriter(activeContent, reasoning, turn.player, () => {
            // On complete (natural finish)
            // Update board to next state
            if (currentTurnIndex + 1 < gameData.history.length) {
                renderBoard(gameData.history[currentTurnIndex + 1].state);
            }

            const player = turn.player;
            // Robust escaping for action string
            let action = turn.actions || "";
            // Replace < and > with HTML entities
            action = action.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const nextPlayer = (player === 0) ? 1 : 0;

            let message = `Player ${player} chose action <code>${action}</code><br>`;
            message += `Turn ${currentTurnIndex + 1} completed.<br>`;

            if (currentTurnIndex + 1 < gameData.history.length) {
                message += `Now Player ${nextPlayer} taking action...`;
            } else {
                message += `Game Over`;
                nextBtn.innerHTML = 'Restart Replay <i class="fas fa-redo"></i>';
                // Allow one more click to reset
                currentTurnIndex++;
            }

            turnIndicator.innerHTML = message;
        });
    });
});
