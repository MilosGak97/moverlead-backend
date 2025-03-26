import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AwsService } from './aws.service';
import { UploadResultsDto } from './dto/upload-results.dto';
import { StartedScrapperDto } from './dto/started-scrapper.dto';
import { ScrappingErrorDto } from './dto/scrapping-error.dto';
import { FailedScrapperResponseDto } from './dto/failed-scrapper-response.dto';

@ApiTags('aws')
@Controller('aws')
export class AwsController {
  constructor(private readonly awsService: AwsService) {}

  @Post('upload-results')
  async uploadResults(@Body() uploadResultsDto: UploadResultsDto) {
    return await this.awsService.uploadResults(uploadResultsDto);
  }

  @Post('scrapping-error')
  async scrappingError(@Body() scrappingErrorDto: ScrappingErrorDto) {
    return await this.awsService.scrappingError(scrappingErrorDto);
  }

  @Post('started-scrapper')
  async startedScrapper(@Body() startedScrapperDto: StartedScrapperDto) {
    return await this.awsService.startedScrapper(startedScrapperDto);
  }

  @Post('successful-scrapper/:key')
  async successfulScrapper(@Param('key') key: string) {
    return await this.awsService.successfulScrapper(key);
  }

  @Post('failed-scrapper/:key')
  async failedScrapper(@Param('key') key: string) {
    return await this.awsService.failedScrapper(key);
  }

  @Post('update-attempt-count/:key')
  async updateAttemptCount(@Param('key') key: string) {
    return await this.awsService.updateAttemptCount(key);
  }

  @Post('check-failed-scrapper')
  @ApiOkResponse({ type: FailedScrapperResponseDto })
  async checkFailedScrapper() {
    return await this.awsService.checkFailedScrapper();
  }
}
