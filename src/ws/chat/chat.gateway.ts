import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessagesService } from '../../messages/messages.service';
import { RealtimeService } from '../../events/realtime.service';
import { PresenceService } from '../../events/presence.service';
import { getClientOriginsFromEnv } from '../../config/client-origin';

function resolveCorsOrigin(): string[] | boolean {
  const origins = getClientOriginsFromEnv();
  return origins.length > 0 ? origins : false;
}

@WebSocketGateway({ cors: { origin: resolveCorsOrigin(), credentials: true } })
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;

  private readonly typingLastEmit = new Map<string, number>();
  private readonly typingMinIntervalMs = 1_500;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagesService: MessagesService,
    private readonly realtime: RealtimeService,
    private readonly presenceService: PresenceService,
  ) {}

  afterInit(server: Server) {
    // Expose the socket server to HTTP services for realtime fan-out.
    this.realtime.setServer(server);
  }

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'dev-secret'),
      });
      client.data.userId = payload.sub;
      client.join(`user:${payload.sub}`);
      await this.presenceService.handleConnect(payload.sub);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      await this.presenceService.handleDisconnect(userId);
    }
  }

  @SubscribeMessage('dm.send')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { recipientId: string; content: string },
  ) {
    const senderId = client.data.userId as string;
    // send() persists + fans out 'dm.received' to both ends via RealtimeService.
    return this.messagesService.send(senderId, body);
  }

  @SubscribeMessage('dm.delivered')
  async deliveredAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId: string },
  ) {
    const recipientId = client.data.userId as string;
    await this.messagesService.markDelivered(body.messageId, recipientId);
  }

  @SubscribeMessage('typing.start')
  typingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { recipientId: string; conversationId?: string },
  ) {
    const senderId = client.data.userId as string;
    const key = `${senderId}:${body.recipientId}`;
    const now = Date.now();
    const lastEmit = this.typingLastEmit.get(key) ?? 0;
    if (now - lastEmit < this.typingMinIntervalMs) {
      return;
    }
    this.typingLastEmit.set(key, now);
    this.server.to(`user:${body.recipientId}`).emit('typing.start', {
      senderId,
      conversationId: body.conversationId,
    });
  }

  @SubscribeMessage('typing.stop')
  typingStop(@ConnectedSocket() client: Socket, @MessageBody() body: { recipientId: string }) {
    const senderId = client.data.userId as string;
    this.typingLastEmit.delete(`${senderId}:${body.recipientId}`);
    this.server.to(`user:${body.recipientId}`).emit('typing.stop', { senderId });
  }
}
