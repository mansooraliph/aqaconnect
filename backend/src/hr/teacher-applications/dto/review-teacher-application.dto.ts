import { IsOptional, IsString } from 'class-validator';

export class ReviewTeacherApplicationDto {
  @IsOptional()
  @IsString()
  reviewNote?: string;
}

export class RejectTeacherApplicationDto {
  @IsString()
  reviewNote: string;
}
