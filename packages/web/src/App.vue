<script setup lang="ts">
  import { ref, triggerRef, provide } from 'vue';
  import { GameMode, Board, Color } from '@chess-motor/engine';
  import MainMenu from './components/MainMenu.vue';
  import ChessBoard from './components/ChessBoard.vue';
  import { io } from 'socket.io-client';

  // Initialize the socket connection
  const socket = io('https://chess-server-oob6.onrender.com');

  // Provide the socket instance and room ID to all child components
  provide('chessSocket', socket);
  provide('roomId', 'demo-room-123');


  const isMultiplayer = ref(false);
  const playerColor = ref<Color | null>(null);
  const currentGame = ref<any>(null);

  const startNewGame = (mode: GameMode) => {
    
    // 1. Create a fresh board instance
    currentGame.value = new Board();
    currentGame.value.mode = mode; // Inject the mode into the engine

    if (isMultiplayer.value) {
        // MULTIPLAYER FLOW: Join a room and wait for role assignment
        console.log("Connecting to multiplayer room...");
        socket.emit('join_room', 'demo-room-123');
    } else {
        // SINGLE PLAYER FLOW: Clear roles to allow full control
        playerColor.value = null;
        console.log("Starting local analysis mode...");
    }
    
    // // 4. Assign to reactive ref
    // console.log("Starting game with mode:", mode); // Debug

    // 5. Listen for opponent moves
    socket.on('opponent_move', (move) => {
      if (currentGame.value && isMultiplayer.value) {
        currentGame.value.makeMove(move.from, move.to, move.promotion);
        triggerRef(currentGame);
        // TODO: play the move sound here too
      }
    });
  };

  // Listen for the role assignment ONLY if we are in multiplayer mode
  socket.on('assigned_role', (role: Color) => {
    if (isMultiplayer.value) {
        playerColor.value = role;
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
        <ChessBoard :game="currentGame!" :player-color="playerColor" :is-multiplayer="isMultiplayer" />
    </div>
  </main>
</template>