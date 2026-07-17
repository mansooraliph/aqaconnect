import { PartialType } from '@nestjs/mapped-types';
import { CreateSurahDto } from './create-surah.dto';

export class UpdateSurahDto extends PartialType(CreateSurahDto) {}
