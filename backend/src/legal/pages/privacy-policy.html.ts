import { pageShell } from './page-shell';

const BODY = `
<h1>Privacy Policy</h1>
<p class="meta">AqaConnect &middot; Last updated September 9, 2026</p>

<p>
  AqaConnect ("we", "us") provides an academic management platform used by
  schools/madrasahs to manage students, staff, attendance, academic and
  Hifdh progress, fees, and related communication, including through a
  companion mobile app for teachers, students, and parents. This policy
  explains what information the platform collects and how it is used.
</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> name, username, and optional
    contact details (email, phone, WhatsApp number).</li>
  <li><strong>Academic records:</strong> attendance, class/section
    enrollment, Hifdh and lesson progress, exam results.</li>
  <li><strong>Staff/HR records:</strong> for employees and teachers &mdash;
    designation, department, attendance, leave records.</li>
  <li><strong>Fee and payment records:</strong> fee demands, discounts, and
    payment history, where applicable to your branch/school.</li>
  <li><strong>Device information:</strong> a push-notification token
    (via Firebase Cloud Messaging) used to deliver in-app notifications and
    announcements.</li>
</ul>

<p>
  Accounts on AqaConnect are created and managed by your school/branch
  administrator &mdash; the platform does not offer public self-registration.
  For students, account and profile data is managed on behalf of the student
  by the school and/or their parent or guardian.
</p>

<h2>How we use this information</h2>
<p>
  Information is used solely to operate the platform for your school: to
  record and display academic/attendance/exam progress, manage staff and fee
  records, and deliver notifications and announcements relevant to your
  branch. We do not sell your data or share it with third parties for
  advertising purposes. Push notification delivery uses Firebase Cloud
  Messaging (Google) solely as a delivery mechanism.
</p>

<h2>Data retention</h2>
<p>
  Academic, HR, and fee records are retained by the school for as long as
  needed for administrative and record-keeping purposes. If you request
  account deletion (see below), your login is deactivated and personal
  contact details are removed, while the underlying academic/HR/fee records
  are retained by the school, consistent with standard educational
  record-keeping practice.
</p>

<h2>Security</h2>
<p>
  Passwords are stored using one-way bcrypt hashing and are never visible to
  staff or administrators. Access to the app and API is protected by
  short-lived access tokens and revocable refresh tokens.
</p>

<h2>Your rights</h2>
<p>
  You may request deletion of your account and personal contact information
  at any time via our <a href="/delete-account">Delete Account</a> page.
  For any other privacy questions or requests, contact us at
  <a href="mailto:czprojectsonline@gmail.com">czprojectsonline@gmail.com</a>.
</p>

<h2>Changes to this policy</h2>
<p>
  We may update this policy from time to time; the "Last updated" date above
  will reflect the most recent revision.
</p>
`;

export const PRIVACY_POLICY_HTML = pageShell('Privacy Policy', BODY);
