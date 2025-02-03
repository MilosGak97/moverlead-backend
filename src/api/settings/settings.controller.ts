import { Controller, Get, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserId } from '../auth/user-id.decorator';
import { GetCompanyResponseDto } from './dto/get-company-response.dto';
import { ApiOkResponse } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('company')
  @ApiOkResponse({ type: GetCompanyResponseDto })
  async getCompany(@UserId() userId: string): Promise<GetCompanyResponseDto> {
    return this.settingsService.getCompany(userId);
  }
}
