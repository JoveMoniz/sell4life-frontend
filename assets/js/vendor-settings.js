// ======================================================
// VENDOR STORE SETTINGS
// ======================================================

const API = window.API_BASE;

function authFetch(url, opts = {}) {
  const token = localStorage.getItem('s4l_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, credentials: 'include', headers });
}

/* ======================================================
   LOAD CURRENT SETTINGS
====================================================== */
async function loadSettings() {
  const wrap = document.getElementById('settings-form-wrap');

  try {
    const res = await authFetch(`${API}/vendor/me`);
    if (res.status === 401) { window.location.href = '/account/signin.html'; return; }
    const data = await res.json();
    const v = data.vendor;
    if (!v) { window.location.href = '/account/vendor/create.html'; return; }

    renderForm(v);
  } catch (err) {
    console.error('Settings load error:', err);
    if (wrap) wrap.innerHTML = '<p style="color:#b91c1c">Failed to load settings.</p>';
  }
}

/* ======================================================
   RENDER FORM
====================================================== */
function renderForm(v) {
  const wrap = document.getElementById('settings-form-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <!-- Store Identity -->
    <div class="settings-section">
      <div class="settings-section-title">Store Identity</div>

      <div class="settings-field">
        <label class="settings-label" for="set-name">Store Name</label>
        <input class="settings-input" id="set-name" type="text" value="${esc(v.storeName)}" maxlength="80" />
      </div>

      <div class="settings-field">
        <label class="settings-label" for="set-slug">Store URL</label>
        <div class="settings-slug-wrap">
          <span class="settings-slug-prefix">sell4life.com/store/</span>
          <input class="settings-input" id="set-slug" type="text" value="${esc(v.storeSlug)}" maxlength="60"
            pattern="[a-z0-9-]+" placeholder="your-store" />
        </div>
        <div class="settings-hint">Lowercase letters, numbers and hyphens only. Changing this will break existing links to your store.</div>
      </div>

      <div class="settings-field">
        <label class="settings-label" for="set-desc">Store Description</label>
        <textarea class="settings-textarea" id="set-desc" maxlength="500" placeholder="Tell buyers about your store…">${esc(v.storeDescription || '')}</textarea>
        <div class="settings-hint">Up to 500 characters. Shown on your public store page.</div>
      </div>

      <div class="settings-field">
        <label class="settings-label">Account Tier</label>
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:13px;color:#374151">Current tier: <strong style="text-transform:capitalize">${esc(v.type || 'casual')}</strong></span>
          ${v.type !== 'enterprise'
            ? (v.upgradeRequest?.status === 'pending'
                ? '<button type="button" id="btn-upgrade-toggle" disabled style="font-size:11px;padding:3px 10px;background:#f3f4f6;color:#9ca3af;border:1px solid #e5e7eb;border-radius:4px;cursor:not-allowed;white-space:nowrap">Requested ✓</button>'
                : '<button type="button" id="btn-upgrade-toggle" style="font-size:11px;padding:3px 10px;background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;white-space:nowrap">Request Upgrade</button>')
            : ''}
        </div>
      </div>
    </div>

    <!-- Branding -->
    <div class="settings-section">
      <div class="settings-section-title">Branding</div>

      <div class="settings-field">
        <label class="settings-label" for="set-logo">Logo URL</label>
        <input class="settings-input" id="set-logo" type="url" value="${esc(v.storeLogo || '')}"
          placeholder="https://…" />
        <img class="settings-image-preview" id="logo-preview" src="${esc(v.storeLogo || '')}" alt="Logo preview" />
        <div class="settings-hint">Direct image URL (JPG, PNG, WebP). Shown as your store avatar.</div>
      </div>

      <div class="settings-field">
        <label class="settings-label" for="set-banner">Banner URL</label>
        <input class="settings-input" id="set-banner" type="url" value="${esc(v.storeBanner || '')}"
          placeholder="https://…" />
        <img class="settings-image-preview" id="banner-preview" src="${esc(v.storeBanner || '')}" alt="Banner preview" />
        <div class="settings-hint">Wide image shown at the top of your store page. Recommended 1200×300px.</div>
      </div>
    </div>

    <!-- Returns -->
    <div class="settings-section">
      <div class="settings-section-title">Returns</div>

      <div class="settings-field">
        <label class="settings-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="set-free-returns" ${v.freeReturns ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer" />
          Offer free returns to your customers
        </label>
        <div class="settings-hint">If off, buyers may be asked to pay return postage for change-of-mind returns (faulty/incorrect items are always covered). Shown on your product pages and at checkout.</div>
      </div>
    </div>

    <!-- Tax Information (HMRC) — shown only when approaching/required -->
    <div id="hmrc-tax-section" style="display:none">
      <div class="settings-section">
        <div class="settings-section-title">Tax Information (HMRC)</div>
        <div id="hmrc-tax-body" style="color:#6b7280;font-size:13px">Loading…</div>
      </div>
    </div>

    <!-- Save Store Settings -->
    <div class="settings-save-bar">
      <button class="settings-save-btn" id="settings-save">Save Changes</button>
      <span class="settings-msg" id="settings-msg"></span>
    </div>

    <!-- Enterprise API Key (Enterprise tier only) -->
    ${v.type === 'enterprise' ? `
    <div class="settings-section" id="api-key-section" style="margin-top:8px">
      <div class="settings-section-title">API Access</div>
      <div class="settings-field">
        <label class="settings-label">Your API Key</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="settings-input" id="api-key-display" type="text" value="${esc(v.apiKey || '')}" readonly
            placeholder="Click Generate to create your key"
            style="font-family:monospace;font-size:13px;background:#f8fafc;color:#374151" />
          ${v.apiKey
            ? `<button type="button" id="copy-api-key" style="padding:8px 14px;background:#0b6b6a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0">Copy</button>`
            : `<button type="button" id="generate-api-key" style="padding:8px 14px;background:#0b6b6a;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;white-space:nowrap;flex-shrink:0">Generate</button>`
          }
        </div>
        <div class="settings-hint">Send this key in the <code>X-API-Key</code> header to authenticate API requests. Keep it secret — treat it like a password.</div>
      </div>
    </div>` : ''}

    <!-- Account Details -->
    <div class="settings-section" style="margin-top:8px">
      <div class="settings-section-title">Account Details</div>

      <div class="settings-field">
        <label class="settings-label" for="vs-name">Full Name</label>
        <input class="settings-input" id="vs-name" type="text" autocomplete="name" />
      </div>
      <div class="settings-save-bar" style="margin-bottom:18px">
        <button class="settings-save-btn" id="vs-save-name">Save Name</button>
        <span class="settings-msg" id="vs-msg-name"></span>
      </div>

      <div class="settings-field">
        <label class="settings-label" for="vs-email">New Email</label>
        <input class="settings-input" id="vs-email" type="email" autocomplete="email" />
      </div>
      <div class="settings-field">
        <label class="settings-label" for="vs-email-pass">Confirm Password</label>
        <input class="settings-input" id="vs-email-pass" type="password" autocomplete="current-password" placeholder="Enter your password to confirm" />
      </div>
      <div class="settings-save-bar" style="margin-bottom:18px">
        <button class="settings-save-btn" id="vs-save-email">Update Email</button>
        <span class="settings-msg" id="vs-msg-email"></span>
      </div>

      <div class="settings-field">
        <label class="settings-label" for="vs-cur-pass">Current Password</label>
        <input class="settings-input" id="vs-cur-pass" type="password" autocomplete="current-password" />
      </div>
      <div class="settings-field">
        <label class="settings-label" for="vs-new-pass">New Password</label>
        <input class="settings-input" id="vs-new-pass" type="password" autocomplete="new-password" />
      </div>
      <div class="settings-save-bar">
        <button class="settings-save-btn" id="vs-save-pass">Update Password</button>
        <span class="settings-msg" id="vs-msg-pass"></span>
      </div>
    </div>
  `;

  // Show image previews if URLs are set
  showPreview('set-logo', 'logo-preview');
  showPreview('set-banner', 'banner-preview');

  // Live preview on input
  document.getElementById('set-logo').addEventListener('input', () => showPreview('set-logo', 'logo-preview'));
  document.getElementById('set-banner').addEventListener('input', () => showPreview('set-banner', 'banner-preview'));

  // Slug: auto-clean on input
  const slugInput = document.getElementById('set-slug');
  slugInput.addEventListener('input', () => {
    const pos = slugInput.selectionStart;
    const cleaned = slugInput.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (cleaned !== slugInput.value) {
      slugInput.value = cleaned;
      try { slugInput.setSelectionRange(pos, pos); } catch (_) {}
    }
  });

  // Save store settings
  document.getElementById('settings-save').addEventListener('click', () => saveSettings(v._id));

  // Copy API key
  const copyBtn = document.getElementById('copy-api-key');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const val = document.getElementById('api-key-display')?.value;
      if (!val) return;
      navigator.clipboard.writeText(val).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
    });
  }

  // Generate API key (for enterprise vendors who don't have one yet)
  const genBtn = document.getElementById('generate-api-key');
  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      genBtn.textContent = 'Generating…';
      try {
        const res = await authFetch(`${API}/vendor/api-key/generate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Failed to generate key', 'error'); return; }
        const display = document.getElementById('api-key-display');
        if (display) display.value = data.apiKey;
        genBtn.textContent = 'Copy';
        genBtn.id = 'copy-api-key';
        genBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(data.apiKey).then(() => {
            genBtn.textContent = 'Copied!';
            setTimeout(() => { genBtn.textContent = 'Copy'; }, 2000);
          });
        });
      } catch {
        showToast('Server error — please try again.', 'error');
      } finally {
        genBtn.disabled = false;
      }
    });
  }

  // Request tier upgrade
  const upgradeToggle = document.getElementById('btn-upgrade-toggle');

  if (upgradeToggle && !upgradeToggle.disabled) {
    upgradeToggle.addEventListener('click', async () => {
      upgradeToggle.disabled = true;
      upgradeToggle.textContent = 'Sending…';
      try {
        const res = await authFetch(`${API}/vendor/request-upgrade`, {
          method: 'POST',
          body: JSON.stringify({ message: '' }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        window.showToast?.(data.message || 'Upgrade request sent!');
        upgradeToggle.textContent = 'Requested ✓';
        upgradeToggle.style.color = '#9ca3af';
        upgradeToggle.style.borderColor = '#e5e7eb';
        upgradeToggle.style.cursor = 'not-allowed';
      } catch (err) {
        window.showToast?.(err.message || 'Failed to send upgrade request', 'error');
        upgradeToggle.disabled = false;
        upgradeToggle.textContent = 'Request Upgrade';
      }
    });
  }

  // Account section
  attachAccountHandlers();
  loadAccountProfile();

  // Load HMRC tax section asynchronously (fetches status from API)
  loadTaxInfoSection();
}

/* ======================================================
   SAVE
====================================================== */
async function saveSettings() {
  const btn = document.getElementById('settings-save');
  const msg = document.getElementById('settings-msg');

  const body = {
    storeName:        document.getElementById('set-name')?.value?.trim(),
    storeSlug:        document.getElementById('set-slug')?.value?.trim(),
    storeDescription: document.getElementById('set-desc')?.value?.trim(),
    storeLogo:        document.getElementById('set-logo')?.value?.trim(),
    storeBanner:      document.getElementById('set-banner')?.value?.trim(),
    freeReturns:      !!document.getElementById('set-free-returns')?.checked,
  };

  if (!body.storeName) {
    showMsg('Store name cannot be empty.', 'error'); return;
  }
  if (!body.storeSlug) {
    showMsg('Store URL cannot be empty.', 'error'); return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  clearMsg();

  try {
    const res = await authFetch(`${API}/vendor/settings`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      showMsg(data.error || 'Save failed.', 'error');
    } else {
      showMsg('Changes saved.', 'success');
      // Update sidebar store name if layout.js exposes it
      const nameEl = document.getElementById('sidebar-store-name');
      const slugEl = document.getElementById('sidebar-store-slug');
      if (nameEl) nameEl.textContent = data.vendor.storeName;
      if (slugEl) slugEl.textContent = '@' + data.vendor.storeSlug;
    }
  } catch (err) {
    showMsg('Network error.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
}

/* ======================================================
   HELPERS
====================================================== */
function showPreview(inputId, previewId) {
  const url  = document.getElementById(inputId)?.value?.trim();
  const img  = document.getElementById(previewId);
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = 'block';
    img.onerror = () => { img.style.display = 'none'; };
  } else {
    img.style.display = 'none';
  }
}

function showMsg(text, type) {
  const el = document.getElementById('settings-msg');
  if (!el) return;
  el.textContent = text;
  el.className = `settings-msg ${type}`;
}

function clearMsg() {
  const el = document.getElementById('settings-msg');
  if (el) { el.textContent = ''; el.className = 'settings-msg'; }
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ======================================================
   ACCOUNT DETAILS (name / email / password)
====================================================== */
async function loadAccountProfile() {
  try {
    const res = await authFetch(`${API}/account/me`);
    if (!res.ok) return;
    const data = await res.json();
    const nameEl = document.getElementById('vs-name');
    const emailEl = document.getElementById('vs-email');
    if (nameEl && data.name) nameEl.value = data.name;
    if (emailEl && data.email) emailEl.placeholder = data.email;
  } catch (_) {}
}

function setAcctMsg(id, text, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `settings-msg ${type}`;
}

function attachAccountHandlers() {
  document.getElementById('vs-save-name').addEventListener('click', async () => {
    const btn = document.getElementById('vs-save-name');
    const name = document.getElementById('vs-name')?.value.trim();
    if (!name) { setAcctMsg('vs-msg-name', 'Name cannot be empty.', 'error'); return; }
    btn.disabled = true;
    setAcctMsg('vs-msg-name', '', '');
    try {
      const res = await authFetch(`${API}/account/me`, { method: 'PATCH', body: JSON.stringify({ name }) });
      const data = await res.json();
      setAcctMsg('vs-msg-name', res.ok ? 'Name updated.' : (data.error || 'Save failed.'), res.ok ? 'success' : 'error');
    } catch (_) { setAcctMsg('vs-msg-name', 'Network error.', 'error'); }
    finally { btn.disabled = false; }
  });

  document.getElementById('vs-save-email').addEventListener('click', async () => {
    const btn = document.getElementById('vs-save-email');
    const email = document.getElementById('vs-email')?.value.trim();
    const currentPassword = document.getElementById('vs-email-pass')?.value;
    if (!email) { setAcctMsg('vs-msg-email', 'Enter new email.', 'error'); return; }
    if (!currentPassword) { setAcctMsg('vs-msg-email', 'Current password required.', 'error'); return; }
    btn.disabled = true;
    setAcctMsg('vs-msg-email', '', '');
    try {
      const res = await authFetch(`${API}/account/me`, { method: 'PATCH', body: JSON.stringify({ email, currentPassword }) });
      const data = await res.json();
      setAcctMsg('vs-msg-email', res.ok ? 'Email updated.' : (data.error || 'Update failed.'), res.ok ? 'success' : 'error');
      if (res.ok) { document.getElementById('vs-email').value = ''; document.getElementById('vs-email-pass').value = ''; }
    } catch (_) { setAcctMsg('vs-msg-email', 'Network error.', 'error'); }
    finally { btn.disabled = false; }
  });

  document.getElementById('vs-save-pass').addEventListener('click', async () => {
    const btn = document.getElementById('vs-save-pass');
    const currentPassword = document.getElementById('vs-cur-pass')?.value;
    const newPassword = document.getElementById('vs-new-pass')?.value;
    if (!currentPassword) { setAcctMsg('vs-msg-pass', 'Enter current password.', 'error'); return; }
    if (!newPassword || newPassword.length < 8) { setAcctMsg('vs-msg-pass', 'New password: min 8 characters.', 'error'); return; }
    btn.disabled = true;
    setAcctMsg('vs-msg-pass', '', '');
    try {
      const res = await authFetch(`${API}/account/me`, { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) });
      const data = await res.json();
      setAcctMsg('vs-msg-pass', res.ok ? 'Password updated.' : (data.error || 'Update failed.'), res.ok ? 'success' : 'error');
      if (res.ok) { document.getElementById('vs-cur-pass').value = ''; document.getElementById('vs-new-pass').value = ''; }
    } catch (_) { setAcctMsg('vs-msg-pass', 'Network error.', 'error'); }
    finally { btn.disabled = false; }
  });
}

/* ======================================================
   TAX INFORMATION (HMRC)
====================================================== */
async function loadTaxInfoSection() {
  const section = document.getElementById('hmrc-tax-section');
  const body    = document.getElementById('hmrc-tax-body');
  if (!section || !body) return;

  section.style.display = '';

  try {
    const res = await authFetch(`${API}/vendor/tax-info`);
    if (!res.ok) { body.textContent = 'Could not load tax information.'; return; }
    const d = await res.json();
    const status = d.reportingStatus || 'none';

    let statusBanner = '';
    if (status === 'required') {
      statusBanner = `<div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:5px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#991b1b">
        <strong>Action required</strong> — your store has crossed the HMRC reporting threshold. You must submit your tax details below.
      </div>`;
    } else if (status === 'approaching') {
      statusBanner = `<div style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:5px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#92400e">
        <strong>Approaching threshold</strong> — please submit your tax details soon to avoid delays.
      </div>`;
    } else {
      statusBanner = `<div style="font-size:13px;color:#6b7280;margin-bottom:12px">
        You can provide your tax information in advance. If your store later approaches the HMRC reporting threshold, this will save time.
      </div>`;
    }

    const transactionCount = d.hmrcReporting?.transactionCount || 0;
    const grossTotal = Number(d.hmrcReporting?.grossPayoutTotal || 0).toFixed(2);
    const year = d.hmrcReporting?.year || new Date().getFullYear();

    const progressInfo = status !== 'none'
      ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#374151">
          ${year} progress: <strong>${transactionCount}</strong> transactions · <strong>£${grossTotal}</strong> gross payout
          <span style="color:#9ca3af">(thresholds: 30 transactions or £1,700)</span>
         </div>`
      : '';

    if (d.taxInfoCompleted && d.taxInfo) {
      const confirmedDate = d.taxInfo.confirmedAt
        ? new Date(d.taxInfo.confirmedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'unknown date';
      const taxIdTypeLabel = { ni: 'National Insurance Number', utr: 'UTR Number', other: 'Other Tax ID' }[d.taxInfo.taxIdType] || d.taxInfo.taxIdType || '—';

      body.innerHTML = `
        ${statusBanner}${progressInfo}
        <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:12px 16px;margin-bottom:14px">
          <div style="font-weight:700;color:#166534;margin-bottom:4px">Tax details submitted</div>
          <div style="font-size:12px;color:#374151">Submitted on ${confirmedDate}</div>
          <div style="font-size:12px;color:#374151;margin-top:4px">${taxIdTypeLabel}: ${esc(d.taxInfo.maskedTaxId || '—')}</div>
        </div>
        <button type="button" id="hmrc-resubmit-btn" style="font-size:12px;padding:4px 12px;background:#f9fafb;border:1px solid #d1d5db;border-radius:5px;cursor:pointer;color:#374151">Update tax details</button>
        <div id="hmrc-form-wrap" style="display:none;margin-top:14px"></div>`;

      document.getElementById('hmrc-resubmit-btn').addEventListener('click', () => {
        document.getElementById('hmrc-form-wrap').style.display = '';
        document.getElementById('hmrc-resubmit-btn').style.display = 'none';
        renderTaxForm('hmrc-form-wrap');
      });
    } else {
      body.innerHTML = `${statusBanner}${progressInfo}<div id="hmrc-form-wrap"></div>`;
      renderTaxForm('hmrc-form-wrap');
    }
  } catch (err) {
    console.error('Tax info section error:', err);
    body.textContent = 'Could not load tax information.';
  }
}

function renderTaxForm(containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;

  wrap.innerHTML = `
    <div style="font-size:13px;color:#374151;margin-bottom:14px">
      Please provide your details for HMRC digital platform reporting. All information is encrypted and stored securely.
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-legal-name">Legal Full Name <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-legal-name" type="text" placeholder="As shown on your tax documents" maxlength="200" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-dob">Date of Birth <span style="color:#9ca3af;font-size:11px">(optional)</span></label>
      <input class="settings-input" id="hmrc-dob" type="date" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-addr1">Address Line 1 <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-addr1" type="text" placeholder="Street address" maxlength="200" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-addr2">Address Line 2</label>
      <input class="settings-input" id="hmrc-addr2" type="text" placeholder="Apt, suite, etc." maxlength="200" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-city">City <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-city" type="text" maxlength="100" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-postcode">Postcode <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-postcode" type="text" maxlength="20" style="max-width:160px" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-country">Country <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-country" type="text" value="United Kingdom" maxlength="100" />
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-id-type">Tax ID Type <span style="color:#b91c1c">*</span></label>
      <select class="settings-input" id="hmrc-id-type" style="max-width:280px">
        <option value="">— Select —</option>
        <option value="ni">National Insurance Number (NI)</option>
        <option value="utr">Unique Taxpayer Reference (UTR)</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="settings-field">
      <label class="settings-label" for="hmrc-id-value">Tax ID Value <span style="color:#b91c1c">*</span></label>
      <input class="settings-input" id="hmrc-id-value" type="text" placeholder="e.g. AB 12 34 56 C or 1234567890" maxlength="40" />
      <div class="settings-hint">Enter your NI number, UTR, or other tax identifier. This will be encrypted and never shared publicly.</div>
    </div>
    <div class="settings-save-bar" style="margin-top:0">
      <button class="settings-save-btn" id="hmrc-submit-btn">Submit Tax Information</button>
      <span class="settings-msg" id="hmrc-msg"></span>
    </div>`;

  document.getElementById('hmrc-submit-btn').addEventListener('click', submitTaxInfo);
}

async function submitTaxInfo() {
  const btn = document.getElementById('hmrc-submit-btn');
  const msg = document.getElementById('hmrc-msg');

  const body = {
    legalName:    document.getElementById('hmrc-legal-name')?.value?.trim(),
    dateOfBirth:  document.getElementById('hmrc-dob')?.value?.trim() || '',
    addrLine1:    document.getElementById('hmrc-addr1')?.value?.trim(),
    addrLine2:    document.getElementById('hmrc-addr2')?.value?.trim() || '',
    addrCity:     document.getElementById('hmrc-city')?.value?.trim(),
    addrPostcode: document.getElementById('hmrc-postcode')?.value?.trim(),
    addrCountry:  document.getElementById('hmrc-country')?.value?.trim(),
    taxIdType:    document.getElementById('hmrc-id-type')?.value?.trim(),
    taxIdValue:   document.getElementById('hmrc-id-value')?.value?.trim(),
  };

  const missingLabels = [];
  if (!body.legalName)    missingLabels.push('Legal Name');
  if (!body.addrLine1)    missingLabels.push('Address Line 1');
  if (!body.addrCity)     missingLabels.push('City');
  if (!body.addrPostcode) missingLabels.push('Postcode');
  if (!body.addrCountry)  missingLabels.push('Country');
  if (!body.taxIdType)    missingLabels.push('Tax ID Type');
  if (!body.taxIdValue)   missingLabels.push('Tax ID Value');

  if (missingLabels.length) {
    if (msg) { msg.textContent = `Please fill in: ${missingLabels.join(', ')}`; msg.className = 'settings-msg error'; }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Submitting…';
  if (msg) { msg.textContent = ''; msg.className = 'settings-msg'; }

  try {
    const res = await authFetch(`${API}/vendor/tax-info`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      if (msg) { msg.textContent = data.error || 'Submission failed.'; msg.className = 'settings-msg error'; }
    } else {
      if (msg) { msg.textContent = 'Tax information saved.'; msg.className = 'settings-msg success'; }
      // Reload the section to show submitted state
      const section = document.getElementById('hmrc-tax-section');
      const taxBody = document.getElementById('hmrc-tax-body');
      if (taxBody) taxBody.innerHTML = '<span style="color:#6b7280">Loading…</span>';
      setTimeout(() => loadTaxInfoSection(), 600);
    }
  } catch (_) {
    if (msg) { msg.textContent = 'Network error.'; msg.className = 'settings-msg error'; }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Tax Information';
  }
}

/* ======================================================
   INIT
====================================================== */
loadSettings();
