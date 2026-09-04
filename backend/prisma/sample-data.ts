import { ActiveStatus, EmployeeType, PrismaClient, ProgressEntryStatus, ProgressEntryType } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureEmployeeAndTeacher(params: {
  userId: string;
  branchId: string;
  employeeCode: string;
  departmentId: string;
  designationId: string;
}) {
  const { userId, branchId, employeeCode, departmentId, designationId } = params;

  let employee = await prisma.employee.findUnique({ where: { userId } });
  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        userId,
        branchId,
        employeeCode,
        employeeType: EmployeeType.TEACHER,
        departmentId,
        designationId,
        dateOfJoining: new Date(),
        status: ActiveStatus.ACTIVE,
      },
    });
    console.log(`Created Employee ${employeeCode} for user ${userId}`);
  }

  let teacher = await prisma.teacher.findUnique({ where: { userId } });
  if (!teacher) {
    teacher = await prisma.teacher.create({
      data: {
        userId,
        branchId,
        employeeId: employee.id,
        employeeCode,
        status: ActiveStatus.ACTIVE,
      },
    });
    console.log(`Created Teacher profile for user ${userId}`);
  }

  return teacher;
}

async function ensureStudent(params: { branchId: string; studentCode: string; name: string; guardianName: string; guardianPhone: string }) {
  const { branchId, studentCode, name, guardianName, guardianPhone } = params;
  const existing = await prisma.student.findFirst({ where: { branchId, studentCode } });
  if (existing) return existing;

  const student = await prisma.student.create({
    data: {
      branchId,
      studentCode,
      name,
      guardianName,
      guardianPhone,
      joiningDate: new Date(),
      hifdhStartDate: new Date(),
      status: ActiveStatus.ACTIVE,
    },
  });
  console.log(`Created Student ${name} (${studentCode})`);
  return student;
}

async function ensureHalqaStudent(halqaId: string, studentId: string) {
  const existing = await prisma.halqaStudent.findUnique({
    where: { halqaId_studentId: { halqaId, studentId } },
  });
  if (existing) return existing;
  return prisma.halqaStudent.create({ data: { halqaId, studentId } });
}

