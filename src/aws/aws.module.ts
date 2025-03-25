import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { AwsService } from './aws.service';
import { AwsController } from './aws.controller';

@Module({
  providers: [EmailService, AwsService],
  exports: [EmailService, AwsService],
  controllers: [AwsController],
})
export class AwsModule {}
