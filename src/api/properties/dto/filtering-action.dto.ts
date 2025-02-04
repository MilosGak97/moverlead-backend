import { IsEnum } from 'class-validator';
import { FilteredStatus } from '../../../enums/filtered-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class FilteringActionDto {
  @ApiProperty({ required: false, enum: FilteredStatus })
  @IsEnum(FilteredStatus)
  action: FilteredStatus;
}
