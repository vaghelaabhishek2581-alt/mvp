import io from 'socket.io-client';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export class YSocketProvider {
  constructor(documentId, ydoc) {
    this.documentId = documentId;
    this.ydoc = ydoc;
    this.socket = null;
    this.connected = false;
    this.awareness = new Map();
    
    // IndexedDB persistence
    this.persistence = new IndexeddbPersistence(documentId, ydoc);
    
    this.connect();
    this.setupYjsListeners();
  }

  connect() {
    this.socket = io({
      path: '/api/socket'
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.connected = true;
      this.onConnect?.();
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
      this.onDisconnect?.();
    });

    this.socket.on('yjs-update', ({ update }) => {
      Y.applyUpdate(this.ydoc, new Uint8Array(update));
    });

    this.socket.on('awareness-update', ({ socketId, awareness }) => {
      this.awareness.set(socketId, awareness);
      this.onAwarenessUpdate?.(this.awareness);
    });

    this.socket.on('user-joined', ({ socketId, userId, userInfo }) => {
      this.onUserJoined?.(socketId, userId, userInfo);
    });

    this.socket.on('user-left', ({ socketId, userId }) => {
      this.awareness.delete(socketId);
      this.onUserLeft?.(socketId, userId);
      this.onAwarenessUpdate?.(this.awareness);
    });

    this.socket.on('current-users', (users) => {
      this.onCurrentUsers?.(users);
    });
  }

  joinDocument(userId, userInfo = {}) {
    if (this.socket && this.connected) {
      this.socket.emit('join-document', {
        documentId: this.documentId,
        userId,
        userInfo: {
          name: userId,
          color: this.generateUserColor(userId),
          ...userInfo
        }
      });
    }
  }

  setupYjsListeners() {
    // Throttle updates to avoid flooding
    let updateTimeout = null;
    
    this.ydoc.on('update', (update) => {
      if (updateTimeout) return;
      
      updateTimeout = setTimeout(() => {
        if (this.socket && this.connected) {
          this.socket.emit('yjs-update', {
            documentId: this.documentId,
            update: Array.from(update)
          });
        }
        updateTimeout = null;
      }, 200);
    });
  }

  updateAwareness(awareness) {
    if (this.socket && this.connected) {
      this.socket.emit('awareness-update', {
        documentId: this.documentId,
        awareness
      });
    }
  }

  generateUserColor(userId) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#AED6F1', '#F7DC6F', '#BB8FCE'
    ];
    
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  destroy() {
    if (this.socket) {
      this.socket.disconnect();
    }
    if (this.persistence) {
      this.persistence.destroy();
    }
  }
}