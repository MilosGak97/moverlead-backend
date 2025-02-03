import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { UserId } from '../auth/user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PropertiesService } from './properties.service';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { Property } from '../../entities/property.entity';
import { FilteringActionDto } from './dto/filtering-action.dto';
import { MessageResponseDto } from '../../dto/message-response.dto';

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('listings')
  @ApiOperation({ summary: 'Show Listings' })
  async listings(
    @Query() getPropertiesDto: GetPropertiesDto,
    @UserId() userId: string,
  ): Promise<Property[]> {
    return this.propertiesService.getProperties(getPropertiesDto, userId);
  }

  @Get('filtering')
  @ApiOperation({ summary: 'Listings / show property that is not filtered' })
  async filtering(@UserId() userId: string) {
    return this.propertiesService.filtering(userId);
  }

  @Post('filtering/:id')
  @ApiOperation({ summary: 'Action for property filtering' })
  async filteringAction(
    @Param('id') id: string,
    @Body() filteringActionDto: FilteringActionDto,
  ): Promise<MessageResponseDto> {
    return this.propertiesService.filteringAction(id, filteringActionDto);
  }
}
