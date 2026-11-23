import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators';
import { AuthUser } from '../common/auth-user';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@CurrentUser() user: AuthUser, @Query('q') query: string) {
    return this.searchService.search(user, query);
  }
}
