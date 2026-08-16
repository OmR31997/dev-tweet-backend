import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

/**
 * Holds a reference to the socket.io server so HTTP services (messages, posts,
 * comments) can push realtime events without importing the gateway (avoids
 * circular module dependencies).
 */
@Injectable()
export class RealtimeService {
  private server?: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload?: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  /** Whether the user currently has at least one connected socket. */
  isUserOnline(userId: string): boolean {
    const room = this.server?.sockets.adapter.rooms.get(`user:${userId}`);
    return Boolean(room && room.size > 0);
  }
}
