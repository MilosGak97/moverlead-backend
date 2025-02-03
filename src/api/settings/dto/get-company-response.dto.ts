import { ApiProperty } from '@nestjs/swagger';

export class GetCompanyResponseDto {
  @ApiProperty()
  company_name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  address2: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  zip: string;

  @ApiProperty()
  website: string;

  @ApiProperty()
  phone_number: string;
}
