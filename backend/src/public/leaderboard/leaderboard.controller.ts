import { Controller, Get, Param, Query } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { Public } from '../../common/decorators/public.decorator';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/** Unauthenticated — meant to be opened directly on a branch's TV/kiosk display. */
@Controller('public/leaderboard')
@Public()
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  @Get(':branchId')
  get(@Param('branchId') branchId: string, @Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : DEFAULT_LIMIT;
    const safeLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : DEFAULT_LIMIT;
    return this.service.getLeaderboard(branchId, safeLimit);
  }
}
