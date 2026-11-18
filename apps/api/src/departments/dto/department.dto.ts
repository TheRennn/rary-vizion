import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MinLength(2) @MaxLength(60)
  name!: string;
}
