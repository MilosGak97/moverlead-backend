import { Injectable, Res } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { UserRepository } from '../../repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../../email/email.service';
import { ValidateUserDto } from './dto/validate-user-dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async setLoginCookies(email: string, id: string, @Res() res: any) {
    const payload = { email: email, sub: id };
    const access_token: string = this.jwtService.sign(payload, {
      expiresIn: '5h',
    });
    const refresh_token: string = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
      maxAge: 5 * 60 * 60 * 1000, // 5 hours
      sameSite: 'Strict',
    });

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Set to true if using HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'Strict',
    });
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
}
