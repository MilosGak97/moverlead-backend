import { ApiProperty } from '@nestjs/swagger';
import { IsDate, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { PropertyStatus } from '../../../enums/property-status.enum';
import { Type } from 'class-transformer';
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
  dateFrom: Date; // check home status date field

  @ApiProperty({ required: false })
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dateTo: Date; // check home status date field
}
