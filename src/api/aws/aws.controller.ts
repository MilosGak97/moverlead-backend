import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {  ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { FailedScrapperResponseDto } from "./dto/failed-scrapper-response.dto";
import { DynamoDBService } from "./services/dynamo-db.service";

@ApiTags("aws")
@Controller("aws")
export class AwsController {
  constructor(
    private readonly dynamoDBService: DynamoDBService,
  ) {}
/*
  @Post('run-scrapper')
  async runScrapper(){
    return await this.awsService.runScrapper();
  }
  @Post("upload-results")
  async uploadResults(@Body() uploadResultsDto: UploadResultsDto) {
    return await this.awsService.uploadResults(uploadResultsDto);
  }

  @Get("read-results/:key")
  async readResults(@Param("key") key: string) {
    return await this.awsService.readResults(key);
  }

  @Post("scrapping-error")
  async scrappingError(@Body() scrappingErrorDto: ScrappingErrorDto) {
    return await this.awsService.scrappingError(scrappingErrorDto);
  }

  @Post("started-scrapper")
  async startedScrapper(@Body() startedScrapperDto: StartedScrapperDto) {
    return await this.awsService.startedScrapper(startedScrapperDto);
  }

  @Post("successful-scrapper")
  async successfulScrapper(@Body() successfulScrapperDto: SuccessfulScrapperDto) {
    return await this.awsService.successfulScrapper(successfulScrapperDto);
  }

  @Post("failed-scrapper/:key")
  async failedScrapper(@Param("key") key: string) {
    return await this.awsService.failedScrapper(key);
  }

  @Post("update-attempt-count/:key")
  async updateAttemptCount(@Param("key") key: string) {
    return await this.awsService.updateAttemptCount(key);
  }
*/
  @Get("snapshots/failed")
  @ApiOkResponse({ type: FailedScrapperResponseDto })
  async checkFailedScrapper() {
    return await this.dynamoDBService.checkFailedScrapper();
  }
/*
  @Get("snapshots/ready")
  @ApiOkResponse({ type: ReadyScrapperResponseDto })
  async checkReadyScrapper() {
    return await this.awsService.checkReadyScrapper();
  }
    */
}
