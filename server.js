import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = 3000;

// Host and serve the /public folder statically
app.use(express.static(path.join(__dirname, 'public')));

// Fallback all routes to index.html for modern SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Prompt pool — 55 fun family-friendly game prompts
const PROMPTS = [
  "Name something you'd find in a grandma's purse",
  "The worst thing to say on a first date",
  "A terrible superpower nobody asked for",
  "What's in Area 51 (be honest)",
  "The worst pizza topping ever invented",
  "Something you'd whisper to a cactus",
  "A job title that shouldn't exist but does",
  "The most suspicious thing to Google",
  "What do cats actually think about",
  "A terrible name for a baby",
  "The most embarrassing ringtone to have go off in a quiet library",
  "A weird thing to keep in your refrigerator",
  "The warning label that should be on every human",
  "What you would trade your soul for on a hot summer day",
  "A lesson you learned the hard way",
  "A highly unusual candidate to be the next president",
  "The absolute worst thing to use as a bookmark",
  "A terrible theme for a high school prom",
  "The first thing you would do if you became invisible",
  "Something you shouldn't do while riding a unicycle",
  "The weirdest excuse for being late to work",
  "A terrible name for a pet alligator",
  "What plants are saying when you water them",
  "Something you shouldn't clean with an electric toothbrush",
  "The most awkward thing to say after a sneeze",
  "The primary ingredient in a wizard's budget potion",
  "A terrible slogan for an airline",
  "What the monsters under your bed are actually doing all night",
  "A suspicious sound to hear coming from the kitchen at 3 AM",
  "The worst gift to bring to a housewarming party",
  "A name for a new planet that sounds highly unappealing",
  "The real replacement for money in a post-apocalypse",
  "A terrible sport to play in a tuxedo",
  "What squirrels are plotting when they stare at you",
  "Something you shouldn't say to an officer while getting a ticket",
  "The worst possible thing to hear your dentist whisper",
  "A creative use for left-over mashed potatoes",
  "A hilarious law that should definitely be enacted",
  "A suspicious instruction on a box of microwave dinners",
  "The worst thing to find inside a pinata",
  "What historical figure would have had the worst social media feed",
  "A funny excuse for why you didn't do your homework",
  "The real reason the dinosaurs went extinct",
  "What you shouldn't say to a flight attendant",
  "A terrible idea for a mascot of a healthy cereal",
  "Something that always sounds like a lie even when it is true",
  "The most useless item to bring on a safari",
  "A terrible name for a discount cruise ship",
  "What really happens when you pull a funny face and the wind changes",
  "The worst song to walk down the aisle to at a wedding",
  "Something you should never say to a barber",
  "A bad idea for a scratch-and-sniff sticker scent",
  "The worst item to use as a defensive weapon",
  "Something you shouldn't ask a palm reader",
  "The real reason cats hate water"
];

// In-Memory Game State
const rooms = {};

// Avatar Tailwind Colors
const AVATAR_COLORS = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-orange-500'
];

// Helper to generate a unique 4-character Room Code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms[code]);
  return code;
}

// Helper to check if name is duplicate in a room
function isNameTaken(room, name) {
  const normalized = name.trim().toLowerCase();
  return Object.values(room.players).some(p => p.name.trim().toLowerCase() === normalized);
}

// Clean up disconnected player
function handleDisconnect(socket) {
  const socketId = socket.id;
  // Find which room the socket belongs to
  let roomCodeToClean = null;
  
  for (const [code, room] of Object.entries(rooms)) {
    if (room.players[socketId]) {
      const player = room.players[socketId];
      const name = player.name;
      const isHost = player.isHost;
      
      console.log(`Player ${name} disconnecting from room ${code}`);
      
      if (isHost) {
        // Host leaving ruins the game for everyone in the room
        io.to(code).emit('host:disconnected');
        clearInterval(room.timerInterval);
        roomCodeToClean = code;
      } else {
        // Normal player leaving
        delete room.players[socketId];
        
        // Remove from submission order just in case
        room.answerSubmitOrder = room.answerSubmitOrder.filter(id => id !== socketId);
        
        // Check if room is empty now
        if (Object.keys(room.players).length === 0) {
          clearInterval(room.timerInterval);
          roomCodeToClean = code;
        } else {
          // Broadcast player list update
          io.to(code).emit('room:updated', {
            players: Object.values(room.players),
            roomCode: code,
            status: room.status
          });
          
          // If we are currently in PROMPT phase, check if this disconnection means all current players have submitted
          if (room.status === 'prompt') {
            checkAndAdvancePrompt(code);
          } else if (room.status === 'voting') {
            checkAndAdvanceVoting(code);
          }
        }
      }
      break;
    }
  }
  
  if (roomCodeToClean) {
    delete rooms[roomCodeToClean];
    console.log(`Room ${roomCodeToClean} cleared.`);
  }
}

