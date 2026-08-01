import { ArrayMinSize, IsArray, IsDateString, IsString } from 'class-validator';

export class GenerateSchedulesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  studentIds: string[];

  @IsDateString()
  startDate: string;
}
