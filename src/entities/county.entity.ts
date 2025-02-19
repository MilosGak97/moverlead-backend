import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { State } from '../enums/state.enum';
import { Type } from 'class-transformer';
import { Property } from './property.entity';

@Entity('counties')
export class County {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ required: true })
  @IsString()
  @IsNotEmpty()
  @Column()
  name: string;

  @ApiProperty({ required: true, enum: State })
  @IsEnum(State)
  @IsNotEmpty()
  @Column()
  state: State;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Column({ name: 'product_id', nullable: true })
  productId: string; // prod_RiK83a7Vlhb8sf

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @Column({ name: 'price_id', nullable: true })
  priceId: string; //price_1QotUeP0ONo4d0belYeNEfym

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type((): NumberConstructor => Number)
  @Column({ name: 'amount', nullable: true })
  amount: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @OneToMany(() => Property, (properties) => properties.county, {
    nullable: true,
    lazy: true,
  })
  properties?: Property[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Column({ name: 'scrapping_end_date', nullable: true })
  scrappingEndDate: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Column({ name: 'daily_scrapper_link', nullable: true })
  dailyScrapperLink: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Column({ name: 'initial_scrapper_link', nullable: true })
  initialScrapperLink: string;


  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
