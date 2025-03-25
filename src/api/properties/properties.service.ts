import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { FilteringActionDto } from './dto/filtering-action.dto';
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
import * as fs from 'fs';
import * as csvParser from 'csv-parser';
import { FilteringResponseDto } from './dto/filtering-response.dto';
import { DaysOnZillow } from '../../enums/days-on-zillow.enum';
import { statesArray } from './dto/states.array'; // Correct ESModule-style import

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

  async listStates(): Promise<StateResponseDto[]> {
    return Object.values(statesArray);
  }

  async fetchSnapshotData(id: string, daysOnZillow: string) {
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
          console.log('get here 1');
          if (data.zpid) {
            console.log('get here 2');
            const propertyExist = await this.propertyRepository.findOneBy({
              zpid: data.zpid,
            });

            console.log('get here 3');
            // CHECK IF PROPERTY ALREADY EXIST BY CHECKING ZPID
            if (propertyExist) {
              console.log(`Property with ${data.zpid} already exist`);
              return;
            }

            console.log('get here 4');
            // CHECK IF COUNTY EXIST BY CHECKING DATA COUNTY NAME AND STATE
            const county = await this.countyRepository.findOne({
              where: { name: data.county, state: data.state },
            });

            console.log('get here 5');
            // IF COUNTY DOESN'T EXIST, NOTE IT IN DATABASE SO WE CAN INSPECT WHY IT DOESN'T EXIST
            if (!county) {
              console.log('get here 6');
              await this.propertyCountiesFailedRepository.createRecord(
                data.county,
                data.state,
                data.zpid,
              );
              return;
            }

            console.log('get here 7');
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
              data.listingTypeDimension === 'New Construction Plan' ||
              data.listingTypeDimension === 'New Construction Spec'
            ) {
              return;
            }

            let listingTypeDimension = null;

            // For Sale by Agent, For Sale by Owner, Coming Soon, Pre-Foreclosure (PreAuction),
            // Unknown Listed By - Foreclosure, Auction (Sold by bank)
            if (data.listingTypeDimension === 'Unknown Listed By') {
              listingTypeDimension = 'Sale by Bank';
            }

            // CREATE NEW PROPERTY
            const property = new CreatePropertyDto();
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

  /* ---------------- DELETE FROM HERE AFTER IMPORTING WISCONSIN TOO-----------------------*/
  async processCsvFile(filePath: string): Promise<void> {
    const results: any[] = [];

    const stream = fs.createReadStream(filePath);
    const parser = csvParser(); // Store reference to parser

    stream.pipe(parser); // Pipe stream to parser

    parser
      .on('data', async (data) => {
        parser.pause(); // Pause the parser, NOT the stream

        try {
          await this.processRow(data);
          console.log('NEXT ONE');
          results.push(data);
        } catch (error) {
          console.error('Error processing row:', error);
        }

        parser.resume(); // Resume parsing after processing
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
