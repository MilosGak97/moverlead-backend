import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class CheckoutResponseDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  checkoutUrl: string;
}
