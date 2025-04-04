import {ApiProperty} from "@nestjs/swagger";
import {IsNotEmpty, IsString} from "class-validator";
import {Type} from "class-transformer";

export class BrightdataEnrichmentFillerDto {
    @ApiProperty({required: true})
    @IsNotEmpty()
    @IsString()
    @Type((): StringConstructor => String)
    snapshotId: string;
}