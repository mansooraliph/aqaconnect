import { pageShell } from './page-shell';

const BODY = `
<h1>Terms &amp; Conditions</h1>
<p class="meta">AqaConnect &middot; Last updated September 9, 2026</p>

<p>
  These terms govern use of the AqaConnect academic management platform,
  including its web portal and companion mobile app. By using AqaConnect,
  you agree to these terms.
</p>

<h2>Accounts</h2>
<p>
  Accounts are provisioned and managed by your school/branch administrator;
  AqaConnect does not offer public self-registration. You are responsible
  for keeping your login credentials confidential and for activity that
  occurs under your account.
</p>

<h2>Acceptable use</h2>
<p>
  The platform is provided for legitimate academic, administrative, and
  communication purposes related to your school. You agree not to misuse
  the platform, attempt to access data outside your authorized role or
  branch, or interfere with its normal operation.
</p>

<h2>Data</h2>
<p>
  Use of the platform is also governed by our
  <a href="/privacy-policy">Privacy Policy</a>, which describes what
  information is collected and how it is used and retained.
</p>

<h2>Disclaimer</h2>
<p>
  AqaConnect is provided "as is" without warranties of any kind, to the
  fullest extent permitted by law. We are not liable for indirect,
  incidental, or consequential damages arising from use of the platform.
</p>

<h2>Changes to these terms</h2>
<p>
  We may update these terms from time to time; the "Last updated" date above
  will reflect the most recent revision. Continued use of the platform after
  changes take effect constitutes acceptance of the revised terms.
</p>

<h2>Contact</h2>
<p>
  Questions about these terms can be sent to
  <a href="mailto:czprojectsonline@gmail.com">czprojectsonline@gmail.com</a>.
</p>
`;

export const TERMS_HTML = pageShell('Terms & Conditions', BODY);
