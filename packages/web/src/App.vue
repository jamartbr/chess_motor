<script setup lang="ts">
import ChessBoard from './components/ChessBoard.vue';
</script>

<template>
  <main class="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans">
    <div class="mb-8 text-center">
      <h1 class="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
        CHESS MOTOR
      </h1>
      <p class="text-slate-400 mt-2 font-mono">Vue 3 + Engine Architecture</p>
    </div>

    <ChessBoard />

    <footer class="mt-8 text-slate-500 text-sm italic">
      Portfolio Project: Web-based Chess Engine Integration
    </footer>
  </main>
</template>