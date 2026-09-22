import { PartialType } from '@nestjs/mapped-types';
import { CreateMasterAcademicYearDto } from './create-master-academic-year.dto';

export class UpdateMasterAcademicYearDto extends PartialType(CreateMasterAcademicYearDto) {}
