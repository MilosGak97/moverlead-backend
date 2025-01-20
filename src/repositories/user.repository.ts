import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { RegisterDto } from '../api/auth/dto/register.dto';
import * as bcrypt from 'bcrypt';
import { ValidateUserDto } from '../api/auth/dto/validate-user-dto';

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
    if (registerDto.password !== registerDto.repeat_password) {
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
    const email_passcode: string = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const hashed_email_passcode: string = await bcrypt.hash(
      email_passcode,
      salt,
    );
    const user = new User();
    user.first_name = registerDto.first_name;
    user.last_name = registerDto.last_name;
    user.company_name = registerDto.company_name;
    user.is_verified = false;
    user.email = registerDto.email;
    user.password = hashedPassword;
    user.email_passcode = hashed_email_passcode;
    await this.save(user);
    return {
      id: user.id,
      email: registerDto.email,
      email_passcode: email_passcode,
    };
  }
}
