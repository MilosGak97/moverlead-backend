import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export class ExportResultsDto{
    @ApiProperty()
    @IsNotEmpty()
    result: any;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    countyId: string;
}