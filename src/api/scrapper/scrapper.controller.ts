import {Body, Controller, Post} from "@nestjs/common";
import {ScrapperService} from "./scrapper.service";
import {ApiTags} from "@nestjs/swagger";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull";
import {FetchDataDto} from "../properties/dto/fetch-data.dto";
import {StartScrapperDto} from "./dto/start-scrapper.dto";
import {BrightdataEnrichmentFillerDto} from "./dto/brightdata-enrichment-filler.dto";

@ApiTags("scrapper")
@Controller("scrapper")
export class ScrapperController {
    constructor(
        private readonly scrapperService: ScrapperService,
        @InjectQueue("scrapper") private readonly scrapperQueue: Queue
    ) {
    }

    @Post()
    async startScrapper(@Body() startScrapperDto: StartScrapperDto) {
        const job = await this.scrapperQueue.add("scrapJob", startScrapperDto);
        console.log("INITIAL SCRAPPER VALUE DTO: " + startScrapperDto.initialScrapper);
        console.log(`Job enqueued with ID: ${job.id}`);
        return {message: "Scrapper job has been queued"};
    }

    /*
        @Post('brightdata-enrichment')
        async brightdataEnrichment(){
            return await this.scrapperService.brightdataEnrichment();
        }
    */


    @Post('brightdata-filler')
    async brightdataFiller(@Body() brightdataEnrichmentFillerDto: BrightdataEnrichmentFillerDto) {
        return await this.scrapperService.brightdataEnrichmentFiller(brightdataEnrichmentFillerDto)
    }

    @Post('fetch-data')
    async fetchData(@Body() fetchDataDto: FetchDataDto) {
        return await this.scrapperService.fetchData(fetchDataDto.initialScrapper)
    }

    @Post('cancel-all')
    async cancelAllJobs() {
        // Pause the queue to stop processing new jobs.
        await this.scrapperQueue.pause(true);

        // Obliterate the queue to remove all jobs (force flag ensures removal).
        await this.scrapperQueue.obliterate({force: true});

        // Optionally, you can also close the queue to release resources:
        // await this.scrapperQueue.close();
        // process.exit(0); // Use with caution: forcefully stops the process.

        return {message: "All jobs have been cancelled and the queue has been cleared."};
    }

    @Post('resume')
    async resumeQueue() {
        await this.scrapperQueue.resume();
        return {message: "Queue has been resumed."};
    }
}
