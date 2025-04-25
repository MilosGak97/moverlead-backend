import {
    Body,
    Controller,
    Delete,
    Get, Param,
    Post,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import {ApiOkResponse, ApiOperation} from '@nestjs/swagger';
import {AuthService} from './auth.service';
import {RegisterDto} from './dto/register.dto';
import {MessageResponseDto} from '../../dto/message-response.dto';
import {JwtAuthGuard} from './jwt-auth.guard';
import {EmailService} from '../aws/services/email.service';
import {ValidateUserDto} from './dto/validate-user-dto';
import {User} from '../../entities/user.entity';
import {Request} from 'express';
import {WhoAmIResponse} from './dto/who-am-i.response.dto';
import {ForgotPasswordRequestDto} from "./dto/forgot-password-request.dto";
import {ResetPasswordDto} from "./dto/reset-password.dto";
import {UserId} from "./user-id.decorator";
import {SendVerificationEmailDto} from "./dto/send-verification-email.dto";

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly emailService: EmailService,
    ) {
    }

    @Post()
    @ApiOperation({summary: 'Login with a password'})
    @ApiOkResponse({type: MessageResponseDto})
    async login(@Body() validateUserDto: ValidateUserDto, @Res() res: any) {
        const user: User = await this.authService.validateUser(validateUserDto);

        await this.authService.setLoginCookies(user.email, user.id, res);
        return res.json({message: 'Logged in'});
    }

    @Post('register')
    @ApiOperation({summary: 'Register a user'})
    @ApiOkResponse({type: MessageResponseDto})
    async register(
        @Body()
        registerDto: RegisterDto,
    ): Promise<MessageResponseDto> {
        return await this.authService.register(registerDto);
    }

    @UseGuards(JwtAuthGuard)
    @Post('verify/verify-email')
    @ApiOperation({summary: 'Send a verification email'})
    @ApiOkResponse({type: MessageResponseDto})
    async sendVerificationEmail(@UserId() userId: string) {
        console.log(userId)
        return await this.authService.sendVerificationEmail(userId)
    }

    @Get('verify/verify-email/:token')
    @ApiOperation({summary: 'Endpoint for JWT token from verify email link'})
    @ApiOkResponse({type: MessageResponseDto})
    async verifyEmail(@Param('token') token: string) {
        return await this.authService.verifyEmail(token)
    }

    @Post('forgot-password')
    @ApiOperation({summary: 'Forgot password'})
    @ApiOkResponse({type: MessageResponseDto})
    async forgotPassword(
        @Body() forgotPasswordRequestDto: ForgotPasswordRequestDto,
    ): Promise<MessageResponseDto> {
        return await this.authService.forgotPassword(forgotPasswordRequestDto)
    }

    @Get('reset-password/:token')
    @ApiOperation({summary: 'Reset password validation'})
    @ApiOkResponse({type: MessageResponseDto})
    async forgotPasswordValidation(
        @Param('token') token: string,
        @Res() res: any,
    ): Promise<MessageResponseDto> {
        const {email, id} = await this.authService.forgotPasswordValidation(token)
        await this.authService.setLoginCookies(email, id, res);
        return res.json({message: 'Token is valid. Reset your password'});
    }

    @UseGuards(JwtAuthGuard)
    @Post('reset-password')
    @ApiOperation({summary: 'Reset password after token validation'})
    @ApiOkResponse({type: MessageResponseDto})
    async resetPassword(
        @Body() resetPasswordDto: ResetPasswordDto,
        @UserId() userId: string
    ): Promise<MessageResponseDto> {
        return await this.authService.resetPassword(resetPasswordDto, userId)
    }

    @UseGuards(JwtAuthGuard)
    @Delete('logout')
    @ApiOperation({summary: 'Logout'})
    async logout(@Res() res: any): Promise<{ message: string }> {
        const isProduction = process.env.NODE_ENV === 'production';

        res.clearCookie('access_token', {
            httpOnly: true,
            secure: isProduction, // Secure only in production
            sameSite: isProduction ? 'None' : 'Lax', // 'None' for cross-site cookies, 'Lax' for local dev
        });

        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: isProduction, // Secure only in production
            sameSite: isProduction ? 'None' : 'Lax',
        });
        return res.json({message: 'User is logged out.'});
    }

    @Get('who-am-i')
    @ApiOperation({summary: "who-am-i endpoint"})
    @ApiOkResponse({type: WhoAmIResponse})
    async getProfile(@Req() req: Request): Promise<WhoAmIResponse> {
        const token = req.cookies['access_token'];
        return await this.authService.whoAmI(token);
    }


}
