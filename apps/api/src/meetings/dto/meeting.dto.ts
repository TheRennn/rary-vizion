import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateMeetingDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsISO8601() startsAt!: string;
  @Type(() => Number) @IsInt() @Min(15) @Max(480) durationMinutes!: number;
  @IsOptional() @IsIn(['TEAM', 'PRIVATE']) accessMode?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) participantIds?: string[];
}

export class JoinMeetingDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString() @MinLength(10) @MaxLength(10) code!: string;
}
