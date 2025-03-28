import { ApiProperty } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { County } from "src/entities/county.entity";

export class CreatePropertyDto {
  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  zpid: string;

  
  @ApiProperty({ required: true })
  @IsNotEmpty()
  county: County;

  @ApiProperty({ required: true })
  @IsNotEmpty()
  @IsString()
  homeStatus: string; // ForSale | ComingSoon | Pending

  @ApiProperty()
  @IsNotEmpty()
  @IsBoolean()
  initialScrape: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  comingSoonDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  forSaleDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  pendingDate?: Date;
}
