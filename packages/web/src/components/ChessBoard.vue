<script setup lang="ts">
    import { ref, triggerRef, computed, inject } from 'vue';
    import { Board, Color, PieceType, GameMode } from '@chess-motor/engine';
    import Square from './Square.vue';
    import PromotionSelector from './PromotionSelector.vue';
    import { SOUNDS } from '../assets/sounds';
    import { Socket } from 'socket.io-client';

    // // Inject the shared socket and room ID
    // const socket = inject<Socket>('chessSocket');
    // const roomId = inject<string>('roomId');

    const props = defineProps<{
        game: Board;
        playerColor: Color | null;
        isMultiplayer: boolean;
        socket: Socket;
        roomId: string;
    }>();

    const game = computed(() => props.game);
    const moveKey = ref(0); // Contador de movimientos
    const selectedSquare = ref<number | null>(null);
    const lastMove = ref<{ from: number; to: number } | null>(null);
    const pendingPromotion = ref<{ from: number, to: number, color: Color } | null>(null);
    const isFinished = ref(false);
    const winner = ref<Color | 'Draw' | null>(null);

    // Generamos los índices de forma que la fila 7 (negras) esté arriba 
    // y la fila 0 (blancas) esté abajo.
    const boardIndices = computed(() => {
        const indices = [];
        const color = props.playerColor;
        console.log(`inside boardIndices: color = ${color}`);
        if (color && color === Color.White) {
            for (let rank = 7; rank >= 0; rank--) { // De fila 7 a 0
                for (let file = 0; file < 8; file++) { // De columna 0 a 7
                    indices.push((rank << 4) | file);
                }
            }
        } else {
            for (let rank = 0; rank < 8; rank++) { // De fila 0 a 7
                for (let file = 7; file >= 0; file--) { // De columna 7 a 0
                    indices.push((rank << 4) | file);
                }
            }
        }
        return indices;
    });

    const handleMove = async (from: number, to: number) => {
        const piece = game.value.getPieceAt(from);
        if (!piece) return;

        const isPawn = piece?.type === PieceType.Pawn;
        const isPromotionRank = (to >> 4) === 0 || (to >> 4) === 7;

        if (isPawn && isPromotionRank && game.value.getLegalMoves(from).includes(to)) {
            console.log("Abriendo selector de promoción..."); // Debug
            pendingPromotion.value = { from, to, color: piece.color };
            return; 
        }

        executeMove(from, to);
    };

    const executeMove = (from: number, to: number, promotion: PieceType = PieceType.Queen) => {
        if (game.value.getLegalMoves(from).includes(to)) {
            // 1. Check if there is a piece at the target before moving (to detect capture)
            const isCapture = !!game.value.getPieceAt(to);

            // 2. Execute the move in the engine
            game.value.makeMove(from, to, promotion);

            // 3. Update the acumulative score for the variant rules
            game.value.updateControlPoints();

            // 4. Check for game over
            if (game.value.isGameOver()) {
                isFinished.value = true;
                winner.value = game.value.getDominionWinner();
                // playSound(SOUNDS.GAME_END); // Add this to your sounds if you have it
            }

            // 5. Identify who just moved and who is now under attack
            const activeColor = game.value.turn; 
            const opponentColor = activeColor === Color.White ? Color.Black : Color.White;

            // 6. Find the king of the player whose turn it is now
            const kingIndex = game.value.findKing(activeColor);
            
            // 7. Check if that king is attacked by the player who just moved
            const isCheck = game.value.isSquareAttacked(kingIndex, opponentColor);

            // 8. Play the appropriate sound
            if (isCheck) {
                playSound(SOUNDS.CHECK);
            } else if (isCapture) {
                playSound(SOUNDS.CAPTURE);
            } else {
                playSound(SOUNDS.MOVE);
            }

            // 9. Update UI state
            moveKey.value++;
            triggerRef(game);
            lastMove.value = { from, to };
            pendingPromotion.value = null;
            selectedSquare.value = null;

            // 10. Notify server
            if (props.isMultiplayer && props.socket) {
                console.log(`request to make move in room ${props.roomId}: from ${from} to ${to}`)
                props.socket.emit('make_move', {
                    roomId: props.roomId,
                    from,
                    to,
                    promotion
                });
            }
        }
    };

    const onSquareClick = (index: number) => {
        const piece = game.value.getPieceAt(index);

        // DEBUG: Check values in console
        console.log({
            pieceColor: piece?.color,
            currentTurn: game.value.turn,
            playerColor: props.playerColor
        });

        if (selectedSquare.value === null) {
            // Only allow selection if:
            // 1. There is a piece
            // 2. It is the player's turn in the engine
            // 3. The piece matches the player's assigned color
            if (piece && 
                piece.color === game.value.turn && 
                piece.color === props.playerColor) {
                selectedSquare.value = index;
            }
        } else {
            // Standard movement logic
            // If the piece is another one different from the selected one, but same color
            if (piece && piece.color === game.value.turn) {
                selectedSquare.value = index;
            } else {
                // If enemy piece, try move
                handleMove(selectedSquare.value, index);
            }
        }
    };

    const getPromotionStyle = (index: number) => {
        // const file = index & 7; // Columna (0-7)
        // const rank = index >> 4; // Fila (0 o 7)
        
        // // Cada casilla mide 64px (512 / 8)
        // const left = file * 64;
        
        // // Si es blanca (fila 7, arriba), lo pegamos arriba. 
        // // Si es negra (fila 0, abajo), lo pegamos abajo.
        // if (rank === 7) {
        //     return { left: `${left}px`, top: '0px' };
        // } else {
        //     return { left: `${left}px`, bottom: '0px' };
        // }
        const file = index & 7; // Columna (0-7)
        const rank = index >> 4; // Fila (0-7)
        
        // Ancho de una casilla: 560px / 8 = 70px
        const squareSize = 70; 
        
        // Calculamos la posición X (siempre igual)
        // Si el tablero está invertido (playerColor === Black), la columna 0 es la derecha
        const xPos = props.playerColor === Color.White 
            ? file * squareSize 
            : (7 - file) * squareSize;

        // Calculamos la posición Y
        // Si coronas en la fila 7 (blancas), el selector debe nacer arriba y bajar
        // Si coronas en la fila 0 (negras), el selector debe nacer abajo y subir
        const isWhiteCoronating = rank === 7;
        
        if (props.playerColor === Color.White) {
            // Vista normal: Fila 7 es arriba, Fila 0 es abajo
            return isWhiteCoronating 
                ? { left: `${xPos}px`, top: '0px' } 
                : { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' };
        } else {
            // Vista invertida: Fila 0 es arriba, Fila 7 es abajo
            return isWhiteCoronating
                ? { left: `${xPos}px`, bottom: '0px', flexDirection: 'column-reverse' }
                : { left: `${xPos}px`, top: '0px' };
        }
    };

    // Function to play chess sounds
    const playSound = (url: string) => {
        const audio = new Audio(url);
        // Ensure we don't block the UI if audio fails
        audio.play().catch(err => console.warn("Audio playback blocked:", err));
    };

    const resetGame = () => {
        // 1. Reset the existing game instance
        game.value.resetBoard();
        
        // 2. Reset UI state variables
        selectedSquare.value = null;
        lastMove.value = null;
        pendingPromotion.value = null;
        isFinished.value = false;
        winner.value = null;
        
        // 3. Update the UI
        moveKey.value++;
        triggerRef(game);

        // 4. TODO: Play game start sound
        // playSound(SOUNDS.GAME_START); 
    };

    // Listen for opponent moves specifically to update the highlight
    if (props.socket) {
        props.socket.on('opponent_move', (move) => {
            // Update the highlight coordinates for the opponent's move
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
                    :piece="game.getPieceAt(index)"
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

        <div class="w-64 flex flex-col gap-4">
            <div v-if="game.mode === GameMode.Dominion" class="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl animate-in slide-in-from-right duration-500">
                <h2 class="text-slate-400 text-xs font-bold uppercase tracking-widest mb-4">Dominion Points</h2>
                
                <div class="flex flex-col gap-6">
                    <div class="flex justify-between items-end">
                        <span class="text-white font-medium">White</span>
                        <span class="text-3xl font-mono font-bold text-white">{{ game.whiteControlPoints }}</span>
                    </div>
                    
                    <div class="h-2 w-full bg-slate-700 rounded-full overflow-hidden flex">
                        <div 
                            class="h-full bg-blue-500 transition-all duration-500" 
                            :style="{ width: `${(game.whiteControlPoints / (game.whiteControlPoints + game.blackControlPoints || 1)) * 100}%` }">
                        </div>
                        <div class="h-full bg-red-500 flex-grow"></div>
                    </div>

                    <div class="flex justify-between items-end">
                        <span class="text-slate-400 font-medium">Black</span>
                        <span class="text-3xl font-mono font-bold text-slate-300">{{ game.blackControlPoints }}</span>
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
        <div class="bg-slate-800 p-10 rounded-2xl border-2 border-slate-600 shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center flex flex-col items-center gap-6">
            
            <div class="space-y-2">
                <h2 class="text-4xl font-black text-white uppercase tracking-tighter">
                    {{ winner === 'Draw' ? "It's a Draw!" : (winner === Color.White ? 'White Victory' : 'Black Victory') }}
                </h2>
                <p v-if="game.mode === GameMode.Classical" class="text-slate-400 uppercase text-xs tracking-widest font-bold">
                    By Checkmate
                </p>
            </div>
            
            <div v-if="game.mode === GameMode.Dominion" class="flex gap-8 items-center bg-slate-900/50 p-6 rounded-xl border border-slate-700">
                <div class="text-center">
                    <p class="text-[10px] text-slate-500 uppercase font-bold">Final White</p>
                    <p class="text-3xl font-mono font-bold text-blue-400">{{ game.whiteControlPoints }}</p>
                </div>
                <div class="text-xl text-slate-600 italic">vs</div>
                <div class="text-center">
                    <p class="text-[10px] text-slate-500 uppercase font-bold">Final Black</p>
                    <p class="text-3xl font-mono font-bold text-red-400">{{ game.blackControlPoints }}</p>
                </div>
            </div>

            <button 
                @click="resetGame" 
                class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/40"
            >
                PLAY AGAIN
            </button>
        </div>
    </div>
</template>

