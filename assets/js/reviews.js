/* reviews.js — product page review section */
(function () {
  const API = window.API_BASE;

  /* ── helpers ───────────────────────────────────────────── */

  function starsHTML(rating, size = 14) {
    let html = `<span class="s4l-stars">`;
    for (let i = 1; i <= 5; i++) {
      const diff = rating - (i - 1);
      let cls = 'empty';
      if (diff >= 1)    cls = 'filled';
      else if (diff >= 0.25) cls = 'half';
      html += `<span class="s4l-star ${cls}" style="font-size:${size}px">★</span>`;
    }
    html += `</span>`;
    return html;
  }

  function timeAgo(dateStr) {
    const d   = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function initial(name) {
    return (name || 'B').trim().charAt(0).toUpperCase();
  }

  /* ── auth check ────────────────────────────────────────── */

  function getToken() {
    try { return localStorage.getItem('token') || null; } catch { return null; }
  }

  /* ── build inline stars for the product page header ───── */

  function buildProductPageStars(avg, total, container) {
    if (!container) return;
    container.innerHTML = `
      <div class="pd-rating-row">
        ${starsHTML(avg, 16)}
        <span class="pd-rating-avg">${avg.toFixed(1)}</span>
        <span class="pd-rating-count">(${total} review${total !== 1 ? 's' : ''})</span>
      </div>`;
  }

  /* ── build summary card ────────────────────────────────── */

  function buildSummary(summary, el) {
    const { avg, total, breakdown } = summary;
    const maxCount = Math.max(...breakdown.map(b => b.count), 1);

    el.innerHTML = `
      <div class="rv-summary">
        <div class="rv-avg-block">
          <span class="rv-avg-num">${avg.toFixed(1)}</span>
          ${starsHTML(avg, 18)}
          <span class="rv-avg-label">${total} review${total !== 1 ? 's' : ''}</span>
        </div>
        <div class="rv-breakdown">
          ${breakdown.map(b => `
            <div class="rv-bar-row">
              <span class="rv-bar-label">${b.star} ★</span>
              <div class="rv-bar-track">
                <div class="rv-bar-fill" style="width:${Math.round(b.count / maxCount * 100)}%"></div>
              </div>
              <span class="rv-bar-count">${b.count}</span>
            </div>`).join('')}
        </div>
      </div>`;
  }

  /* ── build review card ─────────────────────────────────── */

  function buildReviewCard(r) {
    return `
      <div class="rv-card">
        <div class="rv-card-header">
          <div class="rv-avatar">${initial(r.buyerName)}</div>
          <div class="rv-meta">
            <span class="rv-author">${r.buyerName || 'Buyer'}</span>
            <span class="rv-date">${timeAgo(r.createdAt)}</span>
          </div>
          ${r.verified ? '<span class="rv-verified-badge">✓ Verified Purchase</span>' : ''}
          ${starsHTML(r.rating, 14)}
        </div>
        ${r.title ? `<p class="rv-title">${r.title}</p>` : ''}
        ${r.body  ? `<p class="rv-body">${r.body}</p>`   : ''}
      </div>`;
  }

  /* ── review form ───────────────────────────────────────── */

  function buildForm(productId, onSuccess) {
    const wrap = document.createElement('div');
    wrap.className = 'rv-form';
    wrap.innerHTML = `
      <p class="rv-form-title">Write a Review</p>
      <div class="rv-star-pick" id="rv-star-pick">
        ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" title="${n} star${n>1?'s':''}">★</button>`).join('')}
      </div>
      <input type="text" id="rv-title-inp" placeholder="Review title (optional)" maxlength="120" />
      <textarea id="rv-body-inp" placeholder="Share your experience…" maxlength="2000"></textarea>
      <div class="rv-form-actions">
        <button class="rv-submit-btn" id="rv-submit" disabled>Submit Review</button>
        <button class="rv-cancel-btn" id="rv-cancel">Cancel</button>
      </div>
      <p class="rv-form-msg" id="rv-msg"></p>`;

    const stars  = wrap.querySelectorAll('.rv-star-pick button');
    const submit = wrap.querySelector('#rv-submit');
    const msgEl  = wrap.querySelector('#rv-msg');
    let selectedRating = 0;

    function updateStars(n) {
      stars.forEach((btn, i) => btn.classList.toggle('active', i < n));
    }

    stars.forEach(btn => {
      const n = Number(btn.dataset.star);
      btn.addEventListener('mouseenter', () => updateStars(n));
      btn.addEventListener('mouseleave', () => updateStars(selectedRating));
      btn.addEventListener('click', () => {
        selectedRating = n;
        updateStars(n);
        submit.disabled = false;
      });
    });

    wrap.querySelector('#rv-cancel').addEventListener('click', () => wrap.remove());

    submit.addEventListener('click', async () => {
      if (!selectedRating) return;
      submit.disabled = true;
      msgEl.className = 'rv-form-msg';
      msgEl.textContent = '';

      const token = getToken();
      if (!token) {
        msgEl.className = 'rv-form-msg error';
        msgEl.textContent = 'Please sign in to submit a review.';
        submit.disabled = false;
        return;
      }

      try {
        const res = await fetch(`${API}/reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            productId,
            rating: selectedRating,
            title: wrap.querySelector('#rv-title-inp').value,
            body:  wrap.querySelector('#rv-body-inp').value,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit review');
        msgEl.className = 'rv-form-msg success';
        msgEl.textContent = 'Thanks for your review!';
        setTimeout(() => { wrap.remove(); onSuccess(); }, 1200);
      } catch (err) {
        msgEl.className = 'rv-form-msg error';
        msgEl.textContent = err.message;
        submit.disabled = false;
      }
    });

    return wrap;
  }

  /* ── main init ─────────────────────────────────────────── */

  window.initReviews = async function (productId) {
    const section = document.getElementById('pd-reviews');
    if (!section) return;

    // Fetch config and reviews in parallel
    let cfg, data;
    try {
      [cfg, data] = await Promise.all([
        fetch(`${API}/reviews/config`).then(r => r.json()),
        fetch(`${API}/reviews/product/${productId}`).then(r => r.json()),
      ]);
    } catch {
      return; // silently hide reviews if network fails
    }

    if (!cfg.reviewsEnabled) return; // reviews off — hide section entirely

    section.style.display = '';

    const title = document.createElement('h2');
    title.className = 'reviews-section-title';
    title.textContent = 'Customer Reviews';
    section.appendChild(title);

    // Rating header on product page (above price)
    const ratingHeaderEl = document.getElementById('pd-rating-header');
    if (data.public && data.summary) {
      buildProductPageStars(data.summary.avg, data.summary.total, ratingHeaderEl);
      buildSummary(data.summary, section.appendChild(document.createElement('div')));
    }

    // Write a review CTA
    const token = getToken();
    if (token) {
      const btn = document.createElement('button');
      btn.className = 'rv-write-btn';
      btn.textContent = '✏ Write a Review';
      let formOpen = false;
      btn.addEventListener('click', () => {
        if (formOpen) return;
        formOpen = true;
        btn.after(buildForm(productId, () => { formOpen = false; window.initReviews(productId); }));
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      section.appendChild(btn);
    } else {
      const nudge = document.createElement('div');
      nudge.className = 'rv-signin-nudge';
      nudge.innerHTML = `<a href="/account/signin.html">Sign in</a> to leave a review.`;
      section.appendChild(nudge);
    }

    // Reviews list
    if (!data.public || !data.reviews?.length) {
      const empty = document.createElement('p');
      empty.className = 'rv-empty';
      empty.textContent = data.public
        ? 'No reviews yet — be the first!'
        : 'Reviews will appear once more customers have shared their experience.';
      section.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'rv-list';
    list.innerHTML = data.reviews.map(buildReviewCard).join('');
    section.appendChild(list);
  };

  /* ── exported star helper for cards ───────────────────── */
  window.s4lStarsHTML = starsHTML;

})();
