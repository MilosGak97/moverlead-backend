import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
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
import { StateResponseDto } from './dto/state-response.dto';
import { GetDashboardResponseDto } from './dto/get-dashboard.response.dto';
import { GetProductsDto } from './dto/get-products-dto';
import { County } from '../../entities/county.entity';
import { GetSubscriptionsDto } from './dto/get-subscriptions.dto';
import { GetSubscriptionsResponseDto } from './dto/get-subscriptions-response.dto';
import { Request, Response } from 'express';
import { WebhookDto } from './dto/webhook-secret.dto';
import { Public } from '../auth/public.decorator';
import { DaysOnZillow } from '../../enums/days-on-zillow.enum';
import { FetchSnapshotDto } from './dto/fetch-snapshot.dto';

@UseGuards(JwtAuthGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

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

  @Get('listings')
  @ApiOperation({ summary: 'Show Listings' })
  @ApiOkResponse({ type: [Property] })
  async listings(
    @Query() getPropertiesDto: GetPropertiesDto,
    @UserId() userId: string,
  ): Promise<Property[]> {
    return await this.propertiesService.getProperties(getPropertiesDto, userId);
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

  @Get('state')
  @ApiOperation({ summary: 'List all states' })
  @ApiOkResponse({ type: [StateResponseDto] })
  async listStates(): Promise<StateResponseDto[]> {
    return await this.propertiesService.listStates();
  }

  @Post('no-ui/fetch-snapshot-data')
  @ApiOperation({ summary: 'Manually run the scrapper per brightdata ID' })
  async fetchSnapshotData(@Body() fetchSnapshotDto: FetchSnapshotDto) {
    return await this.propertiesService.fetchSnapshotData(
      fetchSnapshotDto.id,
      fetchSnapshotDto.daysOnZillow,
    );
  }

  @Get('products')
  @ApiOperation({ summary: 'List products by state' })
  @ApiOkResponse({ type: [County] })
  async getProducts(@Query() getProductsDto: GetProductsDto) {
    return await this.propertiesService.getProducts(getProductsDto);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Get all active subscriptions for user' })
  @ApiOkResponse({ type: [GetSubscriptionsResponseDto] })
  async getSubscriptions(
    @UserId() userId: string,
    @Query() getSubscriptionsDto: GetSubscriptionsDto,
  ): Promise<GetSubscriptionsResponseDto[]> {
    return await this.propertiesService.getSubscriptions(
      userId,
      getSubscriptionsDto,
    );
  }

  // A simple POST endpoint to process CSV from a static file path
  @Post('process')
  async processCsvFile(): Promise<any> {
    const filePath = './uploads/zipcodes.csv'; // Specify the file path directly here
    await this.propertiesService.processCsvFile(filePath);
    return { message: 'CSV file processed successfully' };
  }

  @Public()
  @Post('webhook')
  async webhook(
    @Query() webhookDto: WebhookDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    if (webhookDto.webhookSecret !== process.env.BRIGHTDATA_SECRET) {
      throw new HttpException(
        'BrightData Secret is not valid!',
        HttpStatus.BAD_REQUEST,
      );
    }

    const body = req.body;

    if (body.status !== 'ready') {
      throw new HttpException(
        'BrightData snapshot is not ready',
        HttpStatus.BAD_REQUEST,
      );
    }
    const daysOnZillow = decodeURIComponent(webhookDto.daysOnZillow);

    if (
      daysOnZillow !== DaysOnZillow.ONE_DAY &&
      daysOnZillow !== DaysOnZillow.THREE_YEARS
    ) {
      throw new HttpException(
        'Days on Zillow input is not good',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.propertiesService.fetchSnapshotData(
      body.snapshot_id,
      webhookDto.daysOnZillow,
    );
    console.log('webhookDTO: ' + webhookDto.daysOnZillow);
    console.log('Snapshot ID: ' + body.snapshot_id);
  }
}
