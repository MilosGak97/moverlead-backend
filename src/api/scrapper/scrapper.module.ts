import { Module } from '@nestjs/common';
import { ScrapperController } from './scrapper.controller';
import { ScrapperService } from './scrapper.service';
import { HttpModule } from '@nestjs/axios';
import { CountyRepository } from '../../repositories/county.repository';
import { AwsService } from '../../aws/aws.service';

@Module({
  imports: [HttpModule],
  controllers: [ScrapperController],
  providers: [ScrapperService, CountyRepository, AwsService],
})
export class ScrapperModule {}
