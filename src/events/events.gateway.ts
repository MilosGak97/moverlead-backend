import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';

@WebSocketGateway({
  transports: ['websocket'],
  cors: {
    origin: '*', // Allows all domains. You can specify specific domains instead of '*'.
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
  },
})
export class EventsGateway {
  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: string): string {
    return 'Received message: ' + data;
  }
}

