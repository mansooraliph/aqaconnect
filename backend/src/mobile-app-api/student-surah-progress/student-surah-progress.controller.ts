import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { extname } from 'path';
import { mkdirSync } from 'fs';
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
import { GetAttendanceReportQueryDto } from './dto/get-attendance-report-query.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { MobileContextService } from '../common/mobile-context.service';
import { MobileValidationPipe } from '../common/mobile-validation.pipe';
import { MobileApiLoggingInterceptor } from '../common/mobile-api-logging.interceptor';
import { VOICE_NOTES_DIR } from './upload-paths';

mkdirSync(VOICE_NOTES_DIR, { recursive: true });

const remarkFileInterceptorOptions = {
  storage: diskStorage({
    destination: VOICE_NOTES_DIR,
    filename: (
      _req: unknown,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) =>
      cb(
        null,
        `${randomBytes(16).toString('hex')}${extname(file.originalname)}`,
      ),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
};

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

  private async handle<T>(
    fn: () => Promise<T>,
    errorPrefix: string | null,
  ): Promise<T> {
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
  async getOwnSurahProgressList(
    @Req() req: AuthedRequest,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () => this.service.getSurahProgressList(branchId, studentId, query.type),
      'Failed to retrieve Surah progress list: ',
    );
  }

  @Get('students/surah-progress-list/:studentId')
  async getSurahProgressList(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getSurahProgressList(branchId, studentId, query.type),
      'Failed to retrieve Surah progress list: ',
    );
  }

  // ── getSurahDetails ──────────────────────────────────────────────────
  @Get('students/surahs/:surahId/details')
  async getOwnSurahDetails(
    @Req() req: AuthedRequest,
    @Param('surahId') surahId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () =>
        this.service.getSurahDetails(branchId, surahId, studentId, query.type),
      'Failed to retrieve Surah details: ',
    );
  }

  @Get('students/surahs/:surahId/details/:studentId')
  async getSurahDetails(
    @Req() req: AuthedRequest,
    @Param('surahId') surahId: string,
    @Param('studentId') studentId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.getSurahDetails(branchId, surahId, studentId, query.type),
      'Failed to retrieve Surah details: ',
    );
  }

  // ── getStudentSurahProgress ──────────────────────────────────────────
  @Get('student')
  async getOwnStudentSurahProgress(
    @Req() req: AuthedRequest,
    @Query() query: GetStudentSurahProgressQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () => this.service.getStudentSurahProgress(branchId, studentId, query),
      'Failed to retrieve student Surah progress: ',
    );
  }

  @Get('student/:studentId')
  async getStudentSurahProgress(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: GetStudentSurahProgressQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getStudentSurahProgress(branchId, studentId, query),
      'Failed to retrieve student Surah progress: ',
    );
  }

  // ── bulkMarkCompleted ────────────────────────────────────────────────
  // The client only sends multipart/form-data when a remark file is
  // attached (plain JSON otherwise); FileInterceptor must be present
  // either way so Multer parses the text fields when it does.
  @Post('bulk-mark-completed')
  @UseInterceptors(FileInterceptor('remark_file', remarkFileInterceptorOptions))
  async bulkMarkCompleted(
    @Req() req: AuthedRequest,
    @Body() dto: BulkMarkCompletedDto,
    @UploadedFile() remarkFile?: Express.Multer.File,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    return this.handle(
      () =>
        this.service.bulkMarkCompleted(
          branchId,
          req.user.userId,
          dto,
          remarkFile,
          publicBaseUrl,
        ),
      'Failed to mark ayahs as completed: ',
    );
  }

  // ── getPendingSurahList ──────────────────────────────────────────────
  @Get('pending-surah')
  async getOwnPendingSurahList(
    @Req() req: AuthedRequest,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () => this.service.getPendingSurahList(branchId, studentId, query.type),
      'Failed to retrieve pending surah list: ',
    );
  }

  @Get('pending-surah/:studentId')
  async getPendingSurahList(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getPendingSurahList(branchId, studentId, query.type),
      'Failed to retrieve pending surah list: ',
    );
  }

  // ── bulkMarkSurahsAsCompleted ────────────────────────────────────────
  @Post('student/bulk-mark-surah-completed')
  async bulkMarkSurahsAsCompleted(
    @Req() req: AuthedRequest,
    @Body() dto: BulkMarkSurahsCompletedDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.bulkMarkSurahsAsCompleted(branchId, req.user.userId, dto),
      'Failed to bulk mark surahs as completed: ',
    );
  }

  // ── getCompletedSurahList ────────────────────────────────────────────
  @Get('students/completed-surahs')
  async getOwnCompletedSurahList(
    @Req() req: AuthedRequest,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const studentId = await this.ownStudentId(req);
    return this.handle(
      () =>
        this.service.getCompletedSurahList(
          branchId,
          studentId,
          query.type ?? 'New Lesson',
        ),
      'Failed to retrieve completed Surah list: ',
    );
  }

  @Get('students/completed-surahs/:studentId')
  async getCompletedSurahList(
    @Req() req: AuthedRequest,
    @Param('studentId') studentId: string,
    @Query() query: TypeFilterQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.getCompletedSurahList(
          branchId,
          studentId,
          query.type ?? 'New Lesson',
        ),
      'Failed to retrieve completed Surah list: ',
    );
  }

  // ── storeOldLessonProgress ───────────────────────────────────────────
  // The client always sends multipart/form-data here (a remark file is
  // optional but the request shape isn't) — see bulkMarkCompleted above.
  @Post('store-old-lesson')
  @UseInterceptors(FileInterceptor('remark_file', remarkFileInterceptorOptions))
  async storeOldLessonProgress(
    @Req() req: AuthedRequest,
    @Body() dto: StoreOldLessonProgressDto,
    @UploadedFile() remarkFile?: Express.Multer.File,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    const publicBaseUrl = `${req.protocol}://${req.get('host')}`;
    return this.handle(
      () =>
        this.service.storeOldLessonProgress(
          branchId,
          req.user.userId,
          dto,
          remarkFile,
          publicBaseUrl,
        ),
      'Failed to save Old Lesson progress: ',
    );
  }

  // ── getOldLessonProgressList ─────────────────────────────────────────
  @Get('students/old-lesson-progress')
  async getOwnOldLessonProgressList(
    @Req() req: AuthedRequest,
    @Query() query: GetOldLessonProgressQueryDto,
  ) {
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
  async getTodayProgress(
    @Req() req: AuthedRequest,
    @Query() query: GetTodayProgressQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getTodayProgress(branchId, req.user.userId, query),
      "Failed to retrieve today's progress: ",
    );
  }

  // ── getStudentsExceededTarget ────────────────────────────────────────
  @Get('students/exceeded-target')
  async getStudentsExceededTarget(
    @Req() req: AuthedRequest,
    @Query() query: GetStudentsTargetQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.getStudentsExceededTarget(
          branchId,
          req.user.userId,
          query,
        ),
      'Failed to retrieve students exceeded target: ',
    );
  }

  // ── studentsWithPendingTargets ───────────────────────────────────────
  @Get('students/pending-targets')
  async studentsWithPendingTargets(
    @Req() req: AuthedRequest,
    @Query() query: GetStudentsTargetQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    // Legacy's own catch-all here has no message prefix — replicated as-is.
    return this.handle(
      () =>
        this.service.studentsWithPendingTargets(
          branchId,
          req.user.userId,
          query,
        ),
      null,
    );
  }

  // ── getFullProgressReport ────────────────────────────────────────────
  @Get('students/reports')
  async getFullProgressReport(
    @Req() req: AuthedRequest,
    @Query() query: GetFullProgressReportQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.getFullProgressReport(branchId, req.user.userId, query),
      'Failed: ',
    );
  }

  // ── getAttendanceReport ───────────────────────────────────────────────
  @Get('students/attendance-report')
  async getAttendanceReport(
    @Req() req: AuthedRequest,
    @Query() query: GetAttendanceReportQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () =>
        this.service.getAttendanceReport(branchId, req.user.userId, query),
      'Failed to generate attendance report: ',
    );
  }

  // ── getTopStudents ───────────────────────────────────────────────────
  @Get('students/top')
  async getTopStudents(
    @Req() req: AuthedRequest,
    @Query() query: GetTopStudentsQueryDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.getTopStudents(branchId, req.user.userId, query),
      'Failed to retrieve top students: ',
    );
  }

  // ── updateProgress ───────────────────────────────────────────────────
  @Post('update')
  async updateProgress(
    @Req() req: AuthedRequest,
    @Body() dto: UpdateProgressDto,
  ) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(
      () => this.service.updateProgress(branchId, req.user.userId, dto),
      'Failed to update progress: ',
    );
  }

  // ── deleteProgress ───────────────────────────────────────────────────
  // Only entries not seeded from the master schedule (day IS NULL — e.g.
  // Old Lesson/Juzh Lesson entries added via storeOldLessonProgress) can be
  // deleted outright; schedule-seeded entries must be reset via
  // updateProgress's `unmark` instead, or the ayah's tracking row disappears
  // from the fixed pacing plan.
  @Delete('destroy/:id')
  async deleteProgress(@Req() req: AuthedRequest, @Param('id') id: string) {
    const branchId = await this.context.resolveBranchId(req.user.userId);
    return this.handle(async () => {
      await this.service.deleteProgress(branchId, id);
      return {
        status: 'success',
        message: 'Progress entry deleted successfully',
      };
    }, 'Failed to delete progress entry: ');
  }
}
