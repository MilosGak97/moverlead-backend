import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsNotEmpty, IsOptional } from 'class-validator';
import { FilteredStatus } from '../enums/filtered-status.enum';
import { County } from './county.entity';
import { User } from './user.entity';

@Entity('properties')
export class Property {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id?: string;

  @ApiProperty({ required: false })
  @ManyToOne(() => County, (county) => county.properties, { nullable: true })
  county?: County;

  @ApiProperty({ required: false })
  @ManyToMany(
    (): typeof User => User,
    (user: User): Property[] => user.properties,
    {
      nullable: true,
    },
  )
  users?: User[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'home_status', nullable: true })
  homeStatus?: string; // homeStatus

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'coming_soon_date', nullable: true })
  comingSoonDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'for_sale_date', nullable: true })
  forSaleDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'pending_date', nullable: true })
  pendingDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'filtered_status', nullable: true })
  filteredStatus?: FilteredStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'filtered_status_date', nullable: true })
  filteredStatusDate?: Date;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsBoolean()
  @Column({ name: 'initial_scrape' })
  initialScrape?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  @Column({ name: 'brightdata_enriched', nullable: true })
  brightdataEnriched?: boolean;

  /* GETTING FROM PRECISELY API */
  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'owner_first_name', nullable: true })
  ownerFirstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'owner_last_name', nullable: true })
  ownerLastName?: string;

  /* GETTING FROM ZILLOW BRIGHT DATA API */
  @ApiProperty({ required: false })
  @Type(() => String)
  @Column({ nullable: true })
  zpid: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'street_address', nullable: true })
  streetAddress?: string; // streetAddress

  @ApiProperty({ required: false })
  @Type(() => String)
  @IsOptional()
  @Column({ nullable: true })
  zipcode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  city?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  state?: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ type: 'float', nullable: true })
  bedrooms?: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ type: 'float', nullable: true })
  bathrooms?: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ nullable: true, type: 'float' })
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'home_type', nullable: true })
  homeType?: string; // homeType

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'is_off_market', nullable: true })
  isOffMarket?: boolean;

  @ApiProperty({ required: false })
  @Type(() => String)
  @Column({ name: 'parcel_id', nullable: true })
  parcelId?: string; // parcelId

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'realtor_name', nullable: true })
  realtorName?: string; // listing_provided_by.name

  @ApiProperty({ required: false })
  @Type(() => String)
  @IsOptional()
  @Column({ name: 'realtor_phone', nullable: true })
  realtorPhone?: string; // listing_provided_by.phone

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'realtor_company', nullable: true })
  realtorCompany?: string; // listing_provided_by.phone_number

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  hasBadGeocode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  isUndisclosedAddress?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  isNonOwnerOccupied?: boolean;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ name: 'living_area_value', nullable: true, type: 'float' })
  livingAreaValue?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'living_area_units_short', nullable: true })
  livingAreaUnitsShort?: string;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ name: 'days_on_zillow', nullable: true })
  daysOnZillow?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'brokerage_name', nullable: true })
  brokerageName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'property_type_dimension', nullable: true })
  propertyTypeDimension?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'hdp_type_dimension', nullable: true })
  hdpTypeDimension?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'listing_type_dimension', nullable: true })
  listingTypeDimension?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  url?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'county_zillow', nullable: true })
  countyZillow?: string;

  @ApiProperty({ required: false })
  @Type((): NumberConstructor => Number)
  @IsOptional()
  @Column({ name: 'photo_count', nullable: true })
  photoCount?: number; // photoCount

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ type: 'json', nullable: true })
  photos?: any[];

  /* DEFAULT */
  @ApiProperty({ required: false })
  @CreateDateColumn({ name: 'created_at' })
  createdAt?: Date;

  @ApiProperty({ required: false })
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt?: Date;
}
