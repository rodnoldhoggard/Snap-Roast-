// Snap Roast — Client Side Multiplayer Logic
document.addEventListener('DOMContentLoaded', () => {
    // ------------------ GAME STATE ------------------
    let socket;
    let myPlayerId = null;
    let roomCode = null;
    let isHost = false;
    let currentRound = 0;
    let myName = '';
    let participants = [];
    let myCurrentRoast = '';
    let lastActivePrompt = '';
    let currentScreenId = 'screen-home';
    
    // ------------------ AUDIO SYNTHESIZER ENGINE ------------------
    let audioContext = null;
    let isMuted = localStorage.getItem('snap-roast-muted') === 'true';
    let submittedCache = {};
    let votedCache = {};

    function initAudioContext() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
    }

    function playSynthSound(triggerFn) {
        if (isMuted) return;
        try {
            initAudioContext();
            if (!audioContext) return;
            triggerFn(audioContext);
        } catch (err) {
            console.warn("Audio synth play failed:", err);
        }
    }

    function playAudioJoin() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(330, now);
            osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        });
    }

    function playAudioLeave() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
        });
    }

    function playAudioAnswerSubmitted() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        });
    }

    function playAudioTimerTickNormal() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(950, now);
            gain.gain.setValueAtTime(0.015, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.015);
        });
    }

    function playAudioTimerTickPanic() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(1100, now);
            gain1.gain.setValueAtTime(0.035, now);
            gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 0.03);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(1300, now + 0.07);
            gain2.gain.setValueAtTime(0.035, now + 0.07);
            gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.07);
            osc2.stop(now + 0.1);
        });
    }

    function playAudioVoteSubmitted() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(380, now);
            osc.frequency.exponentialRampToValueAtTime(950, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.15);
        });
    }

    function playAudioRoundResults() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 784.00, 1046.50];
            notes.forEach((freq, idx) => {
                const noteTime = now + (idx * 0.05);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);
                gain.gain.setValueAtTime(0.04, noteTime);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.2);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(noteTime);
                osc.stop(noteTime + 0.2);
            });
        });
    }

    function playAudioWinning() {
        playSynthSound((ctx) => {
            const now = ctx.currentTime;
            const chord1 = [261.63, 329.63, 392.00];
            const chord2 = [349.23, 440.00, 523.25];
            const chord3 = [392.00, 493.88, 587.33, 783.99];

            chord1.forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            });

            chord2.forEach(freq => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + 0.2);
                gain.gain.setValueAtTime(0.05, now + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + 0.2);
                osc.stop(now + 0.35);
            });

            chord3.forEach((freq, idx) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = (idx === chord3.length - 1) ? 'sine' : 'triangle';
                osc.frequency.setValueAtTime(freq, now + 0.4);
                gain.gain.setValueAtTime(0.05, now + 0.4);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(now + 0.4);
                osc.stop(now + 1.1);
            });
        });
    }

    // Confetti Engine properties
    let confettiActive = false;
    let confettiAnimationFrameId = null;
    let confettiParticles = [];

    // ------------------ ELEMENT REFS ------------------
    const screens = {
        home: document.getElementById('screen-home'),
        hostLobby: document.getElementById('screen-host-lobby'),
        join: document.getElementById('screen-join'),
        waitingLobby: document.getElementById('screen-waiting-lobby'),
        prompt: document.getElementById('screen-prompt'),
        voting: document.getElementById('screen-voting'),
        results: document.getElementById('screen-results'),
        final: document.getElementById('screen-final'),
        reconnect: document.getElementById('screen-reconnect')
    };

    const header = document.getElementById('game-brand-header');
    const toastContainer = document.getElementById('toast-container');

    // Home Screen elements
    const homeUsernameInput = document.getElementById('home-username');
    const btnHomeHost = document.getElementById('btn-home-host');
    const btnHomeJoin = document.getElementById('btn-home-join');

    // Host Lobby elements
    const hostCodeDisplay = document.getElementById('host-code-display');
    const hostPlayerCount = document.getElementById('host-player-count');
    const hostPlayersList = document.getElementById('host-players-list');
    const btnHostStart = document.getElementById('btn-host-start');
    const btnHostLeave = document.getElementById('btn-host-leave');
    
    // Host Lobby Chat Selection Elements
    const btnHostTabPlayers = document.getElementById('btn-host-tab-players');
    const btnHostTabChat = document.getElementById('btn-host-tab-chat');
    const hostPlayersPanel = document.getElementById('host-players-panel');
    const hostChatPanel = document.getElementById('host-chat-panel');
    const hostChatMessages = document.getElementById('host-chat-messages');
    const hostChatInput = document.getElementById('host-chat-input');
    const btnHostChatSend = document.getElementById('btn-host-chat-send');
    const hostChatUnread = document.getElementById('host-chat-unread');
    
    let hostChatActiveTab = 'players';
    let hostChatUnreadCount = 0;

    // Join Screen elements
    const joinCodeInput = document.getElementById('join-code');
    const joinUsernameInput = document.getElementById('join-username');
    const btnJoinSubmit = document.getElementById('btn-join-submit');
    const btnJoinBack = document.getElementById('btn-join-back');

    // Waiting Lobby elements
    const waitCodeDisplay = document.getElementById('wait-code-display');
    const waitPlayerCount = document.getElementById('wait-player-count');
    const waitPlayersList = document.getElementById('wait-players-list');
    const btnWaitLeave = document.getElementById('btn-wait-leave');
    
    // Waiting Lobby Chat Selection Elements
    const btnWaitTabPlayers = document.getElementById('btn-wait-tab-players');
    const btnWaitTabChat = document.getElementById('btn-wait-tab-chat');
    const waitPlayersPanel = document.getElementById('wait-players-panel');
    const waitChatPanel = document.getElementById('wait-chat-panel');
    const waitChatMessages = document.getElementById('wait-chat-messages');
    const waitChatInput = document.getElementById('wait-chat-input');
    const btnWaitChatSend = document.getElementById('btn-wait-chat-send');
    const waitChatUnread = document.getElementById('wait-chat-unread');
    
    let waitChatActiveTab = 'players';
    let waitChatUnreadCount = 0;

    // Lobby Settings elements
    const btnHostOpenSettings = document.getElementById('btn-host-open-settings');
    const btnWaitOpenSettings = document.getElementById('btn-wait-open-settings');
    const modalLobbySettings = document.getElementById('modal-lobby-settings');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const settingsUsernameInput = document.getElementById('settings-username');
    const settingsColorGrid = document.getElementById('settings-color-grid');
    const btnSaveSettings = document.getElementById('btn-save-settings');

    let settingsSelectedColor = '';

    // Prompt elements
    const promptRoundNum = document.getElementById('prompt-round-number');
    const promptTimerVal = document.getElementById('prompt-timer');
    const currentPromptText = document.getElementById('current-prompt-text');
    const promptAnswerInput = document.getElementById('prompt-answer-input');
    const promptCharCount = document.getElementById('prompt-char-count');
    const btnPromptSubmit = document.getElementById('btn-prompt-submit');
    const promptInputArea = document.getElementById('prompt-input-area');
    const promptSubmittedState = document.getElementById('prompt-submitted-state');
    const promptSubmittedGrid = document.getElementById('prompt-submitted-grid');

    // Voting elements
    const votingTimerVal = document.getElementById('voting-timer');
    const votingPromptPreview = document.getElementById('voting-prompt-preview');
    const votingOptionsList = document.getElementById('voting-options-list');
    const votingPendingWidget = document.getElementById('voting-pending-widget');

    // Results elements
    const resultsAnswersList = document.getElementById('results-answers-list');
    const resultsScoreboard = document.getElementById('results-scoreboard');
    const btnResultsNext = document.getElementById('btn-results-next');
    const resultsWaitStatus = document.getElementById('results-wait-status');

    // Final elements
    const finalWinnerName = document.getElementById('final-winner-name');
    const finalWinnerScore = document.getElementById('final-winner-score');
    const finalScoreboardList = document.getElementById('final-scoreboard-list');
    const btnFinalShare = document.getElementById('btn-final-share');
    const btnFinalReset = document.getElementById('btn-final-reset');
    const finalWaitStatus = document.getElementById('final-wait-status');
    const confettiCanvas = document.getElementById('confetti-canvas');
    const btnReconnectFallback = document.getElementById('btn-reconnect-fallback');

    // ------------------ INITIALIZATION ------------------
    // Fill previous user name from local Storage
    const cachedName = localStorage.getItem('snap-roast-username');
    if (cachedName) {
        homeUsernameInput.value = cachedName;
        joinUsernameInput.value = cachedName;
    }

    // Auto load current URL custom queries (for quick game join sharing link)
    const urlParams = new URLSearchParams(window.location.search);
    const sharedCode = urlParams.get('room');
    if (sharedCode) {
        joinCodeInput.value = sharedCode.toUpperCase();
        showScreen('join');
    }

    // Connect socket and listen to events after connection
    initializeSocket();

    // Re-initialize Lucide icon SVGs
    lucide.createIcons();

    // ------------------ NAVIGATION CONTROLLER ------------------
    function showScreen(screenId) {
        currentScreenId = screenId;
        
        // Hide all screens
        Object.keys(screens).forEach(key => {
            if (key !== 'reconnect') {
                screens[key].classList.add('hidden');
            }
        });

        // Show targets
        if (screens[screenId]) {
            screens[screenId].classList.remove('hidden');
        }

        // Conditionally show custom header (Hide when actively inside playing phases)
        const gameActiveScreens = ['prompt', 'voting', 'results', 'final'];
        if (gameActiveScreens.includes(screenId)) {
            header.classList.add('hidden');
        } else {
            header.classList.remove('hidden');
        }

        // Handle active animations / cleanup
        if (screenId !== 'final') {
            stopConfetti();
        }

        // Initialize lucide SVGs specifically inside this screen
        lucide.createIcons();
    }

    // ------------------ TOAST HELPER ------------------
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transform translate-y-2 opacity-0 animate-fade-in pointer-events-auto max-w-sm transition duration-200`;
        
        // Pick styles depending on Toast Type
        if (type === 'error') {
            toast.className += ' bg-slate-900 border-red-500/30 text-red-200';
            toast.innerHTML = `<i data-lucide="circle-alert" class="w-5 h-5 text-red-500 flex-shrink-0"></i><span class="text-sm font-medium">${message}</span>`;
        } else if (type === 'success') {
            toast.className += ' bg-slate-900 border-emerald-500/30 text-emerald-200';
            toast.innerHTML = `<i data-lucide="circle-check" class="w-5 h-5 text-emerald-500 flex-shrink-0"></i><span class="text-sm font-medium">${message}</span>`;
        } else {
            toast.className += ' bg-slate-900 border-coral-500/30 text-coral-200';
            toast.innerHTML = `<i data-lucide="info" class="w-5 h-5 text-coral-500 flex-shrink-0"></i><span class="text-sm font-medium">${message}</span>`;
        }

        toastContainer.appendChild(toast);
        lucide.createIcons();

        // Fade in
        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => {
                toast.remove();
            }, 250);
        }, 3500);
    }

    // ------------------ AVATAR COLOR SELECTION & INITIALS ------------------
    function getInitials(name) {
        if (!name) return '?';
        const clean = name.trim();
        const parts = clean.split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return clean.slice(0, 2).toUpperCase();
    }
    
    // Create animated rising emoji physics element
    function triggerFloatingEmoji(emoji, senderName) {
        const picker = document.createElement('div');
        picker.className = 'floating-emoji-item flex flex-col items-center gap-1';
        
        // Random offset wiggling settings
        const startX = Math.floor(Math.random() * 60) + 20; // 20% to 80% left positioning
        const drift1 = Math.floor(Math.random() * 60) - 30; // -30px to +30px
        const drift2 = Math.floor(Math.random() * 80) - 40; // -40px to +40px
        const drift3 = Math.floor(Math.random() * 40) - 20; // -20px to +20px
        const randomDuration = (Math.random() * 1.0 + 2.7).toFixed(2); // 2.7s to 3.7s speed Variation
        
        // Safely set CSS custom attributes
        picker.style.setProperty('--drift-1', `${drift1}px`);
        picker.style.setProperty('--drift-2', `${drift2}px`);
        picker.style.setProperty('--drift-3', `${drift3}px`);
        
        picker.style.left = `${startX}%`;
        picker.style.animationDuration = `${randomDuration}s`;
        
        // Emoji and beautifully custom player name tag representation
        picker.innerHTML = `
            <span class="text-4xl filter drop-shadow selection:bg-transparent hover:scale-130 transition select-none">${emoji}</span>
            <span class="text-[9px] font-mono font-bold bg-slate-900/90 text-slate-350 border border-slate-800/80 rounded px-1.5 py-0.5 whitespace-nowrap leading-none select-none shadow-md">${senderName}</span>
        `;
        
        document.body.appendChild(picker);
        
        // Automatic cleanup
        setTimeout(() => {
            picker.remove();
        }, 3900);
    }

    // ------------------ SOCKET PROTOCOL HANDLERS ------------------
    function initializeSocket() {
        socket = io({
            reconnectionDelayMax: 10000,
            reconnection: true,
            reconnectionAttempts: 10 // Retries auto 10 times
        });

        // Connection events
        socket.on('connect', () => {
            console.log('Connected to socket network');
            screens.reconnect.classList.add('hidden');
        });

        socket.on('disconnect', (reason) => {
            console.warn(`Connection dropped: ${reason}`);
            screens.reconnect.classList.remove('hidden');
        });

        socket.on('connect_error', () => {
            screens.reconnect.classList.remove('hidden');
        });

        socket.on('reconnect_failed', () => {
            showToast('Failed to auto-reconnect, returning home', 'error');
            screens.reconnect.classList.add('hidden');
            showScreen('home');
        });

        // Room Error Handler
        socket.on('room:error', ({ message }) => {
            showToast(message, 'error');
        });

        // Host Created Room Success Handler
        socket.on('room:created', ({ roomCode: code, myPlayerId: id, players }) => {
            roomCode = code;
            myPlayerId = id;
            isHost = true;
            participants = players;

            // Display in Host Lobby UI
            hostCodeDisplay.querySelector('span').innerText = code;
            hostPlayerCount.innerText = players.length;
            renderHostPlayerList(players);

            // Toggle start button state
            btnHostStart.disabled = players.length < 2;

            showScreen('hostLobby');
            showToast(`Room ${code} created!`, 'success');
            
            // Play nice join sound
            playAudioJoin();
        });

        // Player Joined Room Success Handler
        socket.on('room:joined', ({ roomCode: code, myPlayerId: id, players }) => {
            roomCode = code;
            myPlayerId = id;
            isHost = false;
            participants = players;

            // Display in Waiting Lobby UI
            waitCodeDisplay.innerText = code;
            waitPlayerCount.innerText = players.length;
            renderJoinerPlayerList(players);

            showScreen('waitingLobby');
            showToast('Joined lobby!', 'success');
            
            // Play nice join sound
            playAudioJoin();
        });

        // Kicked from room
        socket.on('room:kicked', () => {
            showToast('You were kicked from the room by the Host.', 'error');
            roomCode = null;
            isHost = false;
            showScreen('home');
        });

        // Host Left Grace notice Handler
        socket.on('host:disconnected', () => {
            showToast('Host left — game ended', 'error');
            
            // Build custom blocking dialog popup layer
            const errorOverlay = document.createElement('div');
            errorOverlay.className = 'fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-fade-in';
            errorOverlay.innerHTML = `
                <div class="bg-slate-900 border border-coral-500/20 max-w-sm w-full p-6 rounded-3xl space-y-5 shadow-xl">
                    <div class="inline-flex p-3 rounded-full bg-coral-500/10 text-coral-500">
                        <i data-lucide="crown" class="w-10 h-10"></i>
                    </div>
                    <div class="space-y-1.5">
                        <h3 class="text-xl font-display font-bold text-white">Host Disconnected</h3>
                        <p class="text-slate-450 text-sm">The Game Host left the room, ending the match. Start a new table!</p>
                    </div>
                    <button id="btn-overlay-close" class="w-full py-3.5 bg-gradient-to-r from-coral-600 to-coral-500 text-white font-medium rounded-xl hover:from-coral-500 hover:to-coral-400 transition active:scale-95 duration-100 flex items-center justify-center gap-2">
                        <i data-lucide="home" class="w-4 h-4"></i> OK, Go Home
                    </button>
                </div>
            `;
            document.body.appendChild(errorOverlay);
            lucide.createIcons();

            document.getElementById('btn-overlay-close').addEventListener('click', () => {
                errorOverlay.remove();
                roomCode = null;
                isHost = false;
                showScreen('home');
            });
        });

        // Lobby Players Update Handler
        socket.on('room:updated', ({ players, roomCode: code, status }) => {
            // Track join/leave sound effects inside lobby
            if (participants && participants.length > 0) {
                const prevIds = participants.map(p => p.id);
                const currIds = players.map(p => p.id);
                
                const joined = currIds.filter(id => !prevIds.includes(id));
                const left = prevIds.filter(id => !currIds.includes(id));
                
                if (joined.length > 0) {
                    playAudioJoin();
                } else if (left.length > 0) {
                    playAudioLeave();
                }
            }

            // Track remote votes submissions sound effects in voting phase
            if (status === 'voting' && currentScreenId === 'voting') {
                players.forEach(p => {
                    if (p.voted && p.id !== myPlayerId && !votedCache[p.id]) {
                        playAudioVoteSubmitted();
                    }
                    votedCache[p.id] = p.voted;
                });
            }

            participants = players;
            
            if (isHost) {
                hostPlayerCount.innerText = players.length;
                renderHostPlayerList(players);
                btnHostStart.disabled = players.length < 2;
            } else {
                waitPlayerCount.innerText = players.length;
                renderJoinerPlayerList(players);
            }

            // If we are actively in prompt phase, update submission progress boxes indicators
            if (status === 'prompt') {
                updatePromptSubmissionStatus(players);
            }
        });

        // Game Timer Countdown updates
        socket.on('timer:tick', ({ seconds }) => {
            // Play timer tick sound subtle feedback
            if (seconds > 0) {
                if (seconds <= 5) {
                    playAudioTimerTickPanic();
                } else {
                    playAudioTimerTickNormal();
                }
            }

            // Check current active phase
            if (currentScreenId === 'prompt') {
                promptTimerVal.innerText = `${seconds}s`;
                if (seconds <= 5) {
                    promptTimerVal.classList.add('timer-panic');
                } else {
                    promptTimerVal.classList.remove('timer-panic');
                }
            } else if (currentScreenId === 'voting') {
                votingTimerVal.innerText = `${seconds}s`;
                if (seconds <= 5) {
                    votingTimerVal.classList.add('timer-panic');
                } else {
                    votingTimerVal.classList.remove('timer-panic');
                }
            }
        });

        // Round Start (Prompt Phase) Handler
        socket.on('game:start-prompt', ({ prompt, round, maxRounds, duration }) => {
            currentRound = round;
            lastActivePrompt = prompt;
            
            // Clean up old submitted caches for next rounds pings
            submittedCache = {};
            votedCache = {};

            promptRoundNum.innerText = round;
            currentPromptText.innerText = prompt;
            promptTimerVal.innerText = `${duration}s`;
            promptTimerVal.classList.remove('timer-panic');
            
            // Clean/Reset submissions box values
            promptAnswerInput.value = '';
            promptCharCount.innerText = '0';
            myCurrentRoast = '';

            promptInputArea.classList.remove('hidden');
            promptSubmittedState.classList.add('hidden');

            showScreen('prompt');
            setTimeout(() => {
                promptAnswerInput.focus();
            }, 300);
        });

        // Game Transition to Voting Handler
        socket.on('game:start-voting', ({ answers, duration }) => {
            votingTimerVal.innerText = `${duration}s`;
            votingTimerVal.classList.remove('timer-panic');
            votingPromptPreview.innerText = lastActivePrompt;

            votingPendingWidget.classList.add('hidden');
            
            // Reset local votedCache to start voting fresh
            votedCache = {};

            // Render Options list
            votingOptionsList.innerHTML = '';
            
            if (answers.length === 0) {
                votingOptionsList.innerHTML = `
                    <div class="text-center p-6 text-slate-500 italic text-sm">
                        Zero qualifying roasts submitted this round! Skipping...
                    </div>
                `;
            } else {
                answers.forEach(ans => {
                    const isMyOwn = (ans.answerText === myCurrentRoast);
                    
                    const card = document.createElement('button');
                    card.className = `w-full text-left p-4 rounded-2xl border transition duration-100 flex items-center justify-between text-base select-none ${
                        isMyOwn 
                        ? 'bg-slate-900/40 border-slate-850 text-slate-500 cursor-not-allowed opacity-60' 
                        : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200 cursor-pointer active:border-coral-500/50 active:scale-[0.98]'
                    }`;
                    
                    // Inside labels
                    let extraLabel = '';
                    if (isMyOwn) {
                        extraLabel = `<span class="text-[10px] font-bold text-coral-500/80 tracking-widest uppercase ml-2 flex-shrink-0 bg-coral-500/10 px-2 py-0.5 rounded-md">YOUR ROAST</span>`;
                    }
                    
                    card.innerHTML = `
                        <div class="flex-1 min-w-0 pr-2">
                            <p class="font-medium text-slate-100 leading-normal break-words">"${ans.answerText}"</p>
                        </div>
                        ${extraLabel}
                    `;
                    
                    // Submit vote click binding
                    if (!isMyOwn) {
                        card.addEventListener('click', () => {
                            // Play local vote sound feedback
                            playAudioVoteSubmitted();

                            // Send selected vote trigger
                            socket.emit('vote:submit', {
                                roomCode: roomCode,
                                answerIndex: ans.index
                            });
                            
                            // Dim option select layout
                            votingOptionsList.querySelectorAll('button').forEach(btn => btn.disabled = true);
                            card.classList.add('border-coral-500', 'bg-slate-850');
                            votingPendingWidget.classList.remove('hidden');
                        });
                    } else {
                        card.disabled = true;
                    }
                    
                    votingOptionsList.appendChild(card);
                });
            }

            showScreen('voting');
        });

        // Round Results Screen Reveal details Handler
        socket.on('game:round-results', ({ round, maxRounds, summary, leaderboard }) => {
            // Play results sound effect
            playAudioRoundResults();

            // Determine host buttons
            if (isHost) {
                btnResultsNext.classList.remove('hidden');
                resultsWaitStatus.classList.add('hidden');
                
                // If round 7, change button text value
                const btnLabel = btnResultsNext.querySelector('span');
                if (round >= 7) {
                    btnLabel.innerText = 'SEE FINAL SCORES';
                } else {
                    btnLabel.innerText = 'NEXT ROUND';
                }
            } else {
                btnResultsNext.classList.add('hidden');
                resultsWaitStatus.classList.remove('hidden');
            }

            // Render Reveal Cards list
            resultsAnswersList.innerHTML = '';
            summary.forEach(sum => {
                const card = document.createElement('div');
                card.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3';
                
                // Construct award badges string
                let badgesMarkup = '';
                if (sum.speedBonusAwarded === 2) {
                    badgesMarkup += `<span class="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><i data-lucide="zap" class="w-3 h-3"></i> 1ST SUBMIT (+2)</span>`;
                } else if (sum.speedBonusAwarded === 1) {
                    badgesMarkup += `<span class="bg-slate-400/20 text-slate-300 border border-slate-700 text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><i data-lucide="zap animate-pulse" class="w-3 h-3"></i> 2ND SUBMIT (+1)</span>`;
                }

                if (sum.voteBonusAwarded === 3) {
                    badgesMarkup += `<span class="bg-coral-500/20 text-coral-400 border border-coral-500/30 text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full flex items-center gap-1"><i data-lucide="flame" class="w-3 h-3 animate-bounce"></i> FUNNIEST ROAST (+3)</span>`;
                }

                // Initial colors class
                const initialText = getInitials(sum.name);
                
                card.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full ${sum.avatarColor} flex items-center justify-center font-display font-bold text-xs shadow-md">
                                ${initialText}
                            </div>
                            <div>
                                <h4 class="font-bold text-white text-sm tracking-tight">${sum.name}</h4>
                            </div>
                        </div>
                        <div class="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <i data-lucide="vote" class="w-4 h-4 text-slate-500"></i>
                            <span>${sum.votesReceived} vote(s)</span>
                        </div>
                    </div>
                    
                    <p class="text-slate-100 font-medium leading-relaxed italic border-l-2 border-slate-800 pl-3">
                        "${sum.answer}"
                    </p>
                    
                    ${badgesMarkup ? `<div class="flex flex-wrap gap-2 pt-1">${badgesMarkup}</div>` : ''}
                `;
                
                resultsAnswersList.appendChild(card);
            });

            // Render current leaderboard totals list
            resultsScoreboard.innerHTML = '';
            leaderboard.forEach((lead, rank) => {
                const rankText = rank + 1;
                const initials = getInitials(lead.name);
                
                const row = document.createElement('div');
                row.className = 'flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-850 shadow-sm';
                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="font-display font-black text-sm w-4 text-center ${rankText === 1 ? 'text-amber-400' : 'text-slate-500'}">
                            ${rankText}
                        </span>
                        <div class="w-7 h-7 rounded-full ${lead.avatarColor} flex items-center justify-center font-bold text-[10px] text-white">
                            ${initials}
                        </div>
                        <span class="font-semibold text-sm text-slate-100">${lead.name}</span>
                    </div>
                    <span class="font-mono font-bold text-sm text-coral-400">${lead.score} pts</span>
                `;
                resultsScoreboard.appendChild(row);
            });

            showScreen('results');
        });

        // Game Finished Final Leaderboard Handler
        socket.on('game:final-leaderboard', ({ leaderboard }) => {
            // Play radiant winning sound effect
            playAudioWinning();

            const winner = leaderboard[0];
            
            finalWinnerName.innerText = winner ? winner.name : 'No Winner';
            finalWinnerScore.innerText = winner ? winner.score : 0;

            // Render score breakdown list
            finalScoreboardList.innerHTML = '';
            leaderboard.forEach((lead, idx) => {
                const rank = idx + 1;
                const initials = getInitials(lead.name);
                
                const card = document.createElement('div');
                card.className = `flex items-center justify-between p-3 rounded-2xl border ${
                    rank === 1 
                    ? 'bg-gradient-to-r from-slate-900 to-amber-950/20 border-amber-500/30' 
                    : 'bg-slate-900 border-slate-800'
                }`;
                
                let rankLabel = `<span class="font-display font-black text-base text-slate-500 text-center w-5">${rank}</span>`;
                if (rank === 1) {
                    rankLabel = `<span class="text-amber-400 animate-bounce flex items-center w-5 justify-center"><i data-lucide="crown" class="w-5 h-5"></i></span>`;
                }

                card.innerHTML = `
                    <div class="flex items-center gap-3">
                        ${rankLabel}
                        <div class="w-8 h-8 rounded-full ${lead.avatarColor} flex items-center justify-center font-bold text-xs text-white">
                            ${initials}
                        </div>
                        <span class="font-bold text-sm text-slate-200">${lead.name}</span>
                    </div>
                    <span class="font-mono font-bold text-base text-coral-500">${lead.score} pts</span>
                `;
                finalScoreboardList.appendChild(card);
            });

            // If Host show play-again toggle
            if (isHost) {
                btnFinalReset.classList.remove('hidden');
                finalWaitStatus.classList.add('hidden');
            } else {
                btnFinalReset.classList.add('hidden');
                finalWaitStatus.classList.remove('hidden');
            }

            showScreen('final');
            startConfetti();
        });

        // Game Reset back to fresh lobby of same code
        socket.on('game:reset-lobby', ({ players, roomCode: code, status }) => {
            // Re-render lobby page depending on host status
            participants = players;

            if (isHost) {
                hostPlayerCount.innerText = players.length;
                renderHostPlayerList(players);
                btnHostStart.disabled = players.length < 2;
                showScreen('hostLobby');
            } else {
                waitPlayerCount.innerText = players.length;
                renderJoinerPlayerList(players);
                showScreen('waitingLobby');
            }
            showToast('Lobby Reset — Ready for new rounds!', 'success');
        });
        
        // Chat Message Received
        socket.on('chat:received', ({ senderName, messageText, avatarColor, isHost: msgSenderIsHost, timestamp }) => {
            console.log(`Chat received: ${senderName}: ${messageText}`);
            
            // Format message item
            const msgEl = document.createElement('div');
            msgEl.className = 'flex flex-col space-y-0.5 animate-fade-in text-left';
            
            const initials = getInitials(senderName);
            const hostBadge = msgSenderIsHost 
                ? `<span class="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1 py-0.5 rounded font-black tracking-wide leading-none">HOST</span>` 
                : '';
            
            msgEl.innerHTML = `
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="w-1.5 h-1.5 rounded-full ${avatarColor}"></span>
                    <span class="font-extrabold text-slate-250 text-xs">${senderName}</span>
                    ${hostBadge}
                    <span class="text-[9px] text-slate-500 font-mono ml-auto">${timestamp}</span>
                </div>
                <p class="pl-3 text-[13px] text-slate-300 break-words font-medium leading-tight">${messageText}</p>
            `;
            
            // Clear placeholders
            const hostCleanNotice = hostChatMessages.querySelector('.italic');
            if (hostCleanNotice) hostCleanNotice.remove();
            
            const waitCleanNotice = waitChatMessages.querySelector('.italic');
            if (waitCleanNotice) waitCleanNotice.remove();
            
            // Append synchronized nodes
            hostChatMessages.appendChild(msgEl.cloneNode(true));
            waitChatMessages.appendChild(msgEl);
            
            // Handle unread badges
            if (currentScreenId === 'hostLobby') {
                if (hostChatActiveTab === 'chat') {
                    hostChatMessages.scrollTop = hostChatMessages.scrollHeight;
                } else {
                    hostChatUnreadCount++;
                    hostChatUnread.innerText = hostChatUnreadCount;
                    hostChatUnread.classList.remove('hidden');
                }
            } else if (currentScreenId === 'waitingLobby') {
                if (waitChatActiveTab === 'chat') {
                    waitChatMessages.scrollTop = waitChatMessages.scrollHeight;
                } else {
                    waitChatUnreadCount++;
                    waitChatUnread.innerText = waitChatUnreadCount;
                    waitChatUnread.classList.remove('hidden');
                }
            }
        });
        
        // Emoji Reaction Received
        socket.on('emoji:received', ({ emoji, senderName }) => {
            triggerFloatingEmoji(emoji, senderName);
        });
    }

    // ------------------ PLAYER RENDER METHODS ------------------
    function renderHostPlayerList(players) {
        hostPlayersList.innerHTML = '';
        players.forEach(p => {
            const initials = getInitials(p.name);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm transform transition duration-150 animate-fade-in';
            
            // Build visual tags
            let hostTag = '';
            let actionBtn = '';
            if (p.isHost) {
                hostTag = `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md flex items-center gap-1"><i data-lucide="crown" class="w-3 h-3"></i> HOST</span>`;
            } else {
                actionBtn = `<button data-kick-id="${p.id}" class="btn-kick p-2 hover:bg-rose-500/10 hover:text-rose-400 text-slate-500 rounded-xl transition duration-100"><i data-lucide="user-x" class="w-4 h-4"></i></button>`;
            }

            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full ${p.avatarColor} avatar-badge flex items-center justify-center font-display font-bold text-sm text-white">
                        ${initials}
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-bold text-sm text-slate-100 max-w-[120px] truncate">${p.name}</span>
                        ${hostTag}
                    </div>
                </div>
                ${actionBtn}
            `;

            // Bind kicking action logic
            if (!p.isHost) {
                item.querySelector('.btn-kick').addEventListener('click', () => {
                    socket.emit('room:kick', {
                        roomCode: roomCode,
                        targetPlayerId: p.id
                    });
                });
            }

            hostPlayersList.appendChild(item);
        });
        lucide.createIcons();
    }

    function renderJoinerPlayerList(players) {
        waitPlayersList.innerHTML = '';
        players.forEach(p => {
            const initials = getInitials(p.name);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 bg-slate-900 border border-slate-850 rounded-2xl transform transition animate-fade-in';
            
            let badge = '';
            if (p.isHost) {
                badge = `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1"><i data-lucide="crown" class="w-2.5 h-2.5"></i> HOST</span>`;
            } else if (p.id === myPlayerId) {
                badge = `<span class="bg-coral-500/10 text-coral-400 border border-coral-500/20 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-md">YOU</span>`;
            }

            item.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full ${p.avatarColor} avatar-badge flex items-center justify-center font-display font-medium text-xs text-white">
                        ${initials}
                    </div>
                    <span class="font-semibold text-sm text-slate-100 truncate max-w-[150px]">${p.name}</span>
                </div>
                ${badge}
            `;
            waitPlayersList.appendChild(item);
        });
        lucide.createIcons();
    }

    // Update real-time submitted status layout in prompt screen
    function updatePromptSubmissionStatus(players) {
        promptSubmittedGrid.innerHTML = '';
        
        // Render submissions dots indicators
        players.forEach(p => {
            // Check submission changes to trigger pop sound
            if (p.submitted && p.id !== myPlayerId && !submittedCache[p.id]) {
                playAudioAnswerSubmitted();
            }
            submittedCache[p.id] = p.submitted;

            const initials = getInitials(p.name);
            const tag = document.createElement('div');
            tag.className = `flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                p.submitted 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                : 'bg-slate-950 text-slate-500 border border-slate-850'
            }`;
            
            let stateIcon = p.submitted 
                ? `<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-400"></i>` 
                : `<i data-lucide="loader" class="w-3.5 h-3.5 text-slate-650 animate-spin"></i>`;

            tag.innerHTML = `
                <div class="w-5 h-5 rounded-full ${p.avatarColor} text-white flex items-center justify-center text-[9px] font-bold">
                    ${initials}
                </div>
                <span class="truncate max-w-[70px]">${p.name}</span>
                ${stateIcon}
            `;
            promptSubmittedGrid.appendChild(tag);
        });
        lucide.createIcons();
    }

    // ------------------ BUTTON CLICKS INTERRUPTS ------------------
    // Host room action click
    btnHomeHost.addEventListener('click', () => {
        const username = homeUsernameInput.value.trim();
        if (!username) {
            showToast('Please choose a nickname/slang name', 'error');
            homeUsernameInput.focus();
            return;
        }
        localStorage.setItem('snap-roast-username', username);
        myName = username;

        socket.emit('room:create', { hostName: username });
    });

    // Go to join screen click
    btnHomeJoin.addEventListener('click', () => {
        showScreen('join');
    });

    // Back to home click from join
    btnJoinBack.addEventListener('click', () => {
        showScreen('home');
    });

    // Input code formatter uppercase
    joinCodeInput.addEventListener('input', () => {
        joinCodeInput.value = joinCodeInput.value.toUpperCase();
    });

    // Submit room join action click
    btnJoinSubmit.addEventListener('click', () => {
        const code = joinCodeInput.value.trim().toUpperCase();
        const username = joinUsernameInput.value.trim();

        if (!code || code.length < 4) {
            showToast('Enter a complete 4-character Room Code!', 'error');
            joinCodeInput.focus();
            return;
        }

        if (!username) {
            showToast('Please type your Roast nickname!', 'error');
            joinUsernameInput.focus();
            return;
        }

        localStorage.setItem('snap-roast-username', username);
        myName = username;

        socket.emit('room:join', {
            roomCode: code,
            playerName: username
        });
    });

    // Leave waiting lobby
    btnWaitLeave.addEventListener('click', () => {
        socket.emit('leave:room');
        roomCode = null;
        isHost = false;
        showScreen('home');
    });

    // Abandon host lobby
    btnHostLeave.addEventListener('click', () => {
        socket.emit('leave:room');
        roomCode = null;
        isHost = false;
        showScreen('home');
    });

    // Host starts game
    btnHostStart.addEventListener('click', () => {
        socket.emit('room:start', { roomCode: roomCode });
    });

    // Prompt Textarea inputs counting limit tracer
    promptAnswerInput.addEventListener('input', () => {
        const chars = promptAnswerInput.value.length;
        promptCharCount.innerText = chars;
    });

    // Submit Answer roasting action
    btnPromptSubmit.addEventListener('click', () => {
        const roast = promptAnswerInput.value.trim();
        if (!roast) {
            showToast('Say something funny! You cannot submit an empty roast.', 'error');
            promptAnswerInput.focus();
            return;
        }

        myCurrentRoast = roast;
        
        // Play local submission sound feedback
        playAudioAnswerSubmitted();
        
        socket.emit('answer:submit', {
            roomCode: roomCode,
            answerText: roast
        });

        // Toggle state to pending
        promptInputArea.classList.add('hidden');
        promptSubmittedState.classList.remove('hidden');

        // Force-render list elements explicitly
        updatePromptSubmissionStatus(participants);
    });

    // Host advance round click
    btnResultsNext.addEventListener('click', () => {
        socket.emit('room:next-round', { roomCode: roomCode });
    });

    // Host resets game to play again click
    btnFinalReset.addEventListener('click', () => {
        socket.emit('room:play-again', { roomCode: roomCode });
    });
    
    // Tab switching controls for Host Lobby
    if (btnHostTabPlayers && btnHostTabChat) {
        btnHostTabPlayers.addEventListener('click', () => {
            hostChatActiveTab = 'players';
            btnHostTabPlayers.classList.add('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnHostTabPlayers.classList.remove('text-slate-400');
            btnHostTabChat.classList.remove('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnHostTabChat.classList.add('text-slate-400');
            
            hostPlayersPanel.classList.remove('hidden');
            hostChatPanel.classList.add('hidden');
        });

        btnHostTabChat.addEventListener('click', () => {
            hostChatActiveTab = 'chat';
            btnHostTabChat.classList.add('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnHostTabChat.classList.remove('text-slate-400');
            btnHostTabPlayers.classList.remove('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnHostTabPlayers.classList.add('text-slate-400');
            
            hostPlayersPanel.classList.add('hidden');
            hostChatPanel.classList.remove('hidden');
            
            // Wipe unread badge count
            hostChatUnreadCount = 0;
            hostChatUnread.classList.add('hidden');
            
            // Auto scroll to bottom
            setTimeout(() => {
                hostChatMessages.scrollTop = hostChatMessages.scrollHeight;
            }, 60);
        });
    }

    // Tab switching controls for Waiting Lobby
    if (btnWaitTabPlayers && btnWaitTabChat) {
        btnWaitTabPlayers.addEventListener('click', () => {
            waitChatActiveTab = 'players';
            btnWaitTabPlayers.classList.add('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnWaitTabPlayers.classList.remove('text-slate-400');
            btnWaitTabChat.classList.remove('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnWaitTabChat.classList.add('text-slate-400');
            
            waitPlayersPanel.classList.remove('hidden');
            waitChatPanel.classList.add('hidden');
        });

        btnWaitTabChat.addEventListener('click', () => {
            waitChatActiveTab = 'chat';
            btnWaitTabChat.classList.add('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnWaitTabChat.classList.remove('text-slate-400');
            btnWaitTabPlayers.classList.remove('text-coral-500', 'bg-slate-900', 'border-slate-800');
            btnWaitTabPlayers.classList.add('text-slate-400');
            
            waitPlayersPanel.classList.add('hidden');
            waitChatPanel.classList.remove('hidden');
            
            // Wipe unread badge count
            waitChatUnreadCount = 0;
            waitChatUnread.classList.add('hidden');
            
            // Auto scroll to bottom
            setTimeout(() => {
                waitChatMessages.scrollTop = waitChatMessages.scrollHeight;
            }, 60);
        });
    }

    // Sending chat message in Host Lobby
    function sendHostChatMessage() {
        const text = hostChatInput.value.trim();
        if (!text) return;
        socket.emit('chat:send', {
            roomCode: roomCode,
            messageText: text
        });
        hostChatInput.value = '';
    }
    
    if (btnHostChatSend) {
        btnHostChatSend.addEventListener('click', sendHostChatMessage);
        hostChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendHostChatMessage();
            }
        });
    }

    // Sending chat message in Waiting Lobby
    function sendWaitChatMessage() {
        const text = waitChatInput.value.trim();
        if (!text) return;
        socket.emit('chat:send', {
            roomCode: roomCode,
            messageText: text
        });
        waitChatInput.value = '';
    }
    
    if (btnWaitChatSend) {
        btnWaitChatSend.addEventListener('click', sendWaitChatMessage);
        waitChatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                sendWaitChatMessage();
            }
        });
    }

    // Bind gameplay reaction emojis bar click events
    document.querySelectorAll('.btn-emoji-send').forEach(btn => {
        btn.addEventListener('click', () => {
            const emoji = btn.getAttribute('data-emoji');
            if (emoji && roomCode) {
                socket.emit('emoji:send', {
                    roomCode: roomCode,
                    emoji: emoji
                });
            }
        });
    });

    // Copy room code poster trigger
    hostCodeDisplay.addEventListener('click', () => {
        const inviteUrl = `${window.location.origin}?room=${roomCode}`;
        copyTextToClipboard(inviteUrl);
        showToast('Invite link copied! Send it to your group.', 'success');
    });

    // Lobby Settings modal logic
    function openLobbySettings() {
        const me = participants.find(p => p.id === myPlayerId);
        if (!me) {
            showToast("Profile data not loaded yet!", "error");
            return;
        }

        // Fill nickname
        settingsUsernameInput.value = me.name;
        
        // Select color
        selectSettingsColor(me.avatarColor);

        // Show modal
        modalLobbySettings.classList.remove('hidden');
    }

    function selectSettingsColor(colorClass) {
        settingsSelectedColor = colorClass;
        
        // Update highlight inside grid buttons
        const colorButtons = settingsColorGrid.querySelectorAll('button');
        colorButtons.forEach(btn => {
            const btnColor = btn.getAttribute('data-color');
            if (btnColor === colorClass) {
                btn.className = `h-10 rounded-xl ${btnColor} border-2 border-white scale-105 shadow-md flex items-center justify-center text-white text-xs font-black`;
                btn.innerHTML = '✓';
            } else {
                btn.className = `h-10 rounded-xl ${btnColor} border-2 border-transparent hover:scale-105 active:scale-95 duration-100 flex items-center justify-center text-white text-xs font-black`;
                btn.innerHTML = '';
            }
        });
    }

    if (btnHostOpenSettings) {
        btnHostOpenSettings.addEventListener('click', openLobbySettings);
    }
    if (btnWaitOpenSettings) {
        btnWaitOpenSettings.addEventListener('click', openLobbySettings);
    }

    btnCloseSettings.addEventListener('click', () => {
        modalLobbySettings.classList.add('hidden');
    });

    modalLobbySettings.addEventListener('click', (e) => {
        if (e.target === modalLobbySettings) {
            modalLobbySettings.classList.add('hidden');
        }
    });

    settingsColorGrid.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            const btnColor = btn.getAttribute('data-color');
            if (btnColor) {
                selectSettingsColor(btnColor);
            }
        });
    });

    btnSaveSettings.addEventListener('click', () => {
        const username = settingsUsernameInput.value.trim();
        if (!username) {
            showToast('Nickname cannot be empty!', 'error');
            return;
        }

        // Send profile update to server
        socket.emit('player:update-profile', {
            roomCode: roomCode,
            name: username,
            avatarColor: settingsSelectedColor
        });

        // Update local name caches
        localStorage.setItem('snap-roast-username', username);
        myName = username;

        // Hide modal
        modalLobbySettings.classList.add('hidden');
    });

    // Clipboard copy mechanism fallback
    function copyTextToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                // Success
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }

    // Share result summaries click
    btnFinalShare.addEventListener('click', () => {
        // Build scoreboard summary text string
        let summaryText = `🎉 Snap Roast Final Leaderboard\n`;
        const scoreItems = finalScoreboardList.querySelectorAll('div');
        
        scoreItems.forEach((item, idx) => {
            const playerString = item.innerText.trim().replace(/\s+/g, ' ');
            // Make winner crowned
            let crown = '';
            if (idx === 0) {
                crown = ' 👑';
            }
            summaryText += `${playerString}${crown}\n`;
        });

        summaryText += `\nPlay at: ${window.location.origin}`;
        copyTextToClipboard(summaryText);
        showToast('Score results copied to clipboard! Share the shame!', 'success');
    });

    btnReconnectFallback.addEventListener('click', () => {
        screens.reconnect.classList.add('hidden');
        roomCode = null;
        isHost = false;
        showScreen('home');
    });

    // ------------------ CONFETTI ENGINE (CANVAS IMPLEMENT) ------------------
    function startConfetti() {
        confettiActive = true;
        confettiParticles = [];
        
        // Match canvas dimensions to viewport size
        resizeConfettiCanvas();
        window.addEventListener('resize', resizeConfettiCanvas);

        // Populate particles coordinates
        const colorsList = ['#FF6B6B', '#FFA8A8', '#4DABF7', '#38D9A9', '#FFD43B', '#FF8787'];
        for (let i = 0; i < 75; i++) {
            confettiParticles.push({
                x: Math.random() * confettiCanvas.width,
                y: Math.random() * confettiCanvas.height - confettiCanvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * confettiCanvas.height,
                color: colorsList[Math.floor(Math.random() * colorsList.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0
            });
        }

        renderConfettiFrame();
    }

    function stopConfetti() {
        confettiActive = false;
        if (confettiAnimationFrameId) {
            cancelAnimationFrame(confettiAnimationFrameId);
            confettiAnimationFrameId = null;
        }
        window.removeEventListener('resize', resizeConfettiCanvas);
    }

    function resizeConfettiCanvas() {
        if (confettiCanvas) {
            confettiCanvas.width = confettiCanvas.parentElement.clientWidth;
            confettiCanvas.height = confettiCanvas.parentElement.clientHeight;
        }
    }

    function renderConfettiFrame() {
        if (!confettiActive) return;
        const ctx = confettiCanvas.getContext('2d');
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        confettiParticles.forEach((p, idx) => {
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle);
            p.tilt = Math.sin(p.tiltAngle - idx / 3) * 15;

            // Map drawing
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            ctx.stroke();

            // Handle bottom boundary wrap
            if (p.y > confettiCanvas.height) {
                confettiParticles[idx] = {
                    x: Math.random() * confettiCanvas.width,
                    y: -15,
                    r: p.r,
                    d: p.d,
                    color: p.color,
                    tilt: p.tilt,
                    tiltAngleIncremental: p.tiltAngleIncremental,
                    tiltAngle: p.tiltAngle
                };
            }
        });

        confettiAnimationFrameId = requestAnimationFrame(renderConfettiFrame);
    }

    // ------------------ AUDIO CONTROLLER INITIALIZATION ------------------
    const btnToggleAudio = document.getElementById('btn-toggle-audio');
    const audioIcon = document.getElementById('audio-icon');

    function updateAudioIconUI() {
        if (!btnToggleAudio || !audioIcon) return;
        if (isMuted) {
            btnToggleAudio.className = "p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 hover:text-slate-400 transition active:scale-95 flex items-center justify-center shadow-lg cursor-pointer";
            audioIcon.setAttribute('data-lucide', 'volume-x');
        } else {
            btnToggleAudio.className = "p-2.5 bg-coral-500/10 border border-coral-500/20 rounded-xl text-coral-400 hover:text-coral-300 hover:bg-coral-500/20 transition active:scale-95 flex items-center justify-center shadow-lg cursor-pointer animate-pulse-subtle";
            audioIcon.setAttribute('data-lucide', 'volume-2');
        }
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    if (btnToggleAudio) {
        btnToggleAudio.addEventListener('click', (e) => {
            e.stopPropagation();
            initAudioContext();
            isMuted = !isMuted;
            localStorage.setItem('snap-roast-muted', isMuted);
            updateAudioIconUI();
            
            if (!isMuted) {
                // Play a tiny sweet chime so they know it is unmuted
                playAudioJoin();
                showToast('Sounds enabled!', 'success');
            } else {
                showToast('Sounds muted', 'error');
            }
        });
    }

    // Force user gesture initialization on first interaction
    document.body.addEventListener('click', () => {
        initAudioContext();
    }, { once: true });

    // Initial update
    updateAudioIconUI();
});
