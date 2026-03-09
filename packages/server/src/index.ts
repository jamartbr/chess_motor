import express from 'express';
import { Color, GameMode } from './types'
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { WaitingPlayer, FindMatchPayload, MakeMovePayload } from './types';

// HTTP / Socket.IO setup

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "https://chess-motor.vercel.app",
        methods: ["GET", "POST"]
    }
});

// Matchmaking queues

/**
 * One FIFO queue per game mode.
 * Players sit here until a compatible opponent is found.
 */
const queues: Record<string, WaitingPlayer[]> = {
    [GameMode.Classical]: [],
    [GameMode.Dominion]:  [],
};

/**
 * Remove a player from ALL queues (used on disconnect and cancel_search).
 * Returns true if the player was found and removed.
 */
function removeFromQueues(socketId: string): boolean {
    let removed = false;
    for (const mode in queues) {
        const before = queues[mode]!.length;
        queues[mode] = queues[mode]!.filter(wp => wp.socketId !== socketId);
        if (queues[mode]!.length < before) removed = true;
    }
    return removed;
}

// Socket.IO event handlers

io.on('connection', (socket) => {
  console.log(`[connect]    ${socket.id}`);

  // Find match
  /**
   * Emitted by a client that wants to start a game.
   * Tries to pair with a compatible waiting player; if none is found,
   * the current player is added to the queue.
   *
   * Compatibility rules:
   *   - A "Random" player (color === null) matches anyone.
   *   - A player with a colour preference matches someone who chose the
   *     opposite colour or someone who chose Random.
   */
  socket.on('find_match', (data: FindMatchPayload) => {
      const { mode, color } = data;
      const queue = queues[mode];

      if (!queue) {
          console.warn(`[find_match] Unknown mode "${mode}" from ${socket.id}`);
          return;
      }

      console.log(`[find_match] ${socket.id} wants ${mode} as ${color ?? 'random'}`);

      // Find the first compatible opponent in the queue
      let opponentIndex = -1;

      if (color === null) {
          // No preference -> match with first one, if exists
          opponentIndex = queue.length > 0 ? 0 : -1;
      } else {
          const oppositeColor = color === Color.White ? Color.Black : Color.White;
          opponentIndex = queue.findIndex(
              wp => wp.color === null || wp.color === oppositeColor
          );
      }

      if (opponentIndex !== -1) {
          // MATCH FOUND
          const [opponent] = queue.splice(opponentIndex, 1);
          const roomId     = `room-${opponent!.socketId}-${socket.id}`;

          const opponentSocket = io.sockets.sockets.get(opponent!.socketId);
          if (!opponentSocket) {
              // Opponent disconnected between queuing and matching — re-queue current player
              console.warn(`[find_match] Opponent ${opponent!.socketId} vanished, re-queuing ${socket.id}`);
              queue.push({ socketId: socket.id, color });
              socket.emit('waiting_for_opponent');
              return;
          }

          // Both players join the shared room
          opponentSocket.join(roomId);
          socket.join(roomId);

          // Decide who plays White
          let whiteId: string;
          let blackId: string;

          if (color === Color.White || opponent!.color === Color.Black) {
              whiteId = socket.id;
              blackId = opponent!.socketId;
          } else if (color === Color.Black || opponent!.color === Color.White) {
              whiteId = opponent!.socketId;
              blackId = socket.id;
          } else {
              // Both chose Random -> flip a coin
              const flip = Math.random() > 0.5;
              whiteId = flip ? socket.id       : opponent!.socketId;
              blackId = flip ? opponent!.socketId : socket.id;
          }

          io.to(whiteId).emit('match_found', { roomId, role: Color.White });
          io.to(blackId).emit('match_found', { roomId, role: Color.Black });

          console.log(`[match_found] Room ${roomId}: white=${whiteId} black=${blackId}`);
      } else {
          // NO OPPONENT -> add to queue
          queue.push({ socketId: socket.id, color });
          socket.emit('waiting_for_opponent');
          console.log(`[queued]     ${socket.id} waiting for ${mode} (${color ?? 'random'})`);
      }
  });

  // make_move
  /**
   * Relay a move to the other player in the same room.
   * The server is move-agnostic — it forwards the payload without validation.
   * (Move legality is enforced client-side by the engine)
   */
  socket.on('make_move', (data: MakeMovePayload) => {
      socket.to(data.roomId).emit('opponent_move', data);
      console.log(`[make_move]  Room ${data.roomId}: ${data.from} → ${data.to}`);
  });

  // cancel_search
  /**
   * Player cancelled matchmaking before an opponent was found.
   * Remove them from all queues.
   */
  socket.on('cancel_search', () => {
      const removed = removeFromQueues(socket.id);
      console.log(`[cancel]     ${socket.id} — removed from queue: ${removed}`);
  });

  // disconnecting
  /**
   * Fires before the socket leaves its rooms, so we can still enumerate them.
   * Notifies any active opponent and removes the player from matchmaking queues.
   */
  socket.on('disconnecting', () => {
    console.log(`[disconnecting] ${socket.id}`);

    // 1. Remove from matchmaking queues (was still waiting, not yet matched)
    const wasWaiting = removeFromQueues(socket.id);
    
    if (!wasWaiting) {

      // 2. Notify any opponent in active game rooms
      for (const room of socket.rooms) {
        if (!room.startsWith('room-')) continue;

        const clients = io.sockets.adapter.rooms.get(room);
        if (!clients) continue;

        for (const clientId of clients) {
            if (clientId === socket.id) continue;

            const opponentSocket = io.sockets.sockets.get(clientId);
            if (!opponentSocket) continue;

            opponentSocket.emit('opponent_left', {
                roomId: room,
                reason: 'opponent_disconnected',
            });
            opponentSocket.leave(room);
            console.log(`[disconnecting] Notified ${clientId} in room ${room}`);
        }
      }
    }
  });

  // Disconnect
  /**
   * Fires after the socket has left all rooms.
   * Queue cleanup is already handled in 'disconnecting', so nothing extra
   * is needed here — the handler is kept for logging
   */
  socket.on('disconnect', (reason) => {
      console.log(`[disconnect] ${socket.id} — ${reason}`);
  });
});

// Start server

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});