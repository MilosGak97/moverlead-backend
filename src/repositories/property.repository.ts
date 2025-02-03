import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { GetPropertiesDto } from '../api/properties/dto/get-properties.dto';
import { FilteringActionDto } from '../api/properties/dto/filtering-action.dto';
import { FilteringResponseDto } from '../api/properties/dto/filtering-response.dto';

@Injectable()
export class PropertyRepository extends Repository<Property> {
  constructor(private readonly dataSource: DataSource) {
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
      queryBuilder.andWhere('properties.state IN (:...state)', { state });
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
    property.filtered_status = filteringActionDto.action;
    property.filtered_status_date = new Date();
    await this.save(property);
    return {
      message: 'Filtering successfully done',
    };
  }
}
