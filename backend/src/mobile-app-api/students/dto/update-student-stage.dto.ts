import { IsIn } from 'class-validator';

export class UpdateStudentStageDto {
  @IsIn(['STAGE_3', 'STAGE_4'])
  stage: 'STAGE_3' | 'STAGE_4';
}
