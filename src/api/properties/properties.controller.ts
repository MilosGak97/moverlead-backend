import {
    Body,
    Controller,
    Get, Header,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    Res, StreamableFile,
    UseGuards,
} from "@nestjs/common";
import {ApiOkResponse, ApiOperation} from "@nestjs/swagger";
import {UserId} from "../auth/user-id.decorator";
import {JwtAuthGuard} from "../auth/jwt-auth.guard";
import {PropertiesService} from "./properties.service";
import {GetListingsDto} from "./dto/get-listings.dto";
import {FilteringActionDto} from "./dto/filtering-action.dto";
import {MessageResponseDto} from "../../dto/message-response.dto";
import {FilteringResponseDto} from "./dto/filtering-response.dto";
import {StateResponseDto} from "./dto/state-response.dto";
import {GetDashboardResponseDto} from "./dto/get-dashboard.response.dto";
import {GetProductsDto} from "./dto/get-products-dto";
import {County} from "../../entities/county.entity";
import {GetSubscriptionsDto} from "./dto/get-subscriptions.dto";
import {GetSubscriptionsResponseDto} from "./dto/get-subscriptions-response.dto";
import {Request, Response} from "express";
import {WebhookDto} from "./dto/webhook-secret.dto";
import {Public} from "../auth/public.decorator";
import {DaysOnZillow} from "../../enums/days-on-zillow.enum";
import {FetchSnapshotDto} from "./dto/fetch-snapshot.dto";
import {GetListingsResponseDto} from "./dto/get-listings.response.dto";
import {FilteringDto} from "./dto/filtering-dto";
import {ListingsExportDto} from "./dto/listings-export.dto";

@UseGuards(JwtAuthGuard)
@Controller("properties")
export class PropertiesController {
    constructor(private readonly propertiesService: PropertiesService) {
    }

    @Get("dashboard")
    @ApiOperation({
        summary: "Fetch last month, this month and today count data",
    })
    @ApiOkResponse({type: GetDashboardResponseDto})
    async getDashboard(
        @UserId() userId: string
    ): Promise<GetDashboardResponseDto> {
        return await this.propertiesService.getDashboard(userId);
    }

    @Get("listings")
    @ApiOperation({summary: "Show Listings"})
    @ApiOkResponse({type: GetListingsResponseDto})
    async getListings(
        @Query() getListingsDto: GetListingsDto,
        @UserId() userId: string
    ): Promise<GetListingsResponseDto> {
        return await this.propertiesService.getListings(getListingsDto, userId);
    }

    @ApiOperation({summary: "Trigger export action for selected listings with usps needed fields"})
    @ApiOkResponse()
    @Post('listings/export/detailed')
    async listingsExportDetailed(
        @Body() listingsExportDto: ListingsExportDto,
        @Res({passthrough: true}) res: Response,
    ): Promise<StreamableFile> {
        const currentDate = new Date().toISOString().split('T')[0]; // e.g., "2025-04-04"
        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="detailed_listings_${currentDate}.csv"`,
        });
        return await this.propertiesService.listingsExportDetailed(listingsExportDto);
    }

    @Post("listings/export/usps")
    @ApiOperation({summary: "Trigger export action for selected listings with usps needed fields"})
    @ApiOkResponse()
    async listingsExportUSPS(
        @Body() listingsExportDto: ListingsExportDto,
        @Res({passthrough: true}) res: Response,
    ): Promise<StreamableFile> {
        const currentDate = new Date();
        const month = currentDate.toLocaleString('default', {month: 'long'}); // "April"
        const day = currentDate.getDate().toString().padStart(2, '0');           // "04"
        const year = currentDate.getFullYear();                                  // 2025
        const formattedDate = `${month} ${day} ${year}`;

        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="Postcards ${formattedDate}.csv"`,
        });
        return await this.propertiesService.listingsExportUsps(listingsExportDto)
    }

    @Post("listings/precisely")
    @ApiOperation({summary: "Trigger export action for selected listings with usps needed fields"})
    @ApiOkResponse()
    async checkPrecisely(
        @Body() listingsExportDto: ListingsExportDto,
    ) {
        return await this.propertiesService.checkPrecisely(listingsExportDto)
    }

    @Get("filtering")
    @ApiOperation({summary: "Listings / show property that is not filtered"})
    @ApiOkResponse({type: FilteringResponseDto})
    async filtering(@Query() filteringDto: FilteringDto, @UserId() userId: string): Promise<FilteringResponseDto> {
        return this.propertiesService.filtering(filteringDto, userId);
    }

    @Post("filtering/:id")
    @ApiOperation({summary: "Action for property filtering"})
    @ApiOkResponse({type: MessageResponseDto})
    async filteringAction(
        @Param("id") id: string,
        @Body() filteringActionDto: FilteringActionDto
    ): Promise<MessageResponseDto> {
        return await this.propertiesService.filteringAction(id, filteringActionDto);
    }

    @Get("state")
    @ApiOperation({summary: "List all states"})
    @ApiOkResponse({type: [StateResponseDto]})
    async listStates(): Promise<StateResponseDto[]> {
        return await this.propertiesService.listStates();
    }

    @Get("products")
    @ApiOperation({summary: "List products by state"})
    @ApiOkResponse({type: [County]})
    async getProducts(@Query() getProductsDto: GetProductsDto) {
        return await this.propertiesService.getProducts(getProductsDto);
    }

    @Get("subscriptions")
    @ApiOperation({summary: "Get all active subscriptions for user"})
    @ApiOkResponse({type: [GetSubscriptionsResponseDto]})
    async getSubscriptions(
        @UserId() userId: string,
        @Query() getSubscriptionsDto: GetSubscriptionsDto
    ): Promise<GetSubscriptionsResponseDto[]> {
        return await this.propertiesService.getSubscriptions(
            userId,
            getSubscriptionsDto
        );
    }

    // A simple POST endpoint to process CSV from a static file path
    @Public()
    @Post("webhook")
    async webhook(
        @Query() webhookDto: WebhookDto,
        @Res() res: Response,
        @Req() req: Request
    ) {
        if (webhookDto.webhookSecret !== process.env.BRIGHTDATA_SECRET) {
            throw new HttpException(
                "BrightData Secret is not valid!",
                HttpStatus.BAD_REQUEST
            );
        }

        const body = req.body;

        if (body.status !== "ready") {
            throw new HttpException(
                "BrightData snapshot is not ready",
                HttpStatus.BAD_REQUEST
            );
        }
        const daysOnZillow = decodeURIComponent(webhookDto.daysOnZillow);

        if (
            daysOnZillow !== DaysOnZillow.ONE_DAY &&
            daysOnZillow !== DaysOnZillow.THREE_YEARS
        ) {
            throw new HttpException(
                "Days on Zillow input is not good",
                HttpStatus.BAD_REQUEST
            );
        }
        /*
        await this.propertiesService.fetchSnapshotData(
            body.snapshot_id,
            webhookDto.daysOnZillow
        );

         */
        console.log("webhookDTO: " + webhookDto.daysOnZillow);
        console.log("Snapshot ID: " + body.snapshot_id);
    }

    @Post('brightdata-enrichment-trigger')
    async brightdataEnrichment() {
        return this.propertiesService.brightdataEnrichmentTrigger();
    }
}
