import { Module } from '@nestjs/common';
import { AcademicClassSectionsController } from './academic-class-sections.controller';
import { AcademicClassSectionsService } from './academic-class-sections.service';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AcademicClassSectionsController],
  providers: [AcademicClassSectionsService],
  exports: [AcademicClassSectionsService],
})
export class AcademicClassSectionsModule {}
