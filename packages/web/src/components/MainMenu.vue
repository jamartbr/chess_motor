<script setup lang="ts">
import { Color, GameMode } from '@chess-motor/engine';

defineProps<{
    modelValue: boolean; // This will bind to isMultiplayerMode
    color: Color | null;
}>();

const emit = defineEmits(['selectMode', 'update:modelValue', 'update:color']);

const options = [
    { label: 'WHITE', value: Color.White },
    { label: 'RANDOM', value: null },
    { label: 'BLACK', value: Color.Black }
];
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

    <div class="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700 shadow-inner">
        <button 
            v-for="opt in options" 
            :key="opt.label"
            @click="emit('update:color', opt.value)"
            class="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200"
            :class="color === opt.value 
                ? 'bg-blue-600 text-white shadow-lg' 
                : 'text-slate-500 hover:text-slate-300'"
        >
            {{ opt.label }}
        </button>
    </div>

    <div class="text-center">
      <h1 class="text-4xl font-black text-white tracking-tighter mb-2">CHESS MOTOR</h1>
      <p class="text-slate-400 text-sm italic">Select your battlefield</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
      <button 
        @click="emit('selectMode', GameMode.Classical, color)"
        class="group relative flex flex-col p-6 bg-slate-700 hover:bg-slate-600 rounded-2xl transition-all border-b-4 border-slate-900 active:border-b-0 active:translate-y-1 transition-all transform hover:scale-105 active:scale-95"
      >
        <span class="text-xl font-bold text-white mb-2">Classical</span>
        <p class="text-xs text-slate-400 text-left">Standard chess rules. Win by checkmate or resignation.</p>
      </button>

      <button 
        @click="emit('selectMode', GameMode.Dominion, color)"
        class="group relative flex flex-col p-6 bg-blue-800/40 hover:bg-blue-800/50 rounded-2xl transition-all border-b-4 border-blue-900 active:border-b-0 active:translate-y-1 transition-all transform hover:scale-105 active:scale-95"
      >
        <span class="text-xl font-bold text-blue-100 mb-2">Dominion</span>
        <p class="text-xs text-blue-200/60 text-left">Control squares to earn points. Win by total territory score.</p>
      </button>
    </div>
  </div>
</template>