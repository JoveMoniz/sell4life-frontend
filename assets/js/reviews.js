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
    try { return localStorage.getItem('s4l_token') || null; } catch { return null; }
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

  /* ── review form (write or edit) ──────────────────────── */

  function buildForm(productId, onSuccess, existing = null) {
    const isEdit = !!existing;
    const wrap = document.createElement('div');
    wrap.className = 'rv-form';
    wrap.innerHTML = `
      <p class="rv-form-title">${isEdit ? 'Edit Your Review' : 'Write a Review'}</p>
      <div class="rv-star-pick" id="rv-star-pick">
        ${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" title="${n} star${n>1?'s':''}">★</button>`).join('')}
      </div>
      <input type="text" id="rv-title-inp" placeholder="Review title (optional)" maxlength="120" value="${existing?.title || ''}" />
      <textarea id="rv-body-inp" placeholder="Share your experience…" maxlength="2000">${existing?.body || ''}</textarea>
      <div class="rv-form-actions">
        <button class="rv-submit-btn" id="rv-submit" ${isEdit ? '' : 'disabled'}>${isEdit ? 'Save Changes' : 'Submit Review'}</button>
        <button class="rv-cancel-btn" id="rv-cancel">Cancel</button>
      </div>
      <p class="rv-form-msg" id="rv-msg"></p>`;

    const stars  = wrap.querySelectorAll('.rv-star-pick button');
    const submit = wrap.querySelector('#rv-submit');
    const msgEl  = wrap.querySelector('#rv-msg');
    let selectedRating = existing?.rating || 0;

    function updateStars(n) {
      stars.forEach((btn, i) => btn.classList.toggle('active', i < n));
    }
    updateStars(selectedRating);

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
        msgEl.textContent = 'Please sign in.';
        submit.disabled = false;
        return;
      }

      try {
        const url    = isEdit ? `${API}/reviews/${existing._id}` : `${API}/reviews`;
        const method = isEdit ? 'PUT' : 'POST';
        const body   = isEdit
          ? { rating: selectedRating, title: wrap.querySelector('#rv-title-inp').value, body: wrap.querySelector('#rv-body-inp').value }
          : { productId, rating: selectedRating, title: wrap.querySelector('#rv-title-inp').value, body: wrap.querySelector('#rv-body-inp').value };

        const res  = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save review');
        msgEl.className = 'rv-form-msg success';
        msgEl.textContent = isEdit ? 'Review updated — pending approval.' : 'Thanks for your review!';
        setTimeout(() => { wrap.remove(); onSuccess(); }, 1400);
      } catch (err) {
        msgEl.className = 'rv-form-msg error';
        msgEl.textContent = err.message;
        submit.disabled = false;
      }
    });

    return wrap;
  }

  /* ── "your review" card ────────────────────────────────── */

  function buildMyReviewCard(review, productId, onEdit) {
    const statusLabel = { pending: 'Pending approval', approved: 'Approved', rejected: 'Rejected' };
    const wrap = document.createElement('div');
    wrap.className = 'rv-my-review';
    wrap.innerHTML = `
      <div class="rv-my-review-header">
        <span class="rv-my-review-label">Your Review</span>
        <span class="arv-status-pill ${review.status}">${statusLabel[review.status] || review.status}</span>
      </div>
      <div class="rv-my-review-stars">${starsHTML(review.rating, 16)}</div>
      ${review.title ? `<p class="rv-title">${review.title}</p>` : ''}
      ${review.body  ? `<p class="rv-body">${review.body}</p>`   : ''}`;

    const editBtn = document.createElement('button');
    editBtn.className = 'rv-write-btn';
    editBtn.style.marginTop = '10px';
    editBtn.textContent = '✏ Edit Review';
    let formOpen = false;
    editBtn.addEventListener('click', () => {
      if (formOpen) return;
      formOpen = true;
      editBtn.after(buildForm(productId, () => { formOpen = false; onEdit(); }, review));
      editBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    wrap.appendChild(editBtn);
    return wrap;
  }

  /* ── main init ─────────────────────────────────────────── */

  window.initReviews = async function (productId) {
    const section = document.getElementById('pd-reviews');
    if (!section) return;

    section.innerHTML = '';

    const token = getToken();

    let cfg, data, myReview = null;
    try {
      const fetches = [
        fetch(`${API}/reviews/config`).then(r => r.json()),
        fetch(`${API}/reviews/product/${productId}`).then(r => r.json()),
      ];
      if (token) {
        fetches.push(
          fetch(`${API}/reviews/my/${productId}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).catch(() => ({ review: null }))
        );
      }
      const results = await Promise.all(fetches);
      cfg      = results[0];
      data     = results[1];
      myReview = token ? (results[2]?.review || null) : null;
    } catch {
      return;
    }

    if (!cfg.reviewsEnabled) return;

    section.style.display = 'block';

    const titleEl = document.createElement('h2');
    titleEl.className = 'reviews-section-title';
    titleEl.textContent = 'Customer Reviews';
    section.appendChild(titleEl);

    // Rating header on product page (above price)
    const ratingHeaderEl = document.getElementById('pd-rating-header');
    if (data.public && data.summary) {
      buildProductPageStars(data.summary.avg, data.summary.total, ratingHeaderEl);
      buildSummary(data.summary, section.appendChild(document.createElement('div')));
    }

    // CTA — show existing review + edit, or write button, or sign-in nudge
    if (token) {
      if (myReview) {
        section.appendChild(buildMyReviewCard(myReview, productId, () => window.initReviews(productId)));
      } else {
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
      }
    } else {
      const nudge = document.createElement('div');
      nudge.className = 'rv-signin-nudge';
      nudge.innerHTML = `<a href="/account/signin.html">Sign in</a> to leave a review.`;
      section.appendChild(nudge);
    }

    // Reviews list
    if (!data.public || !data.reviews?.length) return;

    const list = document.createElement('div');
    list.className = 'rv-list';
    list.innerHTML = data.reviews.map(buildReviewCard).join('');
    section.appendChild(list);
  };

  /* ── exported star helper for cards ───────────────────── */
  window.s4lStarsHTML = starsHTML;

})();
