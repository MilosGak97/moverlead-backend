import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterResponseDto } from './dto/register-response.dto';
import { RegisterDto } from './dto/register.dto';
import { MessageResponseDto } from '../../dto/message-response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { EmailService } from '../aws/email.service';
import { ValidateUserDto } from './dto/validate-user-dto';
import { User } from '../../entities/user.entity';
import { Request } from 'express';
import { VerifyEmailDto } from './dto/verify-email-dto';
import { WhoAmIResponse } from './dto/who-am-i.response.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Login with a password' })
  @ApiOkResponse({ type: MessageResponseDto })
  async login(@Body() validateUserDto: ValidateUserDto, @Res() res: any) {
    const user: User = await this.authService.validateUser(validateUserDto);
    /*
    const { access_token, refresh_token } = await this.authService.login(
      user.aws,
      user.id,
    );

    // Set the HTTP-only cookie for the access token
    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: true, // Use secure cdeokies in production
      sameSite: 'none', // Adjust as necessary
      maxAge: 60 * 60 * 1000, // 1 hour for access token
    });

    // Set the HTTP-only cookie for the refresh token
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: true, // Use secure cookies in production
      sameSite: 'none', // Adjust as necessary
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for refresh token
    });
    console.log('ACCESS TOKEN IN LOGIN: ' + access_token);
    
    */

    await this.authService.setLoginCookies(user.email, user.id, res);
    return res.json({ message: 'Logged in' });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a user' })
  @ApiOkResponse({ type: RegisterResponseDto })
  async register(
    @Body()
    registerDto: RegisterDto,
    @Res() res: any,
  ): Promise<RegisterResponseDto> {
    const { email, id } = await this.authService.register(registerDto);
    await this.authService.setLoginCookies(email, id, res);
    return res.json({ message: 'Registered and logged in' });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @ApiOperation({ summary: 'Logout' })
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
    return res.json({ message: 'User is logged out.' });
  }

  @Get('who-am-i')
  async getProfile(@Req() req: Request): Promise<WhoAmIResponse> {
    const token = req.cookies['access_token'];
    return await this.authService.whoAmI(token);
  }

  @Post('verify-aws')
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Req() req: Request,
  ) {
    const token = req.cookies['access_token'];
    const pin = verifyEmailDto.pin;
    console.log(pin);
    return await this.authService.verifyEmail(token, verifyEmailDto);
  }
}
