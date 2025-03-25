import { HttpException, HttpStatus, Injectable, Res } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UserRepository } from '../../repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../../aws/email.service';
import { ValidateUserDto } from './dto/validate-user-dto';
import { VerifyEmailDto } from './dto/verify-email-dto';
import { MessageResponseDto } from '../../dto/message-response.dto';
import { WhoAmIResponse } from './dto/who-am-i.response.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async login(email: string, id: string) {
    const payload = { email: email, id: id };
    const access_token: string = this.jwtService.sign(payload, {
      expiresIn: '5h',
    });
    const refresh_token: string = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      access_token: access_token,
      refresh_token: refresh_token,
    };
  }

  async setLoginCookies(email: string, id: string, @Res() res: any) {
    const payload = { email: email, id: id };
    const access_token: string = this.jwtService.sign(payload, {
      expiresIn: '5h',
    });
    const refresh_token: string = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });
    /*
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
*/
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    console.log('REFRESH TOKEN: ' + refresh_token);
  }

  async validateUser(validateUserDto: ValidateUserDto) {
    return this.userRepository.validateUser(validateUserDto);
  }

  async register(registerDto: RegisterDto): Promise<{
    email: string;
    id: string;
  }> {
    const { email, id, email_passcode } =
      await this.userRepository.register(registerDto);
    await this.emailService.sendWelcomeEmail(email, email_passcode);
    return { email, id };
  }

  async showUsers() {
    return await this.userRepository.find();
  }

  async whoAmI(token: string): Promise<WhoAmIResponse> {
    if (!token) {
      throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
    }
    const payload = await this.jwtService.verify(token);
    if (!payload) {
      throw new HttpException('Token not verified', HttpStatus.UNAUTHORIZED);
    }
    return payload;
  }

  async verifyEmail(
    token: string,
    verifyEmailDto: VerifyEmailDto,
  ): Promise<MessageResponseDto> {
    const { id: userId } = await this.whoAmI(token);
    return await this.userRepository.verifyEmail(verifyEmailDto, userId);
  }
}
