import { Body, Controller, Post } from "@nestjs/common";
import { ScrapperService } from "./scrapper.service";
import { ApiTags } from "@nestjs/swagger";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";

@ApiTags("scrapper")
@Controller("scrapper")
export class ScrapperController {
  constructor(
    private readonly scrapperService: ScrapperService,
    @InjectQueue("scrapper") private readonly scrapperQueue: Queue
  ) {}

  @Post("run-failed-scrapper-manually")
  async runFailedScrapperManually() {
    return await this.scrapperService.runFailedScrapper()
  }

  @Post()
  async startScrapper(@Body() payload: { zillowData?: any }) {
    await this.scrapperQueue.add("scrapJob", payload);
    return { message: "Scrapper job has been queued" };
  }
}
