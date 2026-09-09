import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { LegalService } from './legal.service';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { PRIVACY_POLICY_HTML } from './pages/privacy-policy.html';
import { TERMS_HTML } from './pages/terms.html';
import { DELETE_ACCOUNT_HTML } from './pages/delete-account.html';

/**
 * Public, unauthenticated pages required for app-store submission
 * (Privacy Policy, Terms & Conditions, account deletion). Mounted at the
 * root path (excluded from the global "api" prefix in main.ts) so they're
 * reachable at clean top-level URLs.
 */
@Controller()
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Public()
  @Get('privacy-policy')
  privacyPolicy(@Res() res: Response) {
    res.type('html').send(PRIVACY_POLICY_HTML);
  }

  @Public()
  @Get('terms-conditions')
  terms(@Res() res: Response) {
    res.type('html').send(TERMS_HTML);
  }

  @Public()
  @Get('delete-account')
  deleteAccountPage(@Res() res: Response) {
    res.type('html').send(DELETE_ACCOUNT_HTML);
  }

  @Public()
  @Post('account/delete-request')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Body() dto: DeleteAccountDto) {
    try {
      await this.legalService.deleteAccount(dto.email, dto.password);
    } catch {
      // Deliberately generic: avoids leaking whether the identifier exists.
      throw new UnauthorizedException('Invalid username or password');
    }
    return { message: 'Account deactivated' };
  }
}
