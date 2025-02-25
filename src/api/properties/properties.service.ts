import { BadRequestException, Injectable } from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { FilteringActionDto } from './dto/filtering-action.dto';
import { State } from '../../enums/state.enum';
import { StateResponseDto } from './dto/state-response.dto';
import { GetDashboardResponseDto } from './dto/get-dashboard.response.dto';
import { HttpService } from '@nestjs/axios';
import { GetProductsDto } from './dto/get-products-dto';
import { CountyRepository } from '../../repositories/county.repository';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { parser } from 'stream-json';
import { PropertyCountiesFailedRepository } from '../../repositories/property-counties-failed.repository';
import { CreatePropertyDto } from './dto/create-property.dto';
import { StripeService } from '../stripe/stripe.service';
import { User } from '../../entities/user.entity';
import { GetSubscriptionsDto } from './dto/get-subscriptions.dto';
import { GetSubscriptionsResponseDto } from './dto/get-subscriptions-response.dto';
import Stripe from 'stripe';
import { SubscriptionItemsDto } from './dto/subscription-items.dto';
import { In } from 'typeorm';
import { County } from '../../entities/county.entity';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as csvParser from 'csv-parser';
import { FilteringResponseDto } from './dto/filtering-response.dto'; // Correct ESModule-style import

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
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  async getProperties(getPropertiesDto: GetPropertiesDto, userId: string) {
    return await this.propertyRepository.getProperties(
      getPropertiesDto,
      userId,
    );
  }

  async filtering(userId: string): Promise<FilteringResponseDto> {
    return await this.propertyRepository.filtering(userId);
  }

  async filteringAction(id: string, filteringActionDto: FilteringActionDto) {
    return await this.propertyRepository.filteringAction(
      id,
      filteringActionDto,
    );
  }

  async getDashboard(userId: string): Promise<GetDashboardResponseDto> {
    return await this.propertyRepository.getDashboard(userId);
  }

  async listStates(): Promise<StateResponseDto> {
    const states: State[] = Object.values(State);
    return {
      states,
    };
  }

  async fetchSnapshotData(id: string) {
    const url = `https://api.brightdata.com/datasets/v3/snapshot/${id}?format=json`;

    try {
      const response = await this.httpService.axiosRef({
        method: 'GET',
        url,
        responseType: 'stream', // Enable streaming
        headers: {
          Authorization: `Bearer ${process.env.BRIGHTDATA_TOKEN}`,
        },
        timeout: 200000, // Increase timeout
      });

      console.log('Starting data processing...');

      response.data
        .pipe(parser())
        .pipe(streamArray())
        .on('data', async ({ value: data }) => {
          if (data.zpid) {
            const propertyExist = await this.propertyRepository.findOneBy({
              zpid: data.zpid,
            });

            // CHECK IF PROPERTY ALREADY EXIST BY CHECKING ZPID
            if (propertyExist) {
              console.log(`Property with ${data.zpid} already exist`);
              return;
            }

            // CHECK IF COUNTY EXIST BY CHECKING DATA COUNTY NAME AND STATE
            const county = await this.countyRepository.findOne({
              where: { name: data.county, state: data.state },
            });

            // IF COUNTY DOESN'T EXIST, NOTE IT IN DATABASE SO WE CAN INSPECT WHY IT DOESN'T EXIST
            if (!county) {
              await this.propertyCountiesFailedRepository.createRecord(
                data.county,
                data.state,
                data.zpid,
              );
              return;
            }

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
            //listing_type_dimension
            // New Construction Plan, New Construction Plan, New Construction Spec - ignore
            if (
              data.listing_type_dimension === 'New Construction Plan' ||
              data.listing_type_dimension === 'New Construction Spec'
            ) {
              return;
            }

            let listingTypeDimension = null;

            // For Sale by Agent, For Sale by Owner, Coming Soon, Pre-Foreclosure (PreAuction),
            // Unknown Listed By - Foreclosure, Auction (Sold by bank)
            if (data.listing_type_dimension === 'Unknown Listed By') {
              listingTypeDimension = 'Sale by Bank';
            }

            // CREATE NEW PROPERTY
            const property = new CreatePropertyDto();
            Object.assign(property, data);
            if (listingTypeDimension != null) {
              property.listingTypeDimension = listingTypeDimension;
            }

            // THIS METHOD IS CHECKING IF THERE IS ACTIVE SUBSCRIPTIONS FOR THIS COUNTY, AND ASSIGNING THOSE USERS TO PROPERTY
            const users: User[] = [];

            const subscriptions = await this.stripe.subscriptions.list({
              price: county.priceId,
            });
            if (subscriptions.data.length > 0) {
              for (const subscription of subscriptions.data) {
                const user: User =
                  await this.userRepository.getUserByStripeUserId(
                    subscription.customer.toString() as string,
                  );
                if (!user) {
                  continue;
                }
                users.push(user);
              }
            }

            property.price = data.price;
            property.livingAreaValue = data.livingAreaValue;
            property.users = users;
            property.photos = photos;
            property.county = county;
            property.countyZillow = data.county;
            property.realtorName = data.listing_provided_by.name;
            property.realtorPhone = data.listing_provided_by.phone_number;
            property.realtorCompany = data.listing_provided_by.company;
            property.homeStatusDate = new Date();
            property.initialScrape = true;
            await this.propertyRepository.createProperty(property);
          }
        })
        .on('end', () => console.log('Finished processing all properties.'))
        .on('error', (err) =>
          console.error('Error while streaming data:', err.message),
        );
    } catch (error) {
      console.error('Error fetching data:', error.message);
    }
  }

  /* PRODUCTS SERVICES */
  async getProducts(getProductsDto: GetProductsDto) {
    return this.countyRepository.getProducts(getProductsDto);
  }

  async getSubscriptions(
    id: string,
    getSubscriptionsDto: GetSubscriptionsDto,
  ): Promise<GetSubscriptionsResponseDto[]> {
    const user: User = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found');
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
            item.plan.product.toString() as string,
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
            subscription.current_period_start * 1000,
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

  async runBrightDataDaily() {
    // check active subscriptions
    const subscriptions = await this.stripe.subscriptions.list({
      status: 'active',
    });
    if (!subscriptions) {
      return;
    }

    const priceIds: string[] = [
      ...new Set(
        subscriptions.data.flatMap((subscription) =>
          subscription.items.data.map((item) => item.price.id),
        ),
      ),
    ];

    const counties: County[] = await this.countyRepository.find({
      where: { priceId: In(priceIds) },
    });

    const countiesNames = counties.flatMap((county) => [
      county.name,
      county.state,
    ]);
    return { countiesNames };
  }

  async triggerScraper(): Promise<any> {
    const payload = [
      {
        url: 'https://www.zillow.com/cook-county-il/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.23010743856049%2C%22south%22%3A41.3928448047299%2C%22east%22%3A-86.88394475585939%2C%22west%22%3A-88.49069524414064%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22fsbo%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%7D%2C%22isListVisible%22%3Atrue%2C%22usersSearchTerm%22%3A%22Cook%20County%20IL%22%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A139%2C%22regionType%22%3A4%7D%5D%2C%22category%22%3A%22cat1%22%2C%22pagination%22%3A%7B%7D%7D',
      },
      {
        url: 'https://www.zillow.com/dupage-county-il/?searchQueryState=%7B%22isMapVisible%22%3Atrue%2C%22mapBounds%22%3A%7B%22north%22%3A42.0487512162021%2C%22south%22%3A41.63029599086032%2C%22east%22%3A-87.68702987792969%2C%22west%22%3A-88.49040512207031%7D%2C%22filterState%22%3A%7B%22sort%22%3A%7B%22value%22%3A%22globalrelevanceex%22%7D%2C%22doz%22%3A%7B%22value%22%3A%221%22%7D%2C%22auc%22%3A%7B%22value%22%3Afalse%7D%2C%22fore%22%3A%7B%22value%22%3Afalse%7D%2C%22nc%22%3A%7B%22value%22%3Afalse%7D%2C%22manu%22%3A%7B%22value%22%3Afalse%7D%2C%22apa%22%3A%7B%22value%22%3Afalse%7D%2C%22land%22%3A%7B%22value%22%3Afalse%7D%2C%22con%22%3A%7B%22value%22%3Afalse%7D%2C%22apco%22%3A%7B%22value%22%3Afalse%7D%2C%22mf%22%3A%7B%22value%22%3Afalse%7D%7D%2C%22isListVisible%22%3Atrue%2C%22usersSearchTerm%22%3A%22DuPage%20County%20IL%22%2C%22category%22%3A%22cat1%22%2C%22mapZoom%22%3A11%2C%22regionSelection%22%3A%5B%7B%22regionId%22%3A1682%7D%5D%2C%22pagination%22%3A%7B%7D%7D',
      },
    ];

    const params = {
      dataset_id: process.env.BRIGHTDATA_DATASET_ID,
      endpoint: process.env.BRIGHTDATA_ENDPOINT,
      notify: process.env.BRIGHTDATA_NOTIFY,
      format: 'json',
      uncompressed_webhook: true,
      include_errors: true,
      type: 'discover_new',
      discover_by: 'url',
    };

    const headers = {
      Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await firstValueFrom(
        this.httpService.post(process.env.BRIGHTDATA_API_URL, payload, {
          headers,
          params,
        }),
      );
      return response.data;
    } catch (error) {
      console.error(
        'Bright Data API Error:',
        error.response?.data || error.message,
      );
      throw new Error('Failed to trigger Bright Data scraping');
    }
  }

  async processCsvFile(filePath: string): Promise<void> {
    const results: any[] = [];

    const stream = fs.createReadStream(filePath);
    const parser = csvParser(); // Store reference to parser

    stream.pipe(parser); // Pipe stream to parser

    parser
      .on('data', async (data) => {
        parser.pause(); // ✅ Pause the parser, NOT the stream

        try {
          await this.processRow(data);
          console.log('NEXT ONE');
          results.push(data);
        } catch (error) {
          console.error('Error processing row:', error);
        }

        parser.resume(); // ✅ Resume parsing after processing
      })
      .on('end', () => {
        console.log('CSV file processed successfully');
      })
      .on('error', (error) => {
        console.error('Error reading CSV file:', error);
      });
  }

  private async processRow(row: any) {
    const county = await this.countyRepository
      .createQueryBuilder('counties')
      .where(`counties.name ILIKE :county`, { county: `%${row.county}%` })
      .andWhere(`counties.state = :state`, { state: row.state })
      .getOne();

    if (!county) {
      console.log(
        `County in Row: ${row.county}, ${row.state} couldn't be found in database`,
      );
      return;
    }

    // Ensure county.zipCodes is an array (initialize if null)
    if (!Array.isArray(county.zipCodes) || county.zipCodes === null) {
      county.zipCodes = []; // Initialize as an empty array if null
    }

    // Add new zip code and remove duplicates
    county.zipCodes.push(row.zip);
    county.zipCodes = Array.from(new Set(county.zipCodes)); // Ensures uniqueness
    await this.countyRepository.save(county); // Save to DB

    console.log(`New county record saved! ${county.name}`);
  }
}
