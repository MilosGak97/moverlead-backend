import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';
import { User } from './user.entity';
import { FilteredStatus } from '../enums/filtered-status.enum';

@Entity('properties')
export class Property {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'owner_first_name', nullable: true })
  ownerFirstName: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'owner_last_name', nullable: true })
  ownerLastName: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  county: string;

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
  @Column({ nullable: true })
  bedrooms?: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ nullable: true })
  bathrooms?: number;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ nullable: true })
  price?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'home_type', nullable: true })
  homeType?: string; // homeType

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'home_status', nullable: true })
  homeStatus?: string; // homeStatus

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'home_status_date', nullable: true })
  homeStatusDate?: Date;

  @ApiProperty({ required: false })
  @Type((): NumberConstructor => Number)
  @IsOptional()
  @Column({ name: 'photo_count', nullable: true })
  photoCount?: number; // photoCount

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ type: 'json', nullable: true })
  photos?: any[];

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
  @Column({ name: 'realtor_email', nullable: true })
  realtorEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @ManyToMany(() => User, (company) => company.properties)
  @JoinTable()
  users: User[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ name: 'filtered_status', nullable: true })
  filteredStatus: FilteredStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'filtered_status_date', nullable: true })
  filteredStatusDate: Date;

  @ApiProperty({ required: false })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ required: false })
  @UpdateDateColumn()
  updatedAt: Date;
}
