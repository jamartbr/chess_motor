<script setup lang="ts">
  import { ref, shallowRef, triggerRef, provide } from 'vue';
  import { GameMode, Engine, Color } from '@chess-motor/engine';
  import MainMenu from './components/MainMenu.vue';
  import ChessBoard from './components/ChessBoard.vue';
  import { io } from 'socket.io-client';

  // Initialize the socket connection
  const socket = io('https://chess-server-oob6.onrender.com');

  // Get the room from URL or generate a random one
  const getRoomId = () => {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('room') ?? Math.random().toString(36).substring(2, 9);
  };

  const currentRoomId = ref(getRoomId());
  const getRandomColor = (): Color => (Math.random() < 0.5 ? Color.White : Color.Black);

  const isMultiplayer = ref(false);
  const playerColor   = ref<Color | null>(null);
  const currentGame   = shallowRef<Engine | null>(null);
  const isWaiting     = ref(false);

  const startNewGame = (mode: GameMode, color: Color | null) => {
    if (isMultiplayer.value) {
      isWaiting.value = true;
      currentGame.value = new Engine(mode);
      socket.emit('find_match', {
        mode:    mode.toString(),
        roomId:  currentRoomId.value,
        color:   playerColor.value,
      });
      socket.once('match_found', (data: { roomId: string; role: Color }) => {
        isWaiting.value   = false;
        currentGame.value = new Engine(mode);
        playerColor.value = data.role;
        currentRoomId.value = data.roomId;
        triggerRef(currentGame);
      });
    } else {
      currentGame.value = new Engine(mode);
      playerColor.value = color ?? getRandomColor();
    }
  };

  // Guard against stale / null game before applying opponent move
  socket.on('opponent_move', (data) => {
    if (currentGame.value && isMultiplayer.value) {
      try {
        currentGame.value.move(data.from, data.to, data.promotion);
      } catch {
        // illegal move received from server -> ignore
      }
      triggerRef(currentGame);
      // TODO: play the move sound here too
    }
  });

  socket.on('opponent_left', () => {
    currentGame.value   = null;
    playerColor.value   = null;
    isMultiplayer.value = false;
    // TODO: llevar al usuario de nuevo al menú principal
  });

  const cancelSearch = () => {
    isWaiting.value     = false;
    currentGame.value   = null;
    playerColor.value   = null;
    isMultiplayer.value = false;
    socket.emit('cancel_search', { roomId: currentRoomId.value });
  };

  const cancelMatch = () => {
    const roomId = currentRoomId.value;
    currentGame.value   = null;
    playerColor.value   = null;
    isMultiplayer.value = false;
    socket.emit('leave_room', { roomId });
  };
</script>

<template>
  <main class="h-screen w-screen bg-slate-900 flex items-center justify-center p-4 overflow-hidden">
    <MainMenu
      v-if="!currentGame"
      v-model="isMultiplayer"
      v-model:color="playerColor"
      @select-mode="startNewGame"
    />

    <div v-else class="flex flex-col items-center gap-4">
      <button
        @click="cancelMatch"
        class="text-slate-500 hover:text-white text-xs uppercase font-bold tracking-widest"
      >
        ← Back to Menu
      </button>
      <ChessBoard
        :game="currentGame!"
        :player-color="playerColor"
        :is-multiplayer="isMultiplayer"
        :socket="socket"
        :room-id="currentRoomId"
      />
    </div>
  </main>

  <div
    v-if="isWaiting"
    class="fixed inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-[300] backdrop-blur-md"
  >
    <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
    <h2 class="text-2xl font-black text-white uppercase tracking-widest animate-pulse">
      Finding Opponent...
    </h2>
    <button
      @click="cancelSearch"
      class="mt-8 text-slate-500 hover:text-white uppercase text-xs font-bold"
    >
      Cancel search
    </button>
  </div>
</template>