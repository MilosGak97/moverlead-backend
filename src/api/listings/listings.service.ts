import { Injectable } from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';

@Injectable()
export class ListingsService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async getProperties(getPropertiesDto: GetPropertiesDto, userId: string) {
    return this.propertyRepository.getProperties(getPropertiesDto, userId);
  }
}
