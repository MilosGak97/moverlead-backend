import {BadRequestException, HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {DataSource, In, IsNull, Not, Repository} from 'typeorm';
import {Property} from '../entities/property.entity';
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
import {UserSubscriptionsDto} from "../api/properties/dto/user-subscriptions.dto";
import {GetListingObjectDto} from "../api/properties/dto/get-listing.object.dto";
import {PropertyStatus} from "../enums/property-status.enum";
import {GetListingsResponseDto} from "../api/properties/dto/get-listings.response.dto";
import {FilteringDto} from "../api/properties/dto/filtering-dto";
import {ListingsExportDto} from "../api/properties/dto/listings-export.dto";
import {GetListingsDto} from "../api/properties/dto/get-listings.dto";

@Injectable()
export class PropertyRepository extends Repository<Property> {
    constructor(
        private readonly dataSource: DataSource,
        private readonly countyRepository: CountyRepository,
        private readonly propertyCountiesFailedRepository: PropertyCountiesFailedRepository,
    ) {
        super(Property, dataSource.createEntityManager());
    }

    async getListings(getListingsDto: GetListingsDto, userSubscriptions: UserSubscriptionsDto[]): Promise<GetListingsResponseDto> {
        const {
            filteredStatus,
            propertyStatus,
            state,
            propertyValueFrom,
            propertyValueTo,
            limit = 10000,  // default limit if not provided
            offset = 0,     // default offset if not provided
        } = getListingsDto;

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
        const getPropertiesResponse: GetListingObjectDto[] = [];

// Define the statuses and the corresponding property date field names.
        const statusChecks = [
            { dateField: 'comingSoonDate', statusLabel: 'COMING_SOON' },
            { dateField: 'forSaleDate', statusLabel: 'FOR_SALE' },
            { dateField: 'pendingDate', statusLabel: 'PENDING' }
        ];

        for (const property of properties) {
            for (const { dateField, statusLabel } of statusChecks) {
                // Retrieve the date from the property dynamically.
                const statusDate = property[dateField];

                // Only proceed if the date exists.
                if (statusDate) {
                    for (const subscription of userSubscriptions) {
                        // Ensure the subscription is for the same county.
                        if (subscription.countyId === property.countyId.toString()) {
                            // Check if the statusDate falls within the subscription period.
                            if (
                                new Date(subscription.fromDate) <= new Date(statusDate) &&
                                new Date(subscription.toDate) >= new Date(statusDate)
                            ) {
                                // Create a new object instance for each unique property-status combination.
                                const propertyObject = new GetListingObjectDto();

                                propertyObject.id = `${property.id}_${statusLabel}`;
                                propertyObject.filteredStatus = property.filteredStatus;
                                propertyObject.propertyStatusDate = statusDate;

                                if (statusLabel === 'COMING_SOON') {
                                    propertyObject.propertyStatus = PropertyStatus.COMING_SOON;
                                } else if (statusLabel === 'FOR_SALE') {
                                    propertyObject.propertyStatus = PropertyStatus.FOR_SALE;
                                } else if (statusLabel === 'PENDING') {
                                    propertyObject.propertyStatus = PropertyStatus.PENDING;
                                }

                                propertyObject.fullAddress = `${property.streetAddress}, ${property.city}, ${property.state}, ${property.zipcode}`;
                                propertyObject.state = property.state;
                                propertyObject.bedrooms = property.bedrooms;
                                propertyObject.bathrooms = property.bathrooms;
                                propertyObject.price = property.price;
                                propertyObject.homeType = property.homeType;
                                propertyObject.realtorName = property.realtorName;
                                propertyObject.realtorPhone = property.realtorPhone;
                                propertyObject.brokerageName = property.brokerageName;
                                propertyObject.brokeragePhone = property.brokeragePhone;

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

    async listingsExportDetailed(listingsExportDto: ListingsExportDto) {
        const {ids} = listingsExportDto;

        // Parse each id string into its UUID and status parts.
        const parsedIds = ids.map(idString => {
            // Assuming the format is always: uuid_STATUS
            const [uuid, ...statusParts] = idString.split('_');
            const status = statusParts.join('_');
            return {uuid, status};
        });

        // Group the UUIDs by status.
        const comingSoonIds = parsedIds
            .filter(item => item.status === 'COMING_SOON')
            .map(item => item.uuid);
        const forSaleIds = parsedIds
            .filter(item => item.status === 'FOR_SALE')
            .map(item => item.uuid);
        const pendingIds = parsedIds
            .filter(item => item.status === 'PENDING')
            .map(item => item.uuid);

        const statusConfigs = [
            { ids: comingSoonIds, dateField: 'comingSoonDate', status: 'COMING_SOON' },
            { ids: forSaleIds, dateField: 'forSaleDate', status: 'FOR_SALE' },
            { ids: pendingIds, dateField: 'pendingDate', status: 'PENDING' },
        ];

        const result = [];

        for (const config of statusConfigs) {
            if (config.ids.length > 0) {
                const properties: Property[] = await this.find({
                    where: {
                        id: In(config.ids),
                        [config.dateField]: Not(IsNull()),
                    },
                });

                const mappedProperties = properties.map(item => ({
                    propertyId: item.id,
                    // Use the date field specified in the configuration
                    listingStatus: item[config.dateField],
                    listingType: config.status,
                    filteredStatus: item.filteredStatus,
                    streetAddress: item.streetAddress,
                    zipcode: item.zipcode,
                    city: item.city,
                    state: item.state,
                    bedrooms: item.bedrooms,
                    bathrooms: item.bathrooms,
                    price: item.price,
                    homeType: item.homeType,
                    livingAreaValue: item.livingAreaValue,
                    realtorName: item.realtorName,
                    realtorPhone: item.realtorPhone,
                    brokerageName: item.brokerageName,
                    brokeragePhone: item.brokeragePhone,
                    county: item.county,
                    longitude: item.longitude,
                    latitude: item.latitude,
                }));

                // Use spread operator to merge the mapped objects into result array.
                result.push(...mappedProperties);
            }
        }

        return result;
    }

    async listingsExportUsps(listingsExportDto: ListingsExportDto) {
        const {ids} = listingsExportDto;

        // Parse each id string into its UUID and status parts.
        const parsedIds = ids.map(idString => {
            // Assuming the format is always: uuid_STATUS
            const [uuid, ...statusParts] = idString.split('_');
            const status = statusParts.join('_');
            return {uuid, status};
        });

        // Group the UUIDs by status.
        const comingSoonIds = parsedIds
            .filter(item => item.status === 'COMING_SOON')
            .map(item => item.uuid);
        const forSaleIds = parsedIds
            .filter(item => item.status === 'FOR_SALE')
            .map(item => item.uuid);
        const pendingIds = parsedIds
            .filter(item => item.status === 'PENDING')
            .map(item => item.uuid);

        const statusConfigs = [
            { ids: comingSoonIds, dateField: 'comingSoonDate', status: 'COMING_SOON' },
            { ids: forSaleIds, dateField: 'forSaleDate', status: 'FOR_SALE' },
            { ids: pendingIds, dateField: 'pendingDate', status: 'PENDING' },
        ];

        const result = [];

        for (const config of statusConfigs) {
            if (config.ids.length > 0) {
                const properties: Property[] = await this.find({
                    where: {
                        id: In(config.ids),
                        [config.dateField]: Not(IsNull()),
                    },
                });


                const mappedProperties = properties.map(item => {
                    let owner_fullname = "";
                    let current_resident = "";

                    // If property is precisely checked and marked as commercial.
                    if (item.preciselyChecked && item.ownerCommercial) {
                        owner_fullname = "Current";
                        current_resident = "Resident";
                    }
                    // If both owner first name and last name are empty (or blank).
                    else if (
                        (!item.ownerFirstName || item.ownerFirstName.trim() === "") &&
                        (!item.ownerLastName || item.ownerLastName.trim() === "")
                    ) {
                        owner_fullname = "Current";
                        current_resident = "Resident";
                    }
                    // If valid first and last names exist.
                    else if (item.ownerFirstName && item.ownerLastName) {
                        owner_fullname = `${item.ownerFirstName} ${item.ownerLastName}`.trim();
                        current_resident = "Or Current Resident";
                    }

                    return {
                        owner_fullname,
                        current_resident,
                        streetAddress: item.streetAddress,
                        city: item.city,
                        state: item.state,
                        zipcode: item.zipcode,
                    };
                });

                result.push(...mappedProperties);
            }
        }

        return result;
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