async function main() {
  const branch = await prisma.branch.findUniqueOrThrow({ where: { code: 'MAIN' } });

  console.log('Seeding sample department/designation...');
  const department =
    (await prisma.department.findFirst({ where: { branchId: branch.id, name: 'Academics' } })) ??
    (await prisma.department.create({ data: { branchId: branch.id, name: 'Academics' } }));
  const designation =
    (await prisma.designation.findFirst({ where: { branchId: branch.id, name: 'Quran Teacher' } })) ??
    (await prisma.designation.create({ data: { branchId: branch.id, name: 'Quran Teacher' } }));

  console.log('Linking admin account to an Employee + Teacher profile...');
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@example.com' } });
  const adminTeacher = await ensureEmployeeAndTeacher({
    userId: admin.id,
    branchId: branch.id,
    employeeCode: 'EMP-ADMIN',
    departmentId: department.id,
    designationId: designation.id,
  });

  // Backfill department/designation on the existing Teacher1 employee if missing.
  const teacher1User = await prisma.user.findFirst({ where: { username: 'Teacher1' } });
  let teacher1: { id: string } | null = null;
  if (teacher1User) {
    const teacher1Employee = await prisma.employee.findUnique({ where: { userId: teacher1User.id } });
    if (teacher1Employee && !teacher1Employee.departmentId) {
      await prisma.employee.update({
        where: { id: teacher1Employee.id },
        data: { departmentId: department.id, designationId: designation.id },
      });
    }
    teacher1 = await prisma.teacher.findUnique({ where: { userId: teacher1User.id } });
  }

  console.log('Assigning teachers to Halqas...');
  const halqa1 = await prisma.halqa.findFirstOrThrow({ where: { branchId: branch.id, name: 'Halqa 1' } });
  await prisma.halqa.update({ where: { id: halqa1.id }, data: { teacherId: adminTeacher.id, startDate: new Date() } });

  let halqa2 = await prisma.halqa.findFirst({ where: { branchId: branch.id, name: 'Halqa 2' } });
  if (!halqa2) {
    halqa2 = await prisma.halqa.create({
      data: {
        branchId: branch.id,
        name: 'Halqa 2',
        teacherId: teacher1?.id,
        startDate: new Date(),
        status: ActiveStatus.ACTIVE,
      },
    });
    console.log('Created Halqa 2');
  } else if (teacher1 && !halqa2.teacherId) {
    await prisma.halqa.update({ where: { id: halqa2.id }, data: { teacherId: teacher1.id } });
  }

  console.log('Seeding sample students...');
  const existingStudent = await prisma.student.findFirst({ where: { branchId: branch.id, studentCode: '001' } });

  const sampleStudents = [
    { studentCode: '002', name: 'Ahmed Ali', guardianName: 'Mohammed Ali', guardianPhone: '9876543210' },
    { studentCode: '003', name: 'Yusuf Rahman', guardianName: 'Abdul Rahman', guardianPhone: '9876543211' },
    { studentCode: '004', name: 'Maryam Siddiqui', guardianName: 'Imran Siddiqui', guardianPhone: '9876543212' },
    { studentCode: '005', name: 'Fatima Noor', guardianName: 'Noor Uddin', guardianPhone: '9876543213' },
  ];

  const created: Awaited<ReturnType<typeof ensureStudent>>[] = [];
  for (const s of sampleStudents) {
    created.push(await ensureStudent({ branchId: branch.id, ...s }));
  }
  const [ahmed, yusuf, maryam, fatima] = created;

  console.log('Assigning students to Halqas...');
  if (existingStudent) await ensureHalqaStudent(halqa1.id, existingStudent.id);
  await ensureHalqaStudent(halqa1.id, ahmed.id);
  await ensureHalqaStudent(halqa1.id, yusuf.id);
  await ensureHalqaStudent(halqa2.id, maryam.id);
  await ensureHalqaStudent(halqa2.id, fatima.id);

  console.log('Seeding sample Surah progress entries...');
  const alFatihah = await prisma.surah.findFirstOrThrow({ where: { number: 1 } });
  const alBaqarah = await prisma.surah.findFirstOrThrow({ where: { number: 2 } });

  const todayCompleted = [
    { student: ahmed, surahId: alFatihah.id, fromAyah: 1, toAyah: 7 },
    { student: yusuf, surahId: alBaqarah.id, fromAyah: 1, toAyah: 5 },
  ];
  for (const entry of todayCompleted) {
    const already = await prisma.studentSurahProgressEntry.findFirst({
      where: { studentId: entry.student.id, surahId: entry.surahId, status: ProgressEntryStatus.COMPLETED },
    });
    if (!already) {
      await prisma.studentSurahProgressEntry.create({
        data: {
          branchId: branch.id,
          studentId: entry.student.id,
          surahId: entry.surahId,
          fromAyah: entry.fromAyah,
          toAyah: entry.toAyah,
          type: ProgressEntryType.NEW_LESSON,
          status: ProgressEntryStatus.COMPLETED,
          completedAt: new Date(),
          grade: 'GOOD',
        },
      });
    }
  }

  // A pending (not started) entry for the remaining students so "today's pending" lists aren't empty.
  for (const student of [maryam, fatima, existingStudent].filter(Boolean) as { id: string }[]) {
    const already = await prisma.studentSurahProgressEntry.findFirst({
      where: { studentId: student.id, status: ProgressEntryStatus.NOT_STARTED },
    });
    if (!already) {
      await prisma.studentSurahProgressEntry.create({
        data: {
          branchId: branch.id,
          studentId: student.id,
          surahId: alFatihah.id,
          fromAyah: 1,
          toAyah: 7,
          type: ProgressEntryType.NEW_LESSON,
          status: ProgressEntryStatus.NOT_STARTED,
        },
      });
    }
  }

  console.log('Seeding sample announcement...');
  const existingAnnouncement = await prisma.announcement.findFirst({ where: { branchId: branch.id } });
  if (!existingAnnouncement) {
    await prisma.announcement.create({
      data: {
        branchId: branch.id,
        title: 'Welcome to AQA App',
        description: 'Ramadan schedule updates will be posted here. Keep up the great work with your Hifdh journey!',
        icon: '📢',
        createdById: admin.id,
      },
    });
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('Sample data seeded.');
  console.log('Admin login (now has a linked teacher profile too):');
  console.log('  username: admin');
  console.log('  password: ChangeMe123!');
  console.log('─────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
