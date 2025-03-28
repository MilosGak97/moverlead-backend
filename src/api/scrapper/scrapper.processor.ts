// scrapper.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { ScrapperService } from './scrapper.service';

@Processor('scrapper')
@Injectable()
export class ScrapperProcessor {
  constructor(private readonly scrapperService: ScrapperService) {}

  @Process('scrapJob')
  async handleScrapJob(job: Job<any>) {
    console.log("ScrapJob started. Job data:", job.data);
    // If zillowData is provided in the payload, use it; otherwise, the service will fetch it.
    await this.scrapperService.runScrapper(job.data.zillowData);
    console.log("ScrapJob finished processing.");
    return {};
  }
}
