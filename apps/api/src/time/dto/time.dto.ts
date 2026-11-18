import { TimeEntryType } from '../../common/domain-types';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ClockDto {
  @IsEnum(TimeEntryType)
  type!: TimeEntryType;

  @IsOptional() @IsString() @MaxLength(200)
  note?: string;
}

export class HistoryQueryDto {
  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;
}
