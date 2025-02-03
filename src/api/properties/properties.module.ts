import { Module } from '@nestjs/common';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Property } from '../../entities/property.entity';
import { User } from '../../entities/user.entity';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Property, User])],
  controllers: [PropertiesController],
  providers: [PropertiesService, PropertyRepository, UserRepository],
})
export class PropertiesModule {}
