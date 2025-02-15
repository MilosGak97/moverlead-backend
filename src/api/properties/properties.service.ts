import { Injectable } from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { FilteringActionDto } from './dto/filtering-action.dto';
import { State } from '../../enums/state.enum';
import { StateResponseDto } from './dto/state-response.dto';
import { GetDashboardResponseDto } from './dto/get-dashboard.response.dto';
import { HttpService } from '@nestjs/axios';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { GetProductsDto } from './dto/get-products-dto';
import { CountyRepository } from '../../repositories/county.repository';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
    private readonly countyRepository: CountyRepository,
    private readonly httpService: HttpService,
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
        timeout: 60000, // Increase timeout
      });

      console.log('Starting data processing...');

      response.data
        .pipe(parser())
        .pipe(streamArray())
        .on('data', async ({ value: data }) => {
          if (data.zpid) {
            await this.propertyRepository.createProperty(data);
            // Process property here
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
