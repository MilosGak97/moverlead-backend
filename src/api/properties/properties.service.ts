import {
    BadRequestException,
    forwardRef,
    HttpException,
    HttpStatus,
    Inject,
    Injectable,
    StreamableFile,
} from "@nestjs/common";
import {PropertyRepository} from "../../repositories/property.repository";
import {UserRepository} from "../../repositories/user.repository";
import {FilteringActionDto} from "./dto/filtering-action.dto";
import {StateResponseDto} from "./dto/state-response.dto";
import {GetDashboardResponseDto} from "./dto/get-dashboard.response.dto";
import {HttpService} from "@nestjs/axios";
import {GetProductsDto} from "./dto/get-products-dto";
import {CountyRepository} from "../../repositories/county.repository";
import {PropertyCountiesFailedRepository} from "../../repositories/property-counties-failed.repository";
import {StripeService} from "../stripe/stripe.service";
import {User} from "../../entities/user.entity";
import {GetSubscriptionsDto} from "./dto/get-subscriptions.dto";
import {GetSubscriptionsResponseDto} from "./dto/get-subscriptions-response.dto";
import Stripe from "stripe";
import {SubscriptionItemsDto} from "./dto/subscription-items.dto";
import {FilteringResponseDto} from "./dto/filtering-response.dto";
import {statesArray} from "./dto/states.array"; // Correct ESModule-style import
import {CreatePropertyDto} from "./dto/create-property.dto";
import {County} from "src/entities/county.entity";
import {In, IsNull} from "typeorm";
import {Property} from "../../entities/property.entity";
import {ScrapperService} from "../scrapper/scrapper.service";
import {FillBrightdataDto} from "../scrapper/dto/fill-brightdata-dto";
import {UserSubscriptionsDto} from "./dto/user-subscriptions.dto";
import {FilteringDto} from "./dto/filtering-dto";
import {ListingsExportDto} from "./dto/listings-export.dto";
import {GetListingsDto} from "./dto/get-listings.dto";
import {Parser} from "json2csv";
import axios from "axios";
import {ZillowDataV2Dto} from "../scrapper/dto/zillow-data-v2.dto";
import {FillPropertyInfoDto} from "../scrapper/dto/fill-property-info.dto";
import {BrightdataVersion} from "../../enums/brightdata-version.enum";

@Injectable()
export class PropertiesService {
    private stripe: Stripe;
    // Temporary token storage (for short-term use)
    private accessTokenPrecisely: string = null;
    private tokenExpirationTime: number = null;

    constructor(
        private readonly propertyRepository: PropertyRepository,
        private readonly userRepository: UserRepository,
        private readonly countyRepository: CountyRepository,
        private readonly httpService: HttpService,
        private readonly propertyCountiesFailedRepository: PropertyCountiesFailedRepository,
        private readonly stripeService: StripeService,
        @Inject(forwardRef(() => ScrapperService))
        private readonly scrapperService: ScrapperService,
    ) {
        this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }

    async getDashboard(userId: string): Promise<GetDashboardResponseDto> {


        // Step 1: Get user from DB to access stripeId
        const user = await this.userRepository.findOneBy({id: userId});

        console.log(`[getDashboard] userId: ${userId}, stripeId: ${user?.stripeId}`);

        // lets get now priceids (county) and when user was subscribed to that county
        // date to and date from

        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);


        if (subscriptionsArray.length === 0) {
            return {
                lastMonthCount: 0,
                thisMonthCount: 0,
                todayCount: 0,
            }
        }


        const userSubscriptions: UserSubscriptionsDto[] = [];