// Prompt Answer check & trigger
function checkAndAdvancePrompt(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  const activePlayers = Object.values(room.players);
  const allSubmitted = activePlayers.every(p => p.submitted);
  
  if (allSubmitted && activePlayers.length > 0) {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    transitionToVoting(roomCode);
  }
}

// Voting check & trigger
function checkAndAdvanceVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  const activePlayers = Object.values(room.players);
  // Players must be allowed to vote only if they are not voting for themselves. 
  // A voter has voted flag set, or they can't submit an answer, etc.
  // Note: if a player is alone, they shouldn't trigger, but we need 2+ players starting.
  const allVoted = activePlayers.every(p => p.voted || !p.submitted); // skip players who didn't submit an answer from being required to vote
  
  if (allVoted && activePlayers.length > 0) {
    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }
    transitionToResults(roomCode);
  }
}

// Setup prompts for room (makes sure they don't repeat)
function getNextPromptForRoom(room) {
  const available = PROMPTS.filter(p => !room.promptsUsed.includes(p));
  if (available.length === 0) {
    // If we exhaust prompts, reset the used log
    room.promptsUsed = [];
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }
  const selected = available[Math.floor(Math.random() * available.length)];
  room.promptsUsed.push(selected);
  return selected;
}

// Transition helper functions
function transitionToVoting(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  room.status = 'voting';
  
  // Format the answers anonymously for display
  const answersList = [];
  Object.values(room.players).forEach(p => {
    if (p.submitted) {
      answersList.push({
        playerSocketId: p.id,
        answerText: p.lastAnswer
      });
    }
  });
  
  // Shuffle answers to keep them anonymous
  for (let i = answersList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [answersList[i], answersList[j]] = [answersList[j], answersList[i]];
  }
  
  room.currentAnonymousAnswers = answersList;
  
  // Emit to client
  io.to(roomCode).emit('game:start-voting', {
    answers: answersList.map((ans, idx) => ({
      index: idx,
      answerText: ans.answerText
    })),
    duration: 15
  });
  
  // Server-side voting timer countdown (15 seconds)
  let count = 15;
  io.to(roomCode).emit('timer:tick', { seconds: count });
  
  room.timerInterval = setInterval(() => {
    count--;
    io.to(roomCode).emit('timer:tick', { seconds: count });
    
    if (count <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      transitionToResults(roomCode);
    }
  }, 1000);
}

