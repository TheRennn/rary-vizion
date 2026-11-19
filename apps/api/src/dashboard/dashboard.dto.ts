import { IsIn, IsOptional } from 'class-validator';

export type DashboardPeriod = '7d' | '30d' | '90d';

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period: DashboardPeriod = '30d';
}
