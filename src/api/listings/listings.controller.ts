import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserId } from '../auth/user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ListingsService } from './listings.service';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { Property } from '../../entities/property.entity';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listingsService: ListingsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({ summary: 'Listings' })
  async listings(
    @Query() getPropertiesDto: GetPropertiesDto,
    @UserId() userId: string,
  ): Promise<Property[]> {
    return this.listingsService.getProperties(getPropertiesDto, userId);
  }
}
