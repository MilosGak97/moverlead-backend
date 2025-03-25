import { Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ScrapperService } from './scrapper.service';

@ApiTags('Scrapper')
@Controller('scrapper')
export class ScrapperController {
  constructor(readonly scrapperService: ScrapperService) {}

  @Post('get-zillow-urls')
  async getZillowUrls() {
    return await this.scrapperService.getZillowUrls();
  }
}
