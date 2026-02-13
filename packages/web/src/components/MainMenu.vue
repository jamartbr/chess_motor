<script setup lang="ts">
import { Color, GameMode } from '@chess-motor/engine';

defineProps<{
    modelValue: boolean; // This will bind to isMultiplayerMode
    color: Color;
}>();

const emit = defineEmits(['selectMode', 'update:modelValue', 'update:color']);
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-8 p-12 bg-slate-800 rounded-3xl border-2 border-slate-700 shadow-2xl">
    <div class="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
        <span :class="!modelValue ? 'text-white font-bold' : 'text-slate-500'" class="text-sm transition-colors">
            SINGLE PLAYER
        </span>
        
        <button 
            @click="emit('update:modelValue', !modelValue)"
            class="relative w-14 h-7 bg-slate-700 rounded-full p-1 transition-colors duration-300"
            :class="{ 'bg-blue-600': modelValue }"
        >
            <div 
                class="w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300"
                :class="{ 'translate-x-7': modelValue }"
            ></div>
        </button>

        <span :class="modelValue ? 'text-blue-400 font-bold' : 'text-slate-500'" class="text-sm transition-colors">
            MULTIPLAYER
        </span>
    </div>

    <div class="flex items-center gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
        <span :class="color === Color.White ? 'text-white font-bold' : 'text-slate-500'" class="text-sm transition-colors">
            WHITE
        </span>
        
        <button 
            @click="emit('update:color', color === Color.White ? Color.Black : Color.White)"
            class="relative w-14 h-7 bg-slate-700 rounded-full p-1 transition-colors duration-300"
            :class="{ 'bg-blue-600': color === Color.Black }"
        >
            <div 
                class="w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300"
                :class="{ 'translate-x-7': color === Color.Black }"
            ></div>
        </button>

        <span :class="color === Color.Black ? 'text-blue-400 font-bold' : 'text-slate-500'" class="text-sm transition-colors">
            BLACK
        </span>
    </div>

    <div class="text-center">
      <h1 class="text-4xl font-black text-white tracking-tighter mb-2">CHESS MOTOR</h1>
      <p class="text-slate-400 text-sm italic">Select your battlefield</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
      <button 
        @click="emit('selectMode', GameMode.Classical)"
        class="group relative flex flex-col p-6 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-all border-b-4 border-slate-900 active:border-b-0 active:translate-y-1"
      >
        <span class="text-xl font-bold text-white mb-2">Classical</span>
        <p class="text-xs text-slate-400 text-left">Standard chess rules. Win by checkmate or resignation.</p>
      </button>

      <button 
        @click="emit('selectMode', GameMode.Dominion)"
        class="group relative flex flex-col p-6 bg-blue-900/40 hover:bg-blue-800/50 rounded-2xl transition-all border-b-4 border-blue-900 active:border-b-0 active:translate-y-1"
      >
        <div class="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
        <span class="text-xl font-bold text-blue-100 mb-2">Dominion</span>
        <p class="text-xs text-blue-200/60 text-left">Control squares to earn points. Win by total territory score.</p>
      </button>
    </div>
  </div>
</template>