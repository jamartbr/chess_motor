<script setup lang="ts">
  import { ref, triggerRef, provide } from 'vue';
  import { GameMode, Board } from '@chess-motor/engine';
  import MainMenu from './components/MainMenu.vue';
  import ChessBoard from './components/ChessBoard.vue';
  import { io } from 'socket.io-client';

  // Initialize the socket connection
  const socket = io('https://chess-server-oob6.onrender.com');

  // Provide the socket instance and room ID to all child components
  provide('chessSocket', socket);
  provide('roomId', 'demo-room-123');



  const currentGame = ref<any>(null);

  const startNewGame = (mode: GameMode) => {
    // 1. Create room
    const roomId = "sala-unica-demo";
    socket.emit('join_room', roomId);

    // 2. Reset any existing game first
    currentGame.value = null; 
    
    // 3. Create the new board and set the mode
    const newBoard = new Board();
    newBoard.mode = mode; // Inject the mode into the engine
    
    // 4. Assign to reactive ref
    console.log("Starting game with mode:", mode); // Debug
    currentGame.value = newBoard;

    // 5. Listen for opponent moves
    socket.on('opponent_move', (move) => {
        if (currentGame.value) {
            // Apply the move to the local engine instance
            currentGame.value.makeMove(move.from, move.to, move.promotion);
            // Manually trigger Vue reactivity for the board
            triggerRef(currentGame);
        }
    });
  };

</script>

<template>
  <main class="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <MainMenu v-if="!currentGame" @select-mode="startNewGame" />
    
    <div v-else class="flex flex-col items-center gap-4">
        <button @click="currentGame = null" class="text-slate-500 hover:text-white text-xs uppercase font-bold tracking-widest">
          ← Back to Menu
        </button>
        <ChessBoard :game="currentGame!" />
    </div>
  </main>
</template>