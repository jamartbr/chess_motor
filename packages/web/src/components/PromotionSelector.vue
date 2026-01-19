<script setup lang="ts">
    import { PieceType, Color } from '@chess-motor/engine';
    import { PIECE_IMAGES } from '../assets/chessPieces';

    const props = defineProps<{ color: Color }>();
    const emit = defineEmits(['select']);

    const options = [
        { type: PieceType.Queen, icon: props.color === Color.White ? '♕' : '♛' },
        { type: PieceType.Rook, icon: props.color === Color.White ? '♖' : '♜' },
        { type: PieceType.Bishop, icon: props.color === Color.White ? '♗' : '♝' },
        { type: PieceType.Knight, icon: props.color === Color.White ? '♘' : '♞' },
    ];

    const getPieceImage = (type: PieceType) => {
        const c = props.color === Color.White ? 'w' : 'b';
        return PIECE_IMAGES[`${c}${type}`];
    };
</script>

<template>
    <div class="flex flex-col bg-white border-2 border-slate-600 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-md w-16 overflow-hidden">
        <button 
            v-for="opt in options" 
            :key="opt.type"
            @click.stop="emit('select', opt.type)"
            class="w-16 h-16 flex items-center justify-center text-4xl hover:bg-blue-100 text-slate-900 border-b last:border-0 border-slate-200"
        >
            <img :src="getPieceImage(opt.type)" class="w-full h-full" />
        </button>
    </div>
</template>