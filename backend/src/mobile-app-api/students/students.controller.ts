import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { Request } from 'express';
import { MobileStudentsService } from './students.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ClassSectionYearsQueryDto } from './dto/class-section-years-query.dto';
import { AdmissionYearReportQueryDto } from './dto/admission-year-report-query.dto';
import { AcademicClassesQueryDto } from './dto/academic-classes-query.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AddStudentExamDto } from './dto/add-student-exam.dto';
import { UpdateStudentExamDto } from './dto/update-student-exam.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('students')->group(...)`, i.e. `/api/app/students`. */
@Controller('app/students')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.students.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class StudentsController {
  constructor(
    private readonly service: MobileStudentsService,
    private readonly context: MobileContextService,
  ) {}

  @Post()
  @HttpCode(201)
  async createStudent(@Req() req: AuthedRequest, @Body() dto: CreateStudentDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(async () => {
      const data = await this.service.createStudent(branchId, req.user.userId, dto);
      return {
        status: 'success',
        message: `Student created successfully${dto.halqa_id ? ' and assigned to halqa' : ''}`,
        data,
      };
    }, 'Failed to create student');
  }

  @Patch('update/:id')
  async updateStudent(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(async () => {
      const data = await this.service.updateStudent(branchId, req.user.userId, id, dto);
      return { status: 'success', message: 'Student updated successfully', data };
    }, 'Failed to update student');
  }

  @Get(':studentId/details')
  async getStudentDetails(@Req() req: AuthedRequest, @Param('studentId') studentId: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getStudentDetails(branchId, studentId), 'Failed to retrieve student details');
  }

  @Get('academic-class-section-years')
  async getAcademicClassSectionYears(@Req() req: AuthedRequest, @Query() query: ClassSectionYearsQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getAcademicClassSectionYears(branchId, query),
      'Failed to retrieve academic class section years',
    );
  }

  @Get('admission-year-reports')
  async admissionYearReport(@Req() req: AuthedRequest, @Query() query: AdmissionYearReportQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.admissionYearReport(branchId, query), null);
  }

  @Delete('destroy/:id')
  async destroyStudent(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(async () => {
      await this.service.destroyStudent(branchId, id);
      return { status: 'success', message: 'Student deleted successfully' };
    }, 'Failed to delete student');
  }

  @Get('activity-report')
  async getStudentActivityReport(@Req() req: AuthedRequest, @Query() query: ActivityQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getStudentActivityReport(branchId, query),
      'Failed to generate student activity report',
    );
  }

  @Get('academic-classes')
  async getAcademicClasses(@Req() req: AuthedRequest, @Query() query: AcademicClassesQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getAcademicClasses(branchId, query), null);
  }

  @Post('student-exams')
  @HttpCode(201)
  async addStudentExam(@Req() req: AuthedRequest, @Body() dto: AddStudentExamDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.addStudentExam(branchId, dto), 'Failed to add student exam');
  }

  @Patch('update-student-exams/:examId')
  async updateStudentExam(@Req() req: AuthedRequest, @Param('examId') examId: string, @Body() dto: UpdateStudentExamDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.updateStudentExam(branchId, examId, dto), 'Failed to update exam record');
  }

  @Get('student-activity')
  async getStudentActivity(@Req() req: AuthedRequest, @Query() query: ActivityQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getStudentActivity(branchId, query), 'Failed to generate activity report');
  }

  /** `errorPrefix: null` mirrors the two legacy handlers whose catch-all just echoes `$e->getMessage()` with no prefix. */
  private async handle<T>(fn: () => Promise<T>, errorPrefix: string | null): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = (error as Error).message;
      throw new InternalServerErrorException({
        status: 'error',
        message: errorPrefix ? `${errorPrefix}: ${message}` : message,
      });
    }
  }
}
