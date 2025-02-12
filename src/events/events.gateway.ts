import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: Socket })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private logger = new Logger('EventsGateway');

  @WebSocketServer()
  server: Server;

  private clients = new Map<string, NodeJS.Timeout>();

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('ping');
    this.logger.log(`Pong sent to ${client.id}`);

    clearTimeout(this.clients.get(client.id));
    this.clients.set(
      client.id,
      setTimeout(() => {
        this.logger.warn(`Client ${client.id} unresponsive... Disconnected`);
        client.disconnect();
      }, 10000),
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    this.clients.set(
      client.id,
      setInterval(() => {
        client.emit('ping');
        this.logger.log(`Ping sent to ${client.id}`);
      }, 5000),
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    clearInterval(this.clients.get(client.id));
    this.clients.delete(client.id);
  }
}
