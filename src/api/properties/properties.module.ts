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

@Module({
  imports: [TypeOrmModule.forFeature([Property, User]), HttpModule],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    PropertyRepository,
    UserRepository,
    CountyRepository,
  ],
})
export class PropertiesModule {}
