import { PartialType } from '@nestjs/mapped-types';
import { CreateSurahAyahPageLineDto } from './create-surah-ayah-page-line.dto';

export class UpdateSurahAyahPageLineDto extends PartialType(CreateSurahAyahPageLineDto) {}
