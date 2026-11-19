import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateConversationDto {
  @IsUUID()
  targetUserId!: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

export class ListMessagesQueryDto {
  @IsOptional()
  @IsUUID()
  before?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class SearchMessagesQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
