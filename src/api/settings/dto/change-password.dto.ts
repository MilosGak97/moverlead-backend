import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ChangePasswordDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  password: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  new_password: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  new_password_repeat: string;
}
