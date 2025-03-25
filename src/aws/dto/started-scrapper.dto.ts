import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartedScrapperDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  key: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  countyId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  zillowUrl: string;
}
