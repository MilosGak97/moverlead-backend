import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'https://www.moverlead.com/', // Change this to your frontend domain for security
    methods: ['GET', 'POST'],
  },
}) // Allow all origins for testing
export class WebsocketGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    client.emit('message', { data: 'Welcome to WebSocket Server!' });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: string, client: Socket): void {
    console.log(`Received ping from ${client.id}`);
    client.emit('pong', { data: 'pong' });
  }
}
