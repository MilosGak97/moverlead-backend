import {
    BadRequestException, Body, forwardRef,
    HttpException,
    HttpStatus, Inject,
    Injectable, StreamableFile,
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
import {ZillowDataDto} from "../scrapper/dto/zillow-data.dto";
import {Property} from "../../entities/property.entity";
import {ScrapperService} from "../scrapper/scrapper.service";
import {FillBrightdataDto} from "../scrapper/dto/fill-brightdata-dto";
import {UserSubscriptionsDto} from "./dto/user-subscriptions.dto";
import {FilteringDto} from "./dto/filtering-dto";
import {ListingsExportDto} from "./dto/listings-export.dto";
import {GetListingsDto} from "./dto/get-listings.dto";
import {Parser} from "json2csv";
import axios from "axios";

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


        // lets get now priceids (county) and when user was subscribed to that county
        // date to and date from
        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);

        if (subscriptionsArray.length == 0) {
            throw new BadRequestException('User never had any subscriptions')
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


        // lets get now priceids (county) and when user was subscribed to that county
        // date to and date from
        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);

        if (subscriptionsArray.length == 0) {
            throw new BadRequestException('User never had any subscriptions')
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
            'streetAddress',
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


        // let's get now priceids (county) and when user was subscribed to that county
        // date to and date from
        const subscriptionsArray = await this.stripeService.getAllUserSubscriptions(user.stripeId);

        if (subscriptionsArray.length == 0) {
            throw new BadRequestException('User never had any subscriptions')
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

    async getZillowUrlsActiveSubscription(): Promise<ZillowDataDto[]> {
        // check active subscriptions
        const subscriptions = await this.stripeService.getActiveSubscriptions();
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
            .flatMap((county) =>
                county.zillowLinks.map((url) => ({
                    countyId: county.id,
                    zillowUrl: url,
                }))
            )
            .filter((item) => item.zillowUrl != null);

    }

    async findProperty(zpid: string) {
        return await this.propertyRepository.findOneBy({zpid})
    }

    async checkPropertyDaily(property: Property, currentStatus: string, initialScrapper: boolean, date: Date) {

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

    async brightdataEnrichmentTrigger() {
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

        const brightdataSnapshot: string = await this.scrapperService.brightdataSnapshotTrigger(urls)

        // Set the snapshot on each property and save
        for (const property of properties) {
            property.brightdataSnapshot = brightdataSnapshot;
        }

        await this.propertyRepository.save(properties);
    }

    async fillBrightdata(fillBrightdataDto: FillBrightdataDto) {
        const {zpid} = fillBrightdataDto;
        console.log(`Filling with brightdata info: ${zpid}`)

        let property = await this.propertyRepository.findOne({where: {zpid}});

        if (!property) {
            // If not found, create new property
            //property = this.propertyRepository.create({zpid});
            return;
        }

        // Assign all DTO fields (overwrites any existing fields)
        Object.assign(property, fillBrightdataDto);
        console.log('Next...')
        return await this.propertyRepository.save(property);

    }

    /* ---------------- DELETE FROM HERE AFTER IMPROVING PRECISELY -----------------------*/


    // Helper to get a valid token; fetch a new one if missing or expired.
    private async getToken(): Promise<string> {
        if (!this.accessTokenPrecisely || Date.now() > this.tokenExpirationTime) {
            await this.fetchToken();
        }
        return this.accessTokenPrecisely;
    }

    // Fetch a new token from the Precisely API.
    private async fetchToken(): Promise<void> {
        const key = 'QKs8U4IfxnfSAUXZCA9ttMBBOzS6rIWW';
        const secret = 'L4VZlKATR5wy56lo';
        const encodedCredentials = Buffer.from(`${key}:${secret}`).toString('base64');

        const config = {
            headers: {
                'Authorization': `Basic ${encodedCredentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        const data = new URLSearchParams({grant_type: 'client_credentials'});

        try {
            const response = await axios.post('https://api.precisely.com/oauth/token', data, config);
            this.accessTokenPrecisely = response.data.access_token;
            // Set expiration time (with a 5-minute buffer before actual expiration)
            this.tokenExpirationTime = Date.now() + (response.data.expires_in * 1000) - (5 * 60 * 1000);
            console.log('Fetched new access token:', this.accessTokenPrecisely);
        } catch (error) {
            console.error(
                'Error fetching access token:',
                error.response ? error.response.data : error.message
            );
        }
    }

    async checkPrecisely(
        listingsExportDto: ListingsExportDto) {
        const {ids} = listingsExportDto;
        const uuids = ids.map(idString => idString.split('_')[0]);

        const properties: Property[] = await this.propertyRepository.find({where: {id: In(uuids)}})

        if(properties.length == 0) {
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