function transitionToResults(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  room.status = 'results';
  
  const players = Object.values(room.players);
  
  // 1. Calculate speed bonuses in order of submission
  // Speed bonus is only eligible for players who actually submitted answers
  const submitters = room.answerSubmitOrder;
  const speedBonusAwards = {}; // socketId -> speedBonus points
  
  if (submitters.length >= 1) {
    const firstId = submitters[0];
    if (room.players[firstId]) {
      room.players[firstId].speedBonus = 2;
      room.players[firstId].score += 2;
      speedBonusAwards[firstId] = 2;
    }
  }
  if (submitters.length >= 2) {
    const secondId = submitters[1];
    if (room.players[secondId]) {
      room.players[secondId].speedBonus = 1;
      room.players[secondId].score += 1;
      speedBonusAwards[secondId] = 1;
    }
  }
  
  // 2. Count Votes
  const voteTallies = {}; // playerSocketId -> count
  players.forEach(p => {
    voteTallies[p.id] = 0;
  });
  
  players.forEach(p => {
    if (p.voted && p.lastVoteForId) {
      voteTallies[p.lastVoteForId] = (voteTallies[p.lastVoteForId] || 0) + 1;
    }
  });
  
  // Write votes counter to player records
  players.forEach(p => {
    p.voteCount = voteTallies[p.id] || 0;
  });
  
  // 3. Calculate Vote Bonus (+3 pts for most votes. Tie = both get +3)
  let maxVotes = 0;
  // Determine max votes earned by any player who actually submitted an answer
  players.forEach(p => {
    if (p.submitted && p.voteCount > maxVotes) {
      maxVotes = p.voteCount;
    }
  });
  
  const voteBonusAwardIds = [];
  if (maxVotes > 0) {
    players.forEach(p => {
      if (p.submitted && p.voteCount === maxVotes) {
        p.score += 3;
        voteBonusAwardIds.push(p.id);
      }
    });
  }
  
  // Compile summary details for the client results page
  const roundSummary = players.map(p => ({
    id: p.id,
    name: p.name,
    avatarColor: p.avatarColor,
    submitted: p.submitted,
    answer: p.submitted ? p.lastAnswer : "[No Answer Submitted]",
    votesReceived: p.voteCount,
    speedBonusAwarded: speedBonusAwards[p.id] || 0,
    voteBonusAwarded: voteBonusAwardIds.includes(p.id) ? 3 : 0,
    pointsThisRound: (speedBonusAwards[p.id] || 0) + (voteBonusAwardIds.includes(p.id) ? 3 : 0) + (p.voteCount * 0) // note: no base score per vote count is specified except the +3 max votes, but let's verify if voting itself gives standard points. Prompt says: "Most votes earns more points. ... Vote bonus: +3 pts for the answer with the most votes. Tie = both get +3. Speed bonus +2/+1. Everything else 0". Okay, we follow user rules strictly!
  }));
  
  io.to(roomCode).emit('game:round-results', {
    round: room.round,
    maxRounds: 7,
    summary: roundSummary,
    leaderboard: players.map(p => ({
      name: p.name,
      score: p.score,
      avatarColor: p.avatarColor
    })).sort((a,b) => b.score - a.score)
  });
}

// Host actions
function startNextRound(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  if (room.round >= 7) {
    // End Game, transit to Final Leaderboard
    transitionToFinalLeaderboard(roomCode);
    return;
  }
  
  room.round++;
  room.status = 'prompt';
  room.answerSubmitOrder = [];
  
  // Reset player per-round status
  Object.values(room.players).forEach(p => {
    p.submitted = false;
    p.voted = false;
    p.lastAnswer = '';
    p.lastVoteForId = null;
    p.speedBonus = 0;
    p.voteCount = 0;
  });
  
  const prompt = getNextPromptForRoom(room);
  room.currentPrompt = prompt;
  
  io.to(roomCode).emit('game:start-prompt', {
    prompt: prompt,
    round: room.round,
    maxRounds: 7,
    duration: 20
  });
  
  // Active Timer
  let count = 20;
  io.to(roomCode).emit('timer:tick', { seconds: count });
  
  room.timerInterval = setInterval(() => {
    count--;
    io.to(roomCode).emit('timer:tick', { seconds: count });
    
    if (count <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      transitionToVoting(roomCode);
    }
  }, 1000);
}

function transitionToFinalLeaderboard(roomCode) {
  const room = rooms[roomCode];
  if (!room) return;
  
  room.status = 'final';
  
  const sortedPlayers = Object.values(room.players)
    .map(p => ({
      name: p.name,
      score: p.score,
      avatarColor: p.avatarColor
    }))
    .sort((a,b) => b.score - a.score);
    
  io.to(roomCode).emit('game:final-leaderboard', {
    leaderboard: sortedPlayers
  });
}

