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
import { GetSubscriptionsPerStripeUserIdDto } from '../stripe/dto/get-subscriptions-per-stripe-user-id.dto';
import { GetSubscriptionsResponseDto } from './dto/get-subscriptions-response.dto';
import Stripe from 'stripe';

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

  async filtering(userId: string) {
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

            const subscriptions =
              await this.stripeService.getSubscriptionsPerPriceId(
                county.priceId,
              );
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

  async getSubscriptions(id: string, getSubscriptionsDto: GetSubscriptionsDto) {
    const user: User = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const getSubscriptionsResponseDto: GetSubscriptionsResponseDto[] = [];

    const stripeUserId: string = user.stripeId;
    if (!stripeUserId) {
      return getSubscriptionsResponseDto;
    }
    const getSubscriptionsPerStripeUserIdDto =
      new GetSubscriptionsPerStripeUserIdDto();

    getSubscriptionsPerStripeUserIdDto.stripeSubscriptionStatus =
      getSubscriptionsDto.stripeSubscriptionStatus;

    getSubscriptionsPerStripeUserIdDto.stripeUserId = stripeUserId;

    const stripeSubscriptionData =
      await this.stripeService.getSubscriptionsPerStripeUserId(
        getSubscriptionsPerStripeUserIdDto,
      );

    if (stripeSubscriptionData && stripeSubscriptionData.data.length > 0) {
      for (const subscription of stripeSubscriptionData.data) {
        const subscriptionItems = [];
        let totalPrice = 0;
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
}
