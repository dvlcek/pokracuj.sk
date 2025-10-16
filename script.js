// script.js — full version with safe fetch + referral REST (GET/POST/DELETE) + admin hides referral

document.addEventListener('DOMContentLoaded', () => {
  // ====== Config ======
  const APP_BASE = '/pokracuj';                 // '' if deployed at domain root
  const API_BASE = `${APP_BASE}/api`;
  const apiUrl = (p) => `${API_BASE}/${p}`;

  // ====== Helpers ======
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => root.querySelectorAll(sel);
  const num = (v) => Number(v) || 0;
  const parseEuro = (txt) => {
    if (typeof txt !== 'string') return 0;
    const cleaned = txt.replace(/[^\d.,-]/g, '').replace(',', '.');
    return Math.floor(Number(cleaned) || 0);
  };

  // Robust fetch that never crashes on non-JSON
  async function fetchJSON(url, options = {}) {
    try {
      const r = await fetch(url, { credentials: 'same-origin', ...options });
      const raw = await r.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { /* non-JSON */ }
      return {
        ok: r.ok && (data?.ok !== false),
        status: r.status,
        data: data?.data ?? data ?? null,
        error: data?.error || (!r.ok ? `HTTP ${r.status} ${r.statusText || ''}`.trim() : null),
        _raw: raw
      };
    } catch (e) {
      return { ok: false, status: 0, data: null, error: e?.message || 'Network error' };
    }
  }

  // ====== Selectors ======
  const container = $$('#scroll-container');
  const sections = container ? container.querySelectorAll('.section') : [];
  const nav = $$('#nav');

  const galleryImages = $$$('.gallery img');
  const overlay = $$('#overlay');
  const overlayImg = $$('#overlay-img');
  const spinner = $$('#spinner');
  let currentImgIndex = 0;

  // Auth / Account
  const btnOpenAuth = $$('#btn-open-auth');
  const btnOpenAuthGuest = $$('#btn-open-auth-guest');
  const btnLogout = $$('#btn-logout');
  const authModal = $$('#auth-modal');
  const authClose = $$('#auth-close');
  const authX = $$('#auth-x');
  const authTitle = $$('#auth-title');

  const loginPanel = $$('#panel-login') || $$('#tab-login');
  const regPanel   = $$('#panel-register') || $$('#tab-register');

  const loginForm = $$('#login-form');
  const registerForm = $$('#register-form');

  const accountGuest = $$('#account-guest');
  const accountUser = $$('#account-user');
  const userEmailLabel = $$('#user-email-label');

  const mainBalanceEl = $$('#main-balance');
  const bonusBalanceEl = $$('#bonus-balance');
  const redeemMainBtn = $$('#btn-redeem-main');
  const redeemBonusBtn = $$('#btn-redeem-bonus');

  const adminPanel = $$('#admin-panel');
  const adminUsersTableBody = $$('#admin-users-table tbody');

  // User/Admin pending UI
  const userPendingBox  = $$('#user-pending-box');
  const userPendingList = $$('#user-pending-list');
  const adminWithdrawalsBox = $$('#admin-withdrawals');
  const adminWithdrawalsTableBody = $$('#admin-withdrawals-table tbody');

  // Referral wrapper (safe targeting)
  const referralFormEl = $$('#referral-form');
  const referralWrap   = referralFormEl ? referralFormEl.closest('.account-referral') : null;

  // ====== Redeem modal (auto-create if missing) ======
  let redeemModal = $$('#redeem-modal');
  if (!redeemModal) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="modal" id="redeem-modal" aria-hidden="true" role="dialog" aria-labelledby="redeem-title">
        <div class="modal-backdrop" id="redeem-close"></div>
        <div class="modal-content">
          <button class="modal-close" id="redeem-x" aria-label="Zavrieť">✕</button>
          <h2 class="modal-title" id="redeem-title">Uplatniť zostatok</h2>
          <form id="redeem-form" class="auth-form" novalidate>
            <p class="switch-text" id="redeem-desc">Zadaj sumu, ktorú chceš uplatniť.</p>
            <label class="field">
              <span>Suma (EUR)</span>
              <input type="number" id="redeem-amount" inputmode="numeric" step="1" min="0">
            </label>
            <p class="form-hint tiny" id="redeem-hint"></p>
            <p class="form-error" id="redeem-error" hidden></p>
            <button class="button" type="submit">Uplatniť</button>
          </form>
        </div>
      </div>`;
    document.body.appendChild(wrapper.firstElementChild);
    redeemModal = $$('#redeem-modal');
  }
  const redeemClose       = $$('#redeem-close');
  const redeemX           = $$('#redeem-x');
  const redeemForm        = $$('#redeem-form');
  const redeemAmountInput = $$('#redeem-amount');
  const redeemError       = $$('#redeem-error');
  const redeemHint        = $$('#redeem-hint');
  const redeemDesc        = $$('#redeem-desc');

  // ===================================================================
  //                         NAV (add Účet)
  // ===================================================================
  const sectionNames = ['Domov', 'Cenník', 'Členstvo', 'Vybavenie', 'Galéria', 'Kontakt', 'Účet'];
  let currentRedeem = { type: 'main', min: 0, max: 0, action: 'redeem_main' };

  if (nav && sections.length) {
    sections.forEach((section, index) => {
      const link = document.createElement('a');
      link.textContent = sectionNames[index] || `Sekcia ${index + 1}`;
      link.href = "#";
      link.classList.add('nav-link');
      if (index === 0) link.classList.add('active');
      link.addEventListener('click', (e) => {
        e.preventDefault();
        container.scrollTo({ left: index * window.innerWidth, behavior: 'smooth' });
      });
      nav.appendChild(link);
    });

    const navLinks = $$$('.nav-link');

    container.addEventListener('scroll', () => {
      const index = Math.round(container.scrollLeft / window.innerWidth);
      navLinks.forEach((link, i) => link.classList.toggle('active', i === index));
    });

    // Wheel -> horizontal scroll
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      container.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    }, { passive: false });
  }

  // ===================================================================
  //                         Gallery overlay
  // ===================================================================
  if (galleryImages.length && overlay && overlayImg && spinner) {
    galleryImages.forEach((img, index) => {
      img.addEventListener('click', () => { showImage(index); overlay.classList.add('show'); });
    });
    $$('#prev-btn')?.addEventListener('click', (e) => { e.stopPropagation(); showImage(currentImgIndex - 1); });
    $$('#next-btn')?.addEventListener('click', (e) => { e.stopPropagation(); showImage(currentImgIndex + 1); });
    $$('#close-btn')?.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
  }

  function showImage(index) {
    spinner.style.display = 'block';
    if (index < 0) index = galleryImages.length - 1;
    if (index >= galleryImages.length) index = 0;
    currentImgIndex = index;
    overlayImg.style.opacity = 0;
    setTimeout(() => { overlayImg.src = galleryImages[currentImgIndex].src; }, 150);
  }
  function closeOverlay() { overlay.classList.remove('show'); setTimeout(() => { overlayImg.src = ''; }, 200); }
  overlayImg?.addEventListener('load', () => { spinner.style.display = 'none'; overlayImg.style.opacity = 1; });

  // ===================================================================
  //                         Keyboard navigation
  // ===================================================================
  document.addEventListener('keydown', (e) => {
    if (!container || !sections.length) return;
    const sectionWidth = window.innerWidth;
    const maxIndex = sections.length - 1;
    const currentIndex = Math.round(container.scrollLeft / sectionWidth);
    if (e.key === 'ArrowRight' && currentIndex < maxIndex) {
      container.scrollTo({ left: (currentIndex + 1) * sectionWidth, behavior: 'smooth' });
    }
    if (e.key === 'ArrowLeft' && currentIndex > 0) {
      container.scrollTo({ left: (currentIndex - 1) * sectionWidth, behavior: 'smooth' });
    }
  });

  // ===================================================================
  //                         CTA scroll to Kontakt
  // ===================================================================
  const firstCTA = $$('.button');
  if (firstCTA && firstCTA.getAttribute('href') === '#kontakt') {
    firstCTA.addEventListener('click', function (e) {
      e.preventDefault();
      $$('#kontakt')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ===================================================================
  //                         Contact form (EmailJS kept)
  // ===================================================================
  const contactForm = $$('#contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMail();
    });
  }
  function sendMail() {
    const name = $$('#name').value.trim();
    const email = $$('#email').value.trim();
    const phone = $$('#phone').value.trim();
    const message = $$('#text').value.trim();
    // @ts-ignore
    emailjs.send('service_10d0kqj', 'template_n76glgh', { name, email, phone, message })
      .then(() => alert('Rezervácia bola úspešne odoslaná!'))
      .catch(() => alert('Niečo sa pokazilo. Skúste to znova.'));
  }

  // ===================================================================
  //                         API helpers (PHP)
  // ===================================================================
  const API = {
    me() { return fetchJSON(apiUrl('me.php')); },
    login(email, password) {
      return fetchJSON(apiUrl('login.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    },
    register(email, password, name) {
      return fetchJSON(apiUrl('register.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
    },
    logout() { return fetchJSON(apiUrl('logout.php'), { method: 'POST' }); },
    getBalances() { return fetchJSON(apiUrl('balances.php')); },
    redeem(action, amount) {
      return fetchJSON(apiUrl('balances.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount })
      });
    },
    adminList() { return fetchJSON(apiUrl('admin_users.php')); },
    adminSave(user_id, main, bonus) {
      return fetchJSON(apiUrl('admin_users.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, main, bonus })
      });
    },
    listWithdrawals() { return fetchJSON(apiUrl('withdrawals.php')); },
    decideWithdrawal(id, decision) {
      return fetchJSON(apiUrl('withdrawals.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision })
      });
    },
    myWithdrawals() { return fetchJSON(apiUrl('balances.php?include=my_withdrawals')); },

    // Referral REST
    referralGet() {
      return fetchJSON(apiUrl('referral.php'));
    },
    referralSet(email) {
      return fetchJSON(apiUrl('referral.php'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referral: email })
      });
    },
    referralDelete() {
      return fetchJSON(apiUrl('referral.php'), { method: 'DELETE' });
    },
  };

  // ====== Referral show/hide helpers (safe, no class removal) ======
  function hideReferralForAdmin() {
    if (!referralWrap) return;
    referralWrap.setAttribute('aria-hidden', 'true');
    referralWrap.style.display = 'none';
    referralWrap.querySelectorAll('input,button,select,textarea').forEach(el => { el.disabled = true; });
  }
  function showReferralForUser() {
    if (!referralWrap) return;
    referralWrap.removeAttribute('aria-hidden');
    referralWrap.style.display = '';
    referralWrap.querySelectorAll('input,button,select,textarea').forEach(el => { el.disabled = false; });
  }

  // ===================================================================
  //                         AUTH MODAL + UI
  // ===================================================================
  function openAuth() { authModal?.setAttribute('aria-hidden', 'false'); authModal?.classList.add('show'); }
  function closeAuth() { authModal?.setAttribute('aria-hidden', 'true'); authModal?.classList.remove('show'); }

  btnOpenAuth?.addEventListener('click', openAuth);
  btnOpenAuthGuest?.addEventListener('click', openAuth);
  authClose?.addEventListener('click', closeAuth);
  authX?.addEventListener('click', closeAuth);
  authModal?.addEventListener('click', (e) => { if (e.target === authModal) closeAuth(); });

  $$$('.linklike[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.switch));
  });

  function showPanel(which) {
    const isLogin = which === 'login';
    if (loginPanel && regPanel) {
      loginPanel.classList.toggle('active', isLogin);
      regPanel.classList.toggle('active', !isLogin);
      loginPanel.hidden = !isLogin;
      regPanel.hidden = isLogin;
    }
    if (authTitle) authTitle.textContent = isLogin ? 'Prihlásenie' : 'Registrácia';
  }

  // LOGIN submit
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $$('#login-email').value.trim().toLowerCase();
    const password = $$('#login-password').value;
    const res = await API.login(email, password);
    if (!res.ok) return alert(res.error || 'Prihlásenie zlyhalo');
    closeAuth();
    refreshAuthUI();
  });

  // REGISTER submit
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $$('#reg-name').value.trim();
    const email = $$('#reg-email').value.trim().toLowerCase();
    const pw1 = $$('#reg-password').value;
    const pw2 = $$('#reg-password2')?.value || '';
    const errorEl = $$('#reg-error');

    if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }

    if (pw1.length < 8) {
      if (errorEl) { errorEl.textContent = 'Heslo musí mať aspoň 8 znakov.'; errorEl.hidden = false; }
      else alert('Heslo musí mať aspoň 8 znakov.');
      return;
    }
    if (pw1 !== pw2) {
      if (errorEl) { errorEl.textContent = 'Heslá sa nezhodujú. Skús to znova.'; errorEl.hidden = false; }
      else alert('Heslá sa nezhodujú.');
      return;
    }

    const res = await API.register(email, pw1, name);
    if (!res.ok) return alert(res.error || 'Registrácia zlyhala');
    closeAuth();
    refreshAuthUI();
    alert('Účet vytvorený. Vitaj!');
  });

  // Default: Login panel
  showPanel('login');

  // ===================================================================
  //                         AUTH + BALANCES UI
  // ===================================================================
  btnLogout?.addEventListener('click', async () => {
    await API.logout();
    refreshAuthUI();
  });

  async function refreshAuthUI() {
    const me = await API.me();
    if (!me.ok || !me.data?.authenticated) {
      setLoggedOutUI();
      if (me.status === 401) { try { openAuth(); } catch {} }
      return;
    }
    const user = me.data;

    btnOpenAuth && (btnOpenAuth.style.display = 'none');
    btnLogout && (btnLogout.style.display = '');
    accountGuest && (accountGuest.style.display = 'none');
    accountUser && (accountUser.style.display = '');
    userEmailLabel && (userEmailLabel.textContent = user.email);

    const bal = await API.getBalances();
    if (bal.ok) {
      const { main = 0, bonus = 0 } = bal.data || {};
      if (mainBalanceEl)  mainBalanceEl.textContent  = String(num(main));
      if (bonusBalanceEl) bonusBalanceEl.textContent = String(num(bonus));
      updateRedeemButtonState(main);
    } else if (bal.status === 401) {
      setLoggedOutUI();
      try { openAuth(); } catch {}
      return;
    } else {
      console.warn('balances error:', bal.error);
    }

    await renderUserPending();

    // admin view (robust normalization)
    const role = (user.role ?? '').toString().toLowerCase();
    const isAdmin = role === 'admin' || role === 'administrator' || role === 'superadmin' || role === 'owner' || role === '1';

    if (isAdmin) {
      if (adminPanel) adminPanel.style.display = '';
      document.body.classList.add('is-admin');
      hideReferralForAdmin();         // hide only the referral box for admins
      renderAdminTable();
      await renderAdminWithdrawals();
    } else {
      if (adminPanel) adminPanel.style.display = 'none';
      document.body.classList.remove('is-admin');
      if (adminWithdrawalsBox) adminWithdrawalsBox.style.display = 'none';
      showReferralForUser();          // restore referral for normal users
      await initReferral();           // initialize referral UI for user
    }
  }

  function setLoggedOutUI() {
    btnOpenAuth && (btnOpenAuth.style.display = '');
    btnLogout && (btnLogout.style.display = 'none');
    accountGuest && (accountGuest.style.display = '');
    accountUser && (accountUser.style.display = 'none');
    adminPanel && (adminPanel.style.display = 'none');
    if (userPendingBox) userPendingBox.style.display = 'none';
    if (adminWithdrawalsBox) adminWithdrawalsBox.style.display = 'none';
    document.body.classList.remove('is-admin');
    showReferralForUser(); // make sure referral shows again when logged out
    const rr = $$('#referral-result'); // clear any stale messages
    if (rr) { rr.hidden = true; rr.textContent = ''; rr.style.display = 'none'; }
  }

  function updateRedeemButtonState(mainValue) {
    if (!redeemMainBtn) return;
    if (Number(mainValue) >= 200) {
      redeemMainBtn.disabled = false;
      redeemMainBtn.classList.remove('disabled');
    } else {
      redeemMainBtn.disabled = true;
      redeemMainBtn.classList.add('disabled');
    }
  }

  // ===================================================================
  //                         Redeem modal
  // ===================================================================
  function openRedeemModal({ type, min, max }) {
    if (!redeemModal) return;
    currentRedeem.type = type;
    currentRedeem.min = Number(min) || 0;
    currentRedeem.max = Number(max) || 0;
    currentRedeem.action = type === 'main' ? 'redeem_main' : 'redeem_bonus';

    const label = type === 'main' ? 'hlavný zostatok' : 'vedľajší zostatok';
    const minTxt = type === 'main' ? 'min. 200 €' : 'min. 20 €';
    redeemDesc.textContent = `Uplatniť ${label}.`;
    redeemHint.textContent = `Rozsah: ${currentRedeem.min} € – ${currentRedeem.max} € (${minTxt}).`;

    redeemAmountInput.min = String(currentRedeem.min);
    redeemAmountInput.max = String(currentRedeem.max);
    redeemAmountInput.step = '1';
    redeemAmountInput.value = String(currentRedeem.max);

    redeemError.hidden = true;
    redeemError.textContent = '';

    redeemModal.setAttribute('aria-hidden', 'false');
    redeemModal.classList.add('show');
    setTimeout(() => redeemAmountInput.focus(), 50);
  }

  function closeRedeemModal() {
    redeemModal?.setAttribute('aria-hidden', 'true');
    redeemModal?.classList.remove('show');
  }

  redeemClose?.addEventListener('click', closeRedeemModal);
  redeemX?.addEventListener('click', closeRedeemModal);
  redeemModal?.addEventListener('click', (e) => {
    if (e.target === redeemModal) closeRedeemModal();
  });

  redeemForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = redeemAmountInput.value.trim();
    const amount = Math.floor(Number(raw));

    if (!Number.isFinite(amount) || amount <= 0) {
      redeemError.textContent = 'Zadaj platnú sumu (celé €).';
      redeemError.hidden = false;
      return;
    }
    if (amount < currentRedeem.min) {
      redeemError.textContent = `Minimálna suma je ${currentRedeem.min} €.`;
      redeemError.hidden = false;
      return;
    }
    if (amount > currentRedeem.max) {
      redeemError.textContent = `Maximálna suma je ${currentRedeem.max} €.`;
      redeemError.hidden = false;
      return;
    }

    const res = await API.redeem(currentRedeem.action, amount);
    if (!res.ok) {
      redeemError.textContent = res.error || 'Uplatnenie zlyhalo.';
      redeemError.hidden = false;
      return;
    }

    closeRedeemModal();
    await refreshAuthUI();
    await renderUserPending();
    alert(`Žiadosť o uplatnenie ${amount} € bola odoslaná. Majiteľ sa s tebou spojí hneď po spracovaní.`);
  });

  redeemMainBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const mainBal = parseEuro(mainBalanceEl?.textContent ?? '');
    const MIN_MAIN = 200;
    if (mainBal < MIN_MAIN) {
      alert(`Hlavný zostatok je príliš nízky. Minimum na uplatnenie je ${MIN_MAIN} €.`);
      return;
    }
    openRedeemModal({ type: 'main', min: MIN_MAIN, max: mainBal });
  });

  redeemBonusBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const bonusBal = parseEuro(bonusBalanceEl?.textContent ?? '');
    const MIN_BONUS = 20;
    if (bonusBal < MIN_BONUS) {
      alert(`Vedľajší zostatok je príliš nízky. Minimum na uplatnenie je ${MIN_BONUS} €.`);
      return;
    }
    openRedeemModal({ type: 'bonus', min: MIN_BONUS, max: bonusBal });
  });

  // ===================================================================
  //                         Admin (users table)
  // ===================================================================
  async function renderAdminTable() {
    if (!adminUsersTableBody) return;
    const res = await API.adminList();
    if (!res.ok) {
      alert(res.error || 'Chyba pri načítaní používateľov');
      return;
    }
    const users = res.data || [];
    adminUsersTableBody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.email}</td>
        <td><input type="number" step="1" min="0" value="${num(u.main)}" data-field="main"></td>
        <td><input type="number" step="1" min="0" value="${num(u.bonus)}" data-field="bonus"></td>
        <td>
          <button class="button small" data-action="save">Uložiť</button>
          <button class="button small outline" data-action="reset">Vynulovať</button>
        </td>
      `;
      tr.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const mainVal = num(tr.querySelector('[data-field="main"]').value);
        const bonusVal = num(tr.querySelector('[data-field="bonus"]').value);
        const res2 = await API.adminSave(u.id, mainVal, bonusVal);
        if (!res2.ok) return alert(res2.error || 'Uloženie zlyhalo');
        await refreshAuthUI();
        alert('Zmeny uložené.');
      });
      tr.querySelector('[data-action="reset"]').addEventListener('click', async () => {
        if (!confirm(`Vynulovať zostatky používateľa ${u.email}?`)) return;
        const res2 = await API.adminSave(u.id, 0, 0);
        if (!res2.ok) return alert(res2.error || 'Reset zlyhal');
        await refreshAuthUI();
      });
      adminUsersTableBody.appendChild(tr);
    });
  }

  // ===================================================================
  //                         Admin – Žiadosti o uplatnenie
  // ===================================================================
  async function renderAdminWithdrawals() {
    if (!adminWithdrawalsBox || !adminWithdrawalsTableBody) return;
    const res = await API.listWithdrawals();
    if (!res.ok) { adminWithdrawalsBox.style.display = 'none'; return; }

    const rows = res.data || [];
    adminWithdrawalsTableBody.innerHTML = '';

    rows.forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${w.email}</td>
        <td>${w.type === 'main' ? 'Hlavný' : 'Vedľajší'}</td>
        <td>${w.amount} €</td>
        <td>${new Date(w.created_at).toLocaleString()}</td>
        <td>
          <button class="button small" data-action="approve">Akceptovať</button>
          <button class="button small outline" data-action="reject">Zamietnuť</button>
        </td>
      `;
      tr.querySelector('[data-action="approve"]').addEventListener('click', async () => {
        if (!confirm(`Schváliť uplatnenie ${w.amount} € pre ${w.email}?`)) return;
        const r = await API.decideWithdrawal(w.id, 'approve');
        if (!r.ok) return alert(r.error || 'Schválenie zlyhalo');
        await refreshAuthUI();
        await renderAdminWithdrawals();
        alert('Uplatnenie schválené.');
      });
      tr.querySelector('[data-action="reject"]').addEventListener('click', async () => {
        if (!confirm(`Zamietnuť uplatnenie ${w.amount} € pre ${w.email}?`)) return;
        const r = await API.decideWithdrawal(w.id, 'reject');
        if (!r.ok) return alert(r.error || 'Zamietnutie zlyhalo');
        await renderAdminWithdrawals();
        alert('Žiadosť zamietnutá.');
      });
      adminWithdrawalsTableBody.appendChild(tr);
    });

    adminWithdrawalsBox.style.display = rows.length ? '' : 'none';
  }

  // ===================================================================
  //                         Referral UI (GET/POST/DELETE)
  // ===================================================================
  async function initReferral() {
    if (!referralWrap || !referralFormEl) return;

    const input  = $$('#referral-code');
    const result = $$('#referral-result');

    // create state container above the form
    let stateRow = referralWrap.querySelector('.ref-state');
    if (!stateRow) {
      stateRow = document.createElement('div');
      stateRow.className = 'ref-state';
      referralWrap.insertBefore(stateRow, referralFormEl);
    }

    function showMessage(msg, ok = true) {
      if (!result) return;
      result.hidden = false;
      result.textContent = msg;
      result.classList.toggle('success', ok);
      result.classList.toggle('error', !ok);
      result.style.display = 'block';
    }

    function clearMessage() {
      if (!result) return;
      result.hidden = true;
      result.textContent = '';
      result.classList.remove('success', 'error');
      result.style.display = 'none';
    }

    function renderState(data) {
      clearMessage();

      // no referral -> show form
      if (!data?.has_referral || !data?.referrer?.email) {
        stateRow.innerHTML = '';
        referralFormEl.style.display = '';
        if (input) input.value = '';
        return;
      }

      // has referral -> show email + actions
      const email = data.referrer.email;
      stateRow.innerHTML = `
        <p class="note tiny" style="text-align:center;margin-bottom:8px;">
          Aktuálny referral: <strong>${email}</strong>
        </p>
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;">
          <button class="button small" id="ref-edit">Upraviť</button>
          <button class="button small outline" id="ref-remove">Odstrániť</button>
        </div>
      `;
      referralFormEl.style.display = 'none';

      stateRow.querySelector('#ref-edit')?.addEventListener('click', () => {
        // Toggle referral form visibility
        const isVisible = referralFormEl.style.display !== 'none';
        if (isVisible) {
          // Hide form
          referralFormEl.style.display = 'none';
        } else {
          // Show form and focus input
          referralFormEl.style.display = '';
          if (input) {
            input.value = email;
            input.focus();
          }
        }
      });
      
      stateRow.querySelector('#ref-remove')?.addEventListener('click', async () => {
        if (!confirm('Naozaj odstrániť referral?')) return;
        const r = await API.referralDelete();
        showMessage(r.data?.message || (r.ok ? 'Referral odstránený' : (r.error || 'Chyba')), r.ok);
        if (r.ok) await loadReferral();
      });
    }

    async function loadReferral() {
      const r = await API.referralGet();
      if (!r.ok && r.status === 401) {
        // logged out – keep form visible, nothing else
        stateRow.innerHTML = '';
        referralFormEl.style.display = '';
        return;
      }
      renderState(r.data);
    }

    referralFormEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearMessage();

      const code = (input?.value || '').trim().toLowerCase();
      if (!code) { showMessage('Zadaj email odporúčajúceho.', false); return; }

      const r = await API.referralSet(code);
      if (!r.ok) {
        showMessage(r.error || 'Chyba pri ukladaní referalu', false);
        return;
      }
      showMessage(r.data?.message || 'Referral uložený.');
      await loadReferral();
    });

    await loadReferral();
  }

  // ===================================================================
  //                         Dots (pagination indicator)
  // ===================================================================
  const dotsWrap = $$('#dots');
  if (dotsWrap && sections.length) {
    dotsWrap.innerHTML = '';
    sections.forEach((_, i) => {
      const d = document.createElement('div');
      d.className = 'dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', () => container.scrollTo({ left: i * window.innerWidth, behavior: 'smooth' }));
      dotsWrap.appendChild(d);
    });
    container.addEventListener('scroll', () => {
      const idx = Math.round(container.scrollLeft / window.innerWidth);
      const dots = dotsWrap.querySelectorAll('.dot');
      dots.forEach((dot, i) => dot.classList.toggle('active', i === idx));
    });
  }

  // ===================================================================
  //                         User pending render
  // ===================================================================
  async function renderUserPending() {
    if (!userPendingBox || !userPendingList) return;
    const res = await API.myWithdrawals();
    if (!res.ok) { userPendingBox.style.display = 'none'; return; }

    const items = (res.data?.withdrawals || []).filter(w => w.status === 'pending');
    if (!items.length) { userPendingBox.style.display = 'none'; return; }

    userPendingList.innerHTML = items.map(w => `
      <div class="pending-item" style="text-align:left">
        <strong>${w.amount} €</strong> – ${w.type === 'main' ? 'Hlavný' : 'Vedľajší'}
        <span class="note tiny"> • od ${new Date(w.created_at).toLocaleString()}</span>
        <span class="note tiny" style="display:block;color:#bbb; margin-bottom: 0px">Stav: čaká na spracovanie</span>
      </div>
    `).join('');
    userPendingBox.style.display = '';
  }

  // ===================================================================
  //                         Boot
  // ===================================================================
  refreshAuthUI?.();
});
