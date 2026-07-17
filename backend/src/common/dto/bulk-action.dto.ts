import { IsArray, IsIn, IsString } from 'class-validator';

export class BulkActionDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsIn(['activate', 'deactivate', 'delete'])
  action: 'activate' | 'deactivate' | 'delete';
}
