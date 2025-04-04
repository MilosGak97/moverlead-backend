import {BadRequestException, forwardRef, Inject, Injectable, Logger} from "@nestjs/common";
import {generateRandomKey} from "../common/utils/genereate-random-key";
import {DynamoDBService} from "../aws/services/dynamo-db.service";
import {S3Service} from "../aws/services/s3.service";
import {HttpsProxyAgent} from "https-proxy-agent";
import {firstValueFrom} from "rxjs";
import {HttpService} from "@nestjs/axios";
import {ZillowDataDto} from "./dto/zillow-data.dto";
import {PropertiesService} from "../properties/properties.service";
import {ReadyScrapperResponseDto} from "../aws/dto/ready-scrapper-response.dto";
import axios from "axios";
import {BrightdataEnrichmentFillerDto} from "./dto/brightdata-enrichment-filler.dto";
import {FillBrightdataDto} from "./dto/fill-brightdata-dto";

@Injectable()
export class ScrapperService {
    private readonly logger = new Logger(ScrapperService.name);

    constructor(
        private readonly dynamoDBService: DynamoDBService,
        private readonly s3Service: S3Service,
        private readonly httpService: HttpService,
        @Inject(forwardRef(() => PropertiesService))
        private readonly propertiesService: PropertiesService,
    ) {
    }

    // THIS EXECUTE FIRST! MAIN ONE
    async runScrapper(initialScrapper: boolean, zillowData?: ZillowDataDto[]) {
        this.logger.log('runScrapper called.');
        // Retrieve the array of ZillowData objects (each containing a countyId and a zillowUrl)
        if (zillowData === undefined) {
            this.logger.log('No zillowData provided. Fetching from propertiesService.');
            zillowData = await this.propertiesService.getZillowUrlsActiveSubscription();
            this.logger.log(`Fetched ${zillowData.length} URLs from propertiesService.`);
        }

        // Process each Zillow URL
        for (const item of zillowData) {
            const key: string = await generateRandomKey();
            this.logger.log(`Processing URL with key: ${key}`);

            await this.dynamoDBService.startedScrapperDynamo(key, item.countyId, item.zillowUrl, initialScrapper);

            // Define input data from Zillow link and headers
            const inputData = await this.defineInputData(item.zillowUrl);
            const headers = await this.defineHeaders();

            try {
                // Using the datacenter proxy for the main run
                const proxyUrl = 'http://brd-customer-hl_104fb85c-zone-datacenter_proxy1:6yt7rqg6ryxk@brd.superproxy.io:33335';
                const proxyAgent = new HttpsProxyAgent(proxyUrl);
                const axiosConfig: any = {
                    headers,
                    httpsAgent: proxyAgent,
                    proxy: false,
                };

                this.logger.log(`Making HTTP request to Zillow for ${item.zillowUrl}`);
                const response = await firstValueFrom(
                    this.httpService.put(
                        "https://www.zillow.com/async-create-search-page-state",
                        inputData,
                        axiosConfig
                    )
                );

                const results = response.data?.cat1?.searchResults?.mapResults;
                this.logger.log(`Received ${results.length} results for ${item.zillowUrl}`);

                await this.dynamoDBService.successfulScrapper(key, results.length);
                await this.s3Service.uploadResults(results, key, item.countyId, initialScrapper);


            } catch (error) {
                this.logger.error(`Error processing URL ${item.zillowUrl}`, error.stack);
                const errorInfo = {
                    zillowUrl: item.zillowUrl,
                    inputData,
                    headers,
                    errorMessage: error.message,
                    errorStack: error.stack,
                    errorResponse: error.response
                        ? {
                            status: error.response.status,
                            statusText: error.response.statusText,
                            data: error.response.data,
                            headers: error.response.headers,
                        }
                        : null,
                    errorConfig: error.config,
                    timestamp: new Date().toISOString(),
                };

                await this.dynamoDBService.failedScrapper(key);
                await this.s3Service.uploadErrorToS3(errorInfo, item.countyId, key);
                // Instead of returning, log and continue to process remaining items
            }
            // Instead of returning, log and continue to process remaining items
            const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
            this.logger.log(`Waiting for ${randomDelay} ms before processing next URL.`);
            await new Promise((resolve) => setTimeout(resolve, randomDelay));

        }
    }

