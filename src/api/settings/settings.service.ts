import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../repositories/user.repository';

@Injectable()
export class SettingsService {
  constructor(private readonly userRepository: UserRepository) {}


}
