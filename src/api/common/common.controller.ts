import {Body, Controller, Post, Res} from '@nestjs/common';
import {ApiOperation, ApiTags} from "@nestjs/swagger";
import {Public} from "../auth/public.decorator";
import {Response} from "express";
import {ContactFormWebhookDto} from "./dto/contact-form-webhook.dto";
import {SubscribeToBlogDto} from "./dto/susbscribe-to-blog.dto";
import {PostcardFormWebhookDto} from "./dto/postcard-form-webhook.dto";
import {CommonService} from "./common.service";

@ApiTags('common')
@Controller('common')
export class CommonController {
    constructor(private readonly commonService: CommonService) {}
    @Post('webhook/contact-form')
    @ApiOperation({summary: 'General webhook'})
    async contactFormWebhook(@Body() contactFormWebhookDto: ContactFormWebhookDto, @Res() res: Response) {
        console.log('Received form data:', contactFormWebhookDto);
        await this.commonService.contactFormWebhook(contactFormWebhookDto);
        // Save to DB, forward to email, etc.
        res.status(200).json({ message: 'Form received', data: contactFormWebhookDto });
    }

    @Post('webhook/postcard-form')
    @ApiOperation({summary: 'General webhook'})
    async postcardFormWebhook(@Body() postcardFormDto: PostcardFormWebhookDto, @Res() res: Response) {
        console.log('Received form data:', postcardFormDto);
        await this.commonService.postcardFormWebhook(postcardFormDto)
        // Save to DB, forward to email, etc.
        res.status(200).json({ message: 'Form received', data: postcardFormDto });
    }

    @Post('webhook/subscribe-to-blog')
    @ApiOperation({summary: 'General webhook'})
    async subscribeToBlogWebhook(@Body() subscribeToBlogDto: SubscribeToBlogDto, @Res() res: Response) {
        console.log('Received form data:', subscribeToBlogDto);
        await this.commonService.subscribeToBlogWebhook(subscribeToBlogDto);
        // Save to DB, forward to email, etc.
        res.status(200).json({ message: 'Form received', data: subscribeToBlogDto });
    }

}
