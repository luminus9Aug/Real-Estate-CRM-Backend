import { Gender, UserRole } from '@prisma/client';

export class AvatarGenerator {
  private static readonly CLOUDINARY_BASE = 'https://res.cloudinary.com/djyry0akx/image/upload/';

  private static readonly AVATARS = [
    { gender: Gender.MALE, role: null, url: 'v1778528424/male-3_gnxbik.png' },
    { gender: Gender.MALE, role: null, url: 'v1778528423/male-1_ewtfzj.png' },
    { gender: Gender.MALE, role: null, url: 'v1778528423/male-2_jrdcrw.png' },
    { gender: Gender.MALE, role: UserRole.OWNER, url: 'v1778528424/male-1-O_h6avsc.png' },
    { gender: Gender.MALE, role: UserRole.MANAGER, url: 'v1778528423/male-1-M_hlpg3q.png' },
    { gender: Gender.FEMALE, role: null, url: 'v1778528422/Female-1_wlgmfw.png' },
    { gender: Gender.FEMALE, role: null, url: 'v1778528423/Female-2_ihd4yz.png' },
    { gender: Gender.FEMALE, role: UserRole.OWNER, url: 'v1778528423/Female-2-O_geewie.png' },
    { gender: Gender.FEMALE, role: UserRole.MANAGER, url: 'v1778528422/Female-1-M_iewdng.png' },
  ];

  /**
   * Generates a random avatar URL based on gender and role.
   * If a role-specific avatar is not found, it falls back to a gender-specific one.
   */
  static generate(gender: Gender, role: UserRole): string {
    // 1. Try to find avatars specifically for this role and gender
    let options = this.AVATARS.filter((a) => a.gender === gender && a.role === role);

    // 2. If no role-specific avatar, fall back to general gender avatars (role === null)
    if (options.length === 0) {
      options = this.AVATARS.filter((a) => a.gender === gender && a.role === null);
    }

    // 3. Last resort: any avatar of that gender
    if (options.length === 0) {
      options = this.AVATARS.filter((a) => a.gender === gender);
    }

    // 4. Default: first male avatar if something goes really wrong
    if (options.length === 0) {
      return `${this.CLOUDINARY_BASE}${this.AVATARS[0].url}`;
    }

    const randomIdx = Math.floor(Math.random() * options.length);
    return `${this.CLOUDINARY_BASE}${options[randomIdx].url}`;
  }
}
