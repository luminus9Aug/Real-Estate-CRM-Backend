import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import  bcrypt from 'bcryptjs';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(tenantId: string): Promise<Record<string, unknown>[]> {
    const users = await this.tenantPrisma.client.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return users.map((u) => this.strip(u));
  }

  async findOne(id: string): Promise<Record<string, unknown>> {
    const user = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.strip(user);
  }

  async create(tenantId: string, dto: CreateUserDto): Promise<Record<string, unknown>> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    try {
      const user = await this.tenantPrisma.client.user.create({
        data: {
          tenantId,
          email: dto.email,
          name: dto.name,
          phone: dto.phone,
          role: dto.role,
          passwordHash,
        },
      });
      return this.strip(user);
    } catch {
      throw new ConflictException('Email already exists');
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<Record<string, unknown>> {
    const existing = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = { ...dto };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      delete data.password;
    }

    const user = await this.tenantPrisma.client.user.update({
      where: { id },
      data: data as never,
    });
    return this.strip(user);
  }

  async softDelete(id: string): Promise<Record<string, unknown>> {
    const existing = await this.tenantPrisma.client.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('User not found');

    const user = await this.tenantPrisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.strip(user);
  }

  async updateLanguage(userId: string, dto: UpdateLanguageDto): Promise<Record<string, unknown>> {
    const user = await this.tenantPrisma.client.user.update({
      where: { id: userId },
      data: { language: dto.language },
    });
    return this.strip(user);
  }

  private strip(user: { passwordHash: string; [k: string]: unknown }): Record<string, unknown> {
    const { passwordHash: _p, ...rest } = user;
    return rest;
  }
}
