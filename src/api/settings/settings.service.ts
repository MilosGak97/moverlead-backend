import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../repositories/user.repository';
import { GetCompanyResponseDto } from './dto/get-company-response.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly userRepository: UserRepository) {}

  async getCompany(userId: string): Promise<GetCompanyResponseDto> {
    return this.userRepository.getCompany(userId);
  }
}