    async runFailedScrapper(initialScrapper: boolean, proxyType: 'datacenter' | 'residential' = 'datacenter') {
        this.logger.log(`runFailedScrapper called with proxyType: ${proxyType}`);
        const failedZillowData = await this.dynamoDBService.checkFailedScrapper();
        this.logger.log(`Found ${failedZillowData.length} failed items to reprocess.`);
        for (const item of failedZillowData) {
            this.logger.log(`Reattempting failed item with key: ${item.s3Key} using ${proxyType} proxy.`);
            await this.executeScrapper(item.zillowUrl, item.countyId, item.s3Key, proxyType, initialScrapper);
        }
    }

    async fetchData(initialScrapper: boolean) {

        const readyDataKey: ReadyScrapperResponseDto[] = await this.dynamoDBService.checkReadyScrapper(initialScrapper)

        if (readyDataKey.length == 0) {
            return 'There is no ready data found.';
        }
        console.log(`There is ${readyDataKey.length} snapshots ready`);
        for (const item of readyDataKey) {
            const data = await this.s3Service.readResults(item.s3Key);
            await this.readRawData(data, item.countyId, initialScrapper, item.date);
            await this.dynamoDBService.markAsDone(item.s3Key);
        }
    }

    async brightdataSnapshotTrigger(input: any): Promise<string> {
        if (!input || input.length === 0) {
            throw new BadRequestException('Payload must not be empty');
        }

        const url =
            'https://api.brightdata.com/datasets/v3/trigger' +
            '?dataset_id=gd_m794g571225l6vm7gh' +
            '&notify=https%3A%2F%2Fapi.moverlead.com%2Fstripe%2Fwebhook' +
            '&include_errors=true';

        const headers = {
            Authorization: `Bearer ${process.env.BRIGHTDATA_TOKEN}`,
            'Content-Type': 'application/json',
        };

        const data = {
            deliver: {
                type: 's3',
                filename: {
                    template: '{[snapshot_id]}',
                    extension: 'json',
                },
                bucket: process.env.AWS_S3_BUCKET_NAME_BRIGHTDATA,
                credentials: {
                    'aws-access-key': process.env.AWS_ACCESS_KEY_ID,
                    'aws-secret-key': process.env.AWS_SECRET_ACCESS_KEY,
                },
                directory: '',
            },
            input,
        };

        try {
            const response = await axios.post(url, data, {headers});
            console.log('✅ BrightData Trigger Success from Scrapper Service:', response.data.snapshot_id);
            return response.data.snapshot_id;
        } catch (error) {
            console.error('❌ BrightData Trigger Failed:', error.response?.data || error.message);
            throw error;
        }
    }

    async brightdataEnrichmentFiller(brightdataEnrichmentFillerDto: BrightdataEnrichmentFillerDto) {
        const {snapshotId} = brightdataEnrichmentFillerDto;
        const rawData = await this.s3Service.readBrightdataSnapshot(snapshotId);

        if (rawData.length == 0) {
            throw new BadRequestException('Array is empty, it should be properties in there in raw data');
        }
        for (const raw of rawData) {
            console.log("GETTING INTO: " + raw.zpid.toString());
            const data: FillBrightdataDto = {
                zpid: raw.zpid.toString(),
                brightdataEnriched: true,
                streetAddress: raw.address?.street_address,
                zipcode: raw.address?.zipcode,
                city: raw.address?.city,
                state: raw.address?.state,
                bedrooms: raw.bedrooms,
                bathrooms: raw.bathrooms,
                price: raw.price,
                homeType: raw.home_type,
                parcelId: raw.parcel_id,
                realtorName: raw.attribution_info?.agent_name,
                realtorPhone: raw.attribution_info?.agent_phone_number,
                brokerageName: raw.attribution_info?.broker_name,
                brokeragePhone: raw.attribution_info?.broker_phone_number,
                latitude: raw.latitude,
                longitude: raw.longitude,
                livingAreaValue: raw.living_area_value,
                daysOnZillow: raw.days_on_zillow,
                propertyTypeDimension: raw.property_type_dimension,
                countyZillow: raw.county,
                photoCount: raw.photo_count,
                photos: Array.isArray(raw.responsive_photos)
                    ? raw.original_photos
                        .map((photo) => photo?.mixed_sources?.jpeg?.[1]?.url)
                        .filter((url) => url) // filters out any undefined or null values
                    : [],
            };

            // Save to database
            await this.propertiesService.fillBrightdata(data);
        }
        // something after whole snapshot is done
        // we have to implement here probably dynamoDB to save snapshot of brightdata
        // and mark it as done once this loop is done
        // for now we doing it manually, running it and controlling it
    }


