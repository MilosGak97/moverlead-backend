import { Injectable } from '@nestjs/common';
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

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
    private readonly countyRepository: CountyRepository,
    private readonly httpService: HttpService,
    private readonly propertyCountiesFailedRepository: PropertyCountiesFailedRepository,
  ) {}

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
    const states = Object.values(State);
    return {
      states,
    };
  }

  async manualRunScrapper(id: string) {
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
}
