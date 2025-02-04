import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { UserId } from '../auth/user-id.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PropertiesService } from './properties.service';
import { GetPropertiesDto } from './dto/get-properties.dto';
import { Property } from '../../entities/property.entity';
import { FilteringActionDto } from './dto/filtering-action.dto';
import { MessageResponseDto } from '../../dto/message-response.dto';
import { FilteringResponseDto } from './dto/filtering-response.dto';
import { State } from '../../enums/state.enum';
import { StateResponseDto } from './dto/state-response.dto';
import { GetDashboardResponseDto } from './dto/get-dashboard.response.dto';

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get('listings')
  @ApiOperation({ summary: 'Show Listings' })
  @ApiOkResponse({ type: [Property] })
  async listings(
    @Query() getPropertiesDto: GetPropertiesDto,
    @UserId() userId: string,
  ): Promise<Property[]> {
    return this.propertiesService.getProperties(getPropertiesDto, userId);
  }

  @Get('filtering')
  @ApiOperation({ summary: 'Listings / show property that is not filtered' })
  @ApiOkResponse({ type: FilteringResponseDto })
  async filtering(@UserId() userId: string): Promise<FilteringResponseDto> {
    return this.propertiesService.filtering(userId);
  }

  @Post('filtering/:id')
  @ApiOperation({ summary: 'Action for property filtering' })
  @ApiOkResponse({ type: MessageResponseDto })
  async filteringAction(
    @Param('id') id: string,
    @Body() filteringActionDto: FilteringActionDto,
  ): Promise<MessageResponseDto> {
    return await this.propertiesService.filteringAction(id, filteringActionDto);
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Fetch last month, this month and today count data',
  })
  @ApiOkResponse({ type: GetDashboardResponseDto })
  async getDashboard(
    @UserId() userId: string,
  ): Promise<GetDashboardResponseDto> {
    return await this.propertiesService.getDashboard(userId);
  }

  @Get('state')
  @ApiOperation({ summary: 'List all states' })
  @ApiOkResponse({ type: StateResponseDto })
  async listStates(): Promise<StateResponseDto> {
    return this.propertiesService.listStates();
  }
}
