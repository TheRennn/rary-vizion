import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../common/domain-types';

export class CreateUserDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @IsString() @MinLength(8) @MaxLength(72)
  password!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional() @IsUUID()
  departmentId?: string;

  @IsOptional() @IsString() @MaxLength(80)
  jobTitle?: string;
}