    // PRIVATE UTILS HELPERS
    // This method now accepts a proxyType parameter to select which proxy to use
    private async executeScrapper(
        zillowLink: string,
        countyId: string,
        key: string,
        proxyType: 'datacenter' | 'residential' = 'datacenter',
        initialScrapper: boolean
    ) {
        this.logger.log(`executeScrapper called for ${zillowLink} using ${proxyType} proxy.`);
        const inputData = await this.defineInputData(zillowLink);
        const headers = await this.defineHeaders();

        await this.dynamoDBService.updateAttemptCount(key);
        let proxyUrl: string;
        if (proxyType === 'residential') {
            proxyUrl = "http://brd-customer-hl_104fb85c-zone-residential_proxy1:qf2a0h0fhx4d@brd.superproxy.io:33335";
        } else {
            proxyUrl = "http://brd-customer-hl_104fb85c-zone-datacenter_proxy1:6yt7rqg6ryxk@brd.superproxy.io:33335";
        }

        try {
            const proxyAgent = new HttpsProxyAgent(proxyUrl);
            const axiosConfig: any = {
                headers,
                httpsAgent: proxyAgent,
                proxy: false,
            };

            this.logger.log(`Making HTTP request to Zillow for ${zillowLink} using ${proxyType} proxy.`);
            const response = await firstValueFrom(
                this.httpService.put(
                    "https://www.zillow.com/async-create-search-page-state",
                    inputData,
                    axiosConfig
                )
            );

            const results = response.data?.cat1?.searchResults?.mapResults;
            this.logger.log(`Received ${results.length} results for ${zillowLink}`);

            await this.dynamoDBService.successfulScrapper(key, results.length);
            await this.s3Service.uploadResults(results, key, countyId, initialScrapper);
        } catch (error) {
            this.logger.error(`Error reprocessing URL ${zillowLink}`, error.stack);
            const errorInfo = {
                zillowLink,
                inputData,
                headers,
                errorMessage: error.message,
                errorStack: error.stack,
                errorResponse: error.response
                    ? {
                        status: error.response.status,
                        statusText: error.response.statusText,
                        data: error.response.data,
                        headers: error.response.headers,
                    }
                    : null,
                errorConfig: error.config,
                timestamp: new Date().toISOString(),
            };

            await this.dynamoDBService.failedScrapper(key);
            await this.s3Service.uploadErrorToS3(errorInfo, countyId, key);
        }

        const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
        this.logger.log(`Waiting for ${randomDelay} ms before next retry.`);
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }

    //daily
    private async readRawData(data: any, countyId: string, initialScrapper: boolean, date: Date) {

        for (const rawItem of data) {
            console.log(rawItem.zpid)
            // lets check if there is field zpid at all, if not -skip it
            if (rawItem.zpid === 'undefined' || typeof rawItem.zpid === 'undefined') {
                console.log(`One Item of RawData is advertisement. Next`)
                continue;
            }
            const zpid = rawItem.zpid.toString();

            // now we need to check if property with this zpid already exist, if it does, check status change
            const propertyExist = await this.propertiesService.findProperty(zpid)
            if (propertyExist) {
                console.log(`Checking property value: ${propertyExist.zpid}...`);
                await this.propertiesService.checkPropertyDaily(propertyExist, rawItem.rawHomeStatusCd, initialScrapper, date)
                continue;
            }

            // if initial, send true value in the middle
            await this.propertiesService.createProperty(rawItem, initialScrapper, countyId)
            console.log(`Saved ${rawItem.zpid} as a new property. Next`)
        }
    }

