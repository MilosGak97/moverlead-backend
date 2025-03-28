import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { GetPropertiesDto } from '../api/properties/dto/get-properties.dto';
import { FilteringActionDto } from '../api/properties/dto/filtering-action.dto';
import { FilteringResponseDto } from '../api/properties/dto/filtering-response.dto';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { GetDashboardResponseDto } from '../api/properties/dto/get-dashboard.response.dto';
import { CountyRepository } from './county.repository';
import { PropertyCountiesFailedRepository } from './property-counties-failed.repository';
import { CreatePropertyDto } from 'src/api/properties/dto/create-property.dto';

@Injectable()
export class PropertyRepository extends Repository<Property> {
  constructor(
    private readonly dataSource: DataSource,
    private readonly countyRepository: CountyRepository,
    private readonly propertyCountiesFailedRepository: PropertyCountiesFailedRepository,
  ) {
    super(Property, dataSource.createEntityManager());
  }

  async getProperties(getPropertiesDto: GetPropertiesDto, userId: string) {
    const {
      filteredStatus,
      propertyStatus,
      state,
      propertyValueFrom,
      propertyValueTo,
      dateFrom,
      dateTo,
    } = getPropertiesDto;

    const queryBuilder = this.createQueryBuilder('properties');
    queryBuilder
      .leftJoinAndSelect('properties.users', 'user')
      .where('user.id = :userId', { userId });
    if (filteredStatus) {
      const filteredStatusArray = Array.isArray(filteredStatus)
        ? filteredStatus
        : [filteredStatus];
      queryBuilder.andWhere(
        'properties.filtered_status IN (:...filteredStatusArray)',
        {
          filteredStatusArray,
        },
      );
    }
    if (propertyStatus) {
      const propertyStatusArray = Array.isArray(propertyStatus)
        ? propertyStatus
        : [propertyStatus];
      queryBuilder.andWhere(
        'properties.home_status IN (:...propertyStatusArray)',
        {
          propertyStatusArray,
        },
      );
    }

    if (state && state.length > 0) {
      console.log('STATE IN REPOSITORY: ' + state);
      const stateArray = Array.isArray(state) ? state : [state]; // Ensure it's an array
      queryBuilder.andWhere('properties.state IN (:...state)', {
        state: stateArray,
      });
    }

    if (propertyValueFrom) {
      queryBuilder.andWhere('properties.price >= :propertyValueFrom', {
        propertyValueFrom,
      });
    }

    if (propertyValueTo) {
      queryBuilder.andWhere('properties.price <= :propertyValueTo', {
        propertyValueTo,
      });
    }

    if (dateFrom) {
      queryBuilder.andWhere('properties.home_status_date >= :dateFrom', {
        dateFrom,
      });
    }

    if (dateTo) {
      queryBuilder.andWhere('properties.home_status_date <= :dateTo', {
        dateTo,
      });
    }
    return await queryBuilder.getMany();
  }

  async filtering(userId: string): Promise<FilteringResponseDto> {
    const queryBuilder = this.createQueryBuilder('properties')
      .leftJoinAndSelect('properties.users', 'user')
      .where('user.id = :userId', { userId })
      .andWhere(
        '(properties.filtered_status IS NULL OR properties.filtered_status = :status)',
        { status: 'NOT_FILTERED' },
      );

    const [properties, count] = await queryBuilder.getManyAndCount();
    return {
      properties,
      count,
    };
  }

  async filteringAction(id: string, filteringActionDto: FilteringActionDto) {
    const property = await this.findOne({ where: { id } });
    if (!property) {
      throw new HttpException('Property not found', HttpStatus.BAD_REQUEST);
    }
    property.filteredStatus = filteringActionDto.action;
    property.filteredStatusDate = new Date();
    await this.save(property);
    return {
      message: 'Filtering successfully done',
    };
  }

  async getDashboard(userId: string): Promise<GetDashboardResponseDto> {
    const lastMonthStart = startOfMonth(subMonths(new Date(), 1)); // First day of last month
    const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)); // Last day of last month
    const queryBuilderLastMonth = this.createQueryBuilder('properties')
      .leftJoinAndSelect('properties.users', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('properties.home_status_date >= :dateFrom', {
        dateFrom: lastMonthStart,
      })
      .andWhere('properties.home_status_date <= :dateTo', {
        dateTo: lastMonthEnd,
      });

    const lastMonthCount: number = await queryBuilderLastMonth.getCount();

    const queryBuilderThisMonth = this.createQueryBuilder('properties')
      .leftJoinAndSelect('properties.users', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('properties.home_status_date >= :dateFrom', {
        dateFrom: startOfMonth(new Date()),
      })
      .andWhere('properties.home_status_date <= :dateTo', {
        dateTo: endOfMonth(new Date()),
      });

    const thisMonthCount: number = await queryBuilderThisMonth.getCount();

    const queryBuilderToday = this.createQueryBuilder('properties')
      .leftJoinAndSelect('properties.users', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('properties.home_status_date >= :dateFrom', {
        dateFrom: startOfDay(new Date()),
      })
      .andWhere('properties.home_status_date <= :dateTo', {
        dateTo: endOfDay(new Date()),
      });

    const todayCount: number = await queryBuilderToday.getCount();

    // DUMMY DATA UNTIL ITS FIXED
    /*
    const lastMonthCount = 2;
    const thisMonthCount = 5;
    const todayCount = 10;
     */

    return {
      lastMonthCount,
      thisMonthCount,
      todayCount,
    };
  }

  async createProperty(createPropertyDto: any) {
    // CREATE NEW PROPERTY
    const property = new Property();
    Object.assign(property, createPropertyDto);
    await this.save(property);
    console.log(`Property with ZPID: ${property.zpid} is saved to database`);
  }

  async checkProperty(zpid:string){
    
  }
}
