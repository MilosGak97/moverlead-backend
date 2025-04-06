import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    ManyToMany, JoinColumn,
} from 'typeorm';
import {ApiProperty} from '@nestjs/swagger';
import {Type} from 'class-transformer';
import {IsBoolean, IsDate, IsNotEmpty, IsOptional} from 'class-validator';
import {FilteredStatus} from '../enums/filtered-status.enum';
import {County} from './county.entity';
import {User} from './user.entity';

@Entity('properties')
export class Property {
    @ApiProperty({required: true})
    @PrimaryGeneratedColumn('uuid')
    id?: string;

    @ApiProperty({required: false})
    @ManyToOne(() => County, (county) => county.properties, {nullable: true})
    @JoinColumn({name: 'countyId'})
    county?: County;

    @Column({nullable: true})
    countyId?: number;

    // ???
    @ApiProperty({required: false})
    @ManyToMany(
        (): typeof User => User,
        (user: User): Property[] => user.properties,
        {
            nullable: true,
        },
    )
    users?: User[];

    // ???
    /*
    @ApiProperty({ required: false })
    @IsOptional()
    @Column({ name: 'home_status', nullable: true })
    homeStatus?: string; // homeStatus
    */


    /* FILLED OUT BY OUR SCRAPPER */
    @ApiProperty({required: false})
    @Type(() => String)
    @Column({nullable: true})
    zpid: string;

    @ApiProperty({required: false})
    @IsOptional()
    @IsDate()
    @Column({name: 'coming_soon_date', nullable: true})
    comingSoonDate?: Date;

    @ApiProperty({required: false})
    @IsOptional()
    @IsDate()
    @Column({name: 'for_sale_date', nullable: true})
    forSaleDate?: Date;

    @ApiProperty({required: false})
    @IsOptional()
    @IsDate()
    @Column({name: 'pending_date', nullable: true})
    pendingDate?: Date;

    @ApiProperty({required: true})
    @IsNotEmpty()
    @IsBoolean()
    @Column({name: 'initial_scrape'})
    initialScrape?: boolean;


    // THIS IS TEMPORARY, NEED TO CHANGE TO ANOTHER TABLE FOR EACH USER
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'filtered_status', nullable: true})
    filteredStatus?: FilteredStatus;

    @ApiProperty({required: false})
    @IsOptional()
    @IsDate()
    @Column({name: 'filtered_status_date', nullable: true})
    filteredStatusDate?: Date;

    /* GETTING FROM PRECISELY API */
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'precisely_checked', nullable: true})
    preciselyChecked?: boolean;

    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'owner_first_name', nullable: true})
    ownerFirstName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'owner_last_name', nullable: true})
    ownerLastName?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'owner_commercial', nullable: true})
    ownerCommercial?: boolean;

    /* GETTING FROM ZILLOW BRIGHT DATA API */
    @ApiProperty({required: false})
    @IsOptional()
    @IsBoolean()
    @Column({name: 'brightdata_enriched', nullable: true})
    brightdataEnriched?: boolean;

    // getting it when sending request to brightdata
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'brightdata_snapshot', nullable: true})
    brightdataSnapshot?: string;

    // address.street_address
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'street_address', nullable: true})
    streetAddress?: string; // streetAddress

    // address.zipcode
    @ApiProperty({required: false})
    @Type(() => String)
    @IsOptional()
    @Column({nullable: true})
    zipcode?: string;

    //  address.city
    @ApiProperty({required: false})
    @IsOptional()
    @Column({nullable: true})
    city?: string;

    //  address.state
    @ApiProperty({required: false})
    @IsOptional()
    @Column({nullable: true})
    state?: string;

    // bedrooms
    @ApiProperty({required: false})
    @Type(() => Number)
    @IsOptional()
    @Column({type: 'float', nullable: true})
    bedrooms?: number;

    // bathrooms
    @ApiProperty({required: false})
    @Type(() => Number)
    @IsOptional()
    @Column({type: 'float', nullable: true})
    bathrooms?: number;

    // price
    @ApiProperty({required: false})
    @Type(() => Number)
    @IsOptional()
    @Column({nullable: true, type: 'float'})
    price?: number;

    // home_type
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'home_type', nullable: true})
    homeType?: string; // homeType

    // parcel_id
    @ApiProperty({required: false})
    @Type(() => String)
    @Column({name: 'parcel_id', nullable: true})
    parcelId?: string; // parcelId

    // attribution_info.agent_name
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'realtor_name', nullable: true})
    realtorName?: string; // listing_provided_by.name

    // attribution_info.agent_phone_number
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'realtor_phone', nullable: true})
    realtorPhone?: string; // listing_provided_by.name

    // attribution_info.broker_name
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'brokerage_name', nullable: true})
    brokerageName?: string;

    // attribution_info.broker_phone_number
    @ApiProperty({required: false})
    @Type(() => String)
    @IsOptional()
    @Column({name: 'brokerage_phone', nullable: true})
    brokeragePhone?: string;

    // longitude
    @ApiProperty({required: false})
    @IsOptional()
    @Column({type: 'float', nullable: true})
    longitude?: number;

    // latitude
    @ApiProperty({required: false})
    @IsOptional()
    @Column({type: 'float', nullable: true})
    latitude?: number;


    // living_area_value
    @ApiProperty({required: false})
    @Type(() => Number)
    @IsOptional()
    @Column({name: 'living_area_value', nullable: true, type: 'float'})
    livingAreaValue?: number;

    // days_on_zillow
    @ApiProperty({required: false})
    @Type(() => Number)
    @IsOptional()
    @Column({name: 'days_on_zillow', nullable: true})
    daysOnZillow?: number;

    // ??
    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'property_type_dimension', nullable: true})
    propertyTypeDimension?: string;

    @ApiProperty({required: false})
    @IsOptional()
    @Column({name: 'county_zillow', nullable: true})
    countyZillow?: string;

    // photo_count
    @ApiProperty({required: false})
    @Type((): NumberConstructor => Number)
    @IsOptional()
    @Column({name: 'photo_count', nullable: true})
    photoCount?: number; // photoCount

    // original_photos.[0-foreach].mixed_sources.jpeg.[0-static].url
    @ApiProperty({required: false})
    @IsOptional()
    @Column({type: 'json', nullable: true})
    photos?: any[];

    /* DEFAULT */
    @ApiProperty({required: false})
    @CreateDateColumn({name: 'created_at'})
    createdAt?: Date;

    @ApiProperty({required: false})
    @UpdateDateColumn({name: 'updated_at'})
    updatedAt?: Date;
}
