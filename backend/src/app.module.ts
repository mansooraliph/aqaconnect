import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { RbacModule } from './rbac/rbac.module';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { UsersModule } from './users/users.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AcademicYearsModule } from './configuration/academic-years/academic-years.module';
import { AcademicClassesModule } from './configuration/academic-classes/academic-classes.module';
import { AcademicSectionsModule } from './configuration/academic-sections/academic-sections.module';
import { AcademicClassSectionsModule } from './configuration/academic-class-sections/academic-class-sections.module';
import { AcademicClassSectionYearsModule } from './configuration/academic-class-section-years/academic-class-section-years.module';
import { LessonStagesModule } from './configuration/lesson-stages/lesson-stages.module';
import { LessonSubStagesModule } from './configuration/lesson-sub-stages/lesson-sub-stages.module';
import { BranchSettingsModule } from './configuration/branch-settings/branch-settings.module';
import { SurahsModule } from './configuration/surahs/surahs.module';
import { SurahTargetSchedulesModule } from './configuration/surah-target-schedules/surah-target-schedules.module';
import { CalendarDaysModule } from './configuration/calendar-days/calendar-days.module';
import { DepartmentsModule } from './hr/departments/departments.module';
import { DesignationsModule } from './hr/designations/designations.module';
import { EmployeesModule } from './hr/employees/employees.module';
import { TeachersModule } from './hr/teachers/teachers.module';
import { LeavesModule } from './hr/leaves/leaves.module';
import { AttendanceModule } from './hr/attendance/attendance.module';
import { HolidaysModule } from './hr/holidays/holidays.module';
import { AppreciationsModule } from './hr/appreciations/appreciations.module';
import { AwardsModule } from './hr/awards/awards.module';
import { TeacherApplicationsModule } from './hr/teacher-applications/teacher-applications.module';
import { AdmissionsModule } from './student-management/admissions/admissions.module';
import { StudentsModule } from './student-management/students/students.module';
import { EnrollmentsModule } from './student-management/enrollments/enrollments.module';
import { StudentLeavesModule } from './student-management/student-leaves/student-leaves.module';
import { FeeTypesModule } from './fees/fee-types/fee-types.module';
import { FeeStructuresModule } from './fees/fee-structures/fee-structures.module';
import { FeeDemandsModule } from './fees/fee-demands/fee-demands.module';
import { PaymentsModule } from './fees/payments/payments.module';
import { DiscountsModule } from './fees/discounts/discounts.module';
import { LessonsModule } from './academic/lessons/lessons.module';
import { StudentLessonProgressModule } from './academic/student-lesson-progress/student-lesson-progress.module';
import { HalqasModule } from './academic/halqas/halqas.module';
import { HifdhModule } from './academic/hifdh/hifdh.module';
import { CurrentClassesModule } from './academic/current-classes/current-classes.module';
import { ExamTypesModule } from './academic/exam-types/exam-types.module';
import { ExamsModule } from './academic/exams/exams.module';
import { ExamResultsModule } from './academic/exam-results/exam-results.module';
import { AcademicDashboardModule } from './academic/dashboard/dashboard.module';
import { HrDashboardModule } from './hr/dashboard/dashboard.module';
import { StudentManagementDashboardModule } from './student-management/dashboard/dashboard.module';
import { FeesDashboardModule } from './fees/dashboard/dashboard.module';
import { AcademicClassesModule as MobileAcademicClassesModule } from './mobile-app-api/academic-classes/academic-classes.module';
import { TeachersModule as MobileTeachersModule } from './mobile-app-api/teachers/teachers.module';
import { SurahSchedulesModule as MobileSurahSchedulesModule } from './mobile-app-api/surah-schedules/surah-schedules.module';
import { HalqasModule as MobileHalqasModule } from './mobile-app-api/halqas/halqas.module';
import { StudentLeavesModule as MobileStudentLeavesModule } from './mobile-app-api/student-leaves/student-leaves.module';
import { StudentsModule as MobileStudentsModule } from './mobile-app-api/students/students.module';
import { StudentSurahProgressModule as MobileStudentSurahProgressModule } from './mobile-app-api/student-surah-progress/student-surah-progress.module';
import { LessonContentModule } from './mobile-app-api/lesson-content/lesson-content.module';
import { HrLookupsModule } from './mobile-app-api/hr-lookups/hr-lookups.module';
import { ProfileModule } from './mobile-app-api/profile/profile.module';
import { MobileDashboardModule } from './mobile-app-api/dashboard/dashboard.module';
import { LeavesModule as MobileLeavesModule } from './mobile-app-api/leaves/leaves.module';
import { MobileAttendanceModule } from './mobile-app-api/attendance/attendance.module';
import { MobileApiUsageModule } from './mobile-api-usage/mobile-api-usage.module';
import { NotificationsModule } from './notifications/notifications.module';
import { MobileNotificationsModule } from './mobile-app-api/notifications/notifications.module';
import { AnnouncementsModule } from './communication/announcements/announcements.module';
import { MobileAnnouncementsModule } from './mobile-app-api/announcements/announcements.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    RbacModule,
    AuthModule,
    BranchesModule,
    UsersModule,
    AcademicYearsModule,
    AcademicClassesModule,
    AcademicSectionsModule,
    AcademicClassSectionsModule,
    AcademicClassSectionYearsModule,
    LessonStagesModule,
    LessonSubStagesModule,
    BranchSettingsModule,
    SurahsModule,
    SurahTargetSchedulesModule,
    CalendarDaysModule,
    DepartmentsModule,
    DesignationsModule,
    EmployeesModule,
    TeachersModule,
    LeavesModule,
    AttendanceModule,
    HolidaysModule,
    AppreciationsModule,
    AwardsModule,
    TeacherApplicationsModule,
    AdmissionsModule,
    StudentsModule,
    EnrollmentsModule,
    StudentLeavesModule,
    FeeTypesModule,
    FeeStructuresModule,
    FeeDemandsModule,
    PaymentsModule,
    DiscountsModule,
    LessonsModule,
    StudentLessonProgressModule,
    HalqasModule,
    HifdhModule,
    CurrentClassesModule,
    ExamTypesModule,
    ExamsModule,
    ExamResultsModule,
    AcademicDashboardModule,
    HrDashboardModule,
    StudentManagementDashboardModule,
    FeesDashboardModule,
    MobileAcademicClassesModule,
    MobileTeachersModule,
    MobileSurahSchedulesModule,
    MobileHalqasModule,
    MobileStudentLeavesModule,
    MobileStudentsModule,
    MobileStudentSurahProgressModule,
    LessonContentModule,
    HrLookupsModule,
    ProfileModule,
    MobileDashboardModule,
    MobileLeavesModule,
    MobileAttendanceModule,
    MobileApiUsageModule,
    NotificationsModule,
    MobileNotificationsModule,
    AnnouncementsModule,
    MobileAnnouncementsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
