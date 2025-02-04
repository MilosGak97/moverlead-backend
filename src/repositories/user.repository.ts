import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { RegisterDto } from '../api/auth/dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ValidateUserDto } from '../api/auth/dto/validate-user-dto';
import { VerifyEmailDto } from '../api/auth/dto/verify-email-dto';
import { MessageResponseDto } from '../dto/message-response.dto';
import { GetCompanyResponseDto } from '../api/settings/dto/get-company-response.dto';
import { ChangePasswordDto } from '../api/settings/dto/change-password.dto';
import { PatchCompanyDto } from '../api/settings/dto/patch-company.dto';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private readonly dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  // used in local.strategy.ts
  async validateUser(validateUserDto: ValidateUserDto): Promise<User> {
    const { email, password } = validateUserDto;
    const user = await this.findOneBy({ email });
    if (!user) {
      throw new HttpException('Check your credentials', HttpStatus.BAD_REQUEST);
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      throw new HttpException('Check your credentials', HttpStatus.BAD_REQUEST);
    }
    return user;
  }

  async register(registerDto: RegisterDto): Promise<{
    email: string;
    id: string;
    email_passcode: string;
  }> {
    if (registerDto.password !== registerDto.repeatPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const userExist: User = await this.findOne({
      where: { email: registerDto.email },
    });
    if (userExist) {
      throw new BadRequestException('User already exists with this email');
    }

    const salt: string = await bcrypt.genSalt(10);
    const hashedPassword: string = await bcrypt.hash(
      registerDto.password,
      salt,
    );
    const emailPasscode: string = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const hashedEmailPasscode: string = await bcrypt.hash(emailPasscode, salt);
    const user = new User();

    const { firstName, lastName, email, companyName } = registerDto;
    Object.assign(user, { firstName, lastName, email, companyName });

    user.isVerified = false;
    user.password = hashedPassword;
    user.emailPasscode = hashedEmailPasscode;
    await this.save(user);
    return {
      id: user.id,
      email: registerDto.email,
      email_passcode: emailPasscode,
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
    userId: string,
  ): Promise<MessageResponseDto> {
    const user = await this.findOne({ where: { id: userId } });
    if (!user) {
      console.log(
        'User is not found in verify email function in user repository.',
      );
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const pin: string = verifyEmailDto.pin;
    const passcodeMatch = await bcrypt.compare(pin, user.emailPasscode);
    if (!passcodeMatch) {
      throw new HttpException('Passcode is not valid.', HttpStatus.BAD_REQUEST);
    }
    user.isVerified = true;
    user.emailPasscode = null;
    await this.save(user);

    return {
      message: 'Email is verified.',
    };
  }

  async getCompany(userId: string): Promise<GetCompanyResponseDto> {
    const user = await this.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    return {
      company_name: user.companyName,
      address: user.address,
      address2: user.address2,
      city: user.city,
      state: user.state,
      zip: user.zip,
      website: user.website,
      phone_number: user.phoneNumber,
    };
  }

  // Change password of user function
  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    const user = await this.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }
    const { password, new_password, new_password_repeat } = changePasswordDto;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new HttpException(
        'Your old password is not correct',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (new_password !== new_password_repeat) {
      throw new HttpException(
        'Password is not matching',
        HttpStatus.BAD_REQUEST,
      );
    }

    user.password = await bcrypt.hash(new_password, 10);
    await this.save(user);
    return {
      message: 'Password changed successfully.',
    };
  }

  async patchCompany(
    userId: string,
    patchCompanyDto: PatchCompanyDto,
  ): Promise<MessageResponseDto> {
    const user = await this.findOne({ where: { id: userId } });
    if (!user) {
      throw new HttpException('User not found', HttpStatus.BAD_REQUEST);
    }

    Object.assign(user, patchCompanyDto);
    await this.save(user);
    return {
      message: 'Successfully updated changed successfully.',
    };
  }
}
