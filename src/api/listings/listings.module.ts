import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '../../entities/property.entity';
import { User } from '../../entities/user.entity';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Property, User])],
  controllers: [ListingsController],
  providers: [ListingsService, PropertyRepository, UserRepository],
})
export class ListingsModule {}
