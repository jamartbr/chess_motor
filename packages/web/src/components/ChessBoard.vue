<script setup lang="ts">
    import { ref, triggerRef, computed, watch, nextTick } from 'vue';
    import { Engine, Color, PieceType, GameMode } from '@chess-motor/engine';
    import Square from './Square.vue';
    import PromotionSelector from './PromotionSelector.vue';
    import { SOUNDS } from '../assets/sounds';
    import { Socket } from 'socket.io-client';

    const props = defineProps<{
        game: Engine;
        playerColor: Color | null;
        isMultiplayer: boolean;
        socket: Socket;
        roomId: string;
    }>();

    const game = computed(() => props.game);
    const moveKey = ref(0);
    const selectedSquare = ref<number | null>(null);
    const lastMove = ref<{ from: number; to: number } | null>(null);
    const pendingPromotion = ref<{ from: number, to: number, color: Color } | null>(null);
    const isFinished = ref(false);
    const winner = ref<Color | 'Draw' | null>(null);

    // Board indices: white view has rank 7 at top, black view is flipped
    const boardIndices = computed(() => {
        const indices = [];
        const color = props.playerColor;
        if (color === Color.White) {
            for (let rank = 7; rank >= 0; rank--) {
                for (let file = 0; file < 8; file++) {
                    indices.push((rank << 4) | file);
                }
            }
        } else {
            for (let rank = 0; rank < 8; rank++) {
                for (let file = 7; file >= 0; file--) {
                    indices.push((rank << 4) | file);
                }
            }
        }
        return indices;
    });

    const scrollBox = ref(null);
    const movePairs = computed(() => {
        const history = props.game.moveHistory;
        const pairs = [];
        for (let i = 0; i < history.length; i += 2) {
            pairs.push({
                white: history[i],
                black: history[i + 1] || ''
            });
        }
        return pairs;
    });

    // Auto-scroll to latest move
    watch(() => props.game.moveHistory.length, async () => {
        await nextTick();
        if (scrollBox.value) {
            (scrollBox.value as HTMLElement).scrollTop = (scrollBox.value as HTMLElement).scrollHeight;
        }
    });
    
    const downloadPGN = () => {
        const content = movePairs.value
            .map((p, i) => `${i + 1}. ${p.white} ${p.black}`)
            .join(' ');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'partida.pgn';
        a.click();
    };

    const handleMove = async (from: number, to: number) => {
        const piece = game.value.getPiece(from);
        if (!piece) return;

        const isPawn = piece.type === PieceType.Pawn;
        const isPromotionRank = (to >> 4) === 0 || (to >> 4) === 7;

        if (isPawn && isPromotionRank && game.value.getLegalMoves(from).includes(to)) {
            pendingPromotion.value = { from, to, color: piece.color };
            return; 
        }

        executeMove(from, to);
    };

    const executeMove = (from: number, to: number, promotion: PieceType = PieceType.Queen) => {
        if (!game.value.getLegalMoves(from).includes(to)) return;

        // Apply move via Engine — returns MoveRecord, updates history internally
        const move = game.value.move(from, to, promotion);

        // Detect capture
        const isCapture = !!move.captured;

        // Check game over
        if (game.value.isGameOver()) {
            isFinished.value = true;
            winner.value = game.value.getWinner();
            // TODO: playSound(SOUNDS.GAME_END);
        }

        // After move, it's the opponent's turn — check if their king is in check
        const isCheck = game.value.isCheck();

        // Play appropriate sound
        if (isCheck) {
            playSound(SOUNDS.CHECK);
        } else if (isCapture) {
            playSound(SOUNDS.CAPTURE);
        } else {
            playSound(SOUNDS.MOVE);
        }

        // Update UI state
        moveKey.value++;
        triggerRef(game);
        lastMove.value = { from, to };
        pendingPromotion.value = null;
        selectedSquare.value = null;

        // Notify server
        if (props.isMultiplayer && props.socket) {
            props.socket.emit('make_move', {
                roomId: props.roomId,
                from,
                to,
                promotion
            });
        }
    };

    const onSquareClick = (index: number) => {
        const piece = game.value.getPiece(index);

        if (selectedSquare.value === null) {
            if (piece && 
                piece.color === game.value.turn && 
                (piece.color === props.playerColor || !props.isMultiplayer)) {
                selectedSquare.value = index;
            }
        } else {
            if (piece && piece.color === game.value.turn) {
                selectedSquare.value = index;
            } else {
                handleMove(selectedSquare.value, index);
            }
        }
    };

    const getPromotionStyle = (index: number) => {
        const file = index & 7;
        const rank = index >> 4;
        const squareSize = 70; 
        
        const xPos = props.playerColor === Color.White 
            ? file * squareSize 
            : (7 - file) * squareSize;

        const isWhiteCoronating = rank === 7;
        
        if (props.playerColor === Color.White) {
            return isWhiteCoronating 
                ? { left: `${xPos}px`, top: '0px' } 
                : { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' };
        } else {
            return isWhiteCoronating
                ? { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' }
                : { left: `${xPos}px`, top: '0px' };
        }
    };

    const playSound = (url: string) => {
        const audio = new Audio(url);
        audio.play().catch(err => console.warn("Audio playback blocked:", err));
    };

    const resetGame = () => {
        game.value.reset();
        
        selectedSquare.value = null;
        lastMove.value = null;
        pendingPromotion.value = null;
        isFinished.value = false;
        winner.value = null;
        
        moveKey.value++;
        triggerRef(game);

        // TODO: playSound(SOUNDS.GAME_START); 
    };

    // Highlight opponent's move when it arrives
    if (props.socket) {
        props.socket.on('opponent_move', (move) => {
            lastMove.value = { from: move.from, to: move.to };
        });
    }
</script>

<template>
    <div class="flex flex-col md:flex-row gap-8 items-center justify-center p-4 w-full h-full max-h-full">
        
        <div class="relative">
            <div :key="moveKey" class="grid grid-cols-8 aspect-square w-[560px] border-[12px] border-slate-700 bg-slate-800 shadow-2xl">
                <Square 
                    v-for="index in boardIndices" 
                    :key="index"
                    :index="index"
                    :piece="game.getPiece(index)"
                    :is-selected="selectedSquare === index"
                    :is-last-move="lastMove?.from === index || lastMove?.to === index"
                    :control="game.getSquareControl(index)"
                    :current-turn="game.turn"
                    :player-color="playerColor"
                    :is-multiplayer="isMultiplayer"
                    :mode="game.mode"
                    @click="onSquareClick(index)" 
                    @move="handleMove"
                />

                <div v-if="pendingPromotion" class="absolute inset-0 z-[100] bg-black/10">
                    <PromotionSelector 
                        :color="pendingPromotion.color"
                        :style="getPromotionStyle(pendingPromotion.to)"
                        @select="(type) => executeMove(pendingPromotion!.from, pendingPromotion!.to, type)"
                    />
                </div>
            </div>
        </div>

        <div class="notation-panel">
            <div class="moves-scroll" ref="scrollBox">
                <div v-for="(pair, i) in movePairs" :key="i" class="move-row">
                    <span class="num">{{ i + 1 }}.</span>
                    <span class="white">{{ pair.white }}</span>
                    <span class="black">{{ pair.black }}</span>
                </div>
            </div>
            
            <button @click="downloadPGN" class="w-full px-4 py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg uppercase">
            Descargar PGN
            </button>
        </div>

        <div class="w-64 flex flex-col gap-4">
            <div v-if="game.mode === GameMode.Dominion" class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl animate-in slide-in-from-right duration-500">
                <h2 class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Dominion Points</h2>
                
                <div class="flex flex-col gap-6">
                    <div class="flex justify-between items-end">
                        <span class="text-white font-medium">White</span>
                        <span class="text-3xl font-mono font-bold text-white">{{ game.whitePoints }}</span>
                    </div>
                    
                    <div class="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                        <div 
                            class="h-full bg-blue-500 transition-all duration-500" 
                            :style="{ width: `${(game.whitePoints / (game.whitePoints + game.blackPoints || 1)) * 100}%` }">
                        </div>
                        <div class="h-full bg-red-500 flex-grow"></div>
                    </div>

                    <div class="flex justify-between items-end">
                        <span class="text-slate-400 font-medium">Black</span>
                        <span class="text-3xl font-mono font-bold text-slate-300">{{ game.blackPoints }}</span>
                    </div>
                </div>
            </div>

            <div class="bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                <span class="text-slate-400 text-sm italic">
                    {{ game.turn === Color.White ? "White's turn" : "Black's turn" }}
                </span>
            </div>
        </div>
    </div>

    <div v-if="isFinished" class="absolute inset-0 z-[200] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm transition-all animate-in fade-in duration-500">
    
        <div class="relative bg-slate-800 p-12 min-w-[400px] rounded-2xl border-2 border-slate-600 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center flex flex-col items-center gap-8">
    
            <button 
                @click="isFinished = false" 
                class="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full transition-colors"
                aria-label="Close"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>

            <div class="space-y-3 pt-2">
                <h2 class="text-5xl font-black text-white uppercase tracking-tighter leading-none">
                    {{ winner === 'Draw' ? "It's a Draw!" : (winner === Color.White ? 'White Victory' : 'Black Victory') }}
                </h2>
                <p v-if="game.mode === GameMode.Classical" class="text-slate-400 uppercase text-xs tracking-[0.2em] font-bold">
                    By Checkmate
                </p>
            </div>
            
            <div v-if="game.mode === GameMode.Dominion" class="flex gap-10 items-center bg-slate-900/50 px-8 py-6 rounded-xl border border-slate-700 w-full justify-center">
                <div class="text-center">
                    <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Final White</p>
                    <p class="text-4xl font-mono font-bold text-blue-400">{{ game.whitePoints }}</p>
                </div>
                <div class="text-xl text-slate-600 italic font-serif">vs</div>
                <div class="text-center">
                    <p class="text-[10px] text-slate-500 uppercase font-bold mb-1">Final Black</p>
                    <p class="text-4xl font-mono font-bold text-red-400">{{ game.blackPoints }}</p>
                </div>
            </div>

            <button 
                @click="resetGame" 
                class="w-full sm:w-auto px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/40 uppercase tracking-widest"
            >
                Play Again
            </button>
        </div>
    </div>
</template>

<style scoped>
.notation-panel {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 250px;
  height: 300px;
  background: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  padding: 10px;
}
.moves-scroll {
  flex-grow: 1;
  overflow-y: auto;
  font-family: monospace;
}
.move-row {
  display: grid;
  grid-template-columns: 30px 1fr 1fr;
  padding: 4px 0;
  border-bottom: 1px solid #3e4f5f;
}
.num { color: #95a5a6; }
</style>