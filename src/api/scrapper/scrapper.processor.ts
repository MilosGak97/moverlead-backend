// scrapper.processor.ts
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { ScrapperService } from './scrapper.service';

@Processor('scrapper')
@Injectable()
export class ScrapperProcessor {
  private readonly logger = new Logger(ScrapperProcessor.name);

  constructor(private readonly scrapperService: ScrapperService) {}

  @Process('scrapJob')
  async handleScrapJob(job: Job<any>) {
    this.logger.log(`ScrapJob started. Job data: ${JSON.stringify(job.data)}`);

    try {
      this.logger.log('Starting initial runScrapper process.');
      await this.scrapperService.runScrapper(job.data.zillowData);
      this.logger.log('Initial runScrapper process finished.');

      // Retry failed scrapper 5 times with the datacenter proxy
      for (let i = 0; i < 5; i++) {
        this.logger.log(`Retrying failed scrapper with datacenter proxy, attempt ${i + 1}`);
        await this.scrapperService.runFailedScrapper('datacenter');
      }

      // Retry failed scrapper 3 times with the residential proxy
      for (let i = 0; i < 3; i++) {
        this.logger.log(`Retrying failed scrapper with residential proxy, attempt ${i + 1}`);
        await this.scrapperService.runFailedScrapper('residential');
      }

      this.logger.log('ScrapJob finished processing.');
    } catch (error) {
      this.logger.error('Error during ScrapJob processing', error.stack);
      throw error;
    }

    return {};
  }
}
