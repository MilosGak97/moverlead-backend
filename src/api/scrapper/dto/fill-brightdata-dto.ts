// src/api/property/dto/fill-brightdata.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import {IsOptional, IsString, IsNumber, IsBoolean} from 'class-validator';
import {Type} from "class-transformer";

export class FillBrightdataDto {
    @ApiProperty({ required: true })
    @IsString()
    zpid: string;

    @ApiProperty({ required: true })
    @IsBoolean()
    brightdataEnriched: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    streetAddress?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    zipcode?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    state?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    bedrooms?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    bathrooms?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    price?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    homeType?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    parcelId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    realtorName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    realtorPhone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    brokerageName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    brokeragePhone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    livingAreaValue?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    daysOnZillow?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    propertyTypeDimension?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    countyZillow?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    photoCount?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    photos?: string[];
}
