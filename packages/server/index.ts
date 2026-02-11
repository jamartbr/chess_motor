import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Configure Socket.io with CORS to allow your Vue app to connect
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Your Vite dev port
        methods: ["GET", "POST"]
    }
});

interface Room {
    id: string;
    mode: 'classical' | 'dominion';
    players: { white?: string; black?: string };
}

const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // When a player creates/joins a room
    socket.on('join_game', ({ roomId, mode }) => {
        socket.join(roomId);

        if (!rooms.has(roomId)) {
            // Player 1 creates the room
            rooms.set(roomId, {
                id: roomId,
                mode: mode,
                players: { white: socket.id }
            });
            socket.emit('assigned_role', 'w');
        } else {
            // Player 2 joins the room
            const room = rooms.get(roomId)!;
            room.players.black = socket.id;
            socket.emit('assigned_role', 'b');
            
            // Tell both players the game is starting
            io.to(roomId).emit('game_ready', { mode: room.mode });
        }
    });

    // Broadcast moves
    socket.on('send_move', ({ roomId, moveData }) => {
        // Send move to everyone in the room EXCEPT the sender
        socket.to(roomId).emit('receive_move', moveData);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

httpServer.listen(3000, () => {
    console.log('Server listening on port 3000');
});