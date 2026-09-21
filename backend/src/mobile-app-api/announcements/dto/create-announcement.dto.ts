import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsEnum(AnnouncementAudienceDto)
  audience: AnnouncementAudienceDto;
}
