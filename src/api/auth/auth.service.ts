import {BadRequestException, HttpException, HttpStatus, Injectable, Res} from '@nestjs/common';
import {RegisterDto} from './dto/register.dto';
import {UserRepository} from '../../repositories/user.repository';
import {JwtService} from '@nestjs/jwt';
import {EmailService} from '../aws/services/email.service';
import {ValidateUserDto} from './dto/validate-user-dto';
import {MessageResponseDto} from '../../dto/message-response.dto';
import {WhoAmIResponse} from './dto/who-am-i.response.dto';
import {ForgotPasswordRequestDto} from "./dto/forgot-password-request.dto";
import {User} from '../../entities/user.entity'
import {ResetPasswordDto} from "./dto/reset-password.dto";
import {SendVerificationEmailDto} from "./dto/send-verification-email.dto";

@Injectable()
export class AuthService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly jwtService: JwtService,
        private readonly emailService: EmailService,
    ) {
    }

    async setLoginCookies(email: string, id: string, @Res() res: any) {
        const payload = {email: email, id: id};
        const access_token: string = this.jwtService.sign(payload, {
            expiresIn: '7d',
        });
        const refresh_token: string = this.jwtService.sign(payload, {
            expiresIn: '7d',
        });

        const isProduction = process.env.NODE_ENV === 'production';

        res.cookie('access_token', access_token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'None' : 'Lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 5 hours
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

    async register(registerDto: RegisterDto): Promise<MessageResponseDto> {
        const {email, id} =
            await this.userRepository.register(registerDto);
        const payload = {
            email: email,
            id: id,
            tokenType: 'emailVerification'
        }
        const registerToken: string = this.jwtService.sign(payload)
        const verifyEmailLink: string = `${process.env.FRONTEND_URL}/verify-email?token=${registerToken}`;
        await this.emailService.sendWelcomeEmail(email, verifyEmailLink);
        return {
            message: "Account has been successfully created, check your email."
        }
    }

    async sendVerificationEmail(userId: string) {

        const user = await this.userRepository.findOne({where: {id: userId}})
        if(!user){
            throw new HttpException('User is not found', HttpStatus.BAD_REQUEST)
        }
        const payload= {
            email: user.email,
            id: user.id,
            tokenType: 'emailVerification'
        }
        const emailVerificationToken: string = this.jwtService.sign(payload)
        const verifyEmailLink: string = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
    await this.emailService.resendEmailVerification(user.email, verifyEmailLink)
        return {
        message: "Verification email is successfully sent."
        }

    }

    async verifyEmail(token: string): Promise<MessageResponseDto> {
        const {id, tokenType} = await this.jwtService.verify(token)

        if (!id) {
            throw new HttpException('Invalid or expired token', HttpStatus.BAD_REQUEST)
        }
        if (tokenType !== 'emailVerification') {
            throw new HttpException('Invalid or expired token', HttpStatus.BAD_REQUEST)
        }

        return this.userRepository.verifyEmail(id)

    }


    async forgotPassword(forgotPasswordRequestDto: ForgotPasswordRequestDto) {
        const {email} = forgotPasswordRequestDto;
        const user: User = await this.userRepository.findOne({where: {email}});
        if (!user) {
            throw new BadRequestException('User with provided email does not exist');
        }
        const payload = {email: email, id: user.id, tokenType: 'forgotPassword'};
        const resetPasswordToken: string = this.jwtService.sign(payload, {
            expiresIn: '24h',
        });
        const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;
        await this.emailService.forgotPasswordEmail(email, resetLink);
        return {
            message: "Password reset link is successfully sent"
        }
    }

    async forgotPasswordValidation(token: string) {
        const {id, tokenType} = await this.jwtService.verify(token)
        if (!id) {
            throw new BadRequestException('Invalid or expired token');
        }
        if (tokenType !== 'forgotPassword') {
            throw new BadRequestException('Invalid or expired token');
        }
        const {email} = await this.userRepository.forgotPasswordValidation(id)
        return {email, id};
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto, userId: string) {
        return await this.userRepository.resetPassword(resetPasswordDto, userId);
    }

    async whoAmI(token: string): Promise<WhoAmIResponse> {
        if (!token) {
            throw new HttpException('Token not provided', HttpStatus.UNAUTHORIZED);
        }
        const payload = await this.jwtService.verify(token);
        if (!payload) {
            throw new HttpException('Token not verified', HttpStatus.UNAUTHORIZED);
        }
        const {id} = payload;
        const user: User = await this.userRepository.findOne({where: {id: id}});
        if (!user) {
            throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
        }
        return {
            email: user.email,
            companyName: user.companyName,
            logoUrl: user.logoUrl,
            status: user.status,
            id: user.id,
            iat: payload.iat,
            exp: payload.exp,
        }
    }

}
