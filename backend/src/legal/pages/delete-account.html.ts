import { pageShell } from './page-shell';

const BODY = `
<h1>Delete Account</h1>
<p class="meta">AqaConnect</p>

<p>
  Use this form to request deletion of your AqaConnect account. Confirming
  will:
</p>
<ul>
  <li>Deactivate your login and sign you out of all devices.</li>
  <li>Remove your stored contact details (email, phone, WhatsApp number).</li>
</ul>
<p>
  Your school's academic, attendance, HR, and fee records associated with
  your profile are <strong>retained</strong> by the school for administrative
  record-keeping, as described in our
  <a href="/privacy-policy">Privacy Policy</a>. If you need those records
  removed as well, contact your school administrator or
  <a href="mailto:czprojectsonline@gmail.com">czprojectsonline@gmail.com</a>.
</p>

<form id="delete-form" autocomplete="off">
  <div style="margin-bottom: 0.75rem;">
    <label for="identifier" style="display:block; font-size: 0.875rem; margin-bottom: 0.25rem;">
      Username or email
    </label>
    <input id="identifier" name="identifier" type="text" required
      style="width:100%; padding:0.5rem; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;">
  </div>
  <div style="margin-bottom: 1rem;">
    <label for="password" style="display:block; font-size: 0.875rem; margin-bottom: 0.25rem;">
      Password
    </label>
    <input id="password" name="password" type="password" required
      style="width:100%; padding:0.5rem; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;">
  </div>
  <button type="submit" id="submit-btn"
    style="padding:0.6rem 1.25rem; border:0; border-radius:4px; background:#c0392b; color:#fff; font-size:1rem; cursor:pointer;">
    Delete my account
  </button>
</form>
<p id="result" role="status" style="margin-top:1rem; font-weight:600;"></p>

<script>
  document.getElementById('delete-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = document.getElementById('submit-btn');
    var result = document.getElementById('result');
    var identifier = document.getElementById('identifier').value;
    var password = document.getElementById('password').value;

    if (!window.confirm('This will deactivate your account and remove your contact details. Continue?')) {
      return;
    }

    btn.disabled = true;
    result.style.color = '';
    result.textContent = 'Processing...';

    try {
      var res = await fetch('/account/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password: password }),
      });

      if (res.ok) {
        result.style.color = '#1a7a1a';
        result.textContent = 'Your account has been deactivated and your contact details removed. You may close this page.';
        document.getElementById('delete-form').reset();
        document.getElementById('delete-form').style.display = 'none';
      } else {
        result.style.color = '#c0392b';
        result.textContent = 'Could not verify your username/email and password. Please try again.';
        btn.disabled = false;
      }
    } catch (err) {
      result.style.color = '#c0392b';
      result.textContent = 'Something went wrong. Please try again later.';
      btn.disabled = false;
    }
  });
</script>
`;

export const DELETE_ACCOUNT_HTML = pageShell('Delete Account', BODY);
