(function () {
  'use strict';

  const CONFIG = window.UCA_TICKETERA_CONFIG;
  const STORAGE = CONFIG.contract.storageKeys;

  /* ========================================================================
   * ICONOS SVG MINIMALISTAS (SIN EMOJIS)
   * ======================================================================== */
  const CATEGORY_ICONS = {
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="1"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    search: '<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    server: '<rect x="2" y="2" width="20" height="8" rx="1"></rect><rect x="2" y="14" width="20" height="8" rx="1"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>'
  };

  /* ========================================================================
   * ESTADO DE LA APLICACIÓN
   * ======================================================================== */
  let currentStep = 1;
  let currentFilter = 'todos';
  const online = location.protocol !== 'file:';
  let signedUser = null;
  let csrf = '';
  let sharedTickets = [];
  let openingBalances = {};
  let contractStart = null;
  let requestKey = null;
  let editingVersion = null;
  let activeMonth = getDefaultMonth();
  let activeTicketId = null;
  let pendingDeleteTicketId = null;
  let toastTimer = null;

  function getDefaultMonth() {
    // Usa el mes del primer ticket semilla o el mes actual si ya hay datos propios
    if (online) return argentinaNow().slice(0, 7);
    let stored;
    try { stored = readStorage(STORAGE.tickets); } catch { return argentinaNow().slice(0, 7); }
    if (!stored && CONFIG.seedTickets.length > 0 && CONFIG.seedTickets[0].billingMonth) {
      return CONFIG.seedTickets[0].billingMonth;
    }
    return argentinaNow().slice(0, 7);
  }

  /* ========================================================================
   * UTILIDADES SEGURAS DE STORAGE Y FORMATO
   * ======================================================================== */
  function argentinaNow() {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return v.year + '-' + v.month + '-' + v.day + 'T' + v.hour + ':' + v.minute;
  }

  function safeLink(value, fallback) {
    if (!value) return fallback;
    if (!validLink(value)) return escapeHtml(value);
    return '<a href="' + escapeHtml(value) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(value) + '</a>';
  }

  function validLink(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !/[\s\\]/.test(value);
    } catch { return false; }
  }

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      throw new Error('No se pudo leer el almacenamiento local. Revisá los datos del navegador.');
    }
  }

  function writeStorage(key, value) {
    try {
      if (value === null || value === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      throw new Error('El navegador no pudo guardar los datos locales. Revisá el almacenamiento disponible.');
    }
  }

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatHours(num) {
    const n = Number(num) || 0;
    const rounded = Math.round(n * 100) / 100;
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(2).replace(/0$/, '')} h`;
  }

  function formatMonthLabel(monthKey) {
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
    const [year, month] = monthKey.split('-').map(Number);
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    return `${months[month - 1] || ''} ${year}`;
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return 'Sin registrar';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function getCategoryMeta(catId) {
    return CONFIG.serviceCategories.find(c => c.id === catId) || CONFIG.serviceCategories[0];
  }

  function getPriorityMeta(prioId) {
    return CONFIG.priorities.find(p => p.id === prioId) || CONFIG.priorities[2];
  }

  function getStatusMeta(statusId) {
    return CONFIG.statuses.find(s => s.id === statusId) || CONFIG.statuses[0];
  }

  /* ========================================================================
   * TEMA CLARO / OSCURO (SYNC <meta name="color-scheme"> + MULTI-TAB)
   * ======================================================================== */
  function getEffectiveTheme() {
    const meta = document.querySelector('meta[name="color-scheme"]');
    const content = meta ? meta.content.trim() : 'light';
    if (content === 'dark' || content === 'light') return content;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyColorScheme(scheme, persist = false) {
    const meta = document.querySelector('meta[name="color-scheme"]');
    const target = scheme || 'light';
    if (meta) meta.content = target;
    if (target === 'dark' || target === 'light') {
      document.documentElement.setAttribute('data-theme', target);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    if (persist) {
      try {
        if (target === 'light dark') {
          localStorage.removeItem(STORAGE.theme);
        } else {
          localStorage.setItem(STORAGE.theme, target);
        }
      } catch (e) {}
    }
  }

  function toggleTheme() {
    const current = getEffectiveTheme();
    const target = current === 'dark' ? 'light' : 'dark';
    applyColorScheme(target, true);
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE.theme) {
      applyColorScheme(e.newValue || 'light', false);
    }
  });

  /* ========================================================================
   * SERVICIO DE AUTENTICACIÓN DESACOPLADO (SIN CREDENCIALES HARDCODEADAS)
   * ======================================================================== */
  const sessionEvents = online && typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('elderecho-ticketera-session') : null;
  if (sessionEvents) sessionEvents.onmessage = () => location.reload();
  window.addEventListener('pageshow', event => { if (online && event.persisted) location.reload(); });
  const canManage = () => !online || signedUser?.role === 'admin';
  const isSystems = () => online && signedUser?.role === 'sistemas_uca';

  function clearPrivateView() {
    signedUser = null;
    csrf = '';
    sharedTickets = [];
    openingBalances = {};
    contractStart = null;
    activeTicketId = null;
    editingVersion = null;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    ['workHistory','ticketsGrid','drawerClientDetails','drawerHeaderMeta','reportTableBody','reportSummaryGrid','wizardSummaryBox','successDetailsBox'].forEach(id => {
      document.getElementById(id).replaceChildren();
    });
    document.getElementById('navTicketCount').textContent = '0';
    document.getElementById('loginPass').value = '';
    document.getElementById('searchTicketsInput').value = '';
    document.querySelectorAll('#detailDialog input, #detailDialog textarea').forEach(el => { el.value = ''; });
    document.getElementById('drawerTicketTitle').textContent = 'Detalle del ticket';
    document.getElementById('toastMsg').textContent = '';
    document.getElementById('successTicketId').textContent = '';
    resetWizard();
    syncAuthUI();
  }

  async function request(endpoint, method = 'GET', data) {
    let res;
    try {
      res = await fetch(endpoint, {
        method, credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: data === undefined ? undefined : JSON.stringify(data)
      });
    } catch { throw new Error('Sin conexión. Revisá la red y reintentá la operación.'); }
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      if (res.status === 401 && signedUser) clearPrivateView();
      throw new Error(result.error || 'El servidor no confirmó la operación.');
    }
    return result;
  }

  async function loadSharedTickets() {
    const identity = csrf;
    const result = await request(CONFIG.auth.ticketsEndpoint);
    if (!identity || csrf !== identity) throw new Error('La sesión cambió. Volvé a ingresar.');
    sharedTickets = result.tickets;
    openingBalances = result.carryover || {};
    contractStart = result.startMonth || null;
  }

  async function startSession(result) {
    csrf = result.csrf;
    try { await loadSharedTickets(); }
    catch (error) { clearPrivateView(); throw error; }
    signedUser = result.user;
    syncAuthUI();
    updateNavCounter();
    switchView(isSystems() ? 'dashboard' : 'newTicket');
  }

  function syncAuthUI() {
    const ready = !online || Boolean(signedUser);
    document.body.classList.toggle('session-pending', !ready);
    document.body.classList.toggle('systems-view', isSystems());
    document.body.classList.toggle('readonly-view', !canManage());
    document.getElementById('viewLogin').classList.toggle('active', !ready);
    document.getElementById('mainNavTabs').style.display = ready ? 'flex' : 'none';
    document.getElementById('userSessionWrap').style.display = signedUser ? 'flex' : 'none';
    document.getElementById('userNameDisplay').textContent = signedUser?.name || '';
    if (!ready) document.querySelectorAll('.view-section:not(#viewLogin)').forEach(el => el.classList.remove('active'));
    document.getElementById('demoNotice').hidden = online;
    for (const [id,key] of [['requesterName','name'],['requesterEmail','email']]) {
      const el = document.getElementById(id);
      el.readOnly = online && Boolean(signedUser) && !canManage();
      if (el.readOnly) el.value = signedUser[key];
    }
    document.querySelectorAll('#detailDialog input, #detailDialog select, #detailDialog textarea').forEach(el => el.disabled = !canManage());
  }

  const TicketStore = {
    getTickets() {
      if (online) return sharedTickets;
      const saved = readStorage(STORAGE.tickets);
      if (saved === null) return structuredClone(CONFIG.seedTickets);
      if (!Array.isArray(saved)) throw new Error('Los datos locales de tickets tienen un formato inválido.');
      return saved;
    },

    getCarryoverMap() {
      return online ? openingBalances : readStorage(STORAGE.carryoverByMonth) || CONFIG.seedCarryoverByMonth;
    },

    openingMonth() {
      return online ? contractStart : CONFIG.demoStartMonth;
    },

    async save(ticket, creating) {
      if (online) {
        const result = await request(CONFIG.auth.ticketsEndpoint, creating ? 'POST' : 'PUT', ticket);
        const saved = result.ticket;
        sharedTickets = [saved, ...sharedTickets.filter(t => t.id !== saved.id)];
        return saved;
      }
      const list = this.getTickets();
      if (!creating && JSON.stringify(list.find(t => t.id === ticket.id)) !== editingVersion) throw new Error('El ticket cambió. Volvé a abrirlo.');
      if (ticket.newWork) {
        ticket.workLogs = [...(ticket.workLogs || []), ticket.newWork];
        delete ticket.newWork;
      }
      writeStorage(STORAGE.tickets, [ticket, ...list.filter(t => t.id !== ticket.id)]);
      return ticket;
    },

    async remove(ticket) {
      if (online) {
        await request(CONFIG.auth.ticketsEndpoint, 'DELETE', { id: ticket.id, version: ticket.version });
        sharedTickets = sharedTickets.filter(t => t.id !== ticket.id);
      } else {
        writeStorage(STORAGE.tickets, this.getTickets().filter(t => t.id !== ticket.id));
      }
    },

    getCarryoverForMonth(monthKey) {
      const start = this.openingMonth();
      if (!inTerm(monthKey, start)) return 0;
      const overrides = this.getCarryoverMap();
      const usage = new Map();
      for (const t of this.getTickets().flatMap(workRows)) {
        if (t.billingMode === 'bolsa') {
          const period = t.billingMonth || (t.createdAt || '').slice(0,7);
          usage.set(period, (usage.get(period) || 0) + Math.round((Number(t.hoursLogged) || 0) * 100));
        }
      }
      let carry = 0;
      for (let offset = 0; offset <= monthIndex(monthKey) - monthIndex(start); offset++) {
        const n = monthIndex(start) + offset;
        const period = Math.floor(n / 12) + '-' + String(n % 12 + 1).padStart(2, '0');
        if (Object.hasOwn(overrides, period)) carry = Math.round(Math.max(0, Math.min(CONFIG.contract.maxCarryoverHours, Number(overrides[period]) || 0)) * 100);
        if (period === monthKey) return carry / 100;
        const currentSpent = Math.max(0, (usage.get(period) || 0) - carry);
        carry = Math.max(0, Math.min(CONFIG.contract.maxCarryoverHours * 100, CONFIG.contract.monthlyHoursIncluded * 100 - currentSpent));
      }
      return 0;
    }
  };

  function monthIndex(key) {
    const [y,m] = key.split('-').map(Number);
    return y * 12 + m - 1;
  }

  function inTerm(key, start) {
    return Boolean(start && key && monthIndex(key) >= monthIndex(start) && monthIndex(key) - monthIndex(start) < CONFIG.contract.contractDurationMonths);
  }

  /* ========================================================================
   * MOTOR DE CÁLCULO FIFO DE HORAS (APARTADO 4 DEL PRESUPUESTO UCA)
   * Regla: Primero se consumen horas trasladadas (máx. 30h, vencen fin de mes);
   * luego las 30h del mes actual. Solo el saldo no usado de las 30h actuales
   * se traslada al mes siguiente (máx. 30h).
   * ======================================================================== */
  function workRows(ticket) {
    const entries = ticket.workLogs || [];
    const rows = entries.map(entry => ({
      ...ticket, workDate: entry.date + 'T12:00', workTitle: entry.description,
      hoursLogged: entry.hours, assignee: entry.assignee, billingMonth: entry.date.slice(0,7),
      status: entry.status, billingMode: entry.billingMode, separateQuoteRef: entry.quoteRef || ''
    }));
    if (Number(ticket.hoursLogged) > 0 || !entries.length) {
      rows.unshift({...ticket, workDate: ticket.createdAt, workTitle: Number(ticket.hoursLogged) > 0 ? 'Registro anterior · fecha de alta' : 'Sin horas registradas'});
    }
    return rows;
  }

  function totalHours(ticket) {
    return (ticket.workLogs || []).reduce((total, entry) => total + Number(entry.hours), Number(ticket.hoursLogged) || 0);
  }

  function computeMonthlyHoursLedger(monthKey) {
    const monthlyQuota = inTerm(monthKey, TicketStore.openingMonth()) ? CONFIG.contract.monthlyHoursIncluded : 0;
    const carryoverAvailable = TicketStore.getCarryoverForMonth(monthKey);
    const totalAvailable = carryoverAvailable + monthlyQuota;

    const monthTickets = TicketStore.getTickets().flatMap(workRows)
      .filter(t => (t.billingMonth || (t.createdAt || '').slice(0, 7)) === monthKey)
      .sort((a, b) => String(a.workDate || '').localeCompare(String(b.workDate || '')) || String(a.id).localeCompare(String(b.id)));

    let carryRemaining = carryoverAvailable;
    let currentRemaining = monthlyQuota;
    let totalPoolConsumed = 0;
    let totalMajorHours = 0;
    let excessHours = 0;

    const ledgerRows = monthTickets.map(ticket => {
      const hrs = Math.max(0, Number(ticket.hoursLogged) || 0);
      let carryUsedHere = 0;
      let currentUsedHere = 0;
      let excessHere = 0;
      let imputationLabel = '';

      if (ticket.billingMode === 'presupuesto_aparte') {
        totalMajorHours += hrs;
        imputationLabel = ticket.separateQuoteRef
          ? `Presupuesto aparte (${ticket.separateQuoteRef})`
          : 'Presupuesto aparte';
      } else if (ticket.billingMode === 'sin_cargo_uca') {
        imputationLabel = 'Derivado Sistemas UCA (sin consumo)';
      } else {
        let toAllocate = hrs;
        if (carryRemaining > 0 && toAllocate > 0) {
          carryUsedHere = Math.min(carryRemaining, toAllocate);
          carryRemaining -= carryUsedHere;
          toAllocate -= carryUsedHere;
        }
        if (currentRemaining > 0 && toAllocate > 0) {
          currentUsedHere = Math.min(currentRemaining, toAllocate);
          currentRemaining -= currentUsedHere;
          toAllocate -= currentUsedHere;
        }
        if (toAllocate > 0) {
          excessHere = toAllocate;
          excessHours += excessHere;
        }
        totalPoolConsumed += carryUsedHere + currentUsedHere;

        const parts = [];
        if (carryUsedHere > 0) parts.push(`${formatHours(carryUsedHere)} trasl.`);
        if (currentUsedHere > 0) parts.push(`${formatHours(currentUsedHere)} mes`);
        if (excessHere > 0) parts.push(`${formatHours(excessHere)} excedente`);
        imputationLabel = parts.length ? parts.join(' + ') : 'Sin consumo aún';
      }

      const runningBalance = carryRemaining + currentRemaining;
      return {
        ticket,
        hours: hrs,
        carryUsedHere,
        currentUsedHere,
        excessHere,
        imputationLabel,
        runningBalance
      };
    });

    const carryUsedTotal = carryoverAvailable - carryRemaining;
    const currentUsedTotal = monthlyQuota - currentRemaining;
    const totalRemaining = carryRemaining + currentRemaining;
    const start = TicketStore.openingMonth();
    const nextMonthCarryover = inTerm(monthKey,start) && monthIndex(monthKey) - monthIndex(start) + 1 < CONFIG.contract.contractDurationMonths ? Math.min(CONFIG.contract.maxCarryoverHours, currentRemaining) : 0;

    return {
      monthKey,
      monthlyQuota,
      carryoverAvailable,
      totalAvailable,
      carryUsedTotal,
      carryExpiredAtMonthEnd: carryRemaining,
      currentUsedTotal,
      currentRemaining,
      totalPoolConsumed,
      totalRemaining,
      excessHours,
      nextMonthCarryover,
      totalMajorHours,
      rows: ledgerRows
    };
  }

  /* ========================================================================
   * EVALUADOR DE ALCANCE (APARTADO 5: MENOR VS. MAYOR)
   * ======================================================================== */
  function evaluateScope(requestKind, criteria, estimatedHours, ticket = {}) {
    if (requestKind !== 'mejora') {
      return {
        classification: 'mantenimiento',
        label: 'Mantenimiento / Soporte incluido',
        bannerClass: 'maintenance',
        message: 'Mantenimiento preventivo o atención ordinaria de incidentes: incluido en la bolsa mensual de 30 h.'
      };
    }

    const hrs = Number(estimatedHours) || 0;
    const norm = s => String(s || '').trim().toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const group = norm(ticket.linkedGroup);
    const peers = group ? TicketStore.getTickets().filter(t => t.requestKind === 'mejora' && t.id !== ticket.id && norm(t.linkedGroup) === group) : [];
    const total = peers.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), hrs);
    const items = [{ scopeCriteria: criteria, estimatedHours: hrs }, ...peers];
    const incomplete = items.some(t => !t.scopeCriteria || !Number(t.estimatedHours) || CONFIG.scopeCriteria.some(c => typeof t.scopeCriteria[c.id] !== 'boolean'));
    const disqualified = total > CONFIG.contract.minorAdjustmentMaxHours || items.some(t => t.estimatedHours > 0 && CONFIG.scopeCriteria.some(c => t.scopeCriteria?.[c.id] === false));
    if (incomplete && !disqualified) return {
      classification: 'pendiente', label: 'Pendiente de evaluación', bannerClass: '',
      message: 'Completá la estimación y los cuatro criterios de la mejora y de sus pedidos vinculados.'
    };
    const allCriteriaMet = !incomplete && !disqualified && Boolean(
      criteria.existingComponentOnly &&
      criteria.withinSixHours &&
      criteria.noDataOrIntegrationChanges &&
      criteria.localizedLowRisk &&
      hrs <= CONFIG.contract.minorAdjustmentMaxHours
    );

    if (allCriteriaMet) {
      return {
        classification: 'menor',
        label: 'Ajuste menor · Incluido en bolsa',
        bannerClass: '',
        message: `Cumple las 4 condiciones de ajuste menor y se mantiene dentro de las ${CONFIG.contract.minorAdjustmentMaxHours} h estimadas. Se imputa a la bolsa mensual.`
      };
    }

    return {
      classification: 'mayor',
      label: 'Ajuste mayor · Presupuesto aparte',
      bannerClass: 'major',
      message: 'No cumple todas las condiciones de Ajuste Menor (o supera las 6 h estimadas). Requiere propuesta independiente aprobada antes de iniciar.'
    };
  }

  /* ========================================================================
   * VALIDACIÓN ACCESIBLE POST-INTERACCIÓN (:user-invalid + ARIA SYNC)
   * ======================================================================== */
  function initAccessibleValidation() {
    const linkError = (el, shown) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute('aria-describedby') || '')
        .split(/\s+/)
        .filter(id => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
      else el.removeAttribute('aria-describedby');
    };

    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.classList.add('visually-hidden');
    document.body.append(announcer);

    let announceTimer = null;
    let announcedField = null;
    const flagged = new WeakSet();
    const announced = new WeakSet();
    const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
    const dirtyFallback = new WeakMap();

    const announceError = (el) => {
      const errEl = document.getElementById(el.dataset.error);
      if (!errEl) return;
      const label = el.labels && el.labels[0] ? `${el.labels[0].textContent.replace('*', '').trim()}: ` : '';
      clearTimeout(announceTimer);
      announcer.textContent = '';
      announcedField = el;
      announceTimer = setTimeout(() => {
        announcer.textContent = label + errEl.textContent.trim();
      }, 450);
    };

    const syncAria = (el, shouldAnnounce = false) => {
      if (!el || !el.matches || !el.matches('input, select, textarea')) return;
      if (el.type === 'radio' || el.type === 'checkbox') return;

      let isInvalid = false;
      if (supportsUserInvalid) {
        isInvalid = el.matches(':user-invalid') || (dirtyFallback.get(el)?.touched && !el.validity.valid);
      } else {
        const st = dirtyFallback.get(el);
        isInvalid = Boolean(st && st.touched && !el.validity.valid);
        el.classList.toggle('user-invalid-fallback', isInvalid);
      }

      el.classList.toggle('user-invalid-fallback', Boolean(isInvalid));
      if (isInvalid) {
        if (shouldAnnounce && !announced.has(el)) {
          announceError(el);
          announced.add(el);
        }
        el.setAttribute('aria-invalid', 'true');
        linkError(el, true);
        flagged.add(el);
      } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
        el.setAttribute('aria-invalid', 'false');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
        if (announcedField === el) {
          clearTimeout(announceTimer);
          announcer.textContent = '';
        }
      }
    };

    document.querySelectorAll('input, select, textarea').forEach(el => syncAria(el));

    document.addEventListener('blur', (e) => {
      if (!supportsUserInvalid && e.target.matches?.('input, select, textarea')) {
        const st = dirtyFallback.get(e.target) || { interacted: false, touched: false };
        if (st.interacted) st.touched = true;
        dirtyFallback.set(e.target, st);
      }
      syncAria(e.target, true);
    }, true);

    document.addEventListener('input', (e) => {
      if (e.target.matches?.('#ticketForm input, #ticketForm textarea')) e.target.setCustomValidity('');
      if (!supportsUserInvalid && e.target.matches?.('input, select, textarea')) {
        const st = dirtyFallback.get(e.target) || { interacted: false, touched: false };
        st.interacted = true;
        dirtyFallback.set(e.target, st);
      }
      if (e.target.hasAttribute?.('aria-invalid')) syncAria(e.target);
    });

    document.addEventListener('change', (e) => syncAria(e.target, true), true);

    document.addEventListener('invalid', (e) => {
      dirtyFallback.set(e.target, { interacted: true, touched: true });
      syncAria(e.target, true);
    }, true);

    document.addEventListener('reset', (e) => {
      setTimeout(() => {
        [...(e.target.elements || [])].forEach(el => {
          dirtyFallback.delete(el);
          el.classList.remove('user-invalid-fallback');
          syncAria(el);
        });
      });
    }, true);
  }

  /* ========================================================================
   * FALLBACK PARA <dialog closedby="any"> EN NAVEGADORES SIN SOPORTE NATIVO
   * ======================================================================== */
  function initDialogLightDismissFallback() {
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    document.querySelectorAll('dialog[closedby="any"]').forEach(dialog => {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e, dialog)) {
          dialog.close('');
        }
        pressedOutside = false;
      });
    });
  }

  /* ========================================================================
   * RENDERIZACIÓN DE SELECTORES DEL WIZARD
   * ======================================================================== */
  function buildWizardControls() {
    const catGrid = document.getElementById('categorySelectorGrid');
    catGrid.innerHTML = CONFIG.serviceCategories.map((cat, idx) => `
      <label class="card-choice">
        <input type="radio" name="serviceCategory" value="${escapeHtml(cat.id)}" ${idx === 0 ? 'checked' : ''}>
        <span class="choice-box">
          <svg class="choice-svg-icon" viewBox="0 0 24 24" aria-hidden="true">${CATEGORY_ICONS[cat.icon] || CATEGORY_ICONS.headset}</svg>
          <span class="choice-label">${escapeHtml(cat.label)}</span>
        </span>
      </label>
    `).join('');

    let automaticAws = false;
    document.getElementById('involvesAwsOrBackups').addEventListener('change', () => { automaticAws = false; });
    const updateCatHelper = () => {
      const checked = document.querySelector('input[name="serviceCategory"]:checked');
      const cat = getCategoryMeta(checked ? checked.value : CONFIG.serviceCategories[0].id);
      document.getElementById('categoryHelperNote').innerHTML =
        `<strong>${escapeHtml(cat.fullName)}:</strong> ${escapeHtml(cat.description)}`;
      if (cat.id === 'infra_aws_uca') {
        automaticAws = !document.getElementById('involvesAwsOrBackups').checked || automaticAws;
        document.getElementById('involvesAwsOrBackups').checked = true;
      } else if (automaticAws) {
        document.getElementById('involvesAwsOrBackups').checked = false;
        automaticAws = false;
      }
    };

    catGrid.addEventListener('change', updateCatHelper);
    updateCatHelper();

    const prioGrid = document.getElementById('prioritySelectorGrid');
    prioGrid.innerHTML = CONFIG.priorities.map(p => `
      <label class="priority-choice" data-prio="${escapeHtml(p.id)}">
        <input type="radio" name="ticketPriority" value="${escapeHtml(p.id)}" ${p.id === 'normal' ? 'checked' : ''}>
        <span class="priority-box">
          <span class="priority-head">
            <span class="priority-name">${escapeHtml(p.label)}</span>
            <span class="priority-sla">${escapeHtml(p.sla)}</span>
          </span>
          <span class="priority-example">${escapeHtml(p.example)}</span>
        </span>
      </label>
    `).join('');

    // Poblar selector de estados en el Drawer
    const editStatus = document.getElementById('editStatus');
    editStatus.innerHTML = CONFIG.statuses.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.id)}</option>`).join('');

    // Poblar checkboxes de los 4 criterios (Apartado 5) en el Drawer
    const criteriaContainer = document.getElementById('scopeCriteriaContainer');
    criteriaContainer.innerHTML = CONFIG.scopeCriteria.map(c => `
      <label class="inline-check-card">
        <input type="checkbox" id="crit_${escapeHtml(c.id)}" data-criterion="${escapeHtml(c.id)}">
        <span><strong>${escapeHtml(c.title)}:</strong> ${escapeHtml(c.minorText)}</span>
      </label>
    `).join('');
  }

  /* ========================================================================
   * NAVEGACIÓN DE VISTAS Y PASOS DEL WIZARD
   * ======================================================================== */
  function switchView(viewName) {
    if (online && (!signedUser || (isSystems() && viewName !== 'dashboard'))) return;
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    if (viewName === 'newTicket') {
      document.getElementById('viewNewTicket').classList.add('active');
      document.getElementById('tabNewTicket').classList.add('active');
    } else if (viewName === 'dashboard') {
      document.getElementById('viewDashboard').classList.add('active');
      document.getElementById('tabDashboard').classList.add('active');
      renderDashboard();
    } else if (viewName === 'report') {
      document.getElementById('viewReport').classList.add('active');
      document.getElementById('tabReport').classList.add('active');
      renderReport();
    }
  }

  function validateStep(stepNum) {
    const stepEl = document.getElementById(`formStep${stepNum}`);
    if (!stepEl) return true;
    const fields = [...stepEl.querySelectorAll('input:not([type="radio"]):not([type="checkbox"]), select, textarea')];
    for (const field of fields) {
      if (field.type === 'url') field.setCustomValidity(!field.value || validLink(field.value) ? '' : 'Ingresá una URL HTTPS sin credenciales.');
      if (field.required && ['text','textarea'].includes(field.type)) field.setCustomValidity(field.value.trim() ? '' : 'Completá este campo.');
      if (!field.checkValidity()) {
        field.dispatchEvent(new Event('invalid', { cancelable: true }));
        field.focus();
        showToast('Revisá los campos obligatorios marcados antes de continuar.');
        return false;
      }
    }
    return true;
  }

  function goToStep(targetStep) {
    if (targetStep > currentStep) {
      for (let s = currentStep; s < targetStep; s++) {
        if (!validateStep(s)) return;
      }
    }
    currentStep = targetStep;

    document.querySelectorAll('.form-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`formStep${targetStep}`).classList.add('active');

    document.querySelectorAll('.step-tab').forEach(tab => {
      const n = Number(tab.dataset.step);
      tab.classList.remove('current', 'completed');
      if (n === targetStep) tab.classList.add('current');
      else if (n < targetStep) tab.classList.add('completed');
    });

    if (targetStep === 3) renderWizardSummary();
  }

  function renderWizardSummary() {
    const cat = getCategoryMeta(document.querySelector('input[name="serviceCategory"]:checked')?.value);
    const prio = getPriorityMeta(document.querySelector('input[name="ticketPriority"]:checked')?.value);
    const kind = document.getElementById('requestKind').value === 'mejora'
      ? 'Cambio / Mejora solicitada (sujeto a validación de 4 criterios)'
      : 'Incidente / Mantenimiento / Soporte operativo';
    const awsFlag = document.getElementById('involvesAwsOrBackups').checked ? 'Sí — requiere coordinación con Sistemas UCA' : 'No indicado';
    const linked = document.getElementById('linkedGroup').value.trim() || 'Ninguno';

    document.getElementById('wizardSummaryBox').innerHTML = `
      <div class="summary-row"><span>Solicitante:</span><strong>${escapeHtml(document.getElementById('requesterName').value.trim())} (${escapeHtml(document.getElementById('requesterEmail').value.trim())})</strong></div>
      <div class="summary-row"><span>Asunto:</span><strong>${escapeHtml(document.getElementById('ticketTitle').value.trim())}</strong></div>
      <div class="summary-row"><span>Naturaleza:</span><strong>${escapeHtml(kind)}</strong></div>
      <div class="summary-row"><span>Servicio:</span><strong>${escapeHtml(cat.fullName)}</strong></div>
      <div class="summary-row"><span>Prioridad / 1ª respuesta:</span><strong>${escapeHtml(prio.label)} (${escapeHtml(prio.sla)})</strong></div>
      <div class="summary-row"><span>Descripción:</span><strong>${escapeHtml(document.getElementById('ticketDescription').value.trim())}</strong></div>
      <div class="summary-row"><span>Mejora vinculada:</span><strong>${escapeHtml(linked)}</strong></div>
      <div class="summary-row"><span>Dependencia AWS / Backups:</span><strong>${escapeHtml(awsFlag)}</strong></div>
    `;
  }

  async function handleTicketSubmit(event) {
    event.preventDefault();
    if (!validateStep(1)) { goToStep(1); return; }
    if (!validateStep(2)) { goToStep(2); return; }

    const nowIso = argentinaNow();
    if (!requestKey) requestKey = crypto.randomUUID();
    const catId = document.querySelector('input[name="serviceCategory"]:checked')?.value || 'gestion_soporte';
    const prioId = document.querySelector('input[name="ticketPriority"]:checked')?.value || 'normal';
    const requestKind = document.getElementById('requestKind').value;
    const involvesAws = document.getElementById('involvesAwsOrBackups').checked || catId === 'infra_aws_uca';

    let newTicket = {
      id: 'ED-' + requestKey.replaceAll('-', '').slice(0, 16).toUpperCase(),
      title: document.getElementById('ticketTitle').value.trim(),
      requestKind,
      category: catId,
      priority: prioId,
      status: requestKind === 'mejora' ? 'Validación de alcance' : 'Nuevo',
      requesterName: document.getElementById('requesterName').value.trim(),
      requesterEmail: document.getElementById('requesterEmail').value.trim(),
      requesterArea: document.getElementById('requesterArea').value.trim(),
      affectedUrl: document.getElementById('affectedUrl').value.trim(),
      evidenceUrl: document.getElementById('evidenceUrl').value.trim(),
      description: document.getElementById('ticketDescription').value.trim(),
      linkedGroup: document.getElementById('linkedGroup').value.trim(),
      involvesAwsOrBackups: involvesAws,
      scopeCriteria: null,
      estimatedHours: 0,
      hoursLogged: 0,
      billingMode: 'bolsa',
      separateQuoteRef: '',
      assignee: 'Sin asignar',
      createdAt: nowIso,
      firstResponseAt: '',
      billingMonth: nowIso.slice(0, 7),
      technicalNotes: ''
    };

    if (online) newTicket.requestKey = requestKey;
    const submit = document.querySelector('#ticketForm [type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try { newTicket = await TicketStore.save(newTicket, true); }
    catch (error) { showToast(error.message); return; }
    finally { submit.disabled = false; }
    activeMonth = newTicket.billingMonth;
    currentFilter = 'todos';
    document.getElementById('searchTicketsInput').value = '';
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === currentFilter));
    });

    updateNavCounter();

    const prioMeta = getPriorityMeta(newTicket.priority);
    const catMeta = getCategoryMeta(newTicket.category);
    document.getElementById('ticketForm').style.display = 'none';
    document.getElementById('wizardStepsNav').style.display = 'none';

    document.getElementById('successTicketId').textContent = `#${newTicket.id}`;
    document.getElementById('successDetailsBox').innerHTML = `
      <div class="summary-row"><span>Asunto:</span><strong>${escapeHtml(newTicket.title)}</strong></div>
      <div class="summary-row"><span>Servicio:</span><strong>${escapeHtml(catMeta.fullName)}</strong></div>
      <div class="summary-row"><span>Prioridad / 1ª respuesta:</span><strong>${escapeHtml(prioMeta.label)} · ${escapeHtml(prioMeta.sla)}</strong></div>
      <div class="summary-row"><span>Estado inicial:</span><strong>${escapeHtml(newTicket.status)}</strong></div>
    `;
    document.getElementById('ticketSuccessCard').classList.add('active');
    showToast(`Ticket #${newTicket.id} registrado correctamente.`);
  }

  function resetWizard() {
    requestKey = null;
    document.getElementById('ticketForm').reset();
    document.querySelectorAll('#ticketForm input, #ticketForm textarea').forEach(f => f.setCustomValidity(''));
    if (signedUser && !canManage()) {
      document.getElementById('requesterName').value = signedUser.name;
      document.getElementById('requesterEmail').value = signedUser.email;
    }
    document.getElementById('ticketForm').style.display = 'block';
    document.getElementById('wizardStepsNav').style.display = 'flex';
    document.getElementById('ticketSuccessCard').classList.remove('active');
    goToStep(1);
    document.querySelector('input[name="serviceCategory"]')?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* ========================================================================
   * RENDERIZACIÓN DEL PANEL DE TICKETS Y BARRA FIFO DE HORAS
   * ======================================================================== */
  function updateNavCounter() {
    const tickets = TicketStore.getTickets();
    const activeCount = tickets.filter(t => t.status !== 'Resuelto').length;
    document.getElementById('navTicketCount').textContent = String(activeCount);
  }

  function renderDashboard() {
    syncMonthInputs();
    const ledger = computeMonthlyHoursLedger(activeMonth);
    const allTickets = TicketStore.getTickets();
    const monthTickets = allTickets.filter(t => (t.billingMonth || (t.createdAt || '').slice(0, 7)) === activeMonth || (t.workLogs || []).some(e => e.date.slice(0,7) === activeMonth));

    // Barra FIFO
    const hasTerm = inTerm(activeMonth, TicketStore.openingMonth());
    document.body.classList.toggle('outside-term', !hasTerm);
    const notice = document.getElementById('dashboardContractNotice');
    notice.hidden = hasTerm || isSystems();
    notice.textContent = TicketStore.openingMonth() ? 'Período fuera de la vigencia configurada.' : 'Falta confirmar el inicio del contrato. El saldo está pendiente.';
    document.getElementById('poolMonthLabel').textContent = formatMonthLabel(activeMonth);
    document.getElementById('poolCarryoverDisplay').textContent = formatHours(ledger.carryoverAvailable);
    document.getElementById('poolConsumedDisplay').textContent = formatHours(ledger.totalPoolConsumed);

    const remEl = document.getElementById('poolRemainingDisplay');
    remEl.textContent = formatHours(ledger.totalRemaining);
    remEl.classList.toggle('danger', ledger.excessHours > 0);
    remEl.classList.toggle('accent', ledger.excessHours === 0);

    const denom = Math.max(1, ledger.totalAvailable + ledger.excessHours);
    document.getElementById('barCarryUsed').style.width = `${(ledger.carryUsedTotal / denom) * 100}%`;
    document.getElementById('barCurrentUsed').style.width = `${(ledger.currentUsedTotal / denom) * 100}%`;
    document.getElementById('barOverUsed').style.width = `${(ledger.excessHours / denom) * 100}%`;

    document.getElementById('legendCarryText').textContent =
      `Trasladadas: ${formatHours(ledger.carryUsedTotal)} / ${formatHours(ledger.carryoverAvailable)}`;
    document.getElementById('legendCurrentText').textContent =
      `Mes actual: ${formatHours(ledger.currentUsedTotal)} / ${formatHours(ledger.monthlyQuota)}`;
    document.getElementById('legendNextCarryText').textContent =
      `Traslado estimado próximo mes: ${formatHours(ledger.nextMonthCarryover)}`;
    document.getElementById('legendMajorHoursText').textContent =
      `Presupuesto aparte: ${formatHours(ledger.totalMajorHours)} · Excedente de bolsa: ${formatHours(ledger.excessHours)}`;

    // 4 KPIs
    document.getElementById('kpiRemainingHours').textContent = formatHours(ledger.totalRemaining);
    document.getElementById('kpiActiveTickets').textContent =
      String(monthTickets.filter(t => t.status !== 'Resuelto').length);
    document.getElementById('kpiHighPriority').textContent =
      String(monthTickets.filter(t => t.status !== 'Resuelto' && (t.priority === 'critica' || t.priority === 'alta')).length);
    document.getElementById('kpiMajorScope').textContent =
      String(monthTickets.filter(t => t.billingMode === 'presupuesto_aparte' || t.status === 'Presupuesto aparte').length);

    // Filtros + búsqueda
    const q = (document.getElementById('searchTicketsInput').value || '').toLowerCase().trim();
    const filtered = monthTickets.filter(t => {
      if (currentFilter === 'criticos' && t.priority !== 'critica' && t.priority !== 'alta') return false;
      if (currentFilter === 'activos' && t.status === 'Resuelto') return false;
      if (currentFilter === 'sistemas_uca' && !t.involvesAwsOrBackups && t.status !== 'Derivado a Sistemas UCA' && t.category !== 'infra_aws_uca') return false;
      if (currentFilter === 'mayores' && t.billingMode !== 'presupuesto_aparte' && t.status !== 'Presupuesto aparte') return false;
      if (currentFilter === 'resueltos' && t.status !== 'Resuelto') return false;

      if (q) {
        const hay = `${t.id} ${t.title} ${t.description} ${t.requesterName} ${t.assignee} ${t.linkedGroup}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const grid = document.getElementById('ticketsGrid');
    const emptyState = document.getElementById('emptyTicketsState');
    grid.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    filtered.forEach(ticket => {
      const cat = getCategoryMeta(ticket.category);
      const prio = getPriorityMeta(ticket.priority);
      const st = getStatusMeta(ticket.status);
      const scopeEval = evaluateScope(ticket.requestKind, ticket.scopeCriteria, ticket.estimatedHours, ticket);

      const card = document.createElement('article');
      card.className = 'ticket-card';
      card.innerHTML = `
        <div class="card-top">
          <div class="card-id-group">
            <span class="ticket-code">#${escapeHtml(ticket.id)}</span>
            <span class="prio-badge ${escapeHtml(prio.badgeClass)}">${escapeHtml(prio.label)} · ${escapeHtml(prio.sla)}</span>
          </div>
          <div class="card-top-right">
            <span class="status-badge ${escapeHtml(st.badgeClass)}">${escapeHtml(ticket.status)}</span>
            <button type="button" class="btn-delete-card" data-delete-id="${escapeHtml(ticket.id)}" title="Eliminar ticket #${escapeHtml(ticket.id)}" aria-label="Eliminar ticket #${escapeHtml(ticket.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <h3 class="card-title">${escapeHtml(ticket.title)}</h3>
        <p class="card-desc">${escapeHtml(ticket.description)}</p>

        <div class="card-meta-list">
          <div class="meta-item"><span>Servicio:</span><strong>${escapeHtml(cat.label)}</strong></div>
          <div class="meta-item scope-info"><span>Alcance:</span><strong>${escapeHtml(scopeEval.label)}</strong></div>
          <div class="meta-item"><span>Solicita:</span><strong>${escapeHtml(ticket.requesterName)}</strong></div>
          <div class="meta-item"><span>Responsable:</span><strong style="color: var(--karin-yellow);">${escapeHtml(ticket.assignee || 'Sin asignar')}</strong></div>
          <div class="meta-item billing-info"><span>Horas registradas:</span><strong>${formatHours(totalHours(ticket))}</strong></div>
        </div>

        <button type="button" class="card-btn-action">VER / GESTIONAR</button>
      `;

      card.addEventListener('click', (e) => {
        const delBtn = e.target.closest('[data-delete-id]');
        if (delBtn) {
          e.stopPropagation();
          requestDeleteTicket(delBtn.dataset.deleteId);
          return;
        }
        openTicketDrawer(ticket.id);
      });

      grid.appendChild(card);
    });
  }

  /* ========================================================================
   * DRAWER NATIVO (<dialog>) DE GESTIÓN DEL TICKET
   * ======================================================================== */
  function openTicketDrawer(ticketId) {
    const ticket = TicketStore.getTickets().find(t => t.id === ticketId);
    if (!ticket) return;
    activeTicketId = ticketId;
    editingVersion = online ? ticket.version : JSON.stringify(ticket);

    const cat = getCategoryMeta(ticket.category);
    const prio = getPriorityMeta(ticket.priority);
    const st = getStatusMeta(ticket.status);

    document.getElementById('drawerHeaderMeta').innerHTML = `
      <span class="ticket-code">#${escapeHtml(ticket.id)}</span>
      <span class="ticket-cat-tag">${escapeHtml(cat.label)}</span>
      <span class="status-badge ${escapeHtml(st.badgeClass)}">${escapeHtml(ticket.status)}</span>
    `;
    document.getElementById('drawerTicketTitle').textContent = ticket.title;

    const slaBadge = document.getElementById('drawerSlaBadge');
    slaBadge.className = `prio-badge ${prio.badgeClass}`;
    slaBadge.textContent = `Prioridad ${prio.label} · 1ª resp. ${prio.sla}`;

    const urlLink = safeLink(ticket.affectedUrl, 'No especificada');
    const evLink = safeLink(ticket.evidenceUrl, 'Sin adjunto externo');

    document.getElementById('drawerClientDetails').innerHTML = `
      <div class="detail-item"><span class="detail-label">Solicitante</span><span class="detail-value">${escapeHtml(ticket.requesterName)} ${ticket.requesterEmail ? '(' + escapeHtml(ticket.requesterEmail) + ')' : ''}</span></div>
      <div class="detail-item"><span class="detail-label">Área El Derecho</span><span class="detail-value">${escapeHtml(ticket.requesterArea || 'No informada')}</span></div>
      <div class="detail-item"><span class="detail-label">Registrado el</span><span class="detail-value">${escapeHtml(formatDateTime(ticket.createdAt))}</span></div>
      <div class="detail-item"><span class="detail-label">AWS / Backups (Sistemas UCA)</span><span class="detail-value">${ticket.involvesAwsOrBackups ? 'Sí — requiere coordinación Sistemas UCA' : 'No'}</span></div>
      <div class="detail-item"><span class="detail-label">URL afectada</span><span class="detail-value">${urlLink}</span></div>
      <div class="detail-item"><span class="detail-label">Evidencia / Enlace</span><span class="detail-value">${evLink}</span></div>
      ${ticket.linkedGroup ? `<div class="detail-item full"><span class="detail-label">Mejora vinculada (evaluación conjunta)</span><span class="detail-value">${escapeHtml(ticket.linkedGroup)}</span></div>` : ''}
      <div class="detail-item full"><span class="detail-label">Descripción completa</span><span class="detail-value">${escapeHtml(ticket.description)}</span></div>
    `;

    // Evaluador de alcance
    document.getElementById('editRequestKind').value = ticket.requestKind || 'mantenimiento';
    document.getElementById('editEstimatedHours').value = Number(ticket.estimatedHours) || 0;
    const crit = ticket.scopeCriteria || {};
    CONFIG.scopeCriteria.forEach(c => {
      const cb = document.getElementById(`crit_${c.id}`);
      if (cb) cb.checked = Boolean(crit[c.id]);
    });
    refreshDrawerScopeVerdict();

    // Campos de gestión interna
    document.getElementById('editStatus').value = ticket.status || 'Nuevo';
    document.getElementById('editAssignee').value = ticket.assignee || '';
    document.getElementById('editHoursLogged').value = Number(ticket.hoursLogged) || 0;
    document.getElementById('editBillingMonth').value = ticket.billingMonth || activeMonth;
    document.getElementById('editBillingMode').value = ticket.billingMode || 'bolsa';
    document.getElementById('editFirstResponseAt').value = ticket.firstResponseAt || '';
    document.getElementById('editSeparateQuoteRef').value = ticket.separateQuoteRef || '';
    document.getElementById('editTechnicalNotes').value = ticket.technicalNotes || '';

    document.getElementById('editHoursLogged').closest('.form-group').hidden = !Number(ticket.hoursLogged);
    document.getElementById('editBillingMonth').closest('.form-group').hidden = !Number(ticket.hoursLogged);
    document.getElementById('workDate').value = argentinaNow().slice(0,10);
    document.getElementById('workDate').max = argentinaNow().slice(0,10);
    document.getElementById('workHours').value = '';
    document.getElementById('workDescription').value = '';
    document.getElementById('workAssignee').value = ticket.assignee === 'Sin asignar' ? '' : ticket.assignee || '';
    document.getElementById('workMode').value = ticket.billingMode || 'bolsa';
    document.getElementById('workHistory').replaceChildren();
    for (const w of ticket.workLogs || []) {
      const li = document.createElement('li');
      li.textContent = [formatShortDate(w.date + 'T12:00'), w.description, w.assignee, formatHours(w.hours), billingLabel(w.billingMode)].join(' · ');
      document.getElementById('workHistory').appendChild(li);
    }
    document.getElementById('detailDialog').showModal();
  }

  function refreshDrawerScopeVerdict() {
    const kind = document.getElementById('editRequestKind').value;
    const estHours = Number(document.getElementById('editEstimatedHours').value) || 0;
    const container = document.getElementById('scopeCriteriaContainer');

    // Sincronizar criterio de <= 6h si supera el tope
    const withinSixCb = document.getElementById('crit_withinSixHours');
    if (withinSixCb && estHours > CONFIG.contract.minorAdjustmentMaxHours) {
      withinSixCb.checked = false;
    }

    container.style.display = kind === 'mejora' ? 'flex' : 'none';

    const criteria = {};
    CONFIG.scopeCriteria.forEach(c => {
      const cb = document.getElementById(`crit_${c.id}`);
      criteria[c.id] = cb ? cb.checked : true;
    });

    const current = TicketStore.getTickets().find(t => t.id === activeTicketId);
    const result = evaluateScope(kind, criteria, estHours, current);
    const banner = document.getElementById('scopeVerdictBanner');
    banner.className = `scope-verdict-banner ${result.bannerClass}`;
    banner.innerHTML = `<strong>${escapeHtml(result.label)}:</strong> ${escapeHtml(result.message)}`;
  }

  async function saveDrawerTicketChanges() {
    if (!activeTicketId || !canManage()) return;
    for (const field of document.querySelectorAll('#detailDialog input, #detailDialog select, #detailDialog textarea')) {
      if (!field.reportValidity()) return;
    }
    const tickets = [...TicketStore.getTickets()];
    const idx = tickets.findIndex(t => t.id === activeTicketId);
    if (idx === -1) return;

    const criteria = {};
    CONFIG.scopeCriteria.forEach(c => {
      const cb = document.getElementById(`crit_${c.id}`);
      criteria[c.id] = cb ? cb.checked : true;
    });

    tickets[idx] = { ...tickets[idx] };
    if (online) tickets[idx].version = editingVersion;
    tickets[idx].requestKind = document.getElementById('editRequestKind').value;
    tickets[idx].estimatedHours = Math.max(0, Number(document.getElementById('editEstimatedHours').value) || 0);
    tickets[idx].scopeCriteria = criteria;
    tickets[idx].status = document.getElementById('editStatus').value;
    tickets[idx].assignee = document.getElementById('editAssignee').value.trim() || 'Sin asignar';
    tickets[idx].hoursLogged = Math.max(0, Number(document.getElementById('editHoursLogged').value) || 0);
    tickets[idx].billingMonth = document.getElementById('editBillingMonth').value || activeMonth;
    tickets[idx].billingMode = document.getElementById('editBillingMode').value;
    tickets[idx].firstResponseAt = document.getElementById('editFirstResponseAt').value;
    tickets[idx].separateQuoteRef = document.getElementById('editSeparateQuoteRef').value.trim();
    tickets[idx].technicalNotes = document.getElementById('editTechnicalNotes').value.trim();

    const t = tickets[idx];
    const workHours = Number(document.getElementById('workHours').value);
    const description = document.getElementById('workDescription').value.trim();
    if (workHours || description) {
      const date = document.getElementById('workDate').value;
      const assignee = document.getElementById('workAssignee').value.trim() || (t.assignee !== 'Sin asignar' ? t.assignee : '');
      const billingMode = document.getElementById('workMode').value;
      if (!date || date > argentinaNow().slice(0,10) || !workHours || !description || !assignee) {
        showToast('Para registrar la intervención completá fecha, tarea, responsable y horas.'); return;
      }
      if (billingMode === 'bolsa' && !inTerm(date.slice(0,7), TicketStore.openingMonth())) {
        showToast('La fecha debe estar dentro de la vigencia acordada para imputar a la bolsa.'); return;
      }
      t.newWork = {date, description, assignee, billingMode, hours: workHours, status:t.status, quoteRef:t.separateQuoteRef};
    }
    const scope = evaluateScope(t.requestKind, criteria, t.estimatedHours, t);
    if (t.firstResponseAt && (t.firstResponseAt < t.createdAt || t.firstResponseAt > argentinaNow())) {
      showToast('La primera respuesta debe estar entre el alta y el momento actual.'); return;
    }
    if (t.requestKind === 'mejora' && scope.classification !== 'menor') {
      if ((t.hoursLogged > 0 && t.billingMode === 'bolsa') || t.newWork?.billingMode === 'bolsa') { showToast('Revisá el alcance antes de imputar esta mejora a la bolsa.'); return; }
      if (['En ejecución','En pruebas / QA','Resuelto'].includes(t.status) && (!t.estimatedHours || t.billingMode !== 'presupuesto_aparte' || !t.separateQuoteRef)) {
        showToast('Registrá la estimación, la imputación aparte y la referencia a la conformidad de la UCA.'); return;
      }
    }
    const button = document.getElementById('btnSaveTicketChanges');
    if (button.disabled) return;
    button.disabled = true;
    try { await TicketStore.save(t, false); }
    catch (error) {
      showToast(error.message);
      if (online && signedUser) { try { await loadSharedTickets(); renderDashboard(); } catch {} }
      return;
    } finally { button.disabled = false; }

    updateNavCounter();
    renderDashboard();
    renderReport();
    document.getElementById('detailDialog').close('');
    showToast(`Cambios guardados en #${tickets[idx].id}.`);
  }

  function billingLabel(mode) {
    return {bolsa:'Bolsa mensual', presupuesto_aparte:'Presupuesto aparte', sin_cargo_uca:'Sin cargo UCA'}[mode] || 'Sin imputación';
  }

  function copyActiveTicketSummary() {
    const ticket = TicketStore.getTickets().find(t => t.id === activeTicketId);
    if (!ticket) return;
    const cat = getCategoryMeta(ticket.category);
    const prio = getPriorityMeta(ticket.priority);
    const summary = [
      `TICKET #${ticket.id}: ${ticket.title}`,
      `- Servicio: ${cat.fullName}`,
      `- Prioridad / 1ª respuesta: ${prio.label} (${prio.sla})`,
      `- Estado: ${ticket.status}`,
      `- Solicitante: ${ticket.requesterName} (${ticket.requesterEmail})`,
      `- Responsable: ${ticket.assignee || 'Sin asignar'}`,
      `- Horas registradas: ${formatHours(totalHours(ticket))}`,
      `- URL afectada: ${ticket.affectedUrl || 'N/A'}`,
      `- Notas técnicas: ${ticket.technicalNotes || 'Sin notas'}`
    ].join('\n');

    navigator.clipboard?.writeText(summary)
      .then(() => showToast('Resumen copiado al portapapeles.'))
      .catch(() => showToast('No se pudo copiar automáticamente.'));
  }

  /* ========================================================================
   * ELIMINACIÓN CON <dialog> NATIVO
   * ======================================================================== */
  function requestDeleteTicket(ticketId) {
    pendingDeleteTicketId = ticketId;
    document.getElementById('confirmDeleteText').textContent =
      `¿Confirmás la eliminación permanente del ticket #${ticketId}? Esta acción actualizará el saldo de horas del período y no se puede deshacer.`;
    document.getElementById('confirmDeleteDialog').showModal();
  }

  async function executeDeleteTicket(ticketId) {
    if (!canManage()) return;
    const ticket = TicketStore.getTickets().find(t => t.id === ticketId);
    if (!ticket) return;
    try { await TicketStore.remove(activeTicketId === ticketId && online ? {...ticket, version:editingVersion} : ticket); }
    catch (error) { showToast(error.message); return; }

    if (activeTicketId === ticketId) {
      activeTicketId = null;
      const detailDlg = document.getElementById('detailDialog');
      if (detailDlg.open) detailDlg.close('');
    }

    updateNavCounter();
    renderDashboard();
    renderReport();
    showToast(`Ticket #${ticketId} eliminado.`);
  }

  /* ========================================================================
   * VISTA 3: REPORTE MENSUAL DE HORAS Y EXPORTACIÓN CSV
   * ======================================================================== */
  function syncMonthInputs() {
    const dashMonth = document.getElementById('dashboardMonthSelect');
    const repMonth = document.getElementById('reportMonthSelect');
    if (dashMonth && dashMonth.value !== activeMonth) dashMonth.value = activeMonth;
    if (repMonth && repMonth.value !== activeMonth) repMonth.value = activeMonth;
  }

  function renderReport() {
    syncMonthInputs();
    const ledger = computeMonthlyHoursLedger(activeMonth);

    document.body.classList.toggle('outside-term', !inTerm(activeMonth, TicketStore.openingMonth()));
    document.getElementById('carryoverInput').value = ledger.carryoverAvailable;
    document.getElementById('carryoverInput').readOnly = online || activeMonth !== TicketStore.openingMonth();
    document.getElementById('reportPeriodHeading').textContent = formatMonthLabel(activeMonth);

    document.getElementById('reportSummaryGrid').innerHTML = `
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.carryoverAvailable)}</div>
        <div class="report-kpi-label">Trasladadas mes anterior</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.monthlyQuota)}</div>
        <div class="report-kpi-label">Bolsa mensual incluida</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.totalPoolConsumed)}</div>
        <div class="report-kpi-label">Consumidas en bolsa</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val accent">${formatHours(ledger.totalRemaining)}</div>
        <div class="report-kpi-label">Saldo mensual disponible</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.nextMonthCarryover)}</div>
        <div class="report-kpi-label">Traslado al próximo mes</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.totalMajorHours)}</div>
        <div class="report-kpi-label">Desarrollos aparte</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.excessHours)}</div>
        <div class="report-kpi-label">Excedente pendiente de conformidad</div>
      </div>
    `;

    const tbody = document.getElementById('reportTableBody');
    if (ledger.rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="report-table-empty">No hay tickets registrados para el período seleccionado.</td></tr>';
    } else {
      tbody.innerHTML = ledger.rows.map(row => {
        const t = row.ticket;
        const cat = getCategoryMeta(t.category);
        const scopeEval = evaluateScope(t.requestKind, t.scopeCriteria, t.estimatedHours, t);
        return `
          <tr>
            <th scope="row">
              <strong>#${escapeHtml(t.id)}</strong> · ${escapeHtml(t.title)}<br><small>${escapeHtml(t.workTitle)}</small>
            </th>
            <td>${escapeHtml(formatShortDate(t.workDate))}</td>
            <td>${escapeHtml(cat.label)}<br><small style="color: var(--text-dim);">${escapeHtml(scopeEval.label)}</small></td>
            <td><strong>${formatHours(row.hours)}</strong></td>
            <td>${escapeHtml(t.assignee || 'Sin asignar')}</td>
            <td>${escapeHtml(t.status)}</td>
            <td>${escapeHtml(!inTerm(activeMonth, TicketStore.openingMonth()) && t.billingMode === 'bolsa' ? 'Vigencia a confirmar' : row.imputationLabel)}<br><small style="color: var(--text-dim);">Saldo: ${inTerm(activeMonth, TicketStore.openingMonth()) ? formatHours(row.runningBalance) : 'Pendiente'}</small></td>
          </tr>
        `;
      }).join('');
    }

    if (!online || signedUser) {
      document.querySelectorAll('.no-contract-notice').forEach(el => {
        el.hidden = isSystems() || inTerm(activeMonth, TicketStore.openingMonth());
        el.textContent = TicketStore.openingMonth() ? 'Este período está fuera de la vigencia configurada.' : 'Falta confirmar el inicio del contrato. El saldo está pendiente.';
      });
    }
    if (!inTerm(activeMonth, TicketStore.openingMonth())) {
      document.getElementById('reportFootnote').textContent = TicketStore.openingMonth()
        ? 'Período fuera de la vigencia configurada. Verificá el contrato antes de imputar horas.'
        : 'Falta configurar el mes de inicio acordado. Los saldos y excedentes no están disponibles.';
    }
    const expiredMsg = ledger.carryExpiredAtMonthEnd > 0
      ? ` Quedan ${formatHours(ledger.carryExpiredAtMonthEnd)} trasladadas del mes anterior que vencerán al finalizar este mes si no se consumen (no vuelven a acumularse).`
      : '';

    if (inTerm(activeMonth, TicketStore.openingMonth())) document.getElementById('reportFootnote').textContent =
      `Regla de cómputo: Se consumen primero las horas trasladadas del mes anterior (máximo 30 h) y luego las 30 h incluidas del mes en curso.${expiredMsg} Las horas no utilizadas de la bolsa mensual vigente se trasladan al mes siguiente hasta un tope de 30 h. Los desarrollos mayores se registran por separado y no descuentan de la bolsa incluida.`;
  }

  function exportMonthlyCsv() {
    const ledger = computeMonthlyHoursLedger(activeMonth);
    if (!ledger.rows.length) {
      showToast('No hay tickets en este mes para exportar.');
      return;
    }

    const headers = [
      'ID', 'Ticket', 'Tarea', 'Fecha', 'Servicio', 'Alcance', 'Prioridad',
      'Horas Consumidas', 'Responsable', 'Estado', 'Imputación',
      'Saldo Disponible Tras Tarea', 'Ref Presupuesto Aparte'
    ];

    const lines = [headers.join(';')];
    ledger.rows.forEach(row => {
      const t = row.ticket;
      const cat = getCategoryMeta(t.category);
      const prio = getPriorityMeta(t.priority);
      const scope = evaluateScope(t.requestKind, t.scopeCriteria, t.estimatedHours, t);
      const cols = [
        t.id,
        t.title,
        t.workTitle,
        formatShortDate(t.workDate),
        cat.fullName,
        scope.label,
        prio.label,
        String(row.hours).replace('.', ','),
        t.assignee || 'Sin asignar',
        t.status,
        !inTerm(activeMonth, TicketStore.openingMonth()) && t.billingMode === 'bolsa' ? 'Vigencia a confirmar' : row.imputationLabel,
        inTerm(activeMonth, TicketStore.openingMonth()) ? String(row.runningBalance).replace('.', ',') : 'Sin saldo contractual',
        t.separateQuoteRef || ''
      ].map(value => {
        let text = String(value).replace(/[\r\n\t]/g, ' ');
        if (/^\s*[=+@＝＋－＠-]/u.test(text)) text = '\t' + text.trimStart();
        return '"' + text.replace(/"/g, '""') + '"';
      });
      lines.push(cols.join(';'));
    });

    const csv = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_ElDerecho_UCA_${activeMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Reporte CSV de ${activeMonth} descargado.`);
  }

  /* ========================================================================
   * EVENT LISTENERS E INICIALIZACIÓN
   * ======================================================================== */
  function bindEvents() {
    document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);
    document.getElementById('logoutBtn').addEventListener('click', async () => {
      try { await request(CONFIG.auth.loginEndpoint, 'DELETE'); sessionEvents?.postMessage('cambio'); clearPrivateView(); showToast('Sesión cerrada.'); }
      catch (error) { showToast(error.message); }
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (online && signedUser && btn.dataset.view !== 'newTicket') {
          try { await loadSharedTickets(); updateNavCounter(); }
          catch (error) { showToast(error.message); return; }
        }
        switchView(btn.dataset.view);
      });
    });

    document.querySelectorAll('.step-tab').forEach(tab => {
      tab.addEventListener('click', () => goToStep(Number(tab.dataset.step)));
    });

    document.querySelectorAll('[data-next]').forEach(btn => {
      btn.addEventListener('click', () => goToStep(Number(btn.dataset.next)));
    });

    document.querySelectorAll('[data-prev]').forEach(btn => {
      btn.addEventListener('click', () => goToStep(Number(btn.dataset.prev)));
    });

    document.getElementById('ticketForm').addEventListener('submit', handleTicketSubmit);
    document.getElementById('btnNewAnotherTicket').addEventListener('click', resetWizard);
    document.getElementById('btnGoToDashboard').addEventListener('click', () => {
      resetWizard();
      switchView('dashboard');
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailEl = document.getElementById('loginEmail');
      const passEl = document.getElementById('loginPass');
      const errBox = document.getElementById('loginErrorBox');
      errBox.style.display = 'none';

      if (!emailEl.checkValidity() || !passEl.checkValidity()) {
        emailEl.dispatchEvent(new Event('invalid', { cancelable: true }));
        passEl.dispatchEvent(new Event('invalid', { cancelable: true }));
        return;
      }

      try {
        const session = await request(CONFIG.auth.loginEndpoint, 'POST', {email: emailEl.value.trim(), password: passEl.value});
        passEl.value = '';
        sessionEvents?.postMessage('cambio');
        await startSession(session);
      } catch (error) {
        errBox.textContent = error.message;
        errBox.style.display = 'block';
      }
    });

    // Dashboard filtros, mes y buscador
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.dataset.filter;
        document.querySelectorAll('.filter-tab').forEach(b => b.setAttribute('aria-pressed', String(b === tab)));
        renderDashboard();
      });
    });

    document.getElementById('searchTicketsInput').addEventListener('input', renderDashboard);

    const onMonthChange = (e) => {
      if (!e.target.value) return;
      activeMonth = e.target.value;
      renderDashboard();
      renderReport();
    };
    document.getElementById('dashboardMonthSelect').addEventListener('change', onMonthChange);
    document.getElementById('reportMonthSelect').addEventListener('change', onMonthChange);

    document.getElementById('carryoverInput').addEventListener('change', (e) => {
      if (online || activeMonth !== TicketStore.openingMonth() || !e.target.reportValidity()) return;
      const clamped = Number(e.target.value);
      try { writeStorage(STORAGE.carryoverByMonth, {...TicketStore.getCarryoverMap(), [activeMonth]:clamped}); }
      catch (error) { showToast(error.message); renderReport(); return; }
      e.target.value = clamped;
      renderDashboard();
      renderReport();
      showToast(`Horas trasladadas para ${formatMonthLabel(activeMonth)}: ${formatHours(clamped)}.`);
    });

    document.getElementById('btnExportCsv').addEventListener('click', exportMonthlyCsv);
    document.getElementById('btnPrintReport').addEventListener('click', () => window.print());

    // Drawer de ticket
    document.getElementById('btnCloseDetailDialog').addEventListener('click', () => {
      document.getElementById('detailDialog').close('');
    });
    document.getElementById('btnSaveTicketChanges').addEventListener('click', saveDrawerTicketChanges);
    document.getElementById('btnCopyTicketSummary').addEventListener('click', copyActiveTicketSummary);
    document.getElementById('btnDeleteFromDrawer').addEventListener('click', () => {
      if (activeTicketId) requestDeleteTicket(activeTicketId);
    });

    document.getElementById('editRequestKind').addEventListener('change', refreshDrawerScopeVerdict);
    document.getElementById('editEstimatedHours').addEventListener('input', refreshDrawerScopeVerdict);
    document.getElementById('scopeCriteriaContainer').addEventListener('change', refreshDrawerScopeVerdict);

    // Confirmación nativa de borrado: leer returnValue y resetearlo siempre
    const confirmDlg = document.getElementById('confirmDeleteDialog');
    confirmDlg.addEventListener('close', () => {
      const choice = confirmDlg.returnValue;
      confirmDlg.returnValue = '';
      if (choice === 'confirm' && pendingDeleteTicketId) {
        const toDelete = pendingDeleteTicketId;
        pendingDeleteTicketId = null;
        executeDeleteTicket(toDelete);
      } else {
        pendingDeleteTicketId = null;
      }
    });
  }

  window.addEventListener('DOMContentLoaded', async () => {
    buildWizardControls();
    initAccessibleValidation();
    initDialogLightDismissFallback();
    bindEvents();
    syncMonthInputs();
    syncAuthUI();
    if (online) {
      try { await startSession(await request(CONFIG.auth.loginEndpoint)); }
      catch (error) {
        const box = document.getElementById('loginErrorBox');
        box.textContent = error.message;
        box.style.display = 'block';
      }
    } else {
      try { updateNavCounter(); renderDashboard(); renderReport(); }
      catch (error) { showToast(error.message); }
    }
  });
})();