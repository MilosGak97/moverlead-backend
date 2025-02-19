import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { StripeController } from './stripe.controller';
import { CountyRepository } from '../../repositories/county.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { County } from '../../entities/county.entity';
import { UserRepository } from '../../repositories/user.repository';
import { MyGateway } from '../../websocket/gateway';

@Module({
  imports: [TypeOrmModule.forFeature([County])],
  providers: [StripeService, CountyRepository, UserRepository, MyGateway],
  controllers: [StripeController],
  exports: [StripeService],
})
export class StripeModule {}
