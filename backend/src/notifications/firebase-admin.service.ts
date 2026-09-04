import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';

/**
 * Thin wrapper around the Firebase Admin SDK. Credentials aren't available
 * in every environment yet (local dev, CI), so initialization is best-effort:
 * missing/invalid config logs a warning once and every send becomes a no-op
 * rather than crashing the app. Notification rows still get written to the
 * DB either way — push delivery is an add-on, not the source of truth.
 *
 * Configure via either:
 *   FIREBASE_SERVICE_ACCOUNT_JSON — the full service-account JSON, inline
 *   FIREBASE_SERVICE_ACCOUNT_PATH — path to a service-account JSON file
 */
@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const inlineJson = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const path = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

    if (!inlineJson && !path) {
      this.logger.warn(
        'Firebase not configured (FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_PATH unset) — push notifications are disabled, in-app notifications still work.',
      );
      return;
    }

    try {
      const raw = inlineJson ? inlineJson : readFileSync(path!, 'utf8');
      const serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
      this.app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      this.logger.log('Firebase Admin initialized — push notifications enabled.');
    } catch (error) {
      this.logger.error(`Failed to initialize Firebase Admin — push notifications disabled: ${(error as Error).message}`);
      this.app = null;
    }
  }

  get isEnabled(): boolean {
    return this.app !== null;
  }

  /** Returns the tokens that Firebase rejected as invalid/unregistered, so callers can prune them. */
  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, unknown>): Promise<string[]> {
    if (!this.app || tokens.length === 0) {
      return [];
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title, body },
      data: data ? this.stringifyData(data) : undefined,
    };

    try {
      const response = await admin.messaging(this.app).sendEachForMulticast(message);
      const invalidTokens: string[] = [];
      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error?.code;
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            invalidTokens.push(tokens[index]);
          } else {
            this.logger.warn(`Push send failed for one token: ${result.error?.message}`);
          }
        }
      });
      return invalidTokens;
    } catch (error) {
      this.logger.error(`Push send failed: ${(error as Error).message}`);
      return [];
    }
  }

  private stringifyData(data: Record<string, unknown>): Record<string, string> {
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]));
  }
}