        for (const sub of subscriptionsArray) {
            const county = await this.countyRepository.findOne({
                where: {priceId: sub.priceId},
            });

            if (!county) continue;

            const dto: UserSubscriptionsDto = {
                countyId: county.id,
                fromDate: new Date(sub.startDate * 1000).toISOString(),
                toDate: new Date(sub.endDate * 1000).toISOString(),
            };

            console.log('Mapped subscription:', dto); // 👈 logging here

            userSubscriptions.push(dto);
        }
        return await this.propertyRepository.getDashboard(userSubscriptions);
    }

    async getListings(getListingsDto: GetListingsDto, userId: string) {

        // to get properties for this userId, we need first to get all subscriptions for that user
        // once we get all subscriptions, we also have starting and ending date + county(PRICEIDS) + userId
        // then, we look for at RDS db for property that have one of 3 fields (comingSoonDate, forSaleDate, pendingDate) in those dates
        // and it matches countyId we have upthere and then show it for that user


        // lets get stripe user id first because it is different than user id
        // stripe user id is created by stripe while checkout and saved in RDS DB
        const user = await this.userRepository.findOneBy({id: userId});

        if(userId === '9f19f3b8-9892-4f5b-af57-b350d933424c'){
            const counties: County[] = await this.getChicagoCounties();
            console.log(counties)
            return await this.propertyRepository.getListingsChicago(
                getListingsDto,
                counties
            );
        }

        // lets get now priceids (county) and when user was subscribed to that county
        // date to and date from
        //if()
        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);

        if (subscriptionsArray.length === 0) {
            return {
                result: [],
                totalRecords: 0,
                currentPage: 0,
                totalPages: 0,
                limit: 0,
                offset: 0,
            }
            //throw new BadRequestException('User never had any subscriptions')
        }

        const userSubscriptions: UserSubscriptionsDto[] = [];


        for (const sub of subscriptionsArray) {
            const county = await this.countyRepository.findOne({
                where: {priceId: sub.priceId},
            });

            if (!county) continue;

            const dto: UserSubscriptionsDto = {
                countyId: county.id,
                fromDate: new Date(sub.startDate * 1000).toISOString(),
                toDate: new Date(sub.endDate * 1000).toISOString(),
            };
            userSubscriptions.push(dto);
        }

        return await this.propertyRepository.getListings(
            getListingsDto,
            userSubscriptions
        );


    }

    async listingsExportDetailed(listingsExportDto: ListingsExportDto) {
        const result = await this.propertyRepository.listingsExportDetailed(listingsExportDto)


        // Define the fields for CSV
        const fields = [
            'propertyId',
            'listingStatus',
            'listingType',
            'filteredStatus',
            'streetAddress',
            'zipcode',
            'city',
            'state',
            'bedrooms',
            'bathrooms',
            'price',
            'homeType',
            'livingAreaValue',
            'realtorName',
            'realtorPhone',
            'brokerageName',
            'brokeragePhone',
            'county',
            'longitude',
            'latitude',
        ];

        // Convert JSON to CSV using json2csv
        const json2csvParser = new Parser({fields});
        const csv = json2csvParser.parse(result);

        // Create a StreamableFile from the CSV string
        return new StreamableFile(Buffer.from(csv, 'utf-8'));
    }

    async listingsExportUsps(listingsExportDto: ListingsExportDto): Promise<StreamableFile> {
        // Retrieve properties for USPS export from the repository.
        const result = await this.propertyRepository.listingsExportUsps(listingsExportDto);


        // Define CSV fields for USPS export.
        const fields = [
            'owner_fullname',
            'current_resident',
            'street_address',
            'city',
            'state',
            'zipcode'
        ];

        // Convert the enriched (and filtered) result to CSV.
        const json2csvParser = new Parser({fields});
        const csv = json2csvParser.parse(result);

        // Return a StreamableFile containing the CSV.
        return new StreamableFile(Buffer.from(csv, 'utf-8'));
    }

    async filtering(filteringDto: FilteringDto, userId: string): Promise<FilteringResponseDto> {
        // Step 1: Get user from DB to access stripeId
        const user = await this.userRepository.findOneBy({id: userId});

        if(user.id === '9f19f3b8-9892-4f5b-af57-b350d933424c'){
            const counties: County[] = await this.getChicagoCounties();
            return await this.propertyRepository.filteringChicago(filteringDto, counties)
        }

        // let's get now priceids (county) and when user was subscribed to that county
        // date to and date from
        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);

        if (subscriptionsArray.length == 0) {
            return {
                result: [],
                totalRecords: 0,
                currentPage: 0,
                totalPages: 0,
                limit: 0,
                offset: 0
            }
            //throw new BadRequestException('User never had any subscriptions')
        }


        const userSubscriptions: UserSubscriptionsDto[] = [];

        for (const sub of subscriptionsArray) {
            const county = await this.countyRepository.findOne({
                where: {priceId: sub.priceId},
            });

            if (!county) continue;

            const dto: UserSubscriptionsDto = {
                countyId: county.id,
                fromDate: new Date(sub.startDate * 1000).toISOString(),
                toDate: new Date(sub.endDate * 1000).toISOString(),
            };


            userSubscriptions.push(dto);
        }

        return await this.propertyRepository.filtering(filteringDto, userSubscriptions);
    }

    async filteringAction(id: string, filteringActionDto: FilteringActionDto) {
        return await this.propertyRepository.filteringAction(
            id,
            filteringActionDto
        );
    }


    async listStates(): Promise<StateResponseDto[]> {
        return Object.values(statesArray);
    }

    /* PRODUCTS SERVICES */
    async getProducts(getProductsDto: GetProductsDto) {
        return this.countyRepository.getProducts(getProductsDto);
    }

    async getSubscriptions(
        id: string,
        getSubscriptionsDto: GetSubscriptionsDto
    ): Promise<GetSubscriptionsResponseDto[]> {
        const user: User = await this.userRepository.findOne({where: {id}});
        if (!user) {
            throw new BadRequestException("User not found");
        }

        const getSubscriptionsResponseDto: GetSubscriptionsResponseDto[] = [];

        const stripeUserId: string = user.stripeId;
        if (!stripeUserId) {
            return getSubscriptionsResponseDto;
        }

        const stripeSubscriptionData = await this.stripe.subscriptions.list({
            customer: stripeUserId,
            status: getSubscriptionsDto.stripeSubscriptionStatus,
        });
        console.log("CONSOLE LOG SUBSCRIPTION", stripeSubscriptionData.data[0].items.data[0].price)

        if (stripeSubscriptionData && stripeSubscriptionData.data.length > 0) {
            for (const subscription of stripeSubscriptionData.data) {
                const subscriptionItems: SubscriptionItemsDto[] = [];
                let totalPrice: number = 0;
                for (const item of subscription.items.data) {
                    const product = await this.stripe.products.retrieve(
                        item.plan.product.toString() as string
                    );

                    totalPrice = totalPrice + item.price.unit_amount / 100;

                    subscriptionItems.push({
                        name: product.name,
                        price: item.price.unit_amount / 100,
                    });
                }

                getSubscriptionsResponseDto.push({
                    id: subscription.id,
                    status: subscription.status.toString() as string,
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                    currentPeriodStart: new Date(
                        subscription.current_period_start * 1000
                    ),
                    subscriptionItems: subscriptionItems,
                    totalPrice: totalPrice,
                });
            }

            return getSubscriptionsResponseDto;
        } else {
            return getSubscriptionsResponseDto;
        }
    }


    async getAllActiveCounties(): Promise<County[]> {
        // check active subscriptions
        const subscriptions = await this.stripeService.getAllActiveSubscriptions();
        if (!subscriptions) {
            return;
        }

        const priceIds = [
            ...new Set(
                subscriptions.data.flatMap((subscription) =>
                    subscription.items.data.map((item) => item.price.id)
                )
            ),
        ];

        const counties: County[] = await this.countyRepository.find({
            where: {priceId: In(priceIds)},
        });
        if (counties.length === 0) {
            throw new HttpException("No county found", HttpStatus.BAD_REQUEST);
        }
        // Create an array of objects with both countyId and zillowLink
        return counties
    }


    async getAllActiveCountiesByUser(stripeId: string): Promise<County[]> {
        // check active subscriptions
        const subscriptions = await this.stripeService.getAllActiveSubscriptions();
        if (!subscriptions) {
            return;
        }

        const priceIds = [
            ...new Set(
                subscriptions.data.flatMap((subscription) =>
                    subscription.items.data.map((item) => item.price.id)
                )
            ),
        ];

        const counties: County[] = await this.countyRepository.find({
            where: {priceId: In(priceIds)},
        });
        if (counties.length === 0) {
            throw new HttpException("No county found", HttpStatus.BAD_REQUEST);
        }
        // Create an array of objects with both countyId and zillowLink
        return counties
    }

    async getChicagoCounties(){
        const counties = [
            '213a67cb-ea78-4b77-b178-b1b0da09d035', // Cook County
            'b271f13b-04ff-4d32-bfc0-74e650c51150', // Lake County
            'c840a95a-9523-4b34-b9ad-9e358712ab02', // McHenry County
            '9e159cf0-ee1a-4e08-8de0-1b1273f566ca', // DuPage County
            '7e9085b6-7882-4982-8b51-834869deb0c2', // Kane County
            '7607395d-c5aa-4482-931a-6d26aabf62ec', // Will County
        ];

       return await this.countyRepository.find({
            where: {id: In(counties)},
        });
    }

    async getActiveStatesByUser(userId:string){
        if(userId === '9f19f3b8-9892-4f5b-af57-b350d933424c'){
            return;
        }
        const user = await this.userRepository.findOneBy({ id: userId });
        if(!user){
            throw new HttpException('User is not found', HttpStatus.BAD_REQUEST)
        }


        if(!user.stripeId){
            return;
        }
        // check active subscriptions
        const subscriptions: Stripe.ApiList<Stripe.Subscription>  = await this.stripeService.getAllActiveSubscriptionsByUser(user.stripeId);
        if (!subscriptions) {
            return;
        }


        const priceIds = [
            ...new Set(
                subscriptions.data.flatMap((subscription) =>
                    subscription.items.data.map((item) => item.price.id)
                )
            ),
        ];

        const counties: County[] = await this.countyRepository.find({
            where: {priceId: In(priceIds)},
        });
        if (counties.length === 0) {
            throw new HttpException("No county found", HttpStatus.BAD_REQUEST);
        }

        const uniqueStatesAbbreviation = [...new Set(counties.map((item) => item.state))];

        const stateResponse: StateResponseDto[] = uniqueStatesAbbreviation.map((abbr) => {
            const stateInfo = statesArray.find((state) => state.abbreviation === abbr);

            return {
                abbreviation: abbr,
                name: stateInfo?.name ?? 'Unknown',
            };
        });

        return stateResponse;
    }


    async getTestCounties(){
        const countiesIds = []
    }

    async findProperty(zpid: string) {
        return await this.propertyRepository.findOneBy({zpid})
    }

    async checkPropertyDaily(property: Property, currentStatus: string, initialScrapper: boolean, date: Date, raw: any) {

        console.log("ZPID:", property.zpid)
        console.log("DATE:", date)
        console.log("CURRENT STATUS:", currentStatus)
        console.log("PENDING DATE:",property.pendingDate)
        console.log("COMING SOON DATE:",property.comingSoonDate)
        console.log("FOR SALE DATE:",property.forSaleDate)

        // Flag to determine if any status has changed
        let statusChanged = false;

        // Check and update the status accordingly
        if (currentStatus === "Pending" && !property.pendingDate) {
            property.pendingDate = date;
            statusChanged = true;
        }

        if (currentStatus === "ComingSoon" && !property.comingSoonDate) {
            property.comingSoonDate = date;
            statusChanged = true;
        }

        if (currentStatus === "ForSale" && !property.forSaleDate) {
            property.forSaleDate = date;
            statusChanged = true;
        }

        // If no status change was detected, skip updating this property
        if (!statusChanged) {
            console.log(`NO STATUS CHANGES: ${property.zpid}, Next.`)
            return;
        }

        const data: FillPropertyInfoDto = {
            streetAddress: raw.hdpData.homeInfo.streetAddress,
            zipcode: raw.hdpData.homeInfo.zipcode,
            city: raw.hdpData.homeInfo.city,
            state: raw.hdpData.homeInfo.state,
            bedrooms: raw.hdpData.homeInfo.bedrooms,
            bathrooms: raw.hdpData.homeInfo.bathrooms,
            price: raw.hdpData.homeInfo.price,
            homeType: raw.hdpData.homeInfo.homeType,
            brokerageName: raw.brokerName,
            latitude: raw.hdpData.homeInfo.latitude,
            longitude: raw.hdpData.homeInfo.longitude,
            livingAreaValue: raw.hdpData.homeInfo.livingArea,
            timeOnZillow: raw.timeOnZillow,
        };

        // Assign all DTO fields (overwrites any existing fields)
        Object.assign(property, data);

        // Ensure initialScrape is marked as false
        property.initialScrape = initialScrapper
        await this.propertyRepository.save(property);

        console.log(`NEW STATUS VALUE: ${property.zpid}, Next.`)
        return;
    }


    async createProperty(
        rawData: any,
        initialScrape: boolean,
        countyId: string
    ) {
        // Create a new property
        const newProperty = new CreatePropertyDto();
        newProperty.zpid = rawData.zpid.toString();
        const county = await this.countyRepository.findOne({
            where: {id: countyId},
        });
        if (!county) {
            console.log(`❌ County with ID ${countyId} not found.`);
            return;
        }
        newProperty.county = county;
        newProperty.initialScrape = initialScrape;

        newProperty.streetAddress = rawData.hdpData.homeInfo.streetAddress
        newProperty.zipcode = rawData.hdpData.homeInfo.zipcode
        newProperty.city = rawData.hdpData.homeInfo.city
        newProperty.state = rawData.hdpData.homeInfo.state
        newProperty.bedrooms = rawData.hdpData.homeInfo.bedrooms
        newProperty.bathrooms = rawData.hdpData.homeInfo.bathrooms
        newProperty.price = rawData.hdpData.homeInfo.price
        newProperty.homeType = rawData.hdpData.homeInfo.homeType
        newProperty.brokerageName = rawData.brokerName
        newProperty.latitude = rawData.hdpData.homeInfo.latitude
        newProperty.longitude = rawData.hdpData.homeInfo.longitude
        newProperty.livingAreaValue = rawData.hdpData.homeInfo.livingArea
        newProperty.timeOnZillow = rawData.timeOnZillow

        // Set the appropriate status date
        if (rawData.rawHomeStatusCd === "Pending") {
            newProperty.pendingDate = new Date();
        } else if (rawData.rawHomeStatusCd === "ComingSoon") {
            newProperty.comingSoonDate = new Date();
        } else if (rawData.rawHomeStatusCd === "ForSale") {
            newProperty.forSaleDate = new Date();
        }

        // Save the new property
        await this.propertyRepository.createProperty(newProperty);
    }

    async getEnrichmentUrls(): Promise<{ url: string; }[]> {
        const properties = await this.propertyRepository.find({
            where: {
                initialScrape: false,
                enriched: IsNull() || false,
            },
        });

        if (properties.length == 0) {
            return null;
        }
        console.log("NUMBER OF PROPERTIES THAT NEED TO BE SCRAPPED: " + properties.length);
        console.log()

        const urls = properties.map((property) => ({
            url: `https://www.zillow.com/homedetails/${property.zpid}_zpid/`,
        }));
        console.log("URLS: ", urls);
        return urls;
    }

    /*
        async brightdataEnrichmentTriggerV2() {
            const properties = await this.propertyRepository.find({
                where: {
                    initialScrape: false,
                    brightdataEnriched: IsNull(),
                },
            });

            if (properties.length == 0) {
                return null;
            }

            const urls = properties.map((property) => ({
                url: `https://www.zillow.com/homedetails/${property.zpid}_zpid/`,
            }));

            const brightdataSnapshot: string = await this.scrapperService.brightdataSnapshotTriggerV2(urls)

            // Set the snapshot on each property and save
            for (const property of properties) {
                property.brightdataSnapshot = brightdataSnapshot;
            }

            await this.propertyRepository.save(properties);
        }
    */
    async fillBrightdata(fillBrightdataDto: FillBrightdataDto, brightdataVersion: BrightdataVersion) {
        const {zpid} = fillBrightdataDto;
        console.log(`Filling with brightdata info: ${zpid}`)

        let property = await this.propertyRepository.findOne({where: {zpid}});

        if (!property) {
            return;
        }

        if (brightdataVersion === BrightdataVersion.BRIGHTDATA_DATASET_ID_V1) {
            property.enrichedBrightdataV1 = true
        }
        if (brightdataVersion === BrightdataVersion.BRIGHTDATA_DATASET_ID_V2) {
            property.enrichedBrightdataV2 = true
        }

        // Assign all DTO fields (overwrites any existing fields)
        Object.assign(property, fillBrightdataDto);
        property.enriched = true;
        console.log(`Property ${fillBrightdataDto.zpid} is enriched with Brightdata...`)
        return await this.propertyRepository.save(property);
    }

    async fillHasdata(fillBrightdataDto: FillBrightdataDto,) {
        const {zpid} = fillBrightdataDto;
        console.log(`Filling with brightdata info: ${zpid}`)

        let property = await this.propertyRepository.findOne({where: {zpid}});

        if (!property) {
            return;
        }
        property.enrichedHasdata = true;
        property.enriched = true;
        // Assign all DTO fields (overwrites any existing fields)
        Object.assign(property, fillBrightdataDto);
        console.log(`Property ${fillBrightdataDto.zpid} is enriched with Hasdata...`)
        return await this.propertyRepository.save(property);
    }


    async getCountyZillowData(id: string) {
        const county = await this.countyRepository.findOne({where: {id}});
        if (!county) {
            throw new BadRequestException("Could not find county with provided id")
        }
        return {
            zillowLink: county.zillowLink,
            zillowDefineInput: county.zillowDefineInput
        }
    }

    /* ---------------- DELETE FROM HERE AFTER IMPROVING PRECISELY -----------------------*/


    private async getToken(): Promise<string> {
        const key = process.env.PRECISELY_API_KEY;
        const secret = process.env.PRECISELY_API_SECRET;

        // If accessToken is not set OR token is expired OR invalid format (e.g. server rebooted)
        if (
            !this.accessTokenPrecisely ||
            !this.tokenExpirationTime ||
            Date.now() > this.tokenExpirationTime
        ) {
            await this.fetchToken(key, secret);
        }

        return this.accessTokenPrecisely;
    }
    private async fetchToken(key: string, secret: string): Promise<void> {
        const encodedCredentials = Buffer.from(`${key}:${secret}`).toString('base64');

        try {
            const response = await axios.post(
                'https://api.precisely.com/oauth/token',
                new URLSearchParams({ grant_type: 'client_credentials' }),
                {
                    headers: {
                        Authorization: `Basic ${encodedCredentials}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                },
            );

            const { access_token, expiresIn } = response.data;

            if (!access_token || !expiresIn) {
                throw new Error('❌ Invalid Precisely token response');
            }


            this.accessTokenPrecisely = access_token;
            this.tokenExpirationTime = Date.now() + expiresIn * 1000 - 5 * 60 * 1000;

            console.log('[Precisely] ✅ Token refreshed. Expires in (s):', expiresIn);
        } catch (error) {
            const errMsg = error?.response?.data || error.message;
            console.error('❌ [Precisely] Failed to fetch token:', errMsg);
            throw new Error('Precisely token fetch failed');
        }
    }


    async checkPrecisely(
        listingsExportDto: ListingsExportDto) {
        const {ids} = listingsExportDto;
        const uuids = ids.map(idString => idString.split('_')[0]);

        const properties: Property[] = await this.propertyRepository.find({where: {id: In(uuids)}})

        if (properties.length == 0) {
            throw new BadRequestException('There are no properties found in database')
        }
        // Process each property to enrich with owner information.
        for (const property of properties) {
            // If already precisely checked, do not call the API.
            if (property.preciselyChecked) {
                continue; // Skip further enrichment.
            }

            // Not checked yet – run the Precisely API check.
            const fullAddress = `${property.streetAddress}, ${property.city}, ${property.state}, ${property.zipcode}`;
            const encodedAddress = encodeURIComponent(fullAddress);
            try {
                const token = await this.getToken(); // Your helper method to get a valid token.
                const response = await axios.get(
                    `https://api.precisely.com/property/v2/attributes/byaddress?address=${encodedAddress}&attributes=owners`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json; charset=utf-8',
                        },
                    }
                );



                const owners = response.data.propertyAttributes?.owners;
                if (owners && owners.length > 0) {
                    let foundValidOwner = false; // Flag to indicate if a valid owner was found.
                    // Look through the first three owners.
                    for (let i = 0; i < Math.min(owners.length, 3); i++) {
                        const owner = owners[i];
                        if (owner.firstName && owner.lastName) {
                            // Check if either name contains "source" (case-insensitive)
                            if (
                                owner.firstName.toLowerCase().includes("source") ||
                                owner.lastName.toLowerCase().includes("source")
                            ) {
                                property.preciselyChecked = true;
                                await this.propertyRepository.save(property);
                                continue; // Skip this owner and move to the next one.
                            }

                            // Check for banned keywords.
                            const bannedKeywords = ["llc", " inc", "corporation", "trust", "bank", "estate", "property", "association"];
                            const firstNameLower = owner.firstName.toLowerCase();
                            const lastNameLower = owner.lastName.toLowerCase();
                            const hasBanned = bannedKeywords.some(keyword =>
                                firstNameLower.includes(keyword) || lastNameLower.includes(keyword)
                            );

                            if (hasBanned) {
                                property.ownerCommercial = true;
                                property.preciselyChecked = true;
                                await this.propertyRepository.save(property);
                                continue; // Skip this owner and move to the next one.
                            }

                            // If we got here, it means we passed both checks.
                            property.preciselyChecked = true;
                            property.ownerFirstName = owner.firstName;
                            property.ownerLastName = owner.lastName;
                            await this.propertyRepository.save(property);
                            foundValidOwner = true;
                            break; // Stop processing further owners.
                        }
                    }
                    // If no valid owner was found, still mark the property as checked.
                    if (!foundValidOwner) {
                        property.preciselyChecked = true;
                        await this.propertyRepository.save(property);
                    }
                }
            } catch (error) {
                console.error(`Error retrieving owner info for address ${fullAddress}:`, error);
            }
        }
    }
}
