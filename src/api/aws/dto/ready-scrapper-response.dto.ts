import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ReadyScrapperResponseDto{
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    s3Key: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    countyId: string;
}