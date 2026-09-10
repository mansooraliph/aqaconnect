export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  request?: string;
  response?: string;
  /** Matching endpoint number(s) from the legacy quran_academy_v1 (AQA App) API Catalog, where this endpoint is the same call. */
  legacyNumbers?: number[];
}

/** Groups a module under one of the mobile app's own tabs, for the RBAC role-edit modal's sub-tab layout. */
export type AppTab = 'dashboard' | 'schedules' | 'lessons' | 'halqa' | 'attendance' | 'profile' | 'other';

export interface ApiModule {
  key: string;
  label: string;
  basePath: string;
  description: string;
  endpoints: ApiEndpoint[];
  /** Which mobile app tab this module's permission belongs under, for the role-edit modal. Defaults to 'other'. */
  tab?: AppTab;
  /**
   * Explicit backend permission key, for modules whose key doesn't fit the
   * `mobile_api.{key}.access` convention (e.g. *.approve permissions, or a
   * catalog key that doesn't match its real permission's module segment).
   * Falls back to the derived `mobile_api.{key with _}.access` when absent.
   */
  permissionKey?: string;
  /** Sub-heading to group this module under within its tab in the role-edit modal (e.g. "Quick Actions", "Manage"). Omit for an ungrouped/standalone item. */
  section?: string;
  /** Explicit sort position within its tab (and section) in the role-edit modal. Lower first; ties keep catalog order. Defaults to 0. */
  order?: number;
  /** No backend capability exists yet — renders as a permanently unchecked, disabled placeholder in the role-edit modal instead of a real toggle. */
  alwaysOff?: boolean;
  /** Only shown in the role-edit modal when editing an admin-tier role (Super Admin/Branch Admin/Management) — e.g. the Dashboard's Manage section, which Teacher doesn't have. */
  adminOnly?: boolean;
  /** Only shown in the role-edit modal when editing a non-admin role (Teacher/Student/etc.) — e.g. Teacher's Dashboard-only shortcuts that Admin's dashboard doesn't have. */
  teacherOnly?: boolean;
}

