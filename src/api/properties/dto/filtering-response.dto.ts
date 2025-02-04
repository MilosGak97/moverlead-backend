import { ApiProperty } from '@nestjs/swagger';
import { Property } from '../../../entities/property.entity';

export class FilteringResponseDto {
  @ApiProperty({ isArray: true, type: () => [Property] })
  properties: Property[];

  @ApiProperty()
  count: number;
}