    private async defineInputData(zillowUrl: string): Promise<any> {
        // Clean up and parse the URL
        const cleanedUrl = zillowUrl.trim();
        const parsedUrl = new URL(cleanedUrl);

        // Extract the URL parameter that contains the Zillow search state
        const searchQueryStateEncoded =
            parsedUrl.searchParams.get("searchQueryState");
        if (!searchQueryStateEncoded) {
            throw new Error("No searchQueryState parameter found in the URL.");
        }
        const searchQueryStateJson = decodeURIComponent(searchQueryStateEncoded);
        const searchQueryState = JSON.parse(searchQueryStateJson);

        // Extract map bounds, zoom, search term, region selection, and filter state
        const {west, east, south, north} = searchQueryState.mapBounds;
        const zoomValue = searchQueryState.mapZoom;
        const searchValue = searchQueryState.usersSearchTerm;
        const regionSelection = searchQueryState.regionSelection;
        const filterState = searchQueryState.filterState;

        // Map filter values with defaults
        const sortSelection = filterState?.sort?.value ?? "";
        const isNewConstruction = filterState?.nc?.value ?? true;
        const isAuction = filterState?.auc?.value ?? true;
        const isForeclosure = filterState?.fore?.value ?? true;
        const isPending = filterState?.pnd?.value ?? true;
        const isComingSoon = filterState?.cmsn?.value ?? true;
        const daysOnZillow = filterState?.doz?.value ?? "1";
        const isTownhome = filterState?.tow?.value ?? true;
        const isMultiFamily = filterState?.mf?.value ?? true;
        const isCondo = filterState?.con?.value ?? true;
        const isLotOrLand = filterState?.land?.value ?? true;
        const isApartment = filterState?.apa?.value ?? true;
        const isManufactured = filterState?.manu?.value ?? true;
        const isApartmentOrCondo = filterState?.apco?.value ?? true;
        const isPreForeclosure = filterState?.pf?.value ?? false;
        const isForeclosed = filterState?.pmf?.value ?? false;

        // Extract price range (default: min = 0, max = no limit)
        const priceFilter = filterState?.price || {};
        const minPrice = priceFilter.min ?? 0;
        const maxPrice = priceFilter.max ?? null;

        // Build the payload matching Zillow’s expected input
        return {
            searchQueryState: {
                pagination: {},
                isMapVisible: true,
                isListVisible: true,
                mapBounds: {west, east, south, north},
                mapZoom: zoomValue,
                usersSearchTerm: searchValue,
                regionSelection,
                filterState: {
                    sortSelection: {value: sortSelection},
                    isNewConstruction: {value: isNewConstruction},
                    isAuction: {value: isAuction},
                    isForSaleForeclosure: {value: isForeclosure},
                    isPendingListingsSelected: {value: isPending},
                    isComingSoon: {value: isComingSoon},
                    doz: {value: daysOnZillow},
                    isTownhome: {value: isTownhome},
                    isMultiFamily: {value: isMultiFamily},
                    isCondo: {value: isCondo},
                    isLotLand: {value: isLotOrLand},
                    isApartment: {value: isApartment},
                    isManufactured: {value: isManufactured},
                    isApartmentOrCondo: {value: isApartmentOrCondo},
                    isPreForeclosure: {value: isPreForeclosure},
                    isForeclosed: {value: isForeclosed},
                    price: {min: minPrice, max: maxPrice},
                },
            },
            wants: {cat1: ["mapResults"]},
            requestId: 2,
            isDebugRequest: false,
        };
    }

    private async defineHeaders(): Promise<any> {
        // Define headers for the Zillow request
        return {
            Accept: "*/*",
            "Accept-Language": "en",
            "Content-Type": "application/json",
            Cookie:
                "optimizelyEndUserId=oeu1728942965854r0.5582628003642129; zguid=24|%247598cf9f-bf14-4479-928b-578a478beb48; ...",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
            Origin: "https://www.zillow.com",
        };
    }
}
