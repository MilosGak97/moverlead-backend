import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '../../entities/property.entity';
import { User } from '../../entities/user.entity';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { HttpModule } from '@nestjs/axios';
import { CountyRepository } from '../../repositories/county.repository';
import { PropertyCountiesFailed } from '../../entities/property-counties-failed.entity';
import { County } from '../../entities/county.entity';
import { PropertyCountiesFailedRepository } from '../../repositories/property-counties-failed.repository';
import { Subscription } from '../../entities/subscription.entity';
import { SubscriptionRepository } from '../../repositories/subscription.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Property,
      User,
      PropertyCountiesFailed,
      County,
      Subscription,
    ]),
    HttpModule,
  ],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertyRepository,
    UserRepository,
    CountyRepository,
    SubscriptionRepository,
    PropertyCountiesFailedRepository,
  ],
})
export class PropertiesModule {}
