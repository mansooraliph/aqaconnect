import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../rbac/access-control.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly accessControl: AccessControlService,
  ) {}

  private hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private accessTokenTtlSeconds(): number {
    const ttl = this.configService.get<string>('JWT_ACCESS_TTL', '15m');
    const match = /^(\d+)m$/.exec(ttl);
    return match ? Number(match[1]) * 60 : 15 * 60;
  }

  private async issueTokenPair(userId: string, username: string): Promise<TokenPair> {
    const payload: Record<string, unknown> = { sub: userId, username };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_TTL', '15m') as never,
    });

    const rawRefreshToken = crypto.randomBytes(48).toString('hex');
    const refreshTtlDays = Number(this.configService.get<string>('JWT_REFRESH_TTL_DAYS', '14'));
    const expiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(rawRefreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessTokenTtlSeconds(),
    };
  }

  async validateUser(username: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      return null;
    }
    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    return passwordMatches ? user : null;
  }

  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(user.id, user.username);
    const accessContext = await this.accessControl.getUserAccessContext(user.id);

    return {
      ...tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        branchId: user.branchId,
        isGlobal: accessContext.isGlobal,
        roles: accessContext.roles,
        permissions: Array.from(accessContext.permissions),
      },
    };
  }

  async refresh(rawRefreshToken: string) {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now() ||
      !existing.user.isActive
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke the presented token so it cannot be replayed, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(existing.user.id, existing.user.username);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (existing && !existing.revokedAt) {
      await this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });
    }
    // Always succeed even if the token was already invalid/unknown — logout is idempotent.
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const accessContext = await this.accessControl.getUserAccessContext(userId);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      branchId: user.branchId,
      isGlobal: accessContext.isGlobal,
      roles: accessContext.roles,
      permissions: Array.from(accessContext.permissions),
    };
  }
}
