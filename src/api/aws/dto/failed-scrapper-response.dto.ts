import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class FailedScrapperResponseDto{
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    s3Key: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    zillowUrl: string;

    @ApiProperty()
    @IsNotEmpty()
    @IsString()
    countyId: string;
}