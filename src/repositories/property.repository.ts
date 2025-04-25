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
import {County} from "../entities/county.entity";

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

        // assign date values that user wants to see listings for
        let dateFrom = getListingsDto.dateFrom;
        let dateTo = getListingsDto.dateTo;

        if (dateFrom) {
            dateFrom = new Date(dateFrom); // now it's a Date object
            console.log('dateFrom:', dateFrom)
            console.log("dateFrom (UTC):", dateFrom.toISOString());
        }
else {
            const now = new Date();
            dateFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        }


        if (dateTo) {
            dateTo = new Date(dateTo); // no rounding, just parsing
            console.log('dateTo:', dateTo)
            console.log("dateTo (UTC):", dateTo.toISOString());
        }else {
            const d = new Date();
            dateTo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
        }


        // Then use dateFrom and dateTo in your query:
        queryBuilder.andWhere(`
          (
            properties.comingSoonDate BETWEEN :dateFrom AND :dateTo
            OR properties.forSaleDate BETWEEN :dateFrom AND :dateTo
            OR properties.pendingDate BETWEEN :dateFrom AND :dateTo
          )
        `, {dateFrom, dateTo});


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
        queryBuilder.andWhere('properties.enriched = true');

        // Additional filters
        if (filteredStatus) {
            const filteredStatusArray = Array.isArray(filteredStatus)
                ? filteredStatus
                : [filteredStatus];
            queryBuilder.andWhere('properties.filteredStatus IN (:...filteredStatusArray)', {
                filteredStatusArray,
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
/*
// Define the statuses and the corresponding property date field names.
        const statusChecks = [
            {dateField: 'comingSoonDate', statusLabel: 'COMING_SOON'},
            {dateField: 'forSaleDate', statusLabel: 'FOR_SALE'},
            {dateField: 'pendingDate', statusLabel: 'PENDING'}
        ];

        for (const property of properties) {
            for (const {dateField, statusLabel} of statusChecks) {
                // Retrieve the date from the property dynamically.
                const statusDate = property[dateField];

                if (
                    statusDate &&
                    dateFrom <= new Date(statusDate) &&
                    dateTo >= new Date(statusDate)
                ) {
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

                                if (!property.ownerFirstName && !property.ownerLastName) {
                                    if (property.preciselyChecked) {
                                        propertyObject.fullName = 'No data found';
                                    } else {
                                        propertyObject.fullName = 'Not checked';
                                    }

                                } else {
                                    propertyObject.fullName = `${property.ownerFirstName} ${property.ownerLastName}`;
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
                                break;
                            }
                        }
                    }
                }
            }
        }
*/
// Normalize to array if provided, otherwise undefined
        const propertyStatusArray = propertyStatus
            ? Array.isArray(propertyStatus)
                ? propertyStatus
                : [propertyStatus]
            : undefined;

        const statusChecks = [
            { dateField: 'comingSoonDate', statusLabel: 'COMING_SOON' },
            { dateField: 'forSaleDate', statusLabel: 'FOR_SALE' },
            { dateField: 'pendingDate', statusLabel: 'PENDING' },
        ];

        for (const property of properties) {
            for (const { dateField, statusLabel } of statusChecks) {
                const statusDate = property[dateField];

                const isStatusAllowed =
                    !propertyStatusArray || propertyStatusArray.includes(statusLabel as PropertyStatus);


                if (
                    statusDate &&
                    isStatusAllowed &&
                    dateFrom <= new Date(statusDate) &&
                    dateTo >= new Date(statusDate)
                ) {
                    for (const subscription of userSubscriptions) {
                        if (subscription.countyId === property.countyId.toString()) {
                            if (
                                new Date(subscription.fromDate) <= new Date(statusDate) &&
                                new Date(subscription.toDate) >= new Date(statusDate)
                            ) {
                                const propertyObject = new GetListingObjectDto();

                                propertyObject.id = `${property.id}_${statusLabel}`;
                                propertyObject.filteredStatus = property.filteredStatus;
                                propertyObject.propertyStatusDate = statusDate;
                                propertyObject.propertyStatus = PropertyStatus[statusLabel];

                                if (!property.ownerFirstName && !property.ownerLastName) {
                                    propertyObject.fullName = property.preciselyChecked
                                        ? 'No data found'
                                        : 'Not checked';
                                } else {
                                    propertyObject.fullName = `${property.ownerFirstName} ${property.ownerLastName}`;
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
                                break;
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

    async getListingsChicago(getListingsDto: GetListingsDto, counties: County[]): Promise<GetListingsResponseDto> {
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

        // assign date values that user wants to see listings for
        let dateFrom = getListingsDto.dateFrom;
        let dateTo = getListingsDto.dateTo;

        // Normalize dateFrom: if provided, set time to midnight; if not, default to today's midnight.
        if (dateFrom) {
            // Parse the date and reset the time to midnight.
            const parsedDateFrom = new Date(dateFrom);
            dateFrom = new Date(parsedDateFrom.getFullYear(), parsedDateFrom.getMonth(), parsedDateFrom.getDate());
        } else {
            const now = new Date();
            dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }

        // Normalize dateTo: if provided, set time to end-of-day; if not, default to today's end-of-day.
        if (dateTo) {
            // Parse the date and set time to 23:59:59.999.
            const parsedDateTo = new Date(dateTo);
            dateTo = new Date(parsedDateTo.getFullYear(), parsedDateTo.getMonth(), parsedDateTo.getDate(), 23, 59, 59, 999);
        } else {
            const now = new Date();
            dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }

        // Filter by countyId using IN
        const countyIds = counties.map((county) => county.id);
        if (countyIds.length > 0) {
            queryBuilder.andWhere('properties.countyId IN (:...countyIds)', {countyIds});
        }

        // Filter by status dates
        queryBuilder.andWhere(`
      (
        properties.comingSoonDate BETWEEN :dateFrom AND :dateTo
        OR properties.forSaleDate BETWEEN :dateFrom AND :dateTo
        OR properties.pendingDate BETWEEN :dateFrom AND :dateTo
      )
    `, {dateFrom, dateTo});


        // 👇 Only get properties that are enriched
        queryBuilder.andWhere('properties.enriched = true');

        // Additional filters
        if (filteredStatus) {
            const filteredStatusArray = Array.isArray(filteredStatus)
                ? filteredStatus
                : [filteredStatus];
            queryBuilder.andWhere('properties.filteredStatus IN (:...filteredStatusArray)', {
                filteredStatusArray,
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
            {dateField: 'comingSoonDate', statusLabel: 'COMING_SOON'},
            {dateField: 'forSaleDate', statusLabel: 'FOR_SALE'},
            {dateField: 'pendingDate', statusLabel: 'PENDING'}
        ];

        for (const property of properties) {
            for (const {dateField, statusLabel} of statusChecks) {
                // Retrieve the date from the property dynamically.
                const statusDate = property[dateField];

                if (
                    statusDate &&
                    dateFrom <= new Date(statusDate) &&
                    dateTo >= new Date(statusDate)
                ) {
                    for (const county of counties) {
                        // Ensure the subscription is for the same county.
                        if (county.id === property.countyId.toString()) {
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

                            if (!property.ownerFirstName && !property.ownerLastName) {
                                if (property.preciselyChecked) {
                                    propertyObject.fullName = 'No data found';
                                } else {
                                    propertyObject.fullName = 'Not checked';
                                }

                            } else {
                                propertyObject.fullName = `${property.ownerFirstName} ${property.ownerLastName}`;
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
                            break;

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
            {ids: comingSoonIds, dateField: 'comingSoonDate', status: 'COMING_SOON'},
            {ids: forSaleIds, dateField: 'forSaleDate', status: 'FOR_SALE'},
            {ids: pendingIds, dateField: 'pendingDate', status: 'PENDING'},
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
            {ids: comingSoonIds, dateField: 'comingSoonDate', status: 'COMING_SOON'},
            {ids: forSaleIds, dateField: 'forSaleDate', status: 'FOR_SALE'},
            {ids: pendingIds, dateField: 'pendingDate', status: 'PENDING'},
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
                    let zipcode = item.zipcode.toString()

                    if (item.zipcode.length == 4) {
                        zipcode = `0${zipcode}`
                    }
                    return {
                        owner_fullname,
                        current_resident,
                        street_address: item.streetAddress,
                        city: item.city,
                        state: item.state,
                        zipcode: zipcode,
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

        queryBuilder.andWhere('properties.enriched = true');
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


    async filteringChicago(filteringDto: FilteringDto, counties: County[]): Promise<FilteringResponseDto> {

        const {limit = 10000, offset = 0} = filteringDto;
        const limitNumber = Number(limit);
        const offsetNumber = Number(offset);
        // Step 4: Apply similar logic from getProperties
        const queryBuilder = this.createQueryBuilder('properties');
        // Filter by countyId using IN
        const countyIds = counties.map((county) => county.id);
        if (countyIds.length > 0) {
            queryBuilder.andWhere('properties.countyId IN (:...countyIds)', {countyIds});
        }

        queryBuilder.andWhere('properties.enriched = true');
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
        queryBuilder.andWhere('properties.enriched = true');

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
