import { Module } from '@nestjs/common';
import { AcademicSectionsController } from './academic-sections.controller';
import { AcademicSectionsService } from './academic-sections.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AcademicSectionsController],
  providers: [AcademicSectionsService],
  exports: [AcademicSectionsService],
})
export class AcademicSectionsModule {}
