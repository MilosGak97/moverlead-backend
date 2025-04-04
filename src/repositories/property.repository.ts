import {BadRequestException, HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {DataSource, IsNull, Repository} from 'typeorm';
import {Property} from '../entities/property.entity';
import {GetPropertiesDto} from '../api/properties/dto/get-properties.dto';
import {FilteringActionDto} from '../api/properties/dto/filtering-action.dto';
import {FilteringResponseDto} from '../api/properties/dto/filtering-response.dto';
import {
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfDay,
    endOfDay,
} from 'date-fns';
import {GetDashboardResponseDto} from '../api/properties/dto/get-dashboard.response.dto';
import {CountyRepository} from './county.repository';
import {PropertyCountiesFailedRepository} from './property-counties-failed.repository';
import {CreatePropertyDto} from 'src/api/properties/dto/create-property.dto';
import {UserSubscriptionsDto} from "../api/properties/dto/user-subscriptions.dto";
import {GetPropertyObjectDto} from "../api/properties/dto/get-property.object.dto";
import {PropertyStatus} from "../enums/property-status.enum";
import {GetPropertiesResponseDto} from "../api/properties/dto/get-properties.response.dto";
import {FilteringDto} from "../api/properties/dto/filtering-dto";

@Injectable()
export class PropertyRepository extends Repository<Property> {
    constructor(
        private readonly dataSource: DataSource,
        private readonly countyRepository: CountyRepository,
        private readonly propertyCountiesFailedRepository: PropertyCountiesFailedRepository,
    ) {
        super(Property, dataSource.createEntityManager());
    }

    async getProperties(getPropertiesDto: GetPropertiesDto, userSubscriptions: UserSubscriptionsDto[]): Promise<GetPropertiesResponseDto> {
        const {
            filteredStatus,
            propertyStatus,
            state,
            propertyValueFrom,
            propertyValueTo,
            limit = 10000,  // default limit if not provided
            offset = 0,     // default offset if not provided
        } = getPropertiesDto;

        const limitNumber = Number(limit);
        const offsetNumber = Number(offset);

        const queryBuilder = this.createQueryBuilder('properties');

        // Filter by county subscription + date ranges
        if (!userSubscriptions || userSubscriptions.length === 0) {
            throw new BadRequestException('User has no active subscriptions');
        }

        const dateCountyConditions: string[] = [];
        const params: Record<string, any> = {};

        userSubscriptions.forEach((sub, idx) => {
            const fromDateParam = `fromDate_${idx}`;
            const toDateParam = `toDate_${idx}`;
            const countyIdParam = `countyId_${idx}`;

            params[fromDateParam] = sub.fromDate;
            params[toDateParam] = sub.toDate;
            params[countyIdParam] = sub.countyId;

            dateCountyConditions.push(`
            (
                properties.countyId = :${countyIdParam}
                AND (
                    properties.comingSoonDate BETWEEN :${fromDateParam} AND :${toDateParam}
                    OR properties.forSaleDate BETWEEN :${fromDateParam} AND :${toDateParam}
                    OR properties.pendingDate BETWEEN :${fromDateParam} AND :${toDateParam}
                )
            )
        `);
        });

        // 👇 Wrap OR group in parentheses to avoid logic bugs
        queryBuilder.andWhere(`(${dateCountyConditions.join(' OR ')})`, params);

        // 👇 Only get properties that are enriched
        queryBuilder.andWhere('properties.brightdataEnriched = true');

        // Additional filters
        if (filteredStatus) {
            const filteredStatusArray = Array.isArray(filteredStatus)
                ? filteredStatus
                : [filteredStatus];
            queryBuilder.andWhere('properties.filteredStatus IN (:...filteredStatusArray)', {
                filteredStatusArray,
            });
        }

        if (propertyStatus) {
            const propertyStatusArray = Array.isArray(propertyStatus)
                ? propertyStatus
                : [propertyStatus];
            queryBuilder.andWhere('properties.homeStatus IN (:...propertyStatusArray)', {
                propertyStatusArray,
            });
        }

        if (state && state.length > 0) {
            const stateArray = Array.isArray(state) ? state : [state];
            queryBuilder.andWhere('properties.state IN (:...state)', {state: stateArray});
        }

        if (propertyValueFrom) {
            queryBuilder.andWhere('properties.price >= :propertyValueFrom', {
                propertyValueFrom,
            });
        }

        if (propertyValueTo) {
            queryBuilder.andWhere('properties.price <= :propertyValueTo', {
                propertyValueTo,
            });
        }

        const count = await queryBuilder.getCount();
        console.log(`🔢 Matching properties count: ${count}`);

        const properties: Property[] = await queryBuilder.getMany();
        const getPropertiesResponse: GetPropertyObjectDto[] = []
        for (const property of properties) {
            const propertyObject = new GetPropertyObjectDto()

            // Define the statuses and the corresponding property date field names.
            const statusChecks = [
                {dateField: 'comingSoonDate', statusLabel: 'COMING_SOON'},
                {dateField: 'forSaleDate', statusLabel: 'FOR_SALE'},
                {dateField: 'pendingDate', statusLabel: 'PENDING'}
            ];

            for (const {dateField, statusLabel} of statusChecks) {
                // Retrieve the date from the property dynamically.
                const statusDate = property[dateField];

                // Only proceed if the date exists.
                if (statusDate) {
                    for (const subscription of userSubscriptions) {
                        // Ensure the subscription is for the same county.
                        if (subscription.countyId === property.countyId.toString()) {
                            // Convert dates as needed and check if the statusDate falls within the subscription period.
                            if (
                                new Date(subscription.fromDate) <= new Date(statusDate) &&
                                new Date(subscription.toDate) >= new Date(statusDate)
                            ) {

                                // now here we can do the logic to push it into the array response

                                propertyObject.id = `${property.id}_${statusLabel}`;
                                propertyObject.filteredStatus = property.filteredStatus; // same
                                propertyObject.propertyStatusDate = statusDate;
                                if (statusLabel === 'COMING_SOON') propertyObject.propertyStatus = PropertyStatus.COMING_SOON
                                if (statusLabel === 'FOR_SALE') propertyObject.propertyStatus = PropertyStatus.FOR_SALE
                                if (statusLabel === 'PENDING') propertyObject.propertyStatus = PropertyStatus.PENDING
                                propertyObject.fullAddress = `${property.streetAddress}, ${property.city}, ${property.state}, ${property.zipcode}`;
                                propertyObject.state = property.state; // same
                                propertyObject.bedrooms = property.bedrooms; // same
                                propertyObject.bathrooms = property.bathrooms; // same
                                propertyObject.price = property.price; // same
                                propertyObject.homeType = property.homeType; // same
                                propertyObject.realtorName = property.realtorName; // same
                                propertyObject.realtorName = property.realtorName; // same
                                propertyObject.realtorPhone = property.realtorPhone; // same
                                propertyObject.brokerageName = property.brokerageName; // same
                                propertyObject.brokeragePhone = property.brokeragePhone; // same
                                getPropertiesResponse.push(propertyObject);
                            }
                        }
                    }
                }
            }
        }
        const paginatedResponse = getPropertiesResponse.slice(offsetNumber, offsetNumber + limitNumber);

        const totalRecords: number = getPropertiesResponse.length;
        const currentPage: number = Math.floor(offsetNumber / limitNumber) + 1;
        const totalPages: number = Math.ceil(totalRecords / limitNumber);

        return {
            result: paginatedResponse,
            totalRecords,
            currentPage,
            totalPages,
            limit: limitNumber,
            offset: offsetNumber,
        };
    }


    async filtering(filteringDto: FilteringDto, userSubscriptions: UserSubscriptionsDto[]): Promise<FilteringResponseDto> {

        const {limit = 10000, offset = 0} = filteringDto;
        const limitNumber = Number(limit);
        const offsetNumber = Number(offset);
        // Step 4: Apply similar logic from getProperties
        const queryBuilder = this.createQueryBuilder('properties');
        const dateCountyConditions: string[] = [];
        const params: Record<string, any> = {};

        userSubscriptions.forEach((sub, idx) => {
            const fromDateParam = `fromDate_${idx}`;
            const toDateParam = `toDate_${idx}`;
            const countyIdParam = `countyId_${idx}`;

            params[fromDateParam] = sub.fromDate;
            params[toDateParam] = sub.toDate;
            params[countyIdParam] = sub.countyId;

            dateCountyConditions.push(`
            (
                properties.countyId = :${countyIdParam} AND (
                    properties.comingSoonDate BETWEEN :${fromDateParam} AND :${toDateParam}
                    OR properties.forSaleDate BETWEEN :${fromDateParam} AND :${toDateParam}
                    OR properties.pendingDate BETWEEN :${fromDateParam} AND :${toDateParam}
                )
            )
        `);
        });

        queryBuilder.andWhere(`(${dateCountyConditions.join(' OR ')})`, params);

        queryBuilder.andWhere('properties.brightdataEnriched = true');
        queryBuilder.andWhere('(properties.filteredStatus IS NULL)');

        queryBuilder.take(limitNumber);
        queryBuilder.skip(offsetNumber);

        const [properties, totalRecords] = await queryBuilder.getManyAndCount();

// Map each property to an object containing only the id and photos fields.
        const photosAndId = properties.map(property => ({
            id: property.id,
            photos: property.photos, // adjust if further transformation is needed
        }));

        const currentPage: number = Math.floor(offsetNumber / limitNumber) + 1;
        const totalPages: number = Math.ceil(totalRecords / limitNumber);

        return {
            result: photosAndId,
            totalRecords,
            currentPage,
            totalPages,
            limit,
            offset
        };
    }

    async filteringAction(id: string, filteringActionDto: FilteringActionDto) {
        const property = await this.findOne({where: {id}});
        if (!property) {
            throw new HttpException('Property not found', HttpStatus.BAD_REQUEST);
        }
        property.filteredStatus = filteringActionDto.action;
        property.filteredStatusDate = new Date();
        await this.save(property);
        return {
            message: 'Filtering successfully done',
        };
    }

    async getDashboard(userSubscriptions: UserSubscriptionsDto[]): Promise<GetDashboardResponseDto> {
        /*
           const lastMonthStart = startOfMonth(subMonths(new Date(), 1)); // First day of last month
           const lastMonthEnd = endOfMonth(subMonths(new Date(), 1)); // Last day of last month
           const queryBuilderLastMonth = this.createQueryBuilder('properties')
               .leftJoinAndSelect('properties.users', 'user')
               .where('user.id = :userId', {userId})
               .andWhere('properties.home_status_date >= :dateFrom', {
                   dateFrom: lastMonthStart,
               })
               .andWhere('properties.home_status_date <= :dateTo', {
                   dateTo: lastMonthEnd,
               });

           const lastMonthCount: number = await queryBuilderLastMonth.getCount();

           const queryBuilderThisMonth = this.createQueryBuilder('properties')
               .leftJoinAndSelect('properties.users', 'user')
               .where('user.id = :userId', {userId})
               .andWhere('properties.home_status_date >= :dateFrom', {
                   dateFrom: startOfMonth(new Date()),
               })
               .andWhere('properties.home_status_date <= :dateTo', {
                   dateTo: endOfMonth(new Date()),
               });

           const thisMonthCount: number = await queryBuilderThisMonth.getCount();

           const queryBuilderToday = this.createQueryBuilder('properties')
               .leftJoinAndSelect('properties.users', 'user')
               .where('user.id = :userId', {userId})
               .andWhere('properties.home_status_date >= :dateFrom', {
                   dateFrom: startOfDay(new Date()),
               })
               .andWhere('properties.home_status_date <= :dateTo', {
                   dateTo: endOfDay(new Date()),
               });

           const todayCount: number = await queryBuilderToday.getCount();


         */
        // DUMMY DATA UNTIL ITS FIXED
        /*
        const lastMonthCount = 2;
        const thisMonthCount = 5;
        const todayCount = 10;
         */
        if (!userSubscriptions || userSubscriptions.length === 0) {
            throw new BadRequestException('No active subscriptions provided');
        }

        // Build the base query with subscription filtering.
        const queryBuilder = this.createQueryBuilder('properties');
        const dateCountyConditions: string[] = [];
        const params: Record<string, any> = {};

        userSubscriptions.forEach((sub, idx) => {
            const fromDateParam = `fromDate_${idx}`;
            const toDateParam = `toDate_${idx}`;
            const countyIdParam = `countyId_${idx}`;

            params[fromDateParam] = sub.fromDate;
            params[toDateParam] = sub.toDate;
            params[countyIdParam] = sub.countyId;

            dateCountyConditions.push(`
      (
        properties.countyId = :${countyIdParam}
        AND (
          properties.comingSoonDate BETWEEN :${fromDateParam} AND :${toDateParam}
          OR properties.forSaleDate BETWEEN :${fromDateParam} AND :${toDateParam}
          OR properties.pendingDate BETWEEN :${fromDateParam} AND :${toDateParam}
        )
      )
    `);
        });

        // Wrap the OR group in parentheses to avoid logic bugs.
        queryBuilder.andWhere(`(${dateCountyConditions.join(' OR ')})`, params);
        queryBuilder.andWhere('properties.brightdataEnriched = true');
        queryBuilder.andWhere('properties.filteredStatus IS NULL');

        // Helper to add a period filter checking if any of the three date fields fall in the range.
        const addPeriodFilter = (qb, dateStart: Date, dateEnd: Date) => {
            qb.andWhere(`
      (
        properties.comingSoonDate BETWEEN :dateStart AND :dateEnd OR
        properties.forSaleDate BETWEEN :dateStart AND :dateEnd OR
        properties.pendingDate BETWEEN :dateStart AND :dateEnd
      )
    `, {dateStart, dateEnd});
        };

        // Last month count.
        const lastMonthStart = startOfMonth(subMonths(new Date(), 1));
        const lastMonthEnd = endOfMonth(subMonths(new Date(), 1));
        const qbLastMonth = queryBuilder.clone();
        addPeriodFilter(qbLastMonth, lastMonthStart, lastMonthEnd);
        const lastMonthCount = await qbLastMonth.getCount();

        // This month count.
        const thisMonthStart = startOfMonth(new Date());
        const thisMonthEnd = endOfMonth(new Date());
        const qbThisMonth = queryBuilder.clone();
        addPeriodFilter(qbThisMonth, thisMonthStart, thisMonthEnd);
        const thisMonthCount = await qbThisMonth.getCount();

        // Today count.
        const todayStart = startOfDay(new Date());
        const todayEnd = endOfDay(new Date());
        const qbToday = queryBuilder.clone();
        addPeriodFilter(qbToday, todayStart, todayEnd);
        const todayCount = await qbToday.getCount();

        console.log("Last Month Count:", lastMonthCount);
        console.log("This Month Count:", thisMonthCount);
        console.log("Today Count:", todayCount);

        return {
            lastMonthCount,
            thisMonthCount,
            todayCount,
        };
    }

    async createProperty(createPropertyDto: any) {
        // CREATE NEW PROPERTY
        const property = new Property();
        Object.assign(property, createPropertyDto);
        await this.save(property);
        console.log(`Property with ZPID: ${property.zpid} is saved to database`);
    }
}
