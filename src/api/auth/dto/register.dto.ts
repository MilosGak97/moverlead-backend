import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  first_name: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  last_name: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsEmail()
  @Type(() => String)
  email: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  company_name: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  password: string;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  @Type(() => String)
  repeat_password: string;
}
