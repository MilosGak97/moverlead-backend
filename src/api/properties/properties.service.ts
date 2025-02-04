import { Injectable } from '@nestjs/common';
import { PropertyRepository } from '../../repositories/property.repository';
import { UserRepository } from '../../repositories/user.repository';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { FilteringActionDto } from './dto/filtering-action.dto';
import { State } from '../../enums/state.enum';
import { StateResponseDto } from './dto/state-response.dto';
import { GetDashboardResponseDto } from './dto/get-dashboard.response.dto';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly propertyRepository: PropertyRepository,
    private readonly userRepository: UserRepository,
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
}