export const MOBILE_API_CATALOG: ApiModule[] = [
  {
    key: 'auth',
    label: 'Authentication',
    basePath: '/auth',
    description:
      'Shared with the admin portal — the mobile app authenticates against the same endpoints, no separate mobile login exists. ' +
      'The login/me response\'s top-level fields (token, image, id, name, position, no_of_task, percentage) and the `permissions` ' +
      'object\'s module/action/own_type shape match the legacy source system\'s auth API verbatim (module names like `tasks`/`leads`/' +
      '`proposals` that have no aqa_v2 equivalent are always false; own_type strings are static placeholders, not derived). ' +
      'token_type/refresh_token/expires_in/branchId/isGlobal/roles are additive — needed by aqa_v2\'s own ' +
      'revocable-refresh-token and multi-branch RBAC design. Note: the web app\'s own permission gating ' +
      '(hasPermission) currently has no working data source — the legacy `permissions` shape above doesn\'t cover ' +
      'most of aqa_v2\'s own modules (configuration, fees, exams, system/RBAC), so it can\'t drive it; this is a known gap.',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/login',
        summary: 'Log in with username or email + password',
        legacyNumbers: [1],
        request: `{
  "email": "admin",
  "password": "ChangeMe123!"
}`,
        response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "refresh_token": "19bae10d192f35ec96b7aa05722b0d4a642411eb0cfe7c2d63b3dbf8232492f",
  "expires_in": 900,
  "id": "cmronw3d8000xg78u4698y37h",
  "username": "admin",
  "email": "admin@example.com",
  "name": "Super Admin",
  "image": null,
  "position": "Principal",
  "no_of_task": 0,
  "percentage": 0,
  "branchId": "cmronw3bh000ug78u36n8enm1",
  "isGlobal": true,
  "roles": [
    { "id": "cmronw39r0005g78uk1fgn1zx", "name": "Super Admin", "scope": "GLOBAL", "branchId": "cmronw3bh000ug78u36n8enm1" }
  ],
  "permissions": {
    "tasks": { "view": false, "own_type": "all", "create": false, "edit": false, "delete": false, "assign": false },
    "employees": { "view": true, "own_type": "", "create": true, "edit": true, "delete": true },
    "students": { "create": true, "view": true, "edit": true, "delete": true, "assign": true, "own_type": "all" },
    "attendance": { "attendance_summary": true, "leaves": true, "apply_for_ot": false, "leave_approval": true, "attendance_approval": true },
    "leaves": { "create": true, "view": true, "own_type": "own", "edit": true, "delete": false },
    "halqa": { "create": true, "view": true, "edit": true, "delete": true, "own_type": "all" },
    "lessons": { "create": true, "view": true, "edit": true, "delete": true, "own_type": "all" },
    "hifdh": { "view": true, "own_type": "all", "create": true, "edit": true, "delete": false },
    "...": "plus projects, leads, schedule, proposals, clients, teachers, attendance_punch, tickets, overtime_requests, admin_halqa — full legacy module list, always false where aqa_v2 has no equivalent"
  }
}`,
      },
      {
        method: 'POST',
        path: '/auth/refresh',
        summary: 'Exchange a refresh token for a new access token',
        request: `{
  "refresh_token": "19bae10d192f35ec96b7aa05722b0d4a642411eb0cfe7c2d63b3dbf8232492f"
}`,
        response: `{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "refresh_token": "2c9de41f2a3b56ec97b8bb06833c1e5b753522fc1dfe8d3e74c4ecf9343503g",
  "expires_in": 900
}`,
      },
      {
        method: 'POST',
        path: '/auth/logout',
        summary: 'Revoke a refresh token',
        request: `{
  "refresh_token": "19bae10d192f35ec96b7aa05722b0d4a642411eb0cfe7c2d63b3dbf8232492f"
}`,
        response: `{
  "message": "Logged out"
}`,
      },
      {
        method: 'POST',
        path: '/auth/me',
        summary: 'Get the current user (from the access token) — same shape as login, minus the token fields',
        response: `{
  "id": "cmronw3d8000xg78u4698y37h",
  "username": "admin",
  "email": "admin@example.com",
  "name": "Super Admin",
  "image": null,
  "position": "Principal",
  "no_of_task": 0,
  "percentage": 0,
  "branchId": "cmronw3bh000ug78u36n8enm1",
  "isGlobal": true,
  "roles": [
    { "id": "cmronw39r0005g78uk1fgn1zx", "name": "Super Admin", "scope": "GLOBAL", "branchId": "cmronw3bh000ug78u36n8enm1" }
  ],
  "permissions": {
    "tasks": { "view": false, "own_type": "all", "create": false, "edit": false, "delete": false, "assign": false },
    "students": { "create": true, "view": true, "edit": true, "delete": true, "assign": true, "own_type": "all" },
    "halqa": { "create": true, "view": true, "edit": true, "delete": true, "own_type": "all" },
    "...": "full legacy module list, same shape as login above"
  }
}`,
      },
    ],
  },
  {
    key: 'academic-classes',
    label: 'Classes',
    tab: 'dashboard',
    section: 'Manage',
    order: 7,
    adminOnly: true,
    basePath: '/app/academic/classes',
    description: 'Create/update academic classes from the mobile app. Response mirrors the legacy Eloquent model dump verbatim, including the added_by/last_updated_by audit relation.',
    endpoints: [
      {
        method: 'POST',
        path: '/app/academic/classes',
        summary: 'Create an academic class',
        request: `{
  "name": "Grade 5 - A",
  "code": "G5A",
  "status": "active"
}`,
        response: `{
  "status": "success",
  "message": "Academic class created successfully.",
  "data": {
    "id": "cmclass0001abcxyzefgh123",
    "company_id": "cmronw3bh000ug78u36n8enm1",
    "name": "Grade 5 - A",
    "code": "G5A",
    "status": "active",
    "added_by": { "id": "cmronw3d8000xg78u4698y37h", "name": "Super Admin" },
    "last_updated_by": { "id": "cmronw3d8000xg78u4698y37h", "name": "Super Admin" },
    "created_at": "2026-08-02T14:21:35.172Z",
    "updated_at": "2026-08-02T14:21:35.172Z"
  }
}`,
      },
      {
        method: 'PATCH',
        path: '/app/academic/classes/:id',
        summary: 'Update an academic class (partial — only fields present are applied)',
        request: `{
  "name": "Grade 5 - B",
  "status": "inactive"
}`,
        response: `{
  "status": "success",
  "message": "Academic class updated successfully.",
  "data": {
    "id": "cmclass0001abcxyzefgh123",
    "company_id": "cmronw3bh000ug78u36n8enm1",
    "name": "Grade 5 - B",
    "code": "G5A",
    "status": "inactive",
    "added_by": { "id": "cmronw3d8000xg78u4698y37h", "name": "Super Admin" },
    "last_updated_by": { "id": "cmronw3d8000xg78u4698y37h", "name": "Super Admin" },
    "created_at": "2026-08-02T14:21:35.172Z",
    "updated_at": "2026-08-02T15:03:11.842Z"
  }
}`,
      },
    ],
  },
  {
    key: 'teachers',
    label: 'Teachers',
    tab: 'dashboard',
    section: 'Manage',
    order: 6,
    adminOnly: true,
    basePath: '/app/teachers',
    description: 'Teacher account CRUD. Responses use the "Record saved/updated/deleted successfully." wording and status/message envelope verbatim from the legacy controller.',
    endpoints: [
      {
        method: 'GET',
        path: '/app/teachers',
        summary: 'List teachers',
        legacyNumbers: [39],
        response: `{
  "status": "success",
  "data": {
    "teachers": [
      {
        "id": "cmteacher001abcxyz45678",
        "branchId": "cmronw3bh000ug78u36n8enm1",
        "userId": "cmuser001abcxyz45678",
        "employeeId": "cmemp0001abcxyz45678",
        "employeeCode": "EMP001",
        "createdAt": "2026-06-01T08:00:00.000Z",
        "updatedAt": "2026-06-01T08:00:00.000Z",
        "user": {
          "id": "cmuser001abcxyz45678",
          "username": "ahmad.hassan",
          "email": null,
          "firstName": "Ahmad",
          "lastName": "Hassan",
          "phone": "+201001234567",
          "isActive": true
        },
        "employee": {
          "department": { "id": "cmdept0001abcxyz45", "name": "Hifdh" },
          "designation": { "id": "cmdesg0001abcxyz45", "name": "Senior Teacher" }
        }
      }
    ]
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/teachers/show/:id',
        summary: 'Get one teacher',
        legacyNumbers: [40],
        response: `{
  "status": "success",
  "data": {
    "teacher": {
      "id": "cmteacher001abcxyz45678",
      "branchId": "cmronw3bh000ug78u36n8enm1",
      "userId": "cmuser001abcxyz45678",
      "employeeId": "cmemp0001abcxyz45678",
      "employeeCode": "EMP001",
      "user": {
        "id": "cmuser001abcxyz45678",
        "username": "ahmad.hassan",
        "email": null,
        "firstName": "Ahmad",
        "lastName": "Hassan",
        "phone": "+201001234567",
        "isActive": true
      },
      "employee": {
        "department": { "id": "cmdept0001abcxyz45", "name": "Hifdh" },
        "designation": { "id": "cmdesg0001abcxyz45", "name": "Senior Teacher" }
      }
    }
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/teachers/store',
        summary: 'Create a teacher (provisions a login + Employee record; auto-assigns the Teacher role)',
        legacyNumbers: [41],
        request: `{
  "name": "Ahmad Hassan",
  "username": "ahmad.hassan",
  "mobile": "+201001234567",
  "password": "Str0ngPass!23",
  "department": "cmdept0001abcxyz45",
  "designation": "cmdesg0001abcxyz45",
  "joining_date": "2026-08-01",
  "gender": "male"
}`,
        response: `{
  "status": "success",
  "message": "Record saved successfully.",
  "user": {
    "id": "cmteacher001abcxyz45678",
    "branchId": "cmronw3bh000ug78u36n8enm1",
    "employeeCode": "EMP001",
    "user": { "id": "cmuser001abcxyz45678", "username": "ahmad.hassan", "firstName": "Ahmad", "lastName": "Hassan", "phone": "+201001234567", "isActive": true },
    "employee": { "department": { "id": "cmdept0001abcxyz45", "name": "Hifdh" }, "designation": { "id": "cmdesg0001abcxyz45", "name": "Senior Teacher" } }
  }
}`,
      },
      {
        method: 'PATCH',
        path: '/app/teachers/update/:id',
        summary: 'Update a teacher (partial)',
        legacyNumbers: [42],
        request: `{
  "mobile": "+201009876543",
  "designation": "cmdesg0002abcxyz46"
}`,
        response: `{
  "status": "success",
  "message": "Record updated successfully.",
  "user": {
    "id": "cmteacher001abcxyz45678",
    "user": { "id": "cmuser001abcxyz45678", "username": "ahmad.hassan", "phone": "+201009876543" },
    "employee": { "designation": { "id": "cmdesg0002abcxyz46", "name": "Head Teacher" } }
  }
}`,
      },
      {
        method: 'DELETE',
        path: '/app/teachers/destroy/:id',
        summary: 'Delete a teacher (deletes the underlying User, cascading Teacher/Employee)',
        legacyNumbers: [43],
        response: `{
  "status": "success",
  "message": "Record deleted successfully."
}`,
      },
    ],
  },
  {
    key: 'halqas',
    label: 'Halqa List',
    tab: 'halqa',
    basePath: '/app/halqas',
    description: 'Halqa (study circle) list/roster, update/delete, and student assignment — adding a new Halqa is a separate permission (Add Halqa, below). Dates use legacy\'s d-m-Y / d-m-Y H:i string formats, not ISO.',
    endpoints: [
      {
        method: 'GET',
        path: '/app/halqas/:halqaId/students',
        summary: 'List students in a halqa (search)',
        legacyNumbers: [7, 9, 12],
        response: `{
  "status": "success",
  "data": {
    "halqa": {
      "id": "cmhalqa0001abcxyz45",
      "name": "Halqa Al-Noor",
      "status": "active",
      "start_date": "01-08-2026",
      "teacher": { "id": "cmteacher001abcxyz45678", "name": "Ahmad Hassan", "email": null },
      "current_class": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" }
    },
    "students": [
      {
        "id": "cmstudent001abcxyz7890",
        "name": "Yusuf Ibrahim",
        "email": null,
        "mobile": "500123456",
        "country_phonecode": null,
        "gender": "male",
        "status": "active",
        "image_url": null,
        "created_at": "01-08-2026 09:15"
      }
    ],
    "meta": { "search": "", "total_students_in_halqa": 1 }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/halqas',
        summary: 'List halqas (role-scoped: teacher sees own, admin sees all)',
        legacyNumbers: [2, 8, 11],
        response: `{
  "status": "success",
  "user_role": "teacher",
  "user_name": "Ahmad Hassan",
  "user_id": "cmuser001abcxyz45678",
  "total_halqas": 3,
  "active_halqas": 2,
  "inactive_halqas": 1,
  "data": [
    {
      "id": "cmhalqa0001abcxyz45",
      "name": "Halqa Al-Noor",
      "teacher_name": "Ahmad Hassan",
      "teacher_id": "cmteacher001abcxyz45678",
      "current_class": "Grade 5 - A",
      "current_class_id": "cmclass0001abcxyzefgh123",
      "status": "active",
      "start_date": "01-08-2026",
      "student_count": 12,
      "added_by": "Super Admin",
      "last_updated_by": "Super Admin",
      "created_at": "01-08-2026",
      "updated_at": "01-08-2026 09:15"
    }
  ]
}`,
      },
      {
        method: 'POST',
        path: '/app/halqas/store',
        summary: 'Create a halqa',
        legacyNumbers: [4],
        request: `{
  "name": "Halqa Al-Noor",
  "teacher_id": "cmteacher001abcxyz45678",
  "start_date": "2026-08-01",
  "status": "active",
  "current_class": "cmclass0001abcxyzefgh123"
}`,
        response: `{
  "id": "cmhalqa0001abcxyz45",
  "name": "Halqa Al-Noor",
  "teacherId": "cmteacher001abcxyz45678",
  "status": "ACTIVE",
  "startDate": "2026-08-01T00:00:00.000Z",
  "currentClassId": "cmclass0001abcxyzefgh123",
  "teacher": { "user": { "firstName": "Ahmad", "lastName": "Hassan", "email": null } },
  "currentClass": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" },
  "addedBy": { "firstName": "Super", "lastName": "Admin" },
  "lastUpdatedBy": { "firstName": "Super", "lastName": "Admin" }
}`,
      },
      {
        method: 'GET',
        path: '/app/halqas/show/:id',
        summary: 'Get one halqa',
        legacyNumbers: [3],
        response: `{
  "id": "cmhalqa0001abcxyz45",
  "name": "Halqa Al-Noor",
  "teacherId": "cmteacher001abcxyz45678",
  "status": "ACTIVE",
  "startDate": "2026-08-01T00:00:00.000Z",
  "teacher": { "user": { "firstName": "Ahmad", "lastName": "Hassan", "email": null } },
  "currentClass": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" },
  "addedBy": { "firstName": "Super", "lastName": "Admin" },
  "lastUpdatedBy": { "firstName": "Super", "lastName": "Admin" }
}`,
      },
      {
        method: 'PATCH',
        path: '/app/halqas/update/:id',
        summary: 'Update a halqa (partial)',
        legacyNumbers: [5],
        request: `{
  "name": "Halqa Al-Furqan",
  "status": "inactive"
}`,
        response: `{
  "id": "cmhalqa0001abcxyz45",
  "name": "Halqa Al-Furqan",
  "status": "INACTIVE",
  "teacher": { "user": { "firstName": "Ahmad", "lastName": "Hassan", "email": null } },
  "currentClass": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" }
}`,
      },
      {
        method: 'DELETE',
        path: '/app/halqas/destroy/:id',
        summary: 'Delete a halqa (unassigns its students first)',
        legacyNumbers: [6],
        response: `{}`,
      },
      {
        method: 'GET',
        path: '/app/halqas/classes',
        summary: 'List academic classes for the halqa dropdown',
        response: `[
  { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" }
]`,
      },
      {
        method: 'POST',
        path: '/app/halqas/assign-student',
        summary: 'Assign students to a halqa (overwrites any other active membership)',
        request: `{
  "student_ids": ["cmstudent001abcxyz7890", "cmstudent002abcxyz7891"],
  "halqa_id": "cmhalqa0001abcxyz45"
}`,
        response: `{
  "status": "success",
  "message": "2 student(s) successfully assigned to halqa.",
  "data": {
    "assigned_student_ids": ["cmstudent001abcxyz7890", "cmstudent002abcxyz7891"],
    "halqa_id": "cmhalqa0001abcxyz45",
    "halqa_name": "Halqa Al-Noor"
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/halqas/unassigned-students',
        summary: 'List active students with no halqa (search, per_page)',
        response: `{
  "status": "success",
  "data": [
    {
      "student_detail": {
        "id": "cmstudent003abcxyz7892",
        "student_code": "STU-1055",
        "father_name": null,
        "mother_name": null,
        "guardian_name": "Farouk Al-Sayed",
        "mobile_1": "500123999",
        "mobile_2": null,
        "whatsapp": null,
        "joining_date": null,
        "blood_group": null,
        "address": null
      },
      "user": {
        "id": "cmuser003abcxyz7892",
        "name": "Omar Farouk",
        "email": null,
        "mobile": "500123999",
        "status": "active",
        "image_url": null,
        "gender": "male"
      }
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 1, "last_page": 1, "search": "" }
}`,
      },
    ],
  },
  {
    key: 'halqas-create',
    label: 'Add Halqa',
    tab: 'halqa',
    basePath: '/app/halqas/store',
    description: 'Add-Halqa button, split from Halqa List above so creating new Halqas can be granted independently of general Halqa management.',
    permissionKey: 'mobile_api.halqas.create',
    endpoints: [],
  },
  {
    key: 'admin-halqa',
    label: 'Admin Halqa',
    basePath: '/app/halqas',
    description:
      "Gates the mobile app's Admin Halqa tab (the Admin role's cross-Halqa admin view) — not a separate " +
      "set of endpoints; it reuses the same /app/halqas/* routes as the Halqas module above under the " +
      "Admin role's broader (branch-wide, not own-Halqa-only) scope. Kept as its own permission so an " +
      "admin can be granted the Halqa tab independently of the regular Halqa module grant.",
    endpoints: [],
  },
  {
    key: 'student-leaves',
    label: 'Student Leaves',
    basePath: '/app/student_leave',
    description: "Student leave requests. Note: this module's responses never use a status wrapper — just plain { message, ... }. leave_type is validated as 'home'|'hostal' (legacy's own spelling, preserved verbatim).",
    endpoints: [
      {
        method: 'POST',
        path: '/app/student_leave/leave-apply',
        summary: 'Student self-applies for leave (one row per day in range)',
        request: `{
  "from_date": "2026-08-05",
  "to_date": "2026-08-07",
  "reason": "Family travel",
  "leave_type": "home",
  "creation_remarks": "Requesting 3 days off"
}`,
        response: `{
  "message": "Leave application submitted successfully for 3 day(s).",
  "from_date": "2026-08-05",
  "to_date": "2026-08-07",
  "data": [
    { "id": "cmleave0001abcxyz45", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-05", "reason": "Family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T14:21:35.172Z" },
    { "id": "cmleave0002abcxyz46", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-06", "reason": "Family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T14:21:35.172Z" },
    { "id": "cmleave0003abcxyz47", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-07", "reason": "Family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T14:21:35.172Z" }
  ]
}`,
      },
      {
        method: 'POST',
        path: '/app/student_leave/create-student-leave',
        summary: "Teacher/admin creates leave on a student's behalf",
        request: `{
  "student_id": "cmstudent001abcxyz7890",
  "from_date": "2026-08-05",
  "to_date": "2026-08-05",
  "reason": "Medical appointment",
  "leave_type": "home",
  "creation_remarks": "Doctor's note on file",
  "status": "approved"
}`,
        response: `{
  "message": "Leave created successfully for student ID cmstudent001abcxyz7890 for 1 day(s).",
  "from_date": "2026-08-05",
  "to_date": "2026-08-05",
  "status": "approved",
  "data": [
    { "id": "cmleave0004abcxyz48", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-05", "reason": "Medical appointment", "leave_type": "home", "status": "approved", "creation_remarks": "Doctor's note on file", "approval_remarks": "Approved by teacher", "created_by": "cmteacher001abcxyz45678", "approved_by": "cmteacher001abcxyz45678", "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T14:21:35.172Z" }
  ]
}`,
      },
      {
        method: 'POST',
        path: '/app/student_leave/leave-approval',
        summary: 'Bulk approve/reject pending leaves',
        request: `{
  "leave_ids": ["cmleave0001abcxyz45", "cmleave0002abcxyz46"],
  "action": "approved",
  "approval_remarks": "Approved by class teacher"
}`,
        response: `{
  "message": "2 leave request(s) approved.",
  "updated_ids": ["cmleave0001abcxyz45", "cmleave0002abcxyz46"]
}`,
      },
      {
        method: 'GET',
        path: '/app/student_leave/get-student-leaves',
        summary: 'List leaves (student sees own; teacher/admin can filter by student_id, status, leave_type, date range, per_page)',
        response: `{
  "data": [
    { "id": "cmleave0001abcxyz45", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-05", "reason": "Family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T14:21:35.172Z" }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 1, "last_page": 1 }
}`,
      },
      {
        method: 'PATCH',
        path: '/app/student_leave/update-leaves/:leaveId',
        summary: 'Update a leave (date-range change creates additional day-rows)',
        request: `{
  "to_date": "2026-08-09",
  "reason": "Extended family travel"
}`,
        response: `{
  "message": "Leave updated successfully for 3 day(s).",
  "data": [
    { "id": "cmleave0001abcxyz45", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-05", "reason": "Extended family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T14:21:35.172Z", "updated_at": "2026-08-02T15:00:00.000Z" },
    { "id": "cmleave0005abcxyz49", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-08", "reason": "Extended family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T15:00:00.000Z", "updated_at": "2026-08-02T15:00:00.000Z" },
    { "id": "cmleave0006abcxyz50", "student_id": "cmstudent001abcxyz7890", "leave_date": "2026-08-09", "reason": "Extended family travel", "leave_type": "home", "status": "pending", "creation_remarks": "Requesting 3 days off", "approval_remarks": null, "created_by": "cmuser001abcxyz45678", "approved_by": null, "created_at": "2026-08-02T15:00:00.000Z", "updated_at": "2026-08-02T15:00:00.000Z" }
  ]
}`,
      },
      {
        method: 'POST',
        path: '/app/student_leave/bulk-manage',
        summary: 'Bulk update and/or delete leave records (response keys are conditional — only present if there were updates/deletes/errors)',
        request: `{
  "updates": [
    { "id": "cmleave0001abcxyz45", "status": "approved", "approval_remarks": "OK" }
  ],
  "deletes": ["cmleave0002abcxyz46"]
}`,
        response: `{
  "message": "Bulk operation completed.",
  "updated_count": 1,
  "updated_ids": ["cmleave0001abcxyz45"],
  "deleted_count": 1,
  "deleted_ids": ["cmleave0002abcxyz46"]
}`,
      },
    ],
  },
  {
    key: 'attendance-mark',
    label: 'Mark Attendance',
    tab: 'attendance',
    order: 0,
    basePath: '/app',
    description: 'Mobile self mark-attendance flow — not implemented yet in aqa_v2, always off until built.',
    permissionKey: 'mobile_api.attendance.mark',
    alwaysOff: true,
    endpoints: [],
  },
  {
    key: 'student-leaves-approve',
    label: 'Student Leave Approvals',
    tab: 'attendance',
    order: 3,
    basePath: '/app/student_leave',
    description:
      'Approve/reject student leave requests — a distinct permission from Student Leaves above (which covers ' +
      'apply/view). The app UI shows this option unconditionally once the Attendance tab is open; the server ' +
      'still enforces this permission on the leave-approval endpoint.',
    permissionKey: 'mobile_api.student_leaves.approve',
    endpoints: [],
  },
  {
    key: 'students',
    label: 'Students',
    tab: 'dashboard',
    section: 'Manage',
    order: 5,
    adminOnly: true,
    basePath: '/app/students',
    description: 'Student profile CRUD, academic reference lookups, and per-student exam records. Fields with no equivalent data in this schema (mother_name, image_url, custom_fields, roll_no, etc.) are present in the response shape but always null, matching legacy\'s field names exactly.',
    endpoints: [
      {
        method: 'POST',
        path: '/app/students',
        summary: 'Create a student (provisions a login; auto-assigns the Student role)',
        legacyNumbers: [13],
        request: `{
  "name": "Yusuf Ibrahim",
  "mobile_1": "500123456",
  "mobile_1_country_code": "+966",
  "gender": "male",
  "username": "yusuf.ibrahim",
  "password": "Str0ngPass!23",
  "student_id": "STU-1042",
  "father_name": "Ibrahim Al-Sayed",
  "guardian_name": "Ibrahim Al-Sayed",
  "joining_date": "2026-08-01",
  "hifdh_start_date": "2026-08-01",
  "halqa_id": "cmhalqa0001abcxyz45",
  "login": "enable"
}`,
        response: `{
  "id": "cmstudent001abcxyz7890",
  "name": "Yusuf Ibrahim",
  "email": null,
  "mobile": "500123456",
  "country_phonecode": null,
  "gender": "male",
  "status": "active",
  "student_details": {
    "id": "cmstudent001abcxyz7890",
    "student_id": "STU-1042",
    "father_name": "Ibrahim Al-Sayed",
    "mother_name": null,
    "guardian_name": "Ibrahim Al-Sayed",
    "mobile_1": "500123456",
    "mobile_2": null,
    "whatsapp": null,
    "joining_date": "2026-08-01",
    "blood_group": null,
    "address": null,
    "halqa_id": "cmhalqa0001abcxyz45",
    "hifdh_start_date": "2026-08-01"
  },
  "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" },
  "teacher": { "id": "cmteacher001abcxyz45678", "name": "Ahmad Hassan", "email": null },
  "username": "yusuf.ibrahim",
  "created_at": "01-08-2026 09:15",
  "generated_password": null
}`,
      },
      {
        method: 'PATCH',
        path: '/app/students/update/:id',
        summary: 'Update a student (partial — same fields as create, all optional)',
        request: `{
  "guardian_name": "Ibrahim Al-Sayed",
  "halqa_id": "cmhalqa0002abcxyz46"
}`,
        response: `{
  "id": "cmstudent001abcxyz7890",
  "name": "Yusuf Ibrahim",
  "student_details": { "id": "cmstudent001abcxyz7890", "student_id": "STU-1042", "guardian_name": "Ibrahim Al-Sayed", "halqa_id": "cmhalqa0002abcxyz46" },
  "halqa": { "id": "cmhalqa0002abcxyz46", "name": "Halqa Al-Furqan", "status": "active" },
  "generated_password": null
}`,
      },
      {
        method: 'GET',
        path: '/app/students/:studentId/details',
        summary: 'Get full student details (profile, halqa, enrollment)',
        legacyNumbers: [14],
        response: `{
  "status": "success",
  "data": {
    "student": {
      "id": "cmstudent001abcxyz7890",
      "name": "Yusuf Ibrahim",
      "email": null,
      "mobile": "500123456",
      "country_phonecode": null,
      "gender": "male",
      "status": "active",
      "login": "enable",
      "email_notifications": true,
      "locale": null,
      "salutation": null,
      "image_url": null,
      "created_at": "01-08-2026 09:15",
      "updated_at": "01-08-2026 09:15"
    },
    "student_details": {
      "id": "cmstudent001abcxyz7890",
      "student_id": "STU-1042",
      "father_name": "Ibrahim Al-Sayed",
      "mother_name": null,
      "guardian_name": "Ibrahim Al-Sayed",
      "mobile_1": "500123456",
      "mobile_2": null,
      "whatsapp": null,
      "mobile_1_country_code": null,
      "mobile_2_country_code": null,
      "whatsapp_country_code": null,
      "joining_date": "2026-08-01",
      "blood_group": null,
      "address": null,
      "halqa_id": "cmhalqa0001abcxyz45"
    },
    "halqa": {
      "id": "cmhalqa0001abcxyz45",
      "name": "Halqa Al-Noor",
      "status": "active",
      "start_date": "01-08-2026",
      "teacher": { "id": "cmteacher001abcxyz45678", "name": "Ahmad Hassan", "email": null },
      "current_class": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A" }
    },
    "enrollment": {
      "id": "cmenroll001abcxyz45",
      "roll_no": null,
      "enrolled_on": "01-08-2026",
      "status": "active",
      "academic_year": { "id": "cmyear0001abcxyz45", "name": "2026-2027", "start_date": "2026-06-01T00:00:00.000Z", "end_date": "2027-05-31T00:00:00.000Z", "is_current": true },
      "academic_class": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5" },
      "academic_section": { "id": "cmsection001abcxyz45", "name": "A" }
    },
    "custom_fields": null
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/students/academic-class-section-years',
        summary: 'List class-section-years (filters: academic_year_id, class_id, section_id, teacher_id, status, search)',
        response: `{
  "status": "success",
  "message": "Class section years retrieved successfully",
  "data": {
    "class_section_years": [
      {
        "id": "cmcsy0001abcxyz45",
        "academic_year": { "id": "cmyear0001abcxyz45", "name": "2026-2027", "start_date": "2026-06-01T00:00:00.000Z", "end_date": "2027-05-31T00:00:00.000Z", "is_current": true },
        "academic_class": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5", "status": "active" },
        "academic_section": { "id": "cmsection001abcxyz45", "name": "A", "status": "active" },
        "class_teacher": null,
        "display_name": "Grade 5 - A",
        "full_display_name": "2026-2027 | Grade 5 - A",
        "max_students": 30,
        "teacher_name": null,
        "notes": null,
        "status": "active",
        "added_by": null,
        "last_updated_by": null,
        "created_at": "01-06-2026 08:00",
        "updated_at": "01-06-2026 08:00"
      }
    ],
    "total_count": 1,
    "summary": { "active": 1, "inactive": 0, "by_year": [{ "year_id": "cmyear0001abcxyz45", "year_name": "2026-2027", "is_current": true, "count": 1 }] },
    "filters_applied": { "academic_year_id": null, "class_id": null, "section_id": null, "teacher_id": null, "status": null, "search": null },
    "company_id": "cmronw3bh000ug78u36n8enm1"
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/students/admission-year-reports',
        summary: 'Students grouped by admission year (filters: year, class_id, academic_year_id)',
        legacyNumbers: [61],
        response: `{
  "status": "success",
  "data": [
    {
      "year": "2026",
      "total_students": 1,
      "students": [
        { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "student_id": "STU-1042", "joining_date": "2026-08-01", "class": { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5", "academic_year": { "id": "cmyear0001abcxyz45", "name": "2026-2027" } } }
      ]
    }
  ],
  "filters": { "class_id": null, "academic_year_id": null }
}`,
      },
      {
        method: 'DELETE',
        path: '/app/students/destroy/:id',
        summary: 'Delete a student (cascades enrollments; deletes the underlying User too)',
        legacyNumbers: [10],
        response: `{}`,
      },
      {
        method: 'GET',
        path: '/app/students/activity-report',
        summary: "Student's activity timeline (joining, Surah completions, attendance, leaves, holidays, enrollment)",
        request: `?student_id=cmstudent001abcxyz7890&month=8&year=2026`,
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "student_id": "STU-1042", "joining_date": "2026-08-01" },
    "date_range": { "start": "2026-08-01", "end": "2026-08-31" },
    "activities": [
      { "date": "2026-08-01", "activities": [{ "type": "joining", "description": "Student joined the academy", "time": "2026-08-01T00:00:00.000Z" }] },
      { "date": "2026-08-04", "activities": [{ "type": "surah_schedule_completion", "description": "Completed portion: Al-Fatihah verses 1 to 7", "time": "2026-08-04T10:00:00.000Z" }] }
    ]
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/students/academic-classes',
        summary: 'List active academic classes (filter: academic_year_id)',
        response: `{
  "status": "success",
  "filters": { "academic_year_id": null },
  "total_classes": 1,
  "data": [
    { "id": "cmclass0001abcxyzefgh123", "name": "Grade 5 - A", "code": "G5A", "status": "active" }
  ]
}`,
      },
      {
        method: 'POST',
        path: '/app/students/student-exams',
        summary: 'Add a student exam record',
        request: `{
  "student_id": "cmstudent001abcxyz7890",
  "exam_date": "2026-08-15",
  "exam_id": "cmexam0001abcxyz45",
  "result": "Pass",
  "marks": 87,
  "remarks": "Good tajweed"
}`,
        response: `{
  "status": "success",
  "message": "Student exam record added successfully",
  "data": {
    "id": "cmexamrec001abcxyz45",
    "student_id": "cmstudent001abcxyz7890",
    "exam_date": "2026-08-15",
    "exam_id": "cmexam0001abcxyz45",
    "result": "Pass",
    "marks": 87,
    "remarks": "Good tajweed",
    "schedule_id": null
  }
}`,
      },
      {
        method: 'PATCH',
        path: '/app/students/update-student-exams/:examId',
        summary: 'Update a student exam record (partial)',
        request: `{
  "marks": 91,
  "remarks": "Improved tajweed"
}`,
        response: `{
  "status": "success",
  "message": "Student exam record updated successfully",
  "data": {
    "id": "cmexamrec001abcxyz45",
    "student_id": "cmstudent001abcxyz7890",
    "exam_date": "2026-08-15",
    "exam_id": "cmexam0001abcxyz45",
    "result": "Pass",
    "marks": 91,
    "remarks": "Improved tajweed",
    "schedule_id": null
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/students/student-activity',
        summary: "Same as activity-report, plus record IDs and an 'exam' activity type (for editing)",
        request: `?student_id=cmstudent001abcxyz7890&month=8&year=2026`,
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "student_id": "STU-1042", "joining_date": "2026-08-01" },
    "date_range": { "start": "2026-08-01", "end": "2026-08-31" },
    "activities": [
      { "date": "2026-08-15", "activities": [{ "type": "exam", "description": "Exam: cmexam0001abcxyz45 - Result: Pass (Marks: 87)", "time": "2026-08-15", "id": "cmexamrec001abcxyz45", "record_type": "exam" }] }
    ]
  }
}`,
      },
    ],
  },
  {
    key: 'students-activity',
    label: 'Manage Students Activity',
    tab: 'dashboard',
    section: 'Quick Actions',
    order: 4,
    basePath: '/app/students',
    description:
      "Dashboard Quick Action gating the student-activity and activity-report endpoints " +
      "(a distinct permission from the Students module above, which covers profile CRUD).",
    permissionKey: 'mobile_api.students.activity.access',
    endpoints: [],
  },
  {
    key: 'students-reports',
    label: 'Student Reports',
    tab: 'dashboard',
    section: 'Quick Actions',
    order: 2,
    basePath: '/app/students',
    description: "Dashboard Quick Action gating the admission-year-reports endpoint.",
    permissionKey: 'mobile_api.students.reports.access',
    endpoints: [],
  },
  {
    key: 'dashboard-assign-halqa',
    label: 'Assign Students to Halqa',
    tab: 'dashboard',
    section: 'Quick Actions',
    order: 3,
    teacherOnly: true,
    basePath: '/app/halqas/assign-student',
    description: "Teacher's Dashboard Quick Action for assigning students to a Halqa — same permission as Halqa List (Halqa tab), surfaced again here since it's also a Dashboard shortcut.",
    permissionKey: 'mobile_api.halqas.access',
    endpoints: [],
  },
  {
    key: 'dashboard-announcements',
    label: 'Announcements',
    tab: 'dashboard',
    order: 8,
    teacherOnly: true,
    basePath: '/app/announcements',
    description: "Dashboard's Announcements shortcut — same permission as the Announcements module.",
    permissionKey: 'mobile_api.announcements.access',
    endpoints: [],
  },
  {
    key: 'student-surah-progress',
    label: "Today's Progress",
    tab: 'dashboard',
    section: 'Quick Actions',
    order: 1,
    basePath: '/app/student-surah-progress',
    description: 'Per-ayah-range Surah memorization progress ledger (New/Juzh/Old Lesson types, grading, verification, Juzuh/page-range tracking) — separate from the Surah Schedules module below. Legacy field names (badge classes, added_by/last_updated_by/verified_by, remark_file_url) are all present verbatim.',
    endpoints: [
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/surahs/:surahId/details/:studentId?',
        summary: "All of a student's progress entries for one Surah, grouped by completion date (filter: type)",
        legacyNumbers: [22, 27],
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "surah": { "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah", "total_ayahs": 286, "makki_or_madani": "MEDINAN", "place_of_revelation": "MEDINAN" },
    "progress_entries": [
      { "completed_at": "2026-08-01", "entries": [
        { "id": "cmentry0001abcxyz45", "surah_id": "cmsurah0002", "from_ayah": 1, "to_ayah": 20, "type": "New Lesson", "completion_status": "Completed", "grade": "Very Good", "completed_at": "2026-08-01 10:00:00", "completed_at_date": "2026-08-01", "verified_at": null, "remarks": null, "remark_file_url": null, "added_by": { "id": "cmteacher001abcxyz45678", "name": "Ahmad Hassan" }, "last_updated_by": null, "verified_by": null, "is_completed": true, "is_verified": false, "can_complete": false, "status_badge_class": "primary", "grade_badge_class": "success", "created_at": "2026-08-01 09:00:00", "updated_at": "2026-08-01 10:00:00" }
      ] }
    ],
    "statistics": { "total_ayahs": 286, "completed_ayahs": 20, "verified_ayahs": 0, "in_progress_ayahs": 0, "not_started_ayahs": 266, "total_completed": 20, "completion_rate": 7.0, "is_surah_completed": false }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/surah-progress-list/:studentId?',
        summary: 'List every Surah a student has any progress on, with per-surah status (filter: type)',
        legacyNumbers: [21],
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "surahs": [
      { "surah_id": "cmsurah0001", "surah_number": 1, "surah_name_ar": "الفاتحة", "surah_name_en": "Al-Fatihah", "total_ayahs": 7, "makki_or_madani": "MECCAN", "place_of_revelation": "MECCAN", "type": "New Lesson", "types": ["New Lesson"], "completion_status": "Completed", "progress_percentage": 100, "status_badge_class": "primary", "total_entries": 7, "completed_entries": 7, "in_progress_entries": 0, "not_started_entries": 0 }
    ],
    "statistics": { "total_surahs": 1, "completed_surahs": 1, "in_progress_surahs": 0, "not_started_surahs": 0, "overall_progress_percentage": 100 },
    "filter_applied": { "type": null }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/student/:studentId?',
        summary: 'The current "target" Surah for a student (auto-determined, or via ?surah_id), with next-Surah suggestion',
        legacyNumbers: [17, 26],
        request: `?surah_id=cmsurah0002&type=New Lesson`,
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "surah": { "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah", "total_ayahs": 286, "makki_or_madani": "MEDINAN", "place_of_revelation": "MEDINAN" },
    "next_surah": null,
    "progress_entries": [
      { "id": "cmentry0001abcxyz45", "surah_id": "cmsurah0002", "from_ayah": 1, "to_ayah": 20, "type": "New Lesson", "completion_status": "In Progress", "grade": null, "completed_at": null, "completed_at_date": null, "verified_at": null, "remarks": null, "remark_file_url": null, "added_by": null, "last_updated_by": null, "verified_by": null, "is_completed": false, "is_verified": false, "can_complete": true, "status_badge_class": "warning", "grade_badge_class": null, "created_at": "2026-08-01 09:00:00", "updated_at": "2026-08-01 09:00:00" }
    ],
    "statistics": { "total_ayahs": 286, "completed_ayahs": 0, "verified_ayahs": 0, "in_progress_ayahs": 1, "not_started_ayahs": 285, "total_completed": 0, "completion_rate": 0, "is_surah_completed": false },
    "logic_applied": { "determined_by": "requested_surah_id", "description": "Surah was explicitly requested via surah_id parameter" }
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/student-surah-progress/bulk-mark-completed',
        summary: 'Mark specific progress entries (ayahs) as completed',
        legacyNumbers: [19],
        request: `{
  "ayah_ids": ["cmentry0001abcxyz45", "cmentry0002abcxyz46"],
  "grade": "Very Good",
  "remarks": "Clear tajweed",
  "completed_at": "2026-08-02"
}`,
        response: `{
  "status": "success",
  "message": "2 ayah(s) marked as completed successfully",
  "data": { "updated_count": 2, "skipped_count": 0, "total_processed": 2, "file_uploaded": false, "file_name": null, "errors": [] }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/pending-surah/:studentId?',
        summary: 'List Surahs a student has started (from_ayah=1) but not finished (filter: type)',
        legacyNumbers: [18],
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "pending_surahs": [
      { "surah": { "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah", "total_ayahs": 286, "makki_or_madani": "MEDINAN", "place_of_revelation": "MEDINAN" }, "status": "In Progress", "type": "New Lesson" }
    ],
    "statistics": { "total_pending_surahs": 1 },
    "filter_applied": { "type": null }
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/student-surah-progress/student/bulk-mark-surah-completed',
        summary: 'Mark every pending entry across one or more whole Surahs as completed',
        legacyNumbers: [20],
        request: `{
  "student_id": "cmstudent001abcxyz7890",
  "surah_ids": ["cmsurah0001", "cmsurah0002"],
  "type": "New Lesson",
  "grade": "Good",
  "completed_at": "2026-08-02"
}`,
        response: `{
  "status": "success",
  "message": "Bulk surah completion successful",
  "data": {
    "student_id": "cmstudent001abcxyz7890",
    "total_surahs_processed": 2,
    "total_entries_completed": 15,
    "surah_summary": [
      { "surah_id": "cmsurah0001", "surah_name": "Al-Fatihah", "completed_entries": 7 },
      { "surah_id": "cmsurah0002", "surah_name": "Al-Baqarah", "completed_entries": 8 }
    ],
    "completed_at": "2026-08-02",
    "file_uploaded": false,
    "file_name": null
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/completed-surahs/:studentId?',
        summary: 'List Surahs with any (non "Not Started") progress, with completion status (default type: New Lesson)',
        legacyNumbers: [23, 28],
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "surahs": [
      { "surah_id": "cmsurah0001", "surah_number": 1, "surah_name_ar": "الفاتحة", "surah_name_en": "Al-Fatihah", "total_ayahs_in_surah": 7, "completed_ayah_count": 7, "surah_completed_at": "2026-08-01 10:00:00", "surah_completed_at_date": "2026-08-01", "status": "completed", "total_entries": 7, "completed_entries": 7, "progress_percentage": 100 }
    ],
    "statistics": { "total_surahs_with_progress": 1, "fully_completed_surahs": 1, "partially_completed_surahs": 0, "total_ayahs_completed_overall": 7, "total_ayahs_covered_overall": 7 },
    "filter_applied": { "type": "New Lesson" }
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/student-surah-progress/store-old-lesson',
        summary: 'Record an "Old Lesson"/"Juzh Lesson" entry (surah/juz/page ranges), always Completed',
        legacyNumbers: [25],
        request: `{
  "student_id": "cmstudent001abcxyz7890",
  "type": "Old Lesson",
  "completed_at": "2026-08-02",
  "surah_from": 1,
  "surah_from_ayah": 1,
  "surah_to": 1,
  "surah_to_ayah": 7,
  "grade": "Very Good",
  "remarks": "Full revision"
}`,
        response: `{
  "status": "success",
  "message": "Old Lesson progress saved successfully",
  "data": {
    "id": "cmoldlesson001abcxyz45",
    "student_id": "cmstudent001abcxyz7890",
    "type": "Old Lesson",
    "completion_status": "Completed",
    "completed_at": "2026-08-02",
    "grade": "Very Good",
    "remarks": "Full revision",
    "remark_file_url": null,
    "surah_from": 1,
    "surah_from_ayah": 1,
    "surah_to": 1,
    "surah_to_ayah": 7,
    "juzuh_from": null,
    "juzuh_to": null,
    "page_from": null,
    "page_to": null,
    "surah_range": "1",
    "juzuh_range": null,
    "page_range": null,
    "created_at": "2026-08-02 14:21:35"
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/old-lesson-progress/:studentId?',
        summary: 'Filtered, paginated list of Old/Juzh Lesson entries',
        legacyNumbers: [24, 29],
        request: `?type=Old Lesson&per_page=25`,
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor", "status": "active" } },
    "progress_records": [
      { "id": "cmoldlesson001abcxyz45", "completion_status": "Completed", "grade": "Very Good", "completed_at": "2026-08-02 00:00:00", "surah_from": 1, "surah_from_ayah": 1, "surah_to": 1, "surah_to_ayah": 7, "surah_range": "1", "juzuh_from": null, "juzuh_to": null, "juzuh_range": null, "page_from": null, "page_to": null, "page_range": null }
    ],
    "pagination": { "current_page": 1, "per_page": 25, "total": 1, "last_page": 1, "from": 1, "to": 1, "has_more_pages": false },
    "statistics": { "total_records": 1, "completed_records": 1, "verified_records": 0 },
    "filters_applied": { "type": "Old Lesson", "completed_at_from": null, "completed_at_to": null, "surah_from": null, "surah_to": null, "juzuh_from": null, "juzuh_to": null, "page_from": null, "page_to": null, "grade": null }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/today-progress',
        summary: 'Cross-student report: who completed progress in a date range vs. who is pending, plus leaves/exams/holidays',
        legacyNumbers: [33],
        request: `?from_date=2026-08-01&to_date=2026-08-02&halqa_id=cmhalqa0001abcxyz45`,
        response: `{
  "status": "success",
  "data": {
    "date_range": { "from_date": "2026-08-01", "to_date": "2026-08-02" },
    "filters": { "from_date": "2026-08-01", "to_date": "2026-08-02", "halqa_id": "cmhalqa0001abcxyz45", "student_id": null, "type": null },
    "completed": {
      "total_students": 1,
      "students": [
        { "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp" }, "activities": [{ "type": "New Lesson", "description": "Completed New Lesson – Surah Al-Baqarah (verses 1-20)", "time": "2026-08-01T10:00:00.000Z", "details": { "surah_id": "cmsurah0002", "from_ayah": 1, "to_ayah": 20, "grade": "Very Good" } }], "total_ayahs_today": 20, "lesson_types": [{ "type": "New Lesson", "total_ayahs": 20, "entries_count": 1 }], "surahs_completed": [{ "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah" }] }
      ]
    },
    "pending": { "total_students": 1, "students": [{ "student": { "id": "cmstudent003abcxyz7892", "name": "Omar Farouk", "email": null, "student_id": "cmstudent003abcxyz7892", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp" }, "activities": [], "total_ayahs_today": 0, "lesson_types": [], "surahs_completed": [] }] },
    "global_events": []
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/exceeded-target',
        summary: 'Students who completed more ayahs than their scheduled target in a date range',
        legacyNumbers: [63],
        request: `?from_date=2026-08-01&to_date=2026-08-02&min_excess=5`,
        response: `{
  "status": "success",
  "data": {
    "period": { "from_date": "2026-08-01", "to_date": "2026-08-02" },
    "filters": { "halqa_id": null, "type": null, "min_excess": 5, "limit": 20 },
    "total_students_exceeded": 1,
    "students": [
      { "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor" } }, "target_ayahs": 10, "actual_ayahs": 20, "excess_ayahs": 10 }
    ]
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/pending-targets',
        summary: 'Students falling short of their scheduled target in a date range',
        legacyNumbers: [65],
        request: `?from_date=2026-08-01&to_date=2026-08-02&min_deficit=3`,
        response: `{
  "status": "success",
  "data": {
    "period": { "from_date": "2026-08-01", "to_date": "2026-08-02" },
    "filters": { "halqa_id": null, "type": null, "min_deficit": 3, "limit": 20 },
    "total_students_with_pending": 1,
    "students": [
      { "student": { "id": "cmstudent003abcxyz7892", "name": "Omar Farouk", "email": null, "student_id": "cmstudent003abcxyz7892", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp", "halqa": { "id": "cmhalqa0001abcxyz45", "name": "Halqa Al-Noor" } }, "target_ayahs": 10, "actual_ayahs": 2, "deficit_ayahs": 8 }
    ]
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/reports',
        summary: 'Full completed/pending progress report for a date range, with recent-inactivity flagging',
        legacyNumbers: [64],
        request: `?from_date=2026-08-01&to_date=2026-08-02&halqa_id=cmhalqa0001abcxyz45`,
        response: `{
  "status": "success",
  "data": {
    "date_range": { "from_date": "2026-08-01", "to_date": "2026-08-02" },
    "inactive_lookback_days": 2,
    "filters": { "halqa_id": "cmhalqa0001abcxyz45", "student_id": null, "types": [] },
    "completed": { "total_students": 1, "total_ayahs_marked": 20, "students": [{ "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp" }, "is_inactive_recent": false, "total_ayahs_today": 20, "surahs_completed": [{ "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah" }], "lesson_types": [{ "type": "New Lesson", "total_ayahs": 20, "entries_count": 1 }] }] },
    "pending": { "total_students": 1, "students": [{ "student": { "id": "cmstudent003abcxyz7892", "name": "Omar Farouk", "email": null, "student_id": "cmstudent003abcxyz7892", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp" }, "is_inactive_recent": true }] }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/student-surah-progress/students/top',
        summary: 'Students ranked by total ayahs completed in a date range',
        legacyNumbers: [62],
        request: `?from_date=2026-08-01&to_date=2026-08-02&limit=5`,
        response: `{
  "status": "success",
  "data": {
    "date_range": { "from_date": "2026-08-01", "to_date": "2026-08-02" },
    "filters": { "halqa_id": null, "student_id": null, "types": [] },
    "top_students": {
      "limit": 5,
      "total_students_with_records": 1,
      "students": [
        { "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "email": null, "student_id": "cmstudent001abcxyz7890", "image_url": "https://www.gravatar.com/avatar/....png?s=200&d=mp" }, "total_ayahs": 20, "total_entries": 1, "lesson_types": [{ "type": "New Lesson", "total_ayahs": 20, "entries_count": 1 }], "surahs_completed": [{ "id": "cmsurah0002", "surah_number": 2, "name_ar": "البقرة", "name_en": "Al-Baqarah" }] }
      ]
    }
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/student-surah-progress/update',
        summary: 'Edit (grade/remarks/completed_at) or unmark progress entries',
        request: `{
  "progress_ids": ["cmentry0001abcxyz45"],
  "grade": "Good",
  "remarks": "Needs more tajweed practice"
}`,
        response: `{
  "status": "success",
  "message": "Progress updated successfully",
  "data": { "updated_count": 1, "progress_ids": ["cmentry0001abcxyz45"] }
}`,
      },
    ],
  },
  {
    key: 'surah-schedules',
    label: 'Surah Schedules',
    tab: 'schedules',
    basePath: '/app/surah-schedules',
    description: "A student's Hifdh (memorization) schedule and progress summary. Legacy reads a non-existent `quality_assessment` column (always null in production) — replicated verbatim, not fixed.",
    endpoints: [
      {
        method: 'GET',
        path: '/app/surah-schedules/student/:studentId?',
        summary: "Get a student's Surah schedule, filtered/paginated (schedule_no, surah_number, status, search, date range, year/month, page, per_page)",
        legacyNumbers: [15, 30],
        response: `{
  "status": "success",
  "data": {
    "student": { "id": "cmstudent001abcxyz7890", "name": "Yusuf Ibrahim", "halqa_name": "Halqa Al-Noor", "halqa_id": "cmhalqa0001abcxyz45" },
    "progress_summary": { "total_schedules": 30, "completed_schedules": 12, "in_progress_schedules": 1, "pending_schedules": 17, "needs_review_schedules": 0, "today": 1, "overdue": 2, "upcoming": 15, "overall_percentage": 40.0, "schedule_no": 1 },
    "surah_progress": [
      { "surah_number": 1, "surah_name_en": "Al-Fatihah", "surah_name_ar": "الفاتحة", "total": 7, "completed": 7, "in_progress": 0, "pending": 0, "needs_review": 0, "percentage": 100, "is_completed": true }
    ],
    "current_surah": { "number": 2, "name_en": "Al-Baqarah", "name_ar": "البقرة", "completed_entries": 20, "total_entries": 286, "percentage": 7.0 },
    "current_schedule_completed": false,
    "available_schedule_numbers": [1],
    "schedules": [
      { "id": "cmsched0001abcxyz45", "day": 1, "date": "2026-08-01", "scheduled_date": null, "display_date": "2026-08-01", "surah_number": 2, "surah_name_en": "Al-Baqarah", "surah_name_ar": "البقرة", "juz_number": null, "page_from": 3, "page_to": 4, "verse_from": 1, "verse_to": 20, "schedule_type": "NEW", "completion_status": "completed", "completion_status_display": "Completed", "completion_date": "2026-08-01", "quality_assessment": null, "quality_assessment_display": "Not assessed", "difficulty_level": "medium", "difficulty_level_display": "Medium", "notes": null, "teacher_notes": null, "halqa_name": "Halqa Al-Noor", "schedule_no": 1, "status_badge_class": "success", "quality_badge_class": "secondary", "difficulty_badge_class": "warning", "is_overdue": false, "is_today": false, "is_upcoming": false }
    ],
    "pagination": { "total_entries": 30, "per_page": 30, "current_page": 1, "total_pages": 1, "has_more_pages": false }
  }
}`,
      },
      {
        method: 'GET',
        path: '/app/surah-schedules/student/yearsmonths/:studentId?',
        summary: 'Get the years/months that have scheduled entries for a student',
        legacyNumbers: [16, 31],
        response: `{
  "status": "success",
  "data": {
    "student_id": "cmstudent001abcxyz7890",
    "available_periods": [
      { "year": 2026, "total_schedules": 30, "completed_schedules": 12, "months": [{ "month": 8, "month_name": "August", "total_count": 30, "completed_count": 12, "completion_percentage": 40.0 }], "completion_percentage": 40.0 }
    ],
    "summary": { "total_years": 1, "earliest_year": 2026, "latest_year": 2026, "total_schedules": 30, "total_completed": 12 }
  }
}`,
      },
    ],
  },
  {
    key: 'lesson-stages',
    label: 'Lesson Stages',
    tab: 'lessons',
    basePath: '/app/lesson-stages',
    description: 'Read-only curriculum reference content (stages + their sub-stages) for the mobile lesson browser. Not branch-scoped — shared config, same as the admin Configuration module. Gated by the same permission as Lessons below (both live under LessonContentController).',
    permissionKey: 'mobile_api.lesson_content.access',
    endpoints: [
      {
        method: 'GET',
        path: '/app/lesson-stages',
        summary: 'List lesson stages, each with its ordered sub-stages and a lesson count',
        legacyNumbers: [34],
        response: `{
  "status": "success",
  "data": [
    {
      "id": "cmropdpt40002r1x2fphvgel2",
      "name": "Stage 1",
      "description": null,
      "sortOrder": 0,
      "status": "ACTIVE",
      "createdAt": "2026-07-17T08:55:51.785Z",
      "updatedAt": "2026-07-17T08:55:51.785Z",
      "subStages": [],
      "_count": { "lessons": 0 }
    }
  ]
}`,
      },
      {
        method: 'GET',
        path: '/app/lesson-stages/show/:id',
        summary: 'Get one lesson stage with its sub-stages and lesson count',
        legacyNumbers: [35],
        response: `{
  "status": "success",
  "data": {
    "id": "cmropdpt40002r1x2fphvgel2",
    "name": "Stage 1",
    "subStages": [],
    "_count": { "lessons": 0 }
  }
}`,
      },
    ],
  },
  {
    key: 'lessons',
    label: 'Lessons',
    tab: 'lessons',
    basePath: '/app/lessons',
    description: "Read-only lesson list, filterable by stage/sub-stage — branch-scoped, wraps the same LessonsService the admin Academic module uses. Legacy's two separate query-param routes (stage_id, sub_stage_id) are the same endpoint here.",
    permissionKey: 'mobile_api.lesson_content.access',
    endpoints: [
      {
        method: 'GET',
        path: '/app/lessons',
        summary: 'List lessons (filters: stage_id, sub_stage_id)',
        legacyNumbers: [36, 37],
        request: `?stage_id=cmropdpt40002r1x2fphvgel2`,
        response: `{
  "status": "success",
  "data": [
    { "id": "cmlesson001abcxyz45", "branchId": "cmronw3bh000ug78u36n8enm1", "lessonStageId": "cmropdpt40002r1x2fphvgel2", "lessonSubStageId": null, "title": "Noorani Qaida - Lesson 1", "description": null, "sortOrder": 0, "status": "ACTIVE" }
  ]
}`,
      },
    ],
  },
  {
    key: 'hr-lookups',
    label: 'HR Lookups',
    basePath: '/app',
    description: 'Read-only department/designation dropdown data for the mobile app. Legacy field names verbatim (departments come from legacy\'s "Team" model, aliased to name).',
    endpoints: [
      {
        method: 'GET',
        path: '/app/departments',
        summary: 'List departments (id, name only)',
        legacyNumbers: [45],
        response: `{ "departments": [{ "id": "cmroqo61o0003wimki17fazdi", "name": "Academics" }, { "id": "cmroqo66y0005wimksukk87aw", "name": "Hifdh Wing" }] }`,
      },
      {
        method: 'GET',
        path: '/app/designations',
        summary: 'List designations (id, name only)',
        legacyNumbers: [44],
        response: `{ "designations": [{ "id": "cmshy06zs000511278e8asz0m", "name": "Principal" }, { "id": "cmroqo69e0007wimkaihtjwdt", "name": "Senior Teacher" }] }`,
      },
    ],
  },
  {
    key: 'profile',
    label: 'Profile',
    tab: 'profile',
    basePath: '/app/profile',
    description: "The caller's own Employee/Student/User profile. Legacy's task-completion stats (total_tasks, completed_percentage) are dropped — no Task module exists in aqa_v2. Avatar upload is accepted but not persisted — no avatar storage exists yet, `image` is always null.",
    endpoints: [
      {
        method: 'GET',
        path: '/app/profile',
        summary: "Get the caller's own profile",
        legacyNumbers: [38],
        response: `{
  "error": false,
  "data": {
    "id": "cmshvxysh0009dwmkan8qdg69",
    "name": "Teacher 2",
    "email": null,
    "phone_number": null,
    "image": null,
    "gender": null,
    "address": null,
    "qualification": null,
    "date_of_birth": null,
    "department_id": null,
    "department": null,
    "designation_id": null,
    "designation": null,
    "joining_date": null
  }
}`,
      },
      {
        method: 'POST',
        path: '/app/edit-profile',
        summary: "Update the caller's own profile (multipart/form-data — `image` is accepted but discarded)",
        request: `name=Teacher One&email=teacher1@example.com&phone_number=9998887777&address=123 Main St&qualification=Ijazah in Hifs&gender=male&date_of_birth=1990-05-15&joining_date=2020-01-10`,
        response: `{
  "error": false,
  "data": {
    "id": "cmshvxysh0009dwmkan8qdg69",
    "name": "Teacher One",
    "email": "teacher1@example.com",
    "phone_number": "9998887777",
    "image": null,
    "gender": "MALE",
    "address": "123 Main St",
    "qualification": "Ijazah in Hifs",
    "date_of_birth": "1990-05-15T00:00:00.000Z",
    "department_id": "cmtk17pn90001z3gyai3qaufk",
    "department": "Academics",
    "designation_id": "cmtk17pnl0003z3gy7ndu59vu",
    "designation": "Quran Teacher",
    "joining_date": "2020-01-10T00:00:00.000Z"
  }
}`,
      },
    ],
  },
  {
    key: 'profile-edit',
    label: 'Edit Profile',
    tab: 'profile',
    basePath: '/app/edit-profile',
    description: 'Edit own profile — split from viewing the Profile module above so edit access can be granted independently.',
    permissionKey: 'mobile_api.profile.edit',
    endpoints: [],
  },
  {
    key: 'dashboard',
    label: 'Summary Card',
    tab: 'dashboard',
    order: 0,
    basePath: '/app/teacher-dashboard',
    description: "Summary counts for the caller's own Halqas/students, plus a branch announcements feed (a new Announcement model — no admin CRUD UI yet, rows are seeded/managed directly). Also gates /app/admin-dashboard (branch-wide teacher/student/Halqa/attendance/progress summary for admin roles). Unlike legacy, the response shape is consistent even when the teacher has no Halqas (user/announcements are always present).",
    endpoints: [
      {
        method: 'GET',
        path: '/app/teacher-dashboard',
        summary: "Get the calling teacher's dashboard summary",
        legacyNumbers: [32],
        response: `{
  "error": false,
  "data": {
    "user": { "id": "cmshvxysh0009dwmkan8qdg69", "name": "Teacher 2", "email": null },
    "total_students": 3,
    "recited_students": 2,
    "students_completed_today": 0,
    "percentage_completed_today": 0,
    "announcements": [
      { "icon": null, "title": "Term starts Monday", "description": "Welcome back!", "date": "2026-08-01T00:00:00.000Z" }
    ]
  }
}`,
      },
    ],
  },
  {
    key: 'leaves',
    label: 'Leaves (Staff)',
    basePath: '/app',
    description: 'Leave types, self-service apply/cancel/my-leaves — thin wrappers over the same LeavesService the admin HR module uses. Leave types are a new named LeaveType lookup table (branch-scoped), not the free-text string the underlying Leave/LeaveQuota rows still also carry. Approve/reject is now a separate permission (Leave Approvals, below).',
    endpoints: [
      {
        method: 'GET',
        path: '/app/leaves/types',
        summary: 'List active leave types for this branch',
        legacyNumbers: [54, 59],
        response: `{ "status": "success", "data": [{ "id": "cmsnlxeme00jsajd0iyld0f2h", "name": "Casual Leave" }, { "id": "cmsnlxemy00jwajd0cf0qbxpa", "name": "Earned Leave" }, { "id": "cmsnlxemq00juajd0v8v8whjo", "name": "Sick Leave" }] }`,
      },
      {
        method: 'GET',
        path: '/app/leaves/approvals',
        summary: 'Pending/approved leave buckets for this branch (admin)',
        legacyNumbers: [53],
        response: `{
  "pending": [{ "id": "cmsnm6s6w000qfqxwfksl7kgq", "employeeId": "cmshvxysl000bdwmkprlhfvlu", "leaveType": "Casual Leave", "status": "PENDING", "startDate": "2026-08-15T00:00:00.000Z", "endDate": "2026-08-15T00:00:00.000Z", "reason": "Test" }],
  "completed": []
}`,
      },
      {
        method: 'GET',
        path: '/app/leaves/my-leaves',
        summary: "The caller's own leave history plus a per-type quota summary",
        legacyNumbers: [58],
        response: `{
  "totalLeaves": 1,
  "leaves": [{ "id": "cmsnm6s6w000qfqxwfksl7kgq", "leaveType": "Casual Leave", "status": "APPROVED", "startDate": "2026-08-15T00:00:00.000Z", "endDate": "2026-08-15T00:00:00.000Z" }],
  "leaveSummary": [{ "leaveTypeId": "cmsnlxeme00jsajd0iyld0f2h", "leaveTypeName": "Casual Leave", "allocated": "12.00", "taken": "1.00", "remaining": 11 }]
}`,
      },
      {
        method: 'POST',
        path: '/app/leaves/apply-leave',
        summary: 'Self-apply for leave (employeeId resolved from the token, not the body)',
        legacyNumbers: [60],
        request: `{
  "start_date": "2026-08-15",
  "end_date": "2026-08-15",
  "type": "cmsnlxeme00jsajd0iyld0f2h",
  "reason": "Test"
}`,
        response: `{ "status": "success", "message": "Leave request applied successfully", "data": { "id": "cmsnm6s6w000qfqxwfksl7kgq", "leaveType": "Casual Leave", "status": "PENDING" } }`,
      },
      {
        method: 'POST',
        path: '/app/attendance/approve-leave',
        summary: 'Approve a pending leave request (admin)',
        legacyNumbers: [55],
        request: `{ "leave_id": "cmsnm6s6w000qfqxwfksl7kgq" }`,
        response: `{ "status": "success", "message": "Leave request approved successfully", "data": { "id": "cmsnm6s6w000qfqxwfksl7kgq", "status": "APPROVED" } }`,
      },
      {
        method: 'POST',
        path: '/app/leaves/:id/reject',
        summary: 'Reject a pending leave request (admin)',
        legacyNumbers: [56],
        request: `{ "rejection_reason": "Insufficient quota" }`,
        response: `{ "status": "success", "message": "Leave request rejected", "data": { "id": "cmsnm6s6w000qfqxwfksl7kgq", "status": "REJECTED" } }`,
      },
      {
        method: 'POST',
        path: '/app/attendance/cancel-leave',
        summary: "Self-cancel one of the caller's own pending/pre-approved leave requests",
        legacyNumbers: [57],
        request: `{ "leave_id": "cmsnm6s6w000qfqxwfksl7kgq" }`,
        response: `{ "status": "success", "message": "Leave request canceled successfully" }`,
      },
    ],
  },
  {
    key: 'leaves-approve',
    label: 'Leave Approvals',
    tab: 'attendance',
    order: 2,
    basePath: '/app',
    description: 'Approve/reject staff leave requests (leaves/approvals, attendance/approve-leave, leaves/:id/reject) — split from the Leaves (Staff) module above so approval can be granted independently of self-service apply.',
    permissionKey: 'mobile_api.leaves.approve',
    endpoints: [],
  },
  {
    key: 'tab-attendance',
    label: 'Attendance Tab (master)',
    basePath: '/app',
    description: "Master switch for the Attendance tab itself — a role needs this to see the tab at all (My Attendance/My Leaves show unconditionally once it does). The permissions below it further narrow what's usable inside the tab.",
    permissionKey: 'mobile_api.tab_attendance.access',
    endpoints: [],
  },
  {
    key: 'attendance',
    label: 'Employee Attendance',
    tab: 'attendance',
    order: 1,
    basePath: '/app/attendance',
    description: "Own/all-employee attendance summaries and reports (Employee Attendance). Approving/rejecting pending clock-ins is now a separate permission (Attendance Approvals, below).",
    endpoints: [
      {
        method: 'GET',
        path: '/app/attendance-summary',
        summary: "The caller's own attendance summary + daily rows for a month (required: year, month)",
        legacyNumbers: [46],
        request: `?year=2026&month=8`,
        response: `{
  "workingDays": 10, "present": 0, "absent": 10, "leave": 0, "pendingApproval": 0,
  "dailyReport": [{ "date": "2026-08-10", "day": "Monday", "status": "ABSENT", "attendanceId": null, "clockInAt": null, "clockOutAt": null, "clockInLat": null, "clockInLng": null }]
}`,
      },
      {
        method: 'GET',
        path: '/app/employees-attendance-summery',
        summary: 'Every employee\'s attendance summary (counts only, no daily rows) for a date range (admin)',
        legacyNumbers: [47],
        request: `?start_date=2026-08-01&end_date=2026-08-11`,
        response: `{
  "status": "success",
  "dateRange": { "startDate": "2026-08-01", "endDate": "2026-08-11" },
  "totalEmployees": 2,
  "employeeSummaries": [{ "employeeId": "cmshvxysl000bdwmkprlhfvlu", "employeeName": "Teacher 2", "employeeEmail": null, "workingDays": 10, "present": 0, "absent": 10, "leave": 0, "pendingApproval": 0 }]
}`,
      },
      {
        method: 'GET',
        path: '/app/attendance/employee/:employeeId/report',
        summary: "One employee's attendance summary + daily rows for a date range (admin)",
        legacyNumbers: [48],
        request: `?start_date=2026-08-01&end_date=2026-08-11`,
        response: `{
  "status": "success",
  "dateRange": { "startDate": "2026-08-01", "endDate": "2026-08-11" },
  "employee": { "id": "cmshvxysl000bdwmkprlhfvlu", "name": "Teacher 2", "email": null },
  "summary": { "workingDays": 10, "present": 0, "absent": 10, "leave": 0, "pendingApproval": 0 },
  "dailyReport": [{ "date": "2026-08-10", "day": "Monday", "status": "ABSENT", "attendanceId": null, "clockInAt": null, "clockOutAt": null, "clockInLat": null, "clockInLng": null }]
}`,
      },
      {
        method: 'GET',
        path: '/app/attendance/not-approved',
        summary: 'List attendance rows awaiting review (admin)',
        legacyNumbers: [49],
        response: `{ "error": false, "message": "", "data": [{ "id": "att001", "employeeId": "cmshvxysl000bdwmkprlhfvlu", "date": "2026-08-11T00:00:00.000Z", "status": "PENDING_APPROVAL", "clockInAt": "2026-08-10T19:18:32.285Z", "employee": { "employeeCode": "EMP001", "user": { "firstName": "Teacher", "lastName": "2" } } }] }`,
      },
      {
        method: 'GET',
        path: '/app/attendance/approved',
        summary: 'List attendance rows that went through review and were approved (admin)',
        legacyNumbers: [50],
        response: `{ "error": false, "message": "", "data": [{ "id": "att001", "status": "PRESENT", "reviewedById": "cmronw3d8000xg78u4698y37h", "reviewedAt": "2026-08-10T19:18:41.961Z" }] }`,
      },
      {
        method: 'POST',
        path: '/app/attendance/approve/:id',
        summary: 'Approve a pending clock-in (admin) — sets status to PRESENT',
        legacyNumbers: [51],
        response: `{ "status": "success", "message": "Attendance request approved and records saved." }`,
      },
      {
        method: 'POST',
        path: '/app/attendance/reject/:id',
        summary: 'Reject a pending clock-in (admin)',
        legacyNumbers: [52],
        request: `{ "rejection_reason": "No location match" }`,
        response: `{ "status": "success", "message": "Attendance request rejected successfully" }`,
      },
    ],
  },
  {
    key: 'attendance-approve',
    label: 'Attendance Approvals',
    tab: 'attendance',
    order: 4,
    basePath: '/app/attendance',
    description: 'Review and approve/reject pending mobile clock-in requests (not-approved, approved, approve/:id, reject/:id) — split from Attendance (view) above so approval can be granted independently of just viewing summaries/reports.',
    permissionKey: 'mobile_api.attendance.approve',
    endpoints: [],
  },
  {
    key: 'attendance-student-summary',
    label: 'Student Summary',
    tab: 'attendance',
    order: 5,
    basePath: '/app',
    description: "Teacher's Attendance tab student-attendance summary — not implemented yet in aqa_v2, always off until built.",
    permissionKey: 'mobile_api.attendance.student_summary',
    alwaysOff: true,
    endpoints: [],
  },
];
