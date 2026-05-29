import { registerAs } from '@nestjs/config';

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET ?? '',
  refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
  wsSecret: process.env.WS_SECRET ?? '',
  accessExpires: '7d',
  refreshExpires: '30d',
  wsExpires: '24h',
}));
