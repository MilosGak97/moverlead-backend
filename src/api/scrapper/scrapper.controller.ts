import {Body, Controller, Param, Post, Query} from "@nestjs/common";
import {ScrapperService} from "./scrapper.service";
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {InjectQueue} from "@nestjs/bull";
import {Queue} from "bull";
import {FetchDataDto} from "../properties/dto/fetch-data.dto";
import {StartScrapperDto} from "./dto/start-scrapper.dto";
import {BrightdataEnrichmentFillerDto} from "./dto/brightdata-enrichment-filler.dto";
import {RunScrapperV2Dto} from "./dto/run-scrapper-v2.dto";
import {GetZillowUrlsForCountyDto} from "./dto/get-zillow-urls-for-county-dto";
import {BrightdataService} from "./brightdata.service";
import {BrightdataEnrichmentTriggerDto} from "./dto/brightdata-enrichment-trigger-dto";
import {HasdataService} from "./hasdata.service";
import {TestScrapperDto} from "./dto/test-scrapper.dto";

@ApiTags("scrapper")
@Controller("scrapper")
export class ScrapperController {
    constructor(
        private readonly scrapperService: ScrapperService,
        private readonly brightdataService: BrightdataService,
        private readonly hasdataService: HasdataService,
        @InjectQueue("scrapper") private readonly scrapperQueue: Queue
    ) {
    }

    @Post('reddis/trigger-scrapping')
    async startScrapper(@Body() startScrapperDto: StartScrapperDto) {
        const job = await this.scrapperQueue.add("scrapJob", startScrapperDto);
        console.log("INITIAL SCRAPPER VALUE DTO: " + startScrapperDto.initialScrapper);
        console.log(`Job enqueued with ID: ${job.id}`);
        return {message: "Scrapper job has been queued"};
    }

    @Post('test-scrapper')
    async testScrapper(@Body() testScrapperDto: TestScrapperDto){
        return await this.scrapperService.chicagoScrapper(testScrapperDto.initialScrapper)
    }

    @ApiOperation({ description: "Trigger brightdata"})
    @Post('brightdata/trigger')
    async brightdataEnrichmentTrigger(@Query() brightdataEnrichmentTriggerDto: BrightdataEnrichmentTriggerDto) {
        return await this.brightdataService.brightdataEnrichmentTrigger(brightdataEnrichmentTriggerDto.brightdataVersion)
    }

    @Post('brightdata/filler')
    async brightdataEnrichmentFiller(@Query() brightdataEnrichmentFillerDto: BrightdataEnrichmentFillerDto) {
        return await this.brightdataService.brightdataEnrichmentFiller(brightdataEnrichmentFillerDto.brightdataVersion, brightdataEnrichmentFillerDto.snapshotId)
    }

    @Post('hasdata/trigger')
    async hasdataProperty(){
        return await this.hasdataService.hasdataEnrichmentTrigger()
    }

    @Post('fetch-data')
    async fetchData(@Body() fetchDataDto: FetchDataDto) {
        return await this.scrapperService.fetchDataBatch(fetchDataDto.initialScrapper)
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


    @Post('get-zillow-urls-for-county')
    async getZillowUrlsForCounty(@Body() getZillowUrlsForCountyDto: GetZillowUrlsForCountyDto) {
        return await this.scrapperService.getZillowUrlsForCounty(getZillowUrlsForCountyDto.urls);
    }

    @Post('run-scrapper-v2')
    async runScrapperV2(@Body() runScrapperV2Dto: RunScrapperV2Dto) {
        return await this.scrapperService.runScrapperV2(runScrapperV2Dto.initialScrapper)
    }

}
