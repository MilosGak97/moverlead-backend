import { ApiProperty } from '@nestjs/swagger';

export class WhoAmIResponse {
  @ApiProperty()
  email: string;

  @ApiProperty()
  id: string;

  @ApiProperty()
  iat: string;

  @ApiProperty()
  exp: string;
}
