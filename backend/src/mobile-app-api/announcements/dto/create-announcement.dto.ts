import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum AnnouncementAudienceDto {
  ALL = 'ALL',
  TEACHERS = 'TEACHERS',
  STUDENTS = 'STUDENTS',
}

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  // Required for admin-tier callers (Super Admin/Branch Admin/Management), who
  // choose the broadcast audience. Ignored for Teacher callers — their
  // announcements are always scoped to their own Halqa's students server-side.
  @IsOptional()
  @IsEnum(AnnouncementAudienceDto)
  audience?: AnnouncementAudienceDto;

  // Admin-only, optional: narrows a STUDENTS-audience announcement to a
  // single Halqa's roster instead of every branch student. Ignored for any
  // other audience, and ignored entirely for Teacher callers (whose own
  // Halqa is always used).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  halqaIds?: string[];
}
