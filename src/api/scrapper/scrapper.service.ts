import { Injectable } from "@nestjs/common";
import { generateRandomKey } from "../common/utils/genereate-random-key";
import { DynamoDBService } from "../aws/services/dynamo-db.service";
import { S3Service } from "../aws/services/s3.service";
import { HttpsProxyAgent } from "https-proxy-agent";
import { firstValueFrom } from "rxjs";
import { HttpService } from "@nestjs/axios";
import { ZillowDataDto } from "./dto/zillow-data.dto";
import { PropertiesService } from "../properties/properties.service";

@Injectable()
export class ScrapperService {
  constructor(
    private readonly dynamoDBService: DynamoDBService,
    private readonly s3Service: S3Service,
    private readonly propertiesService: PropertiesService,
    private readonly httpService: HttpService
  ) {}

  // THIS EXECUTE FIRST! MAIN ONE
  async runScrapper(zillowData?: ZillowDataDto[]) {
    // Retrieve the array of ZillowData objects (each containing a countyId and a zillowUrl)
    if (zillowData === undefined) {
      zillowData =
        await this.propertiesService.getZillowUrlsActiveSubscription();
    }

    // Process each Zillow URL
    for (const item of zillowData) {
      //await this.executeScrapper(item.zillowUrl, item.countyId);

      const key: string = await generateRandomKey();

      await this.dynamoDBService.startedScrapperDynamo(
        key,
        item.countyId,
        item.zillowUrl
      );

      // define input data from zillow link
      const inputData = await this.defineInputData(item.zillowUrl);

      // Define headers for the Zillow request
      const headers = await this.defineHeaders();

      try {
        // ------------- HERE IS DATACENTER PROXY
        const proxyUrl = 'http://brd-customer-hl_104fb85c-zone-datacenter_proxy1:6yt7rqg6ryxk@brd.superproxy.io:33335';

        // ------------- HERE IS RESIDENTIAL PROXY
        //const proxyUrl = "http://brd-customer-hl_104fb85c-zone-residential_proxy1:qf2a0h0fhx4d@brd.superproxy.io:33335";

        // Create the proxy agent.
        const proxyAgent = new HttpsProxyAgent(proxyUrl);

        // Add the proxy agent to the axios config.
        // allowing the custom agent to be used.
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

        await this.dynamoDBService.successfulScrapper(key, results.length);
        await this.s3Service.uploadResults(results, key, item.countyId);

        // Process the results as needed
      } catch (error) {
        const errorInfo = {
          zillowUrl: item.zillowUrl, // the Zillow URL we attempted to scrape
          inputData, // input data sent to Zillow
          headers, // headers used in the request
          errorMessage: error.message, // error message from axios
          errorStack: error.stack, // full error stack trace
          errorResponse: error.response
            ? {
                status: error.response.status, // HTTP status code
                statusText: error.response.statusText, // Status text
                data: error.response.data, // response data from the server
                headers: error.response.headers, // response headers
              }
            : null,
          errorConfig: error.config, // axios config used for the request
          timestamp: new Date().toISOString(), // when the error occurred
        };

        // key, // unique scrapper key
        //   countyId: countyId, // county id used in this attempt
        // handle errorInfo here

        await this.dynamoDBService.failedScrapper(key);
        await this.s3Service.uploadErrorToS3(error, item.countyId, key);
        return;
      }

      // Generate a random delay between 5000ms (5s) and 25000ms (25s)
      const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }
  }


  async runFailedScrapper(){
    const zillowData = await this.dynamoDBService.checkFailedScrapper();
     // Process each Zillow URL
     for (const item of zillowData) {
        await this.executeScrapper(item.zillowUrl, item.countyId, item.s3Key);
  
        // Generate a random delay between 5000ms (5s) and 25000ms (25s)
        const randomDelay = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }
    }
  
    // THIS EXECUTE INSIDE runScrapper for loop!
    async executeScrapper(zillowLink: string, countyId: string, key: string) {
      // define input data from zillow link
      const inputData = await this.defineInputData(zillowLink);
  
      // Define headers for the Zillow request
      const headers = await this.defineHeaders();
  
      await this.dynamoDBService.updateAttemptCount(key);
      try {
        // Build the BrightData proxy URL using the provided details.
        const proxyUrl = 'http://brd-customer-hl_104fb85c-zone-datacenter_proxy1:6yt7rqg6ryxk@brd.superproxy.io:33335';
        //const proxyUrl = 'http://brd-customer-hl_104fb85c-zone-residential_proxy1:qf2a0h0fhx4d@brd.superproxy.io:33335';
  
        // Create the proxy agent.
        const proxyAgent = new HttpsProxyAgent(proxyUrl);
  
        // Add the proxy agent to the axios config.
        // Setting "proxy: false" disables axios' default proxy handling,
        // allowing the custom agent to be used.
        const axiosConfig: any = {
          headers,
          httpsAgent: proxyAgent,
          proxy: false,
        };
  
        const response = await firstValueFrom(
          this.httpService.put(
            'https://www.zillow.com/async-create-search-page-state',
            inputData,
            axiosConfig,
          ),
        );
  
        const results = response.data?.cat1?.searchResults?.mapResults;
  
        await this.dynamoDBService.successfulScrapper(key, results.length);
        await this.s3Service.uploadResults(results, countyId, key);
  
        // Process the results as needed
      } catch (error) {
        const errorInfo = {
          zillowLink, // the Zillow URL we attempted to scrape
          inputData, // input data sent to Zillow
          headers, // headers used in the request
          errorMessage: error.message, // error message from axios
          errorStack: error.stack, // full error stack trace
          errorResponse: error.response
            ? {
                status: error.response.status, // HTTP status code
                statusText: error.response.statusText, // Status text
                data: error.response.data, // response data from the server
                headers: error.response.headers, // response headers
              }
            : null,
          errorConfig: error.config, // axios config used for the request
          timestamp: new Date().toISOString(), // when the error occurred
        };
  
        // key, // unique scrapper key
        //   countyId: countyId, // county id used in this attempt
        // handle errorInfo here
  
        await this.dynamoDBService.failedScrapper(key);
        await this.s3Service.uploadErrorToS3(errorInfo, countyId, key);
      }
  
      // Optionally, upload the results using your S3 service (using the countyId for reference)
      // await this.s3service.uploadResults(results, countyId);
      //console.log(`Processed countyId: ${countyId}`);
    }
  // PRIVATE UTILS HELPERS
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
    const { west, east, south, north } = searchQueryState.mapBounds;
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
        mapBounds: { west, east, south, north },
        mapZoom: zoomValue,
        usersSearchTerm: searchValue,
        regionSelection,
        filterState: {
          sortSelection: { value: sortSelection },
          isNewConstruction: { value: isNewConstruction },
          isAuction: { value: isAuction },
          isForSaleForeclosure: { value: isForeclosure },
          isPendingListingsSelected: { value: isPending },
          isComingSoon: { value: isComingSoon },
          doz: { value: daysOnZillow },
          isTownhome: { value: isTownhome },
          isMultiFamily: { value: isMultiFamily },
          isCondo: { value: isCondo },
          isLotLand: { value: isLotOrLand },
          isApartment: { value: isApartment },
          isManufactured: { value: isManufactured },
          isApartmentOrCondo: { value: isApartmentOrCondo },
          isPreForeclosure: { value: isPreForeclosure },
          isForeclosed: { value: isForeclosed },
          price: { min: minPrice, max: maxPrice },
        },
      },
      wants: { cat1: ["mapResults"] },
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
