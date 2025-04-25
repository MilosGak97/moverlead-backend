// scrapper.processor.ts
import {Process, Processor} from '@nestjs/bull';
import {Job} from 'bull';
import {Injectable, Logger} from '@nestjs/common';
import {ScrapperService} from './scrapper.service';
import {StartScrapperDto} from "./dto/start-scrapper.dto";
import {PropertiesService} from "../properties/properties.service";
import {BrightdataService} from "./brightdata.service";
import {BrightdataVersion} from "../../enums/brightdata-version.enum";

@Processor('scrapper')
@Injectable()
export class ScrapperProcessor {
    private readonly logger = new Logger(ScrapperProcessor.name);

    constructor(
        private readonly scrapperService: ScrapperService,
        private readonly propertiesService: PropertiesService,
        private readonly brightdataService: BrightdataService,
    ) {
    }

    @Process('scrapJob')
    //async handleScrapJob(job: Job<StartScrapperDto>) {
    async handleScrapJob(job: Job<StartScrapperDto>) {
        try {


            // we take information if this scrapper request is initialScrapper or not
            const {initialScrapper} = job.data;

            // temporarily, this is only for daily scrapping...
            // for initialScrapping we need to update method runScrapper() to accept ZillowUrls, not only initialScrapper field

            this.logger.log('Starting runScrapper()...');
            // if initialScrapper is false, it means it is daily regular scrapping
            // regular daily scrapping is sent without data, and it is generating it in runScrapper()
            // runScrapper() is accessing all active counties and grabbing urls from there then sending request to zillow
            // we are generating snapshot.json id and saving it to dynamoDB
            // if request with zillow is successful then we upload json to s3 and update successful log to dynamoDB
            // if request with zillow failed, then we log it to dynamoDB and upload error file to S3
            await this.scrapperService.runScrapperV2(initialScrapper);
           this.logger.log('runScrapper() is finished...');

            // runFailedScrapper() is checking our dynamoDB for any failed scrapper attempts and creating array with urls
            // then we are sending request to zillow again, if it is successful we update our dynamoDB status to 'ready'
            // and upload S3 raw data with snapshot.json that we take from dynamoDB (key/s3key)
            // if scrapping request to zillow fails again, we just update attempt count to dynamoDB and skip to next url
            // Retry failed scrapper 5 times with the datacenter proxy

            for (let i = 0; i < 5; i++) {
                this.logger.log(`Retrying failed scrapper with datacenter proxy, attempt ${i + 1}`);
                await this.scrapperService.runFailedScrapper(initialScrapper, 'datacenter');
            }



            // this runFailedScrapper() with residential proxies is doing the same as one above, just with better success rate
            // Retry failed scrapper 5 times with the residential proxy
            // it is important to check dynamoDB if there is any snapshots.json with status 'failed' after those 10 attempts
            // we should create the endpoint to show that in the future, attempt number and status along with dates

            for (let i = 0; i < 5; i++) {
                this.logger.log(`Retrying failed scrapper with residential proxy, attempt ${i + 1}`);
                await this.scrapperService.runFailedScrapper(initialScrapper, 'residential');
            }

            // fetchData() is checking first our dynamoDB for all snapshots that have status 'ready'. initialScrapper value and ml_read == 'false'
            // ml_read means that it was not processed by mover lead and compared to current RDS property values
            // once we get array of ready snapshots, we foreach them and access each ZPID property in that JSON file
            // we compare comingSoon, forSale and pending field from RDS postgres to new raw data from json by using ZPID
            // we have to note every new status by entering the date in comingSoonDate, forSaleDate and pendingDate fields
            // we always make sure to set initialScrape to false
            // after we process each snapshot and all properties inside, we update dynamoDB ml_read to 'true'
            await this.scrapperService.fetchData(initialScrapper);


            // brightdataEnrichmentTrigger() is checking all new properties that are not enriched and sending request to brightdata
            // after request is sent to brightdata, we receive snapshot_id that we foreach in every property and save to RDS database
            await this.brightdataService.brightdataEnrichmentTrigger(BrightdataVersion.BRIGHTDATA_DATASET_ID_V2)

            // this is the rest of the workflow ******
            // now we need to create a webhook that will take a notification from brightdata when scrapping is done
            // but for now, will make a manual endpoint to enter snapshot id and then do this FLOW:
            // using snapshot_id, get raw data from S3 that was taken from brightdata
            // insert needed fields and data into property and release it for user by marking field brightdataEnriched to true
            this.logger.log('ScrapJob finished processing.');
        } catch (error) {
            this.logger.error('Error during ScrapJob processing', error.stack);
            throw error;
        }
        return {};
    }
}
