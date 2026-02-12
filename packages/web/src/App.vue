<script setup lang="ts">
  import { ref, triggerRef } from 'vue';
  import { GameMode, Board } from '@chess-motor/engine';
  import MainMenu from './components/MainMenu.vue';
  import ChessBoard from './components/ChessBoard.vue';

  import { io } from 'socket.io-client';
  const socket = io('https://chess-server-8kwt.onrender.com');


  // esto dentro de startNewGame:
  
  // // When the player selects a mode in the menu
  // const startNewGame = (mode: GameMode) => {
  //     // 1. Tell the server we want to play
  //     socket.emit('join_game', { roomId: 'lobby-1', mode: mode });

  //     // 2. Wait for role assignment
  //     socket.on('assigned_role', (role: 'w' | 'b') => {
  //         const newBoard = new Board();
  //         newBoard.mode = mode;
  //         // We can store the role to prevent moving opponent pieces
  //         currentGame.value = newBoard;
  //     });
  // };

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
    socket.on('receive_move', (move) => {
        if (currentGame.value) {
            currentGame.value.makeMove(move.from, move.to, move.promotion);
            triggerRef(currentGame); // Force Vue to update
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