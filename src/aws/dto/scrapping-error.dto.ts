import { ApiProperty } from '@nestjs/swagger';

export class ScrappingErrorDto {
  @ApiProperty()
  error: any;

  @ApiProperty()
  countyId: string;

  @ApiProperty()
  key: string;
}
