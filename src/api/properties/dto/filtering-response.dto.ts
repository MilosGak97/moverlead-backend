import { ApiProperty } from '@nestjs/swagger';
import { Property } from '../../../entities/property.entity';

export class FilteringResponseDto {
  @ApiProperty()
  properties: Property[];

  @ApiProperty()
  count: number;
}
