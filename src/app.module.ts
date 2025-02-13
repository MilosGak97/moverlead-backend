import { Module } from '@nestjs/common';
import { AuthModule } from './api/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersModule } from './api/users/users.module';
import { EmailModule } from './email/email.module';
import { Property } from './entities/property.entity';
import { PropertiesModule } from './api/properties/properties.module';
import { SettingsModule } from './api/settings/settings.module';
import { StripeModule } from './api/stripe/stripe.module';
import { County } from './entities/county.entity';
import { Subscription } from './entities/subscription.entity';
import { Payment } from './entities/payment.entity';
import { WebsocketGateway } from './events/websocket.gateway';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      synchronize: true,
      ssl: {
        rejectUnauthorized: false, // Use true if you have the certificate
      },
      entities: [User, Property, County, Subscription, Payment],
    }),
    UsersModule,
    EmailModule,
    PropertiesModule,
    SettingsModule,
    StripeModule,
  ],
  providers: [WebsocketGateway],
})
export class AppModule {}
