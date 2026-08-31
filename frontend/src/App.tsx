import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AppLayout } from './layout/AppLayout';
import { AcademicYearsPage } from './pages/configuration/AcademicYearsPage';
import { AcademicClassesPage } from './pages/configuration/AcademicClassesPage';
import { AcademicSectionsPage } from './pages/configuration/AcademicSectionsPage';
import { ClassSectionsPage } from './pages/configuration/ClassSectionsPage';
import { ClassSectionYearsPage } from './pages/configuration/ClassSectionYearsPage';
import { LessonStagesPage } from './pages/configuration/LessonStagesPage';
import { SurahsPage } from './pages/configuration/SurahsPage';
import { SurahAyahPageLinesPage } from './pages/configuration/SurahAyahPageLinesPage';
import { TargetSchedulesPage } from './pages/configuration/TargetSchedulesPage';
import { CalendarPage } from './pages/configuration/CalendarPage';
import { BranchSettingsPage } from './pages/configuration/BranchSettingsPage';
import { DepartmentsDesignationsPage } from './pages/hr/DepartmentsDesignationsPage';
import { EmployeesPage } from './pages/hr/EmployeesPage';
import { TeachersPage } from './pages/hr/TeachersPage';
import { LeavesPage } from './pages/hr/LeavesPage';
import { AttendancePage } from './pages/hr/AttendancePage';
import { HolidaysPage } from './pages/hr/HolidaysPage';
import { RecognitionPage } from './pages/hr/RecognitionPage';
import { TeacherApplicationsPage } from './pages/hr/TeacherApplicationsPage';
import { AdmissionsPage } from './pages/student-management/AdmissionsPage';
import { StudentsPage } from './pages/student-management/StudentsPage';
import { EnrollmentsPage } from './pages/student-management/EnrollmentsPage';
import { StudentLeavesPage } from './pages/student-management/StudentLeavesPage';
import { FeeTypesPage } from './pages/fees/FeeTypesPage';
import { FeeStructuresPage } from './pages/fees/FeeStructuresPage';
import { StudentFeeLedgerPage } from './pages/fees/StudentFeeLedgerPage';
import { LessonsProgressPage } from './pages/academic/LessonsProgressPage';
import { HalqasPage } from './pages/academic/HalqasPage';
import { HifdhTrackingPage } from './pages/academic/HifdhTrackingPage';
import { ExamsPage } from './pages/academic/ExamsPage';
import { CurrentClassesPage } from './pages/academic/CurrentClassesPage';
import { BranchesPage } from './pages/BranchesPage';
import { UsersPage } from './pages/UsersPage';
import { RolesPage } from './pages/RolesPage';
import { MobileApiDocsPage } from './pages/mobile/MobileApiDocsPage';
import { MobileApiUsageHistoryPage } from './pages/mobile/MobileApiUsageHistoryPage';
import { MobilePermissionsPage } from './pages/mobile/MobilePermissionsPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/roles" element={<RolesPage />} />

          <Route path="/configuration/academic-years" element={<AcademicYearsPage />} />
          <Route path="/configuration/academic-classes" element={<AcademicClassesPage />} />
          <Route path="/configuration/academic-sections" element={<AcademicSectionsPage />} />
          <Route path="/configuration/class-sections" element={<ClassSectionsPage />} />
          <Route path="/configuration/class-section-years" element={<ClassSectionYearsPage />} />
          <Route path="/configuration/lesson-stages" element={<LessonStagesPage />} />
          <Route path="/configuration/surahs" element={<SurahsPage />} />
          <Route path="/configuration/surah-ayah-page-lines" element={<SurahAyahPageLinesPage />} />
          <Route path="/configuration/target-schedules" element={<TargetSchedulesPage />} />
          <Route path="/configuration/calendar" element={<CalendarPage />} />
          <Route path="/configuration/settings" element={<BranchSettingsPage />} />

          <Route path="/hr/departments" element={<DepartmentsDesignationsPage />} />
          <Route path="/hr/employees" element={<EmployeesPage />} />
          <Route path="/hr/teachers" element={<TeachersPage />} />
          <Route path="/hr/leaves" element={<LeavesPage />} />
          <Route path="/hr/attendance" element={<AttendancePage />} />
          <Route path="/hr/holidays" element={<HolidaysPage />} />
          <Route path="/hr/recognition" element={<RecognitionPage />} />
          <Route path="/hr/teacher-applications" element={<TeacherApplicationsPage />} />

          <Route path="/student-management/admissions" element={<AdmissionsPage />} />
          <Route path="/student-management/students" element={<StudentsPage />} />
          <Route path="/student-management/enrollments" element={<EnrollmentsPage />} />
          <Route path="/student-management/leaves" element={<StudentLeavesPage />} />

          <Route path="/fees/fee-types" element={<FeeTypesPage />} />
          <Route path="/fees/fee-structures" element={<FeeStructuresPage />} />
          <Route path="/fees/student-ledger" element={<StudentFeeLedgerPage />} />

          <Route path="/academic/lessons-progress" element={<LessonsProgressPage />} />
          <Route path="/academic/halqas" element={<HalqasPage />} />
          <Route path="/academic/hifdh-tracking" element={<HifdhTrackingPage />} />
          <Route path="/academic/exams" element={<ExamsPage />} />
          <Route path="/academic/current-classes" element={<CurrentClassesPage />} />

          <Route path="/mobile/permissions" element={<MobilePermissionsPage />} />
          <Route path="/mobile/api-docs" element={<MobileApiDocsPage />} />
          <Route path="/mobile/usage-history" element={<MobileApiUsageHistoryPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
