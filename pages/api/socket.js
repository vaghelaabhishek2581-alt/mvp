import { Server } from 'socket.io';

export default function handler(req, res) {
  if (res.socket.server.io) {
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Store document rooms and user awareness
  const documentRooms = new Map();
  const userAwareness = new Map();

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join-document', ({ documentId, userId, userInfo }) => {
      socket.join(documentId);
      socket.documentId = documentId;
      socket.userId = userId;

      if (!documentRooms.has(documentId)) {
        documentRooms.set(documentId, new Set());
      }
      documentRooms.get(documentId).add(socket.id);

      // Store user info
      userAwareness.set(socket.id, { userId, ...userInfo });

      // Broadcast user joined
      socket.to(documentId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userInfo
      });

      // Send current users to new user
      const currentUsers = Array.from(documentRooms.get(documentId))
        .filter(id => id !== socket.id)
        .map(id => ({
          socketId: id,
          userId: userAwareness.get(id)?.userId,
          userInfo: userAwareness.get(id)
        }))
        .filter(user => user.userId);

      socket.emit('current-users', currentUsers);
    });

    socket.on('yjs-update', ({ documentId, update }) => {
      socket.to(documentId).emit('yjs-update', { update });
    });

    socket.on('awareness-update', ({ documentId, awareness }) => {
      socket.to(documentId).emit('awareness-update', {
        socketId: socket.id,
        awareness
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      if (socket.documentId) {
        const room = documentRooms.get(socket.documentId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) {
            documentRooms.delete(socket.documentId);
          }
        }

        socket.to(socket.documentId).emit('user-left', {
          socketId: socket.id,
          userId: socket.userId
        });
      }

      userAwareness.delete(socket.id);
    });
  });

  res.socket.server.io = io;
  res.end();
}