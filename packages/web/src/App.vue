<script setup lang="ts">
  import { ref, triggerRef, provide } from 'vue';
  import { GameMode, Board, Color } from '@chess-motor/engine';
  import MainMenu from './components/MainMenu.vue';
  import ChessBoard from './components/ChessBoard.vue';
  import { io } from 'socket.io-client';

  // Initialize the socket connection
  const socket = io('https://chess-server-oob6.onrender.com');

  // Get the room from URL or generate a random one
  const getRoomId = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const room = urlParams.get('room');
      if (room) return room;
      
      // If no room in URL, create a random string
      return Math.random().toString(36).substring(2, 9);
  };

  const currentRoomId = ref(getRoomId());

  // Provide the socket instance and room ID to all child components
  // provide('chessSocket', socket);
  // provide('roomId', currentRoomId);


  const isMultiplayer = ref(false);
  const playerColor = ref<Color | null>(null);
  const currentGame = ref<any>(null);

  const isWaiting = ref(false);

  const startNewGame = (mode: GameMode, color: Color) => {
    
    // 1. Create a fresh board instance
    currentGame.value = new Board();
    currentGame.value.mode = mode; // Inject the mode into the engine

    if (isMultiplayer.value) {
        // MULTIPLAYER FLOW: Join a room and wait for role assignment
        isWaiting.value = true;
        // Tell server we want to play this specific mode
        socket.emit('find_match', { 
          mode: mode.toString(), 
          roomId: currentRoomId.value 
        });
        console.log("hola")


        // Listen for the match found event
        socket.on('match_found', (data: { roomId: string, role: Color }) => {
          isWaiting.value = false;
          
          // Initialize the game with the correct settings
          const newBoard = new Board();
          newBoard.mode = currentGame.value.mode;
          currentGame.value = newBoard;
          playerColor.value = data.role;
          
          // Update the room ID injected into ChessBoard
          currentRoomId.value = data.roomId;
          console.log("Match found! Joining room:", data.roomId);
          triggerRef(currentRoomId);
        });
    } else {
        // SINGLE PLAYER FLOW: Clear roles to allow full control
        currentGame.value = new Board();
        currentGame.value.mode = mode;
        playerColor.value = color;
    }
    
    // // 4. Assign to reactive ref
    // console.log("Starting game with mode:", mode); // Debug
  };

  // Listen for opponent moves
  socket.on('opponent_move', (data) => {
    console.log("fuera")
    if (currentGame.value && isMultiplayer.value) {
      currentGame.value.makeMove(data.from, data.to, data.promotion);
      triggerRef(currentGame);
      console.log("dentro")
      // TODO: play the move sound here too
    }
  });

</script>

<template>
  <main class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <MainMenu 
      v-if="!currentGame" 
      v-model="isMultiplayer"
      @select-mode="startNewGame" 
  />
    
    <div v-else class="flex flex-col items-center gap-4">
        <button @click="currentGame = null" class="text-slate-500 hover:text-white text-xs uppercase font-bold tracking-widest">
          ← Back to Menu
        </button>
        <ChessBoard :game="currentGame!" :player-color="playerColor" :is-multiplayer="isMultiplayer" :socket="socket" :room-id="currentRoomId" />
    </div>
  </main>

  <div v-if="isWaiting" class="fixed inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-[300] backdrop-blur-md">
    <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
    <h2 class="text-2xl font-black text-white uppercase tracking-widest animate-pulse">
        Finding Opponent...
    </h2>
    <button @click="isWaiting = false" class="mt-8 text-slate-500 hover:text-white uppercase text-xs font-bold">
        Cancel search
    </button>
</div>
</template>