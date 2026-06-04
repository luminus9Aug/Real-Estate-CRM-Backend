import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { SupportedLanguage, SubscriptionStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { I18nService } from "nestjs-i18n";
import { PrismaService } from "../../prisma/prisma.service";
import type { AccessTokenPayload } from "../../types/jwt-payload";
import { LoginDto } from "./dto/login.dto";
import { SignupDto } from "./dto/signup.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AuthEmailProducer } from "../../queues/auth-email/auth-email.producer";
import { UserRole } from "../../common/constants/roles.constants";
import type Redis from "ioredis";
import { REDIS } from "../../redis/redis.module";
import { CACHE_KEYS } from "../../common/constants/app.constants";
import { randomUUID } from "crypto";

const BCRYPT_ROUNDS = 10;
const OTP_TTL_SECONDS = 300;
const RESET_SESSION_TTL_SECONDS = 600;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly authEmailProducer: AuthEmailProducer,
  ) {}

  async signup(dto: SignupDto, res: Response): Promise<{ wsToken: string }> {
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    if (existing) {
      throw new ConflictException(this.i18n.t("auth.subdomain_taken"));
    }

    const freePlan = await this.prisma.plan.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (!freePlan) {
      throw new ConflictException(
        "Starter plan not found. System initialization required.",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenantName,
          subdomain: dto.subdomain,
          defaultLanguage: SupportedLanguage.en,
          supportedLanguages: [SupportedLanguage.en],
          currentPlanId: freePlan.id,
          subscriptionStatus: SubscriptionStatus.TRIAL,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        },
      });

      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenant.id}::text, false)`;

      return tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.ownerEmail,
          name: dto.ownerName,
          role: UserRole.OWNER,
          passwordHash,
          language: SupportedLanguage.en,
          commissionRate: 0,
        },
      });
    });

    await this.setAuthCookies(res, user);
    const wsToken = this.signWsToken(user.id, user.tenantId!);
    return { wsToken };
  }

  async login(dto: LoginDto, res: Response): Promise<{ wsToken: string }> {
    let user;

    // Handle SuperAdmin Login (Global)
    if (!dto.subdomain || dto.subdomain === "admin") {
      user = await this.prisma.user.findFirst({
        where: {
          email: dto.email,
          role: UserRole.SUPER_ADMIN,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException(
          this.i18n.t("auth.invalid_credentials"),
        );
      }
    } else {
      // Standard Tenant Login
      const tenant = await this.prisma.tenant.findUnique({
        where: { subdomain: dto.subdomain },
      });
      if (!tenant) {
        throw new UnauthorizedException(
          this.i18n.t("auth.invalid_credentials"),
        );
      }

      user = await this.prisma.user.findFirst({
        where: {
          tenantId: tenant.id,
          email: dto.email,
          deletedAt: null,
          isActive: true,
        },
      });
    }

    if (!user) {
      throw new UnauthorizedException(this.i18n.t("auth.invalid_credentials"));
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException(this.i18n.t("auth.invalid_credentials"));
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.setAuthCookies(res, user);
    const wsToken = this.signWsToken(user.id, user.tenantId ?? "");
    return { wsToken };
  }

  logout(req: Request, res: Response): void {
    const token = req.cookies?.jwt as string | undefined;
    if (token) {
      try {
        const payload = this.jwt.verify<AccessTokenPayload>(token, {
          secret: this.config.getOrThrow<string>("jwt.secret"),
        });
        if (payload.jti) {
          const blockKey = CACHE_KEYS.jwtBlocklist(payload.jti);
          this.redis.setex(blockKey, 604800, "blocked").catch(() => {});
        }
      } catch {
        // Ignored
      }
    }
    const secure = process.env.NODE_ENV === "production";
    res.clearCookie("jwt", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
    res.clearCookie("refresh", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
    });
  }

  async refresh(
    res: Response,
    refreshToken?: string,
  ): Promise<{ wsToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    let payload: AccessTokenPayload;
    try {
      payload = this.jwt.verify<AccessTokenPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>("jwt.refreshSecret"),
      });
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    await this.setAuthCookies(res, user);
    return { wsToken: this.signWsToken(user.id, user.tenantId ?? "") };
  }

  async me(
    userId: string,
    tenantId?: string,
  ): Promise<Record<string, unknown>> {
    const where: { id: string; deletedAt: null; tenantId?: string } = {
      id: userId,
      deletedAt: null,
    };
    if (tenantId) where.tenantId = tenantId;

    const user = await this.prisma.user.findFirst({ where });

    if (!user) {
      throw new UnauthorizedException();
    }
    return this.stripUser(user);
  }

  private stripUser(user: {
    passwordHash: string;
    [k: string]: unknown;
  }): Record<string, unknown> {
    const { passwordHash: _removed, ...rest } = user;
    return rest;
  }

  private async setAuthCookies(
    res: Response,
    user: { id: string; tenantId: string | null; role: string; email: string },
  ): Promise<void> {
    const access = this.signAccess(user);
    const refresh = this.signRefresh(user);
    const secure = process.env.NODE_ENV === "production";
    const maxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie("jwt", access, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    res.cookie("refresh", refresh, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });
  }

  private signAccess(user: {
    id: string;
    tenantId: string | null;
    role: string;
    email: string;
  }): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as import("../../modules/auth/types/auth-user.type").AuthUser["role"],
      email: user.email,
      jti: randomUUID(),
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("jwt.secret"),
      expiresIn: "7d",
    });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    console.log("[DEBUG] forgotPassword input:", dto);
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain: dto.subdomain },
    });
    const successResult = {
      message: "If the email exists, an OTP has been sent.",
    };
    if (!tenant) {
      console.debug("[DEBUG] Tenant not found for subdomain:", dto.subdomain);
      return successResult;
    }
    console.debug("[DEBUG] Tenant found:", tenant.id);

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email: { equals: dto.email, mode: "insensitive" },
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      console.debug(
        "[DEBUG] User not found for email:",
        dto.email,
        "in tenant:",
        tenant.id,
      );
      return successResult;
    }
    console.debug("[DEBUG] User found:", user.id, user.email);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = CACHE_KEYS.otpCode(dto.email, dto.subdomain);
    await this.redis.set(otpKey, otp, "EX", OTP_TTL_SECONDS);
    console.debug("[DEBUG] OTP stored in Redis:", otpKey, otp);

    await this.authEmailProducer.enqueueOtp({
      email: user.email,
      name: user.name,
      otp,
      expiresInMinutes: 5,
    });
    console.debug("[DEBUG] OTP email enqueued successfully");

    return successResult;
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ resetToken: string }> {
    const otpKey = CACHE_KEYS.otpCode(dto.email, dto.subdomain);
    const cachedOtp = await this.redis.get(otpKey);

    if (!cachedOtp || cachedOtp !== dto.otp) {
      throw new BadRequestException("Invalid or expired OTP verification code");
    }

    await this.redis.del(otpKey);

    const resetToken = randomUUID();
    const sessionKey = CACHE_KEYS.resetSession(resetToken);
    const sessionData = JSON.stringify({
      email: dto.email,
      subdomain: dto.subdomain,
    });
    await this.redis.set(
      sessionKey,
      sessionData,
      "EX",
      RESET_SESSION_TTL_SECONDS,
    );

    return { resetToken };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const sessionKey = CACHE_KEYS.resetSession(dto.token);
    const sessionData = await this.redis.get(sessionKey);

    if (!sessionData) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const { email, subdomain } = JSON.parse(sessionData);
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (!tenant) {
      throw new BadRequestException("Invalid tenant subdomain");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        email,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!user) {
      throw new BadRequestException("User not found");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await this.redis.del(sessionKey);
    await this.redis.del(CACHE_KEYS.user(tenant.id, user.id));

    return { message: "Password reset successful" };
  }

  private signRefresh(user: {
    id: string;
    tenantId: string | null;
    role: string;
    email: string;
  }): string {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role as import("../../modules/auth/types/auth-user.type").AuthUser["role"],
      email: user.email,
    };
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>("jwt.refreshSecret"),
      expiresIn: "30d",
    });
  }

  private signWsToken(userId: string, tenantId: string): string {
    return this.jwt.sign(
      { sub: userId, tenantId },
      {
        expiresIn: "24h",
        secret: this.config.getOrThrow<string>("jwt.wsSecret"),
      },
    );
  }
}
