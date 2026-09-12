const form = document.getElementById('vendorForm');
const msg = document.getElementById('msg');
const slugPreview = document.getElementById('slug-preview');
const countrySel = document.getElementById('vendorCountry');

// Populate from the same allowlist the backend validates against — adding
// a country there is enough to make it show up here too.
(async () => {
  if (!countrySel) return;
  try {
    const res = await fetch(`${window.API_BASE}/vendor/stripe-connect-countries`);
    const data = await res.json();
    const codes = Array.isArray(data.countries) ? data.countries : ['GB'];
    const all = Array.isArray(window.S4L_COUNTRIES) ? window.S4L_COUNTRIES : [];
    countrySel.innerHTML = '<option value="">Select a country…</option>' + codes
      .map((code) => {
        const match = all.find((c) => c.code === code);
        return `<option value="${code}">${match ? match.name : code}</option>`;
      })
      .join('');
  } catch {
    countrySel.innerHTML = '<option value="GB">United Kingdom</option>';
  }
})();

document.getElementById('storeName').addEventListener('input', (e) => {
  const slug = e.target.value
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  document.getElementById('storeSlug').value = slug;
  if (slugPreview) slugPreview.textContent = slug || '…';
});

document.getElementById('storeSlug').addEventListener('input', (e) => {
  if (slugPreview) slugPreview.textContent = e.target.value || '…';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Submitting…';
  msg.textContent = '';
  msg.style.color = '';

  const token = localStorage.getItem('s4l_token');
  if (!token) {
    localStorage.setItem('postLoginRedirect', window.location.pathname + window.location.search);
    window.location.replace('/account/signin.html');
    return;
  }

  const storeName = document.getElementById('storeName').value.trim();
  const storeSlug = document.getElementById('storeSlug').value
    .toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  const storeDescription = (document.getElementById('storeDescription')?.value || '').trim();
  const storeType = document.getElementById('storeType')?.value || 'casual';
  const country = countrySel?.value || '';

  if (!country) {
    msg.textContent = 'Please select your business country.';
    msg.style.color = '#dc2626';
    button.disabled = false;
    button.textContent = 'Apply to Sell';
    return;
  }

  if (!storeName || storeName.length < 3) {
    msg.textContent = 'Store name must be at least 3 characters.';
    msg.style.color = '#dc2626';
    button.disabled = false;
    button.textContent = 'Apply to Sell';
    return;
  }

  if (!storeSlug || storeSlug.length < 3) {
    msg.textContent = 'Store URL must be at least 3 characters.';
    msg.style.color = '#dc2626';
    button.disabled = false;
    button.textContent = 'Apply to Sell';
    return;
  }

  // Same UTM/referrer this session already recorded for visit tracking
  // (client-info.js) — reused so vendor-store creation can be attributed
  // to a traffic source/campaign, same as buyer registration.
  let utm = {};
  let referrer = '';
  try {
    utm = JSON.parse(sessionStorage.getItem('s4l_session_utm') || '{}');
    referrer = sessionStorage.getItem('s4l_session_referrer') || '';
  } catch { /* attribution is best-effort only */ }

  try {
    const res = await fetch(`${window.API_BASE}/vendor/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storeName, storeSlug, storeDescription, type: storeType, country, utm, referrer }),
    });

    const data = await res.json();

    if (!res.ok) {
      msg.textContent = data.message || data.error || 'Something went wrong.';
      msg.style.color = '#dc2626';
      button.disabled = false;
      button.textContent = 'Apply to Sell';
      return;
    }

    localStorage.setItem('s4l_isVendor', 'true');
    localStorage.setItem('s4l_vendorType', storeType);

    if (data.autoApproved) {
      // Casual vendors are approved instantly — go straight to dashboard
      localStorage.setItem('s4l_vendorStatus', 'approved');
      window.location.replace('/account/vendor/dashboard-casual.html');
      return;
    }

    // Other tiers need admin review — show pending notice
    localStorage.setItem('s4l_vendorStatus', 'pending');
    form.style.display = 'none';
    const notice = document.getElementById('successNotice');
    if (notice) notice.style.display = 'block';

  } catch {
    msg.textContent = 'Server error. Please try again.';
    msg.style.color = '#dc2626';
    button.disabled = false;
    button.textContent = 'Apply to Sell';
  }
});
