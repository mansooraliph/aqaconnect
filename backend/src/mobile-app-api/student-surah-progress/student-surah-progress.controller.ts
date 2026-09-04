import {
  Body,
  Controller,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { StudentSurahProgressService } from './student-surah-progress.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TypeFilterQueryDto } from './dto/type-filter-query.dto';
import { GetStudentSurahProgressQueryDto } from './dto/get-student-surah-progress-query.dto';
import { BulkMarkCompletedDto } from './dto/bulk-mark-completed.dto';
import { BulkMarkSurahsCompletedDto } from './dto/bulk-mark-surahs-completed.dto';
import { StoreOldLessonProgressDto } from './dto/store-old-lesson-progress.dto';
import { GetOldLessonProgressQueryDto } from './dto/get-old-lesson-progress-query.dto';
import { GetTodayProgressQueryDto } from './dto/get-today-progress-query.dto';
import { GetStudentsTargetQueryDto } from './dto/get-students-target-query.dto';
import { GetFullProgressReportQueryDto } from './dto/get-full-progress-report-query.dto';
import { GetTopStudentsQueryDto } from './dto/get-top-students-query.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';

interface AuthedRequest extends Request {
  user: { userId: string };
}

/** Mirrors legacy `Route::prefix('student-surah-progress')->group(...)`, i.e. `/api/app/student-surah-progress`. */
@Controller('app/student-surah-progress')
@UseGuards(PermissionsGuard)
@RequirePermission('mobile_api.student_surah_progress.access')
@UseInterceptors(MobileApiLoggingInterceptor)
@UsePipes(new MobileValidationPipe())
export class StudentSurahProgressController {
  constructor(
    private readonly service: StudentSurahProgressService,
    private readonly context: MobileContextService,
  ) {}

  private async ownStudentId(req: AuthedRequest): Promise<string> {
    return this.context.resolveOwnStudentId(req.user.userId);
  }

  private async handle<T>(fn: () => Promise<T>, errorPrefix: string | null): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const message = (error as Error).message;
      throw new InternalServerErrorException({
        status: 'error',
        message: errorPrefix ? `${errorPrefix}${message}` : message,
      });
    }
  }

  // ── getSurahProgressList ─────────────────────────────────────────────
  @Get('students/surah-progress-list')
  async getOwnSurahProgressList(@Req() req: AuthedRequest, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(() => this.service.getSurahProgressList(branchId, studentId, query.type), 'Failed to retrieve Surah progress list: ');
  }

  @Get('students/surah-progress-list/:studentId')
  async getSurahProgressList(@Req() req: AuthedRequest, @Param('studentId') studentId: string, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getSurahProgressList(branchId, studentId, query.type), 'Failed to retrieve Surah progress list: ');
  }

  // ── getSurahDetails ──────────────────────────────────────────────────
  @Get('students/surahs/:surahId/details')
  async getOwnSurahDetails(@Req() req: AuthedRequest, @Param('surahId') surahId: string, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(() => this.service.getSurahDetails(branchId, surahId, studentId, query.type), 'Failed to retrieve Surah details: ');
  }

  @Get('students/surahs/:surahId/details/:studentId')
  async getSurahDetails(
    @Req() req: AuthedRequest,
    @Param('surahId') surahId: string,
    @Param('studentId') studentId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getSurahDetails(branchId, surahId, studentId, query.type), 'Failed to retrieve Surah details: ');
  }

  // ── getStudentSurahProgress ──────────────────────────────────────────
  @Get('student')
  async getOwnStudentSurahProgress(@Req() req: AuthedRequest, @Query() query: GetStudentSurahProgressQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(() => this.service.getStudentSurahProgress(branchId, studentId, query), 'Failed to retrieve student Surah progress: ');
  }

  @Get('student/:studentId')
  async getStudentSurahProgress(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: GetStudentSurahProgressQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getStudentSurahProgress(branchId, studentId, query), 'Failed to retrieve student Surah progress: ');
  }

  // ── bulkMarkCompleted ────────────────────────────────────────────────
  // The client only sends multipart/form-data when a remark file is
  // attached (plain JSON otherwise); FileInterceptor must be present
  // either way so Multer parses the text fields when it does. The file
  // itself is received and discarded — no file storage exists yet.
  @Post('bulk-mark-completed')
  @UseInterceptors(FileInterceptor('remark_file'))
  async bulkMarkCompleted(@Req() req: AuthedRequest, @Body() dto: BulkMarkCompletedDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.bulkMarkCompleted(branchId, req.user.userId, dto), 'Failed to mark ayahs as completed: ');
  }

  // ── getPendingSurahList ──────────────────────────────────────────────
  @Get('pending-surah')
  async getOwnPendingSurahList(@Req() req: AuthedRequest, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(() => this.service.getPendingSurahList(branchId, studentId, query.type), 'Failed to retrieve pending surah list: ');
  }

  @Get('pending-surah/:studentId')
  async getPendingSurahList(@Req() req: AuthedRequest, @Param('studentId') studentId: string, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getPendingSurahList(branchId, studentId, query.type), 'Failed to retrieve pending surah list: ');
  }

  // ── bulkMarkSurahsAsCompleted ────────────────────────────────────────
  @Post('student/bulk-mark-surah-completed')
  async bulkMarkSurahsAsCompleted(@Req() req: AuthedRequest, @Body() dto: BulkMarkSurahsCompletedDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.bulkMarkSurahsAsCompleted(branchId, req.user.userId, dto),
      'Failed to bulk mark surahs as completed: ',
    );
  }

  // ── getCompletedSurahList ────────────────────────────────────────────
  @Get('students/completed-surahs')
  async getOwnCompletedSurahList(@Req() req: AuthedRequest, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () => this.service.getCompletedSurahList(branchId, studentId, query.type ?? 'New Lesson'),
      'Failed to retrieve completed Surah list: ',
    );
  }

  @Get('students/completed-surahs/:studentId')
  async getCompletedSurahList(@Req() req: AuthedRequest, @Param('studentId') studentId: string, @Query() query: TypeFilterQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getCompletedSurahList(branchId, studentId, query.type ?? 'New Lesson'),
      'Failed to retrieve completed Surah list: ',
    );
  }

  // ── storeOldLessonProgress ───────────────────────────────────────────
  // The client always sends multipart/form-data here (a remark file is
  // optional but the request shape isn't) — see bulkMarkCompleted above.
  @Post('store-old-lesson')
  @UseInterceptors(FileInterceptor('remark_file'))
  async storeOldLessonProgress(@Req() req: AuthedRequest, @Body() dto: StoreOldLessonProgressDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.storeOldLessonProgress(branchId, req.user.userId, dto), 'Failed to save Old Lesson progress: ');
  }

  // ── getOldLessonProgressList ─────────────────────────────────────────
  @Get('students/old-lesson-progress')
  async getOwnOldLessonProgressList(@Req() req: AuthedRequest, @Query() query: GetOldLessonProgressQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () => this.service.getOldLessonProgressList(branchId, studentId, query),
      'Failed to retrieve Old Lesson progress list: ',
    );
  }

  @Get('students/old-lesson-progress/:studentId')
  async getOldLessonProgressList(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: GetOldLessonProgressQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getOldLessonProgressList(branchId, studentId, query),
      'Failed to retrieve Old Lesson progress list: ',
    );
  }

  // ── getTodayProgress ─────────────────────────────────────────────────
  @Get('students/today-progress')
  async getTodayProgress(@Req() req: AuthedRequest, @Query() query: GetTodayProgressQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getTodayProgress(branchId, query), "Failed to retrieve today's progress: ");
  }

  // ── getStudentsExceededTarget ────────────────────────────────────────
  @Get('students/exceeded-target')
  async getStudentsExceededTarget(@Req() req: AuthedRequest, @Query() query: GetStudentsTargetQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getStudentsExceededTarget(branchId, query),
      'Failed to retrieve students exceeded target: ',
    );
  }

  // ── studentsWithPendingTargets ───────────────────────────────────────
  @Get('students/pending-targets')
  async studentsWithPendingTargets(@Req() req: AuthedRequest, @Query() query: GetStudentsTargetQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    // Legacy's own catch-all here has no message prefix — replicated as-is.
    return this.handle(() => this.service.studentsWithPendingTargets(branchId, query), null);
  }

  // ── getFullProgressReport ────────────────────────────────────────────
  @Get('students/reports')
  async getFullProgressReport(@Req() req: AuthedRequest, @Query() query: GetFullProgressReportQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getFullProgressReport(branchId, query), 'Failed: ');
  }

  // ── getTopStudents ───────────────────────────────────────────────────
  @Get('students/top')
  async getTopStudents(@Req() req: AuthedRequest, @Query() query: GetTopStudentsQueryDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.getTopStudents(branchId, query), 'Failed to retrieve top students: ');
  }

  // ── updateProgress ───────────────────────────────────────────────────
  @Post('update')
  async updateProgress(@Req() req: AuthedRequest, @Body() dto: UpdateProgressDto) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(() => this.service.updateProgress(branchId, req.user.userId, dto), 'Failed to update progress: ');
  }
}
