import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PropertyStatus } from '../../../enums/property-status.enum';
import { Transform, Type } from 'class-transformer';
import { FilteredStatus } from '../../../enums/filtered-status.enum';

export class GetPropertiesDto {
  @ApiProperty({ required: false })
  @IsEnum(FilteredStatus, { each: true })
  @IsOptional()
  filteredStatus: FilteredStatus[];

  @ApiProperty({ required: false })
  @IsEnum(PropertyStatus, { each: true })
  @IsOptional()
  propertyStatus: PropertyStatus[];

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value])) // Ensure it's always an array
  state: string[];

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  propertyValueFrom: number;

  @ApiProperty({ required: false })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  propertyValueTo: number;

  @ApiProperty({ required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  dateFrom: Date; // check home status date field

  @ApiProperty({ required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value)) // Handle empty string
  dateTo: Date; // check home status date field
}
