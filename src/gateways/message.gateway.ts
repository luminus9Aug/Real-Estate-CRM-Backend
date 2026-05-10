import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
})
export class MessageGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MessageGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket): void {
    try {
      const token = client.handshake.auth?.wsToken as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }
      const payload = this.jwt.verify<{ sub: string; tenantId: string }>(token, {
        secret: this.config.getOrThrow<string>('jwt.wsSecret'),
      });
      void client.join(`tenant:${payload.tenantId}`);
      void client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitNewMessage(
    tenantId: string,
    payload: { leadId: string; content: string; isFromLead: boolean; createdAt: Date },
  ): void {
    this.server.to(`tenant:${tenantId}`).emit('new-message', payload);
  }

  emitLeadAssigned(tenantId: string, payload: { leadId: string; agentId: string; agentName: string }): void {
    this.server.to(`tenant:${tenantId}`).emit('lead-assigned', payload);
  }

  emitCommissionPaid(
    tenantId: string,
    payload: { commissionId: string; amount: number; currency: string; amountFormatted: string },
  ): void {
    this.server.to(`tenant:${tenantId}`).emit('commission-paid', payload);
  }

  emitFollowUpDue(
    tenantId: string,
    payload: { followUpId: string; leadId: string; leadName: string; message: string | null; dueAt: Date },
  ): void {
    this.server.to(`tenant:${tenantId}`).emit('follow-up-due', payload);
  }

  afterInit(): void {
    this.logger.log('WebSocket gateway initialized');
  }
}
