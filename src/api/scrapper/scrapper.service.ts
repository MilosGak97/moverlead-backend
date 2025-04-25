import {BadRequestException, forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger} from "@nestjs/common";
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
import {County} from "../../entities/county.entity";
import {In} from "typeorm";

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
    // this will execute scrapper that will pull all active counties from stripe
    // then it will foreach const of array of counties to triggerScrapper()
    async runScrapperV2(initialScrapper: boolean) {
        this.logger.log('runScrapperV2 called.');

        // get all active counties
        const counties: County[] = await this.propertiesService.getAllActiveCounties();

        if (!counties) {
            throw new BadRequestException("No counties data was found from active subscriptions")

        }
        for (const county of counties) {
            if(!county.zillowLink){
                continue
            }
            await this.triggerScrapper(county.zillowLink, county.zillowDefineInput, county.id, initialScrapper)
        }

    }

    async  chicagoScrapper(initialScrapper: boolean){
        const counties: County[] = await this.propertiesService.getChicagoCounties();
        if(!counties){
            throw new HttpException('Counties are not found', HttpStatus.BAD_REQUEST)
        }

        for(const county of counties){
            await this.triggerScrapper(county.zillowLink, county.zillowDefineInput, county.id, initialScrapper)
        }
    }

    // feed it with:
    // county.zillowLink (single string)
    // county.zillowDefineInput (array of objects)
    // county.id (uuid)
    // initialScrapper (boolean)
    async triggerScrapper(zillowLink: string, zillowDefineInput: any, countyId: string, initialScrapper: boolean) {
        if (Array.isArray(zillowDefineInput) && zillowDefineInput.length > 0) {
            // Process each Zillow URL
            for (const item of zillowDefineInput) {
                const key: string = await generateRandomKey();
                this.logger.log(`Processing URL with key: ${key}`);

                await this.dynamoDBService.startedScrapperDynamo(key, countyId, zillowLink, item.minPrice.toString(), item.maxPrice.toString(), initialScrapper);

                // Define input data from Zillow link and headers
                const inputData = await this.defineInputData(zillowLink, Number(item.minPrice), Number(item.maxPrice));
                const headers = await this.defineHeaders();

                try {
                    // Using the datacenter proxy for the main run
                    const proxyUrl = "http://brd-customer-hl_104fb85c-zone-residential_proxy1:qf2a0h0fhx4d@brd.superproxy.io:33335";
                    const proxyAgent = new HttpsProxyAgent(proxyUrl);
                    const axiosConfig: any = {
                        headers,
                        httpsAgent: proxyAgent,
                        proxy: false,
                    };

                    this.logger.log(`Making HTTP request to Zillow for ${zillowLink}`);
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
                    this.logger.error(`Error processing URL ${zillowLink}`, error.stack);
                    const errorInfo = {
                        zillowUrl: zillowLink,
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
                    // Instead of returning, log and continue to process remaining items
                }
                // Instead of returning, log and continue to process remaining items
                const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
                this.logger.log(`Waiting for ${randomDelay} ms before processing next URL.`);
                await new Promise((resolve) => setTimeout(resolve, randomDelay));

            }
        }
    }

    async runFailedScrapper(initialScrapper: boolean, proxyType: 'datacenter' | 'residential' = 'datacenter') {
        this.logger.log(`runFailedScrapper called with proxyType: ${proxyType}`);
        const failedZillowData = await this.dynamoDBService.checkFailedScrapper();
        this.logger.log(`Found ${failedZillowData.length} failed items to reprocess.`);
        for (const item of failedZillowData) {
            this.logger.log(`Reattempting failed item with key: ${item.s3Key} using ${proxyType} proxy.`);
            await this.executeScrapper(item.zillowUrl, Number(item.minPrice), Number(item.maxPrice), item.countyId, item.s3Key, proxyType, initialScrapper);
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

    async fetchDataBatch(initialScrapper: boolean) {
        const readyDataKey: ReadyScrapperResponseDto[] = await this.dynamoDBService.checkReadyScrapper(initialScrapper);

        if (readyDataKey.length === 0) {
            return 'There is no ready data found.';
        }
        console.log(`There are ${readyDataKey.length} snapshots ready.`);

       const batchSize = 100;
        for (let i = 0; i < readyDataKey.length; i += batchSize) {
           const batch = readyDataKey.slice(i, i + batchSize);
            await Promise.all(
                batch.map(async (item) => {
                    const data = await this.s3Service.readResults(item.s3Key);
                    await this.readRawData(data, item.countyId, initialScrapper, item.date);
                    await this.dynamoDBService.markAsDone(item.s3Key);
               })
            );
       }
    }


    // PRIVATE UTILS HELPERS
    // This method now accepts a proxyType parameter to select which proxy to use
    private async executeScrapper(
        zillowLink: string,
        minPrice: number,
        maxPrice: number,
        countyId: string,
        key: string,
        proxyType: 'datacenter' | 'residential' = 'datacenter',
        initialScrapper: boolean
    ) {
        this.logger.log(`executeScrapper called for ${zillowLink} using ${proxyType} proxy.`);
        const inputData = await this.defineInputData(zillowLink, minPrice, maxPrice);
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
                minPrice,
                maxPrice,
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
                await this.propertiesService.checkPropertyDaily(propertyExist, rawItem.rawHomeStatusCd, initialScrapper, date, rawItem)
                continue;
            }

            // if initial, send true value in the middle
            await this.propertiesService.createProperty(rawItem, initialScrapper, countyId)
            console.log(`Saved ${rawItem.zpid} as a new property. Next`)
        }
    }

    async getZillowUrlsForCounty(urls: string[]) {
        let finalFinalObject = [];
        for (const url of urls) {
            let minPrice = 657000;
            let maxPrice = 900000;
            let lastResult = 0;
            let repeatedResult = 0;

            let finalObject = [];
            let done = false;
            for (let i = 0; !done; i++) {
                // Instead of returning, log and continue to process remaining items
              /*  const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
                this.logger.log(`Waiting for ${randomDelay} ms before processing next iteration.`);
                await new Promise((resolve) => setTimeout(resolve, randomDelay));
*/
                const resultNumber = await this.getZillowResults(url, minPrice, maxPrice);
                console.log(`Number of results is: ${resultNumber} on iteration ${i} with minPrice: ${minPrice} and maxPrice: ${maxPrice}`);

                if (resultNumber > 470) {
                    console.log(`${resultNumber} is more than max allowed 420. Deducting 10k from maxPrice: ${maxPrice}`)
                    maxPrice = maxPrice - 7000; // -10k usual
                    if (maxPrice > 1000000) {
                        console.log("maxPrice is more than 1mil. we will deduct extra 75k")
                        maxPrice = maxPrice - 25000
                    }
                    if (maxPrice > 2000000) {
                        console.log("maxPrice is more than 2mil. we will deduct extra 125k")
                        maxPrice = maxPrice - 45000
                    }
                    if (maxPrice > 4000000) {
                        console.log("maxPrice is more than 4mil. we will deduct extra 250k")
                        maxPrice = maxPrice - 58000
                    }
                    if (lastResult === resultNumber) {
                        repeatedResult++;
                    } else {
                        lastResult = resultNumber;
                        repeatedResult = 0;
                    }
                    continue;
                }

                if (resultNumber < 300) {
                    if (maxPrice > 1000000) {
                        console.log("maxPrice is more than 1mil........ adding extra 200k")
                        maxPrice = maxPrice + 50000;
                    }
                    if (maxPrice > 2000000) {
                        console.log("maxPrice is more than 2mil........ adding extra half 500k")
                        maxPrice = maxPrice + 100000;
                    }
                    if (maxPrice > 4000000) {
                        console.log("maxPrice is more than 4mil........ SETTING MAX PRICE TO 50mil")
                        maxPrice = 50000000;
                    }

                    if (resultNumber < 100) {
                        console.log(`${resultNumber} is less than min allowed 300... even under 100results...  Adding 100k to maxPrice: ${maxPrice}`)
                        maxPrice = maxPrice + 100000; // 100k
                    } else if (resultNumber < 200) {
                        console.log(`${resultNumber} is less than min allowed 300... even under 200results...  Adding 75k to maxPrice: ${maxPrice}`)
                        maxPrice = maxPrice + 75000; //75k usual
                    } else if (resultNumber < 300) {
                        console.log(`${resultNumber} is less than min allowed 300...  Adding 50k to maxPrice: ${maxPrice}`)
                        maxPrice = maxPrice + 50000;
                    }


                }
                //check if results number repeat after new request check
                if (lastResult === resultNumber) {
                    console.log(`${resultNumber} does repeat from last request. Noted. Repeated so far: ${repeatedResult} + this time.`)
                    repeatedResult++;
                } else {
                    lastResult = resultNumber;
                    repeatedResult = 0;
                }
                /*
                if (repeatedResult > 5 && repeatedResult < 8) {
                    console.log(`It has repeated already ${repeatedResult} so I have to add extra 50k`)
                    maxPrice = maxPrice + 50000;
                }
                */
                if (repeatedResult > 8) {
                    finalObject.push({
                        minPrice: minPrice,
                        maxPrice: maxPrice,
                        resultNumber: resultNumber
                    })
                    console.log(`Results number is repeating to many time. We are done here!`)
                    done = true;
                }

                if (maxPrice > 49000000) {
                    finalObject.push({
                        minPrice: minPrice,
                        maxPrice: maxPrice,
                        resultNumber: resultNumber
                    })
                    console.log(`Results number is repeating to many time. We are done here!`)
                    done = true;
                }


                if (resultNumber < 470 && resultNumber > 300) {
                    finalObject.push({
                        minPrice: minPrice,
                        maxPrice: maxPrice,
                        resultNumber: resultNumber
                    })
                    minPrice = maxPrice;
                    maxPrice = maxPrice + 100000; // usual 50k
                }
                console.log("__________________________________ result so far ______________________________________________________________")
                console.log(JSON.stringify(finalObject))
                console.log("_________________________________ Going to next iteration ______________________________________________________")

            }

            console.log("Iteration is done and here is the result:")
            console.log(finalObject)
            finalFinalObject.push(finalObject);
        }
        console.log("EVERYTHING IS DONE:")
        console.log(finalFinalObject)
        return finalFinalObject;
    }

    private async getZillowResults(zillowUrl: string, minPrice: number, maxPrice: number) {

        // Define input data from Zillow link and headers
        const inputData = await this.defineInputData(zillowUrl, minPrice, maxPrice);
        const headers = await this.defineHeaders();

        // Using the datacenter proxy for the main run
        const proxyUrl = "http://brd-customer-hl_104fb85c-zone-residential_proxy1:qf2a0h0fhx4d@brd.superproxy.io:33335";
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
        const axiosConfig: any = {
            headers,
            httpsAgent: proxyAgent,
            proxy: false,
        };
        const response = await firstValueFrom(
            this.httpService.put(
                "https://www.zillow.com/async-create-search-page-state",
                inputData,
                axiosConfig
            )
        );

        const results = response.data?.cat1?.searchResults?.mapResults;

        return results.length;
    }

    private async defineInputData(zillowUrl: string, minPrice: number, maxPrice: number): Promise<any> {
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
        //const minPrice = priceFilter.min ?? 0;
        //const maxPrice = priceFilter.max ?? null;

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
                    price: {min: minPrice.toString(), max: maxPrice.toString()},
                },
            },
            wants: {cat1: ["mapResults"]},
            requestId: 2,
            isDebugRequest: false,
        };
    }

    /*
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
    */
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
