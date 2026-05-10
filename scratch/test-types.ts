import type { Request } from 'express';

type UserKeys = keyof Express.User;
const k: UserKeys = 'id';
console.log(k);
