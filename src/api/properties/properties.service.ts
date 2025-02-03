import { Injectable } from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { FilteringActionDto } from './dto/filtering-action.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getProperties(getPropertiesDto: GetPropertiesDto, userId: string) {
    return this.propertyRepository.getProperties(getPropertiesDto, userId);
  }

  async filtering(userId: string) {
    return this.propertyRepository.filtering(userId);
  }

  async filteringAction(id: string, filteringActionDto: FilteringActionDto) {
    return this.propertyRepository.filteringAction(id, filteringActionDto);
  }
}
