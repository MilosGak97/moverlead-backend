import { ApiProperty } from '@nestjs/swagger';
import { Property } from '../../../entities/property.entity';
import { IsArray } from 'class-validator';

export class FilteringResponseDto {
  @ApiProperty({ type: [Property] })
  @IsArray()
  properties: Property[];

  @ApiProperty()
  count: number;
}
