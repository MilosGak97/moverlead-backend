import { Module } from '@nestjs/common';
import { AuthModule } from './api/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersModule } from './api/users/users.module';
import { AwsModule } from './aws/aws.module';
import { Property } from './entities/property.entity';
import { PropertiesModule } from './api/properties/properties.module';
import { SettingsModule } from './api/settings/settings.module';
import { StripeModule } from './api/stripe/stripe.module';
import { County } from './entities/county.entity';
import { WebsocketModule } from './websocket/websocket.module';
import { PropertyCountiesFailed } from './entities/property-counties-failed.entity';
import { ScrapperModule } from './api/scrapper/scrapper.module';

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
      entities: [User, Property, County, PropertyCountiesFailed],
    }),
    UsersModule,
    AwsModule,
    PropertiesModule,
    SettingsModule,
    StripeModule,
    WebsocketModule,
    ScrapperModule,
  ],
})
export class AppModule {}
