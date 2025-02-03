import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Property } from '../entities/property.entity';
import { GetPropertiesDto } from '../api/listings/dto/get-properties.dto';

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
}
