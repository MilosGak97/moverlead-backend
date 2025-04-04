import {
    BadRequestException, forwardRef,
    HttpException,
    HttpStatus, Inject,
    Injectable,
} from "@nestjs/common";
import {PropertyRepository} from "../../repositories/property.repository";
import {UserRepository} from "../../repositories/user.repository";
import {GetPropertiesDto} from "./dto/get-properties.dto";
import {FilteringActionDto} from "./dto/filtering-action.dto";
import {StateResponseDto} from "./dto/state-response.dto";
import {GetDashboardResponseDto} from "./dto/get-dashboard.response.dto";
import {HttpService} from "@nestjs/axios";
import {GetProductsDto} from "./dto/get-products-dto";
import {CountyRepository} from "../../repositories/county.repository";
import {streamArray} from "stream-json/streamers/StreamArray";
import {parser} from "stream-json";
import {PropertyCountiesFailedRepository} from "../../repositories/property-counties-failed.repository";
import {StripeService} from "../stripe/stripe.service";
import {User} from "../../entities/user.entity";
import {GetSubscriptionsDto} from "./dto/get-subscriptions.dto";
import {GetSubscriptionsResponseDto} from "./dto/get-subscriptions-response.dto";
import Stripe from "stripe";
import {SubscriptionItemsDto} from "./dto/subscription-items.dto";
import {FilteringResponseDto} from "./dto/filtering-response.dto";
import {DaysOnZillow} from "../../enums/days-on-zillow.enum";
import {statesArray} from "./dto/states.array"; // Correct ESModule-style import
import {CreatePropertyDto} from "./dto/create-property.dto";
import {CreatePropertyBrightdataDto} from "./dto/create-property-brightdata.dto";
import {County} from "src/entities/county.entity";
import {In, IsNull} from "typeorm";
import {ZillowDataDto} from "../scrapper/dto/zillow-data.dto";
import {Property} from "../../entities/property.entity";
import {ScrapperService} from "../scrapper/scrapper.service";
import {FillBrightdataDto} from "../scrapper/dto/fill-brightdata-dto";
import {UserSubscriptionsDto} from "./dto/user-subscriptions.dto";
import {FilteringDto} from "./dto/filtering-dto";

@Injectable()
export class PropertiesService {
    private stripe: Stripe;

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

    async getProperties(getPropertiesDto: GetPropertiesDto, userId: string) {

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


        // SO LETS GET PRICEIDS FIRST
        // its basically like getting counties

        return await this.propertyRepository.getProperties(
            getPropertiesDto,
            userSubscriptions
        );


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

    async listStates(): Promise<StateResponseDto[]> {
        return Object.values(statesArray);
    }

    async fetchSnapshotData(id: string, daysOnZillow: string) {
        const url = `https://api.brightdata.com/datasets/v3/snapshot/${id}?format=json`;

        try {
            const response = await this.httpService.axiosRef({
                method: "GET",
                url,
                responseType: "stream", // Enable streaming
                headers: {
                    Authorization: `Bearer ${process.env.BRIGHTDATA_TOKEN}`,
                },
                timeout: 200000, // Increase timeout
            });

            console.log("Starting data processing...");

            response.data
                .pipe(parser())
                .pipe(streamArray())
                .on("data", async ({value: data}) => {
                    console.log("get here 1");
                    if (data.zpid) {
                        console.log("get here 2");
                        const propertyExist = await this.propertyRepository.findOneBy({
                            zpid: data.zpid,
                        });

                        console.log("get here 3");
                        // CHECK IF PROPERTY ALREADY EXIST BY CHECKING ZPID
                        if (propertyExist) {
                            console.log(`Property with ${data.zpid} already exist`);
                            return;
                        }

                        console.log("get here 4");
                        // CHECK IF COUNTY EXIST BY CHECKING DATA COUNTY NAME AND STATE
                        const county = await this.countyRepository.findOne({
                            where: {name: data.county, state: data.state},
                        });

                        console.log("get here 5");
                        // IF COUNTY DOESN'T EXIST, NOTE IT IN DATABASE SO WE CAN INSPECT WHY IT DOESN'T EXIST
                        if (!county) {
                            console.log("get here 6");
                            await this.propertyCountiesFailedRepository.createRecord(
                                data.county,
                                data.state,
                                data.zpid
                            );
                            return;
                        }

                        console.log("get here 7");
                        // CHECK IF THERE IS ANY PHOTOS AND ASSIGN ONLY 576PX
                        let photos = null;
                        if (data.photoCount > 1) {
                            const photosData = data.photos;
                            photos = photosData
                                .map((photo) => {
                                    const jpegArray = photo.mixedSources.jpeg;
                                    return jpegArray[2]?.url; // extract 576px photo only
                                })
                                .filter((url) => url);
                        }
                        //listingTypeDimension
                        // New Construction Plan, New Construction Spec - ignore
                        if (
                            data.listingTypeDimension === "New Construction Plan" ||
                            data.listingTypeDimension === "New Construction Spec"
                        ) {
                            return;
                        }

                        let listingTypeDimension = null;

                        // For Sale by Agent, For Sale by Owner, Coming Soon, Pre-Foreclosure (PreAuction),
                        // Unknown Listed By - Foreclosure, Auction (Sold by bank)
                        if (data.listingTypeDimension === "Unknown Listed By") {
                            listingTypeDimension = "Sale by Bank";
                        }

                        // CREATE NEW PROPERTY
                        const property = new CreatePropertyBrightdataDto();
                        Object.assign(property, data);
                        if (listingTypeDimension != null) {
                            property.listingTypeDimension = listingTypeDimension;
                        }

                        property.price = data.price;
                        property.livingAreaValue = data.livingAreaValue;
                        property.photos = photos;
                        property.county = county;
                        property.countyZillow = data.county;
                        property.realtorName = data.listing_provided_by.name;
                        property.realtorPhone = data.listing_provided_by.phone_number;
                        property.realtorCompany = data.listing_provided_by.company;
                        property.homeStatusDate = new Date();
                        if (daysOnZillow === DaysOnZillow.THREE_YEARS) {
                            property.initialScrape = true;
                        }
                        await this.propertyRepository.createProperty(property);
                    }
                })
                .on("end", () => console.log("Finished processing all properties."))
                .on("error", (err) =>
                    console.error("Error while streaming data:", err.message)
                );
        } catch (error) {
            console.error("Error fetching data:", error.message);
        }
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

    /* ---------------- DELETE FROM HERE AFTER IMPORTING WISCONSIN TOO-----------------------*/
}