// Socket IO Protocol
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  
  // Create Room (Host)
  socket.on('room:create', ({ hostName }) => {
    if (!hostName || hostName.trim() === '') {
      socket.emit('room:error', { message: 'Invalid host name' });
      return;
    }
    
    const code = generateRoomCode();
    
    const newRoom = {
      code: code,
      players: {},
      status: 'lobby',
      round: 0,
      currentPrompt: '',
      promptsUsed: [],
      answerSubmitOrder: [],
      timer: 0,
      timerInterval: null,
      currentAnonymousAnswers: []
    };
    
    // Create host player
    const hostColor = AVATAR_COLORS[0];
    newRoom.players[socket.id] = {
      id: socket.id,
      name: hostName.trim(),
      score: 0,
      avatarColor: hostColor,
      submitted: false,
      voted: false,
      lastAnswer: '',
      lastVoteForId: null,
      speedBonus: 0,
      voteCount: 0,
      isHost: true
    };
    
    rooms[code] = newRoom;
    socket.join(code);
    
    socket.emit('room:created', {
      roomCode: code,
      myPlayerId: socket.id,
      players: Object.values(newRoom.players)
    });
    
    console.log(`Room ${code} created by host ${hostName}`);
  });
  
  // Join Room (Player)
  socket.on('room:join', ({ roomCode, playerName }) => {
    if (!roomCode || !playerName || playerName.trim() === '') {
      socket.emit('room:error', { message: 'Enter a valid room code and name.' });
      return;
    }
    
    const code = roomCode.trim().toUpperCase();
    const room = rooms[code];
    
    if (!room) {
      socket.emit('room:error', { message: 'Room not found! Ensure the code is correct.' });
      return;
    }
    
    if (room.status !== 'lobby') {
      socket.emit('room:error', { message: 'Game has already started in this room!' });
      return;
    }
    
    if (isNameTaken(room, playerName)) {
      socket.emit('room:error', { message: 'Name already taken inside this room!' });
      return;
    }
    
    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 8) {
      socket.emit('room:error', { message: 'This room is full (max 8 players)!' });
      return;
    }
    
    const playerColor = AVATAR_COLORS[playerCount % AVATAR_COLORS.length];
    
    room.players[socket.id] = {
      id: socket.id,
      name: playerName.trim(),
      score: 0,
      avatarColor: playerColor,
      submitted: false,
      voted: false,
      lastAnswer: '',
      lastVoteForId: null,
      speedBonus: 0,
      voteCount: 0,
      isHost: false
    };
    
    socket.join(code);
    
    // Inform player they joined successfully
    socket.emit('room:joined', {
      roomCode: code,
      myPlayerId: socket.id,
      players: Object.values(room.players)
    });
    
    // Broadcast player update to room
    io.to(code).emit('room:updated', {
      players: Object.values(room.players),
      roomCode: code,
      status: room.status
    });
    
    console.log(`Player ${playerName} joined Room ${code}`);
  });
  
  // Host Kick Player Action
  socket.on('room:kick', ({ roomCode, targetPlayerId }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    // Check if requester is host
    const requester = room.players[socket.id];
    if (!requester || !requester.isHost) {
      return;
    }
    
    const targetPlayer = room.players[targetPlayerId];
    if (targetPlayer && !targetPlayer.isHost) {
      console.log(`Host kicked player ${targetPlayer.name} from room ${code}`);
      
      // Notify target they are kicked
      io.to(targetPlayerId).emit('room:kicked');
      
      // Remove target socket from room socket grouping
      const targetSocket = io.sockets.sockets.get(targetPlayerId);
      if (targetSocket) {
        targetSocket.leave(code);
      }
      
      delete room.players[targetPlayerId];
      
      // Update lobby list
      io.to(code).emit('room:updated', {
        players: Object.values(room.players),
        roomCode: code,
        status: room.status
      });
    }
  });
  
  // Host Starts Game
  socket.on('room:start', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const host = room.players[socket.id];
    if (!host || !host.isHost) return;
    
    const playersCount = Object.keys(room.players).length;
    if (playersCount < 2) {
      socket.emit('room:error', { message: 'Must have at least 2 players to start!' });
      return;
    }
    
    console.log(`Starting game in Room ${code}`);
    room.round = 0;
    startNextRound(code);
  });
  
  // Submit Prompt Answer
  socket.on('answer:submit', ({ roomCode, answerText }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const player = room.players[socket.id];
    if (!player || room.status !== 'prompt' || player.submitted) return;
    
    player.lastAnswer = answerText ? answerText.trim() : '';
    player.submitted = true;
    
    // Register submission order speed trace
    if (player.lastAnswer !== '') {
      room.answerSubmitOrder.push(socket.id);
    }
    
    console.log(`Player ${player.name} submitted roast in Room ${code}`);
    
    // Inform everybody that count of submissions changed
    io.to(code).emit('room:updated', {
      players: Object.values(room.players),
      roomCode: code,
      status: room.status
    });
    
    // Check if we should transition
    checkAndAdvancePrompt(code);
  });
  
  // Submit Vote
  socket.on('vote:submit', ({ roomCode, answerIndex }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const player = room.players[socket.id];
    if (!player || room.status !== 'voting' || player.voted) return;
    
    // Map answer index back to owner
    const ans = room.currentAnonymousAnswers[answerIndex];
    if (!ans) return;
    
    // Prevent voting for self
    if (ans.playerSocketId === socket.id) {
      socket.emit('room:error', { message: 'You cannot vote for your own answer!' });
      return;
    }
    
    player.lastVoteForId = ans.playerSocketId;
    player.voted = true;
    
    console.log(`Player ${player.name} voted in Room ${code}`);
    
    // Inform everyone and check if voting complete
    io.to(code).emit('room:updated', {
      players: Object.values(room.players),
      roomCode: code,
      status: room.status
    });
    
    checkAndAdvanceVoting(code);
  });
  
  // Host Advance to Next Round (or final results)
  socket.on('room:next-round', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const host = room.players[socket.id];
    if (!host || !host.isHost) return;
    
    startNextRound(code);
  });
  
  // Re-play (Host reset room)
  socket.on('room:play-again', ({ roomCode }) => {
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const host = room.players[socket.id];
    if (!host || !host.isHost) return;
    
    console.log(`Resetting Room ${code} for fresh play-again game`);
    room.status = 'lobby';
    room.round = 0;
    room.promptsUsed = [];
    room.answerSubmitOrder = [];
    
    Object.values(room.players).forEach(p => {
      p.score = 0;
      p.submitted = false;
      p.voted = false;
      p.lastAnswer = '';
      p.lastVoteForId = null;
      p.speedBonus = 0;
      p.voteCount = 0;
    });
    
    io.to(code).emit('game:reset-lobby', {
      players: Object.values(room.players),
      roomCode: code,
      status: room.status
    });
  });
  
  // Lobby Chat Message
  socket.on('chat:send', ({ roomCode, messageText }) => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const player = room.players[socket.id];
    if (!player) return;
    
    const cleanedMessage = messageText ? messageText.trim() : '';
    if (cleanedMessage === '') return;
    
    console.log(`Chat message from ${player.name} in Room ${code}: "${cleanedMessage}"`);
    
    io.to(code).emit('chat:received', {
      senderName: player.name,
      messageText: cleanedMessage,
      avatarColor: player.avatarColor,
      isHost: !!player.isHost,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    });
  });

  // Update Player Profile in Lobby
  socket.on('player:update-profile', ({ roomCode, name, avatarColor }) => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const player = room.players[socket.id];
    if (!player) return;
    
    const newName = name ? name.trim() : '';
    if (newName && newName !== player.name) {
      // Check duplicate
      const isTaken = Object.entries(room.players).some(([sid, p]) => sid !== socket.id && p.name.trim().toLowerCase() === newName.toLowerCase());
      if (isTaken) {
        socket.emit('room:error', { message: 'This nickname is already taken!' });
        return;
      }
      player.name = newName;
    }
    
    if (avatarColor) {
      player.avatarColor = avatarColor;
    }
    
    console.log(`Player profile updated: socket ${socket.id} -> name: ${player.name}, color: ${player.avatarColor}`);
    
    // Broadcast updated players list
    io.to(code).emit('room:updated', {
      players: Object.values(room.players),
      roomCode: code,
      status: room.status
    });
  });
  
  // In-game reaction emoji
  socket.on('emoji:send', ({ roomCode, emoji }) => {
    if (!roomCode) return;
    const code = roomCode.toUpperCase();
    const room = rooms[code];
    if (!room) return;
    
    const player = room.players[socket.id];
    if (!player) return;
    
    // Allow emoji reactions in gameplay modes
    if (room.status !== 'prompt' && room.status !== 'voting') return;
    
    console.log(`Emoji reaction ${emoji} sent by ${player.name} in Room ${code}`);
    
    io.to(code).emit('emoji:received', {
      emoji: emoji,
      senderName: player.name
    });
  });
  
  // Socket leaving room gracefully
  socket.on('leave:room', () => {
    handleDisconnect(socket);
  });
  
  // On regular socket disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });
});

// Run server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Snap Roast server running on HTTP port ${PORT}`);
});
