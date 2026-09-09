import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class LegalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Public self-service "delete account" flow. Deactivates the login and
   * scrubs contact PII rather than hard-deleting the User row: Employee/
   * Teacher cascade-delete from User in the schema, so a hard delete would
   * destroy real HR/academic records, not just a login.
   */
  async deleteAccount(identifier: string, password: string): Promise<void> {
    const user = await this.authService.validateUser(identifier, password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { isActive: false, email: null, phone: null, whatsapp: null },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
}
