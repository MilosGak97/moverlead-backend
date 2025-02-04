import { ApiProperty } from '@nestjs/swagger';
import { Property } from '../../../entities/property.entity';

export class FilteringResponseDto {
  @ApiProperty({ isArray: true, enum: Property })
  properties: Property[];

  @ApiProperty()
  count: number;
}
