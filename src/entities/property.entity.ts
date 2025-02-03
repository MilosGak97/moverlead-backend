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
import { FilteredStatus } from "../api/enums/filtered-status.enum";

@Entity('properties')
export class Property {
  @ApiProperty({ required: true })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: false })
  @Column({ nullable: true })
  county: string;

  @ApiProperty({ required: false })
  @Type(() => String)
  @Column({ nullable: true })
  zpid: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  street_address?: string; // streetAddress

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
  @Column({ nullable: true })
  home_type?: string; // homeType

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  home_status?: string; // homeStatus

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ nullable: true })
  home_status_date?: Date;

  @ApiProperty({ required: false })
  @Type(() => Number)
  @IsOptional()
  @Column({ nullable: true })
  photo_count?: number; // photoCount

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ type: 'json', nullable: true })
  photos?: any[];

  @ApiProperty({ required: false })
  @Type(() => String)
  @Column({ nullable: true })
  parcel_id?: string; // parcelId

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  realtor_name?: string; // listing_provided_by.name

  @ApiProperty({ required: false })
  @Type(() => String)
  @IsOptional()
  @Column({ nullable: true })
  realtor_phone?: string; // listing_provided_by.phone

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  realtor_company?: string; // listing_provided_by.phone_number

  @ApiProperty({ required: false })
  @IsOptional()
  @ManyToMany(() => User, (company) => company.properties)
  @JoinTable()
  users: User[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Column({ nullable: true })
  filtered_status: FilteredStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
