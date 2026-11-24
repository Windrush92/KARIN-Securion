(function () {
  'use strict';

  const CONFIG = window.UCA_TICKETERA_CONFIG;
  const STORAGE = CONFIG.contract.storageKeys;

  /* ========================================================================
   * ICONOS SVG MINIMALISTAS (SIN EMOJIS) PARA LAS 5 ÁREAS DE ATENCIÓN
   * ======================================================================== */
  const CATEGORY_ICONS = {
    headset: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>',
    window: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><circle cx="6.5" cy="6.5" r="0.65" fill="currentColor" stroke="none"></circle><circle cx="9.2" cy="6.5" r="0.65" fill="currentColor" stroke="none"></circle><circle cx="11.9" cy="6.5" r="0.65" fill="currentColor" stroke="none"></circle>',
    search: '<circle cx="11" cy="11" r="7.5"></circle><line x1="20.5" y1="20.5" x2="16.3" y2="16.3"></line>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
    bars: '<rect x="4" y="13" width="3.5" height="7" rx="0.5"></rect><rect x="10.25" y="9" width="3.5" height="11" rx="0.5"></rect><rect x="16.5" y="4" width="3.5" height="16" rx="0.5"></rect>'
  };

  /* ========================================================================
   * ESTADO DE LA APLICACIÓN
   * ======================================================================== */
  let currentFilter = 'todos';
  const isStaticPreview = location.protocol === 'file:' || /(^|\.)github\.io$/i.test(location.hostname);
  const online = !isStaticPreview;
  let signedUser = null;
  let csrf = '';
  let sharedTickets = [];
  let openingBalances = {};
  let balanceAdjustments = [];
  let contractStart = null;
  let canViewReport = !online;
  let requestKey = null;
  let editingVersion = null;
  let activeMonth = getDefaultMonth();
  let activeTicketId = null;
  let pendingDeleteTicketId = null;
  let pendingAttachments = [];
  let attachmentSeq = 0;
  let toastTimer = null;

  function getDefaultMonth() {
    if (online) return argentinaNow().slice(0, 7);
    let stored;
    try { stored = readStorage(STORAGE.tickets); } catch { return argentinaNow().slice(0, 7); }
    if (!stored && CONFIG.seedTickets.length > 0 && CONFIG.seedTickets[0].billingMonth) {
      return CONFIG.seedTickets[0].billingMonth;
    }
    return argentinaNow().slice(0, 7);
  }

  /* ========================================================================
   * UTILIDADES DE FECHA, FORMATO Y ALMACENAMIENTO
   * ======================================================================== */
  function argentinaNow() {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return v.year + '-' + v.month + '-' + v.day + 'T' + v.hour + ':' + v.minute;
  }

  function roundHours(num) {
    return Math.round((Number(num) || 0) * 100) / 100;
  }

  function formatHours(num) {
    const rounded = roundHours(num);
    const str = rounded % 1 === 0
      ? rounded.toFixed(0)
      : rounded.toFixed(2).replace(/0$/, '').replace('.', ',');
    return `${str} h`;
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  function readStorage(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
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
    } catch {
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
    } catch {
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
    } catch {
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
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
  }

  function resolveCategoryId(catId) {
    if (!catId) return CONFIG.serviceCategories[0].id;
    const mapped = (CONFIG.legacyCategoryMap && CONFIG.legacyCategoryMap[catId]) || catId;
    return CONFIG.serviceCategories.some(c => c.id === mapped)
      ? mapped
      : CONFIG.serviceCategories[0].id;
  }

  function getCategoryMeta(catId) {
    const resolved = resolveCategoryId(catId);
    return CONFIG.serviceCategories.find(c => c.id === resolved) || CONFIG.serviceCategories[0];
  }

  function getPriorityMeta(prioId) {
    return CONFIG.priorities.find(p => p.id === prioId) || CONFIG.priorities[2];
  }

  function getStatusMeta(statusId) {
    return CONFIG.statuses.find(s => s.id === statusId) || CONFIG.statuses[0];
  }

  function statusTextClass(statusId) {
    const meta = getStatusMeta(statusId);
    return meta.badgeClass.replace(/^status-/, 'status-text-');
  }

  function prioTextClass(prioId) {
    const meta = getPriorityMeta(prioId);
    return meta.badgeClass.replace(/^prio-/, 'prio-text-');
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
      } catch {}
    }
  }

  function toggleTheme() {
    const current = getEffectiveTheme();
    applyColorScheme(current === 'dark' ? 'light' : 'dark', true);
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE.theme) {
      applyColorScheme(e.newValue || 'light', false);
    }
  });

  /* ========================================================================
   * TOGGLETIPS NATIVOS ACCESIBLES (interestfor + popover="hint" + FALLBACKS)
   * ======================================================================== */
  const ownedToggletipTriggers = new WeakSet();

  function wireInterestToggletips(root = document) {
    const normalizeText = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const accessibleName = (el) => {
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        return normalizeText(labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
      }
      if (el.hasAttribute('aria-label')) return normalizeText(el.getAttribute('aria-label'));
      return normalizeText(el.textContent || el.getAttribute('title') || '');
    };

    root.querySelectorAll('[interestfor]').forEach(trigger => {
      const targetId = trigger.getAttribute('interestfor');
      const tip = targetId ? document.getElementById(targetId) : null;
      if (!tip || tip.getAttribute('popover') !== 'hint') return;

      const tipText = normalizeText(tip.textContent);
      const triggerName = accessibleName(trigger);
      if (tipText && triggerName && tipText.toLowerCase() === triggerName.toLowerCase()) return;

      if (!tip.hasAttribute('role')) {
        tip.setAttribute('role', 'tooltip');
      }

      if (!triggerName) {
        if (!trigger.hasAttribute('aria-labelledby')) {
          trigger.setAttribute('aria-labelledby', targetId);
        }
      } else if (trigger.getAttribute('popovertarget') === targetId || trigger.getAttribute('commandfor') === targetId) {
        if (!trigger.hasAttribute('aria-expanded')) {
          const isOpen = tip.matches?.(':popover-open') || tip.classList.contains(':popover-open');
          trigger.setAttribute('aria-expanded', String(Boolean(isOpen)));
          ownedToggletipTriggers.add(trigger);
        }
      } else if (!trigger.hasAttribute('aria-describedby')) {
        trigger.setAttribute('aria-describedby', targetId);
      }
    });
  }

  function initToggletips() {
    wireInterestToggletips(document);

    // Sincronizar aria-expanded desde el evento toggle en fase de captura (toggle no burbujea)
    document.addEventListener('toggle', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.id) return;
      const open = event.newState === 'open';
      document.querySelectorAll(`[interestfor="${CSS.escape(target.id)}"]`).forEach(trigger => {
        if (ownedToggletipTriggers.has(trigger)) {
          trigger.setAttribute('aria-expanded', String(open));
        }
        trigger.classList.toggle('interest-source', open);
      });
      target.classList.toggle('interest-target', open);
    }, true);

    // Fallback para navegadores sin popover="hint" (ej. Safari): cambiar a "auto" en beforetoggle
    const supportsPopover = Object.hasOwn(HTMLElement.prototype, 'popover');
    if (supportsPopover) {
      const probe = document.createElement('div');
      probe.popover = 'hint';
      if (probe.popover !== 'hint') {
        document.addEventListener('beforetoggle', (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement) || !target.id) return;
          const isToggletip = target.getAttribute('popover') === 'hint'
            && document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
          if (event.newState === 'open' && isToggletip) {
            target.popover = 'auto';
          }
        }, true);
      }
    }

    // Fallback local de hover/focus cuando el navegador no soporta interestfor nativo (CSP script-src 'self')
    if ('interestForElement' in HTMLButtonElement.prototype) return;

    document.querySelectorAll('[interestfor]').forEach(trigger => {
      const targetId = trigger.getAttribute('interestfor');
      const tip = targetId ? document.getElementById(targetId) : null;
      if (!tip) return;

      let showTimer = null;
      let hideTimer = null;
      let pointerInside = false;
      let pinnedByClick = false;

      const isOpen = () => supportsPopover
        ? tip.matches(':popover-open')
        : tip.classList.contains(':popover-open');

      const openTip = () => {
        clearTimeout(hideTimer);
        if (isOpen()) return;
        if (supportsPopover) {
          try { tip.showPopover({ source: trigger }); }
          catch { try { tip.showPopover(); } catch {} }
        } else {
          tip.classList.add(':popover-open');
          trigger.setAttribute('aria-expanded', 'true');
          trigger.classList.add('interest-source');
        }
      };

      const closeTip = () => {
        clearTimeout(showTimer);
        if (!isOpen()) return;
        if (supportsPopover) {
          try { tip.hidePopover(); } catch {}
        } else {
          tip.classList.remove(':popover-open');
          trigger.setAttribute('aria-expanded', 'false');
          trigger.classList.remove('interest-source');
        }
      };

      const scheduleShow = () => {
        clearTimeout(hideTimer);
        clearTimeout(showTimer);
        showTimer = setTimeout(openTip, 150);
      };

      const scheduleHide = () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        if (pinnedByClick) return;
        hideTimer = setTimeout(() => {
          if (!pointerInside && document.activeElement !== trigger) {
            closeTip();
          }
        }, 160);
      };

      trigger.addEventListener('pointerenter', () => { pointerInside = true; scheduleShow(); });
      trigger.addEventListener('pointerleave', () => { pointerInside = false; scheduleHide(); });
      trigger.addEventListener('focus', () => { scheduleShow(); });
      trigger.addEventListener('blur', () => { pinnedByClick = false; scheduleHide(); });

      // WCAG 1.4.13 Hoverable: el puntero puede pasar sobre el contenido sin cerrarlo
      tip.addEventListener('pointerenter', () => { pointerInside = true; clearTimeout(hideTimer); });
      tip.addEventListener('pointerleave', () => { pointerInside = false; scheduleHide(); });

      trigger.addEventListener('click', () => {
        pinnedByClick = true;
        openTip();
      });

      document.addEventListener('pointerdown', (e) => {
        if (!trigger.contains(e.target) && !tip.contains(e.target)) {
          pinnedByClick = false;
          if (!supportsPopover && isOpen()) closeTip();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
          pinnedByClick = false;
          closeTip();
        }
      });
    });
  }

  /* ========================================================================
   * SERVICIO DE AUTENTICACIÓN DESACOPLADO (POR CUENTA HABILITADA)
   * ======================================================================== */
  const sessionEvents = online && typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel('elderecho-ticketera-session')
    : null;
  if (sessionEvents) sessionEvents.onmessage = () => location.reload();
  window.addEventListener('pageshow', (event) => {
    if (online && event.persisted) location.reload();
  });

  const canManage = () => !online || signedUser?.role === 'admin';
  const isSystems = () => online && signedUser?.role === 'sistemas_uca';
  const isReportAllowed = () => !online || (Boolean(signedUser) && !isSystems() && canViewReport);

  function clearPrivateView() {
    signedUser = null;
    csrf = '';
    sharedTickets = [];
    openingBalances = {};
    balanceAdjustments = [];
    contractStart = null;
    canViewReport = !online;
    activeTicketId = null;
    editingVersion = null;
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    [
      'workHistory', 'ticketsGrid', 'drawerClientDetails', 'drawerHeaderMeta',
      'drawerAttachmentsGrid', 'reportTableBody', 'reportSummaryGrid',
      'successDetailsBox', 'balanceAdjustHistoryList'
    ].forEach(id => {
      document.getElementById(id)?.replaceChildren();
    });
    document.getElementById('navTicketCount').textContent = '0';
    document.getElementById('loginPass').value = '';
    document.getElementById('searchTicketsInput').value = '';
    document.querySelectorAll('#detailDialog input, #detailDialog textarea').forEach(el => {
      if (el.type === 'checkbox') el.checked = false;
      else el.value = '';
    });
    document.getElementById('drawerTicketTitle').textContent = 'Detalle del ticket';
    document.getElementById('toastMsg').textContent = '';
    document.getElementById('successTicketId').textContent = '';
    resetTicketForm();
    syncAuthUI();
  }

  async function request(endpoint, method = 'GET', data) {
    let res;
    try {
      res = await fetch(endpoint, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: data === undefined ? undefined : JSON.stringify(data)
      });
    } catch {
      throw new Error('Sin conexión. Revisá la red y reintentá la operación.');
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      if (res.status === 401 && signedUser) clearPrivateView();
      const err = new Error(result.error || 'El servidor no confirmó la operación.');
      err.status = res.status;
      throw err;
    }
    return result;
  }

  async function uploadAttachmentsOnline(ticketId, items) {
    if (!items.length) return [];
    const formData = new FormData();
    formData.append('ticketId', ticketId);
    items.forEach(item => formData.append('images[]', item.file, item.name));

    let res;
    try {
      res = await fetch(CONFIG.auth.attachmentsEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-CSRF-Token': csrf },
        body: formData
      });
    } catch {
      throw new Error('El ticket se creó, pero no hubo conexión para subir las capturas.');
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) {
      throw new Error(result.error || 'El ticket se creó, pero no se pudieron guardar las capturas.');
    }
    return result.attachments || [];
  }

  async function loadSharedTickets() {
    const identity = csrf;
    const result = await request(CONFIG.auth.ticketsEndpoint);
    if (!identity || csrf !== identity) throw new Error('La sesión cambió. Volvé a ingresar.');
    sharedTickets = result.tickets || [];
    openingBalances = result.carryover || {};
    balanceAdjustments = result.balanceAdjustments || [];
    contractStart = result.startMonth || null;
    if (typeof result.canViewReport === 'boolean') {
      canViewReport = result.canViewReport;
    }
  }

  async function startSession(result) {
    csrf = result.csrf;
    signedUser = result.user;
    canViewReport = typeof result.canViewReport === 'boolean'
      ? result.canViewReport
      : result.user?.role === 'admin';
    try {
      await loadSharedTickets();
    } catch (error) {
      clearPrivateView();
      throw error;
    }
    syncAuthUI();
    updateNavCounter();
    switchView(isSystems() ? 'dashboard' : 'newTicket');
  }

  function syncAuthUI() {
    const ready = !online || Boolean(signedUser);
    document.body.classList.toggle('session-pending', !ready);
    document.body.classList.toggle('systems-view', isSystems());
    document.body.classList.toggle('readonly-view', !canManage());
    document.body.classList.toggle('report-hidden', !isReportAllowed());
    document.getElementById('viewLogin').classList.toggle('active', !ready);
    document.getElementById('mainNavTabs').style.display = ready ? 'flex' : 'none';
    document.getElementById('userSessionWrap').style.display = signedUser ? 'flex' : 'none';
    document.getElementById('userNameDisplay').textContent = signedUser?.name || '';
    if (!ready) {
      document.querySelectorAll('.view-section:not(#viewLogin)').forEach(el => el.classList.remove('active'));
    }
    document.querySelectorAll('#detailDialog input, #detailDialog select, #detailDialog textarea')
      .forEach(el => { el.disabled = !canManage(); });
  }

  /* ========================================================================
   * REPOSITORIO DE TICKETS Y BOLSA DE HORAS
   * ======================================================================== */
  const TicketStore = {
    getTickets() {
      if (online) return sharedTickets;
      const saved = readStorage(STORAGE.tickets);
      if (saved === null) return structuredClone(CONFIG.seedTickets);
      if (!Array.isArray(saved)) throw new Error('Los datos locales de tickets tienen un formato inválido.');
      return saved;
    },

    getCarryoverMap() {
      return online
        ? openingBalances
        : (readStorage(STORAGE.carryoverByMonth) || { ...CONFIG.seedCarryoverByMonth });
    },

    getBalanceAdjustments() {
      if (online) return balanceAdjustments;
      return readStorage(STORAGE.balanceAdjustments) || [];
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
      if (!creating && JSON.stringify(list.find(t => t.id === ticket.id)) !== editingVersion) {
        throw new Error('El ticket cambió. Volvé a abrirlo.');
      }
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

    async saveBalanceAdjustment(period, hours, reason) {
      if (!canManage()) throw new Error('Solo el equipo de Karín puede ajustar el saldo.');
      if (online) {
        const res = await request(CONFIG.auth.balanceEndpoint, 'POST', { period, hours, reason });
        openingBalances = res.carryover || openingBalances;
        balanceAdjustments = res.adjustments || balanceAdjustments;
        return;
      }
      const map = { ...this.getCarryoverMap() };
      const prevHours = Object.hasOwn(map, period) ? Number(map[period]) : null;
      map[period] = roundHours(hours);
      writeStorage(STORAGE.carryoverByMonth, map);

      const log = [
        {
          id: Date.now(),
          period,
          prevHours,
          newHours: roundHours(hours),
          reason,
          actor: signedUser?.name || 'Administración Karín',
          createdAt: argentinaNow().replace('T', ' ')
        },
        ...this.getBalanceAdjustments()
      ].slice(0, 50);
      writeStorage(STORAGE.balanceAdjustments, log);
    },

    getCarryoverForMonth(monthKey) {
      const start = this.openingMonth();
      if (!inTerm(monthKey, start)) return 0;
      const overrides = this.getCarryoverMap();
      const usage = new Map();
      for (const t of this.getTickets().flatMap(workRows)) {
        if (t.billingMode === 'bolsa') {
          const period = t.billingMonth || (t.createdAt || '').slice(0, 7);
          usage.set(period, (usage.get(period) || 0) + Math.round((Number(t.hoursLogged) || 0) * 100));
        }
      }
      let carry = 0;
      const maxCarryCenti = CONFIG.contract.maxCarryoverHours * 100;
      const monthlyCenti = CONFIG.contract.monthlyHoursIncluded * 100;
      for (let offset = 0; offset <= monthIndex(monthKey) - monthIndex(start); offset++) {
        const n = monthIndex(start) + offset;
        const period = Math.floor(n / 12) + '-' + String((n % 12) + 1).padStart(2, '0');
        if (Object.hasOwn(overrides, period)) {
          carry = Math.round(Math.max(0, Math.min(CONFIG.contract.maxCarryoverHours, Number(overrides[period]) || 0)) * 100);
        }
        if (period === monthKey) return carry / 100;
        // FIFO: primero se usan las trasladadas (vencen al cierre del mes); solo el saldo sin usar de las 30 h del mes pasa al mes siguiente.
        const currentSpent = Math.max(0, (usage.get(period) || 0) - carry);
        carry = Math.max(0, Math.min(maxCarryCenti, monthlyCenti - currentSpent));
      }
      return 0;
    }
  };

  function monthIndex(key) {
    const [y, m] = key.split('-').map(Number);
    return y * 12 + m - 1;
  }

  function inTerm(key, start) {
    return Boolean(
      start &&
      key &&
      monthIndex(key) >= monthIndex(start) &&
      monthIndex(key) - monthIndex(start) < CONFIG.contract.contractDurationMonths
    );
  }

  /* ========================================================================
   * MOTOR DE CÁLCULO FIFO DE HORAS (ÚNICA FUENTE PARA PORTAL, TARJETAS Y REPORTE)
   * ======================================================================== */
  function workRows(ticket) {
    const entries = ticket.workLogs || [];
    const rows = entries.map(entry => ({
      ...ticket,
      workDate: entry.date + 'T12:00',
      workTitle: entry.description,
      hoursLogged: roundHours(entry.hours),
      assignee: entry.assignee || ticket.assignee,
      billingMonth: entry.date.slice(0, 7),
      status: entry.status || ticket.status,
      billingMode: entry.billingMode || 'bolsa',
      separateQuoteRef: entry.quoteRef || ''
    }));
    if (Number(ticket.hoursLogged) > 0 || !entries.length) {
      rows.unshift({
        ...ticket,
        workDate: ticket.createdAt,
        workTitle: Number(ticket.hoursLogged) > 0 ? 'Registro anterior · fecha de alta' : 'Sin horas registradas'
      });
    }
    return rows;
  }

  function totalHours(ticket) {
    return roundHours((ticket.workLogs || []).reduce((acc, e) => acc + (Number(e.hours) || 0), Number(ticket.hoursLogged) || 0));
  }

  function ticketPeriodHoursInfo(ticket, monthKey) {
    const rows = monthKey
      ? workRows(ticket).filter(r => (r.billingMonth || (r.createdAt || '').slice(0, 7)) === monthKey)
      : workRows(ticket);
    const activeRows = rows.filter(r => (Number(r.hoursLogged) || 0) > 0);
    let pool = 0;
    let separate = 0;
    let uca = 0;

    for (const r of activeRows) {
      const h = roundHours(r.hoursLogged);
      if (r.billingMode === 'presupuesto_aparte') separate = roundHours(separate + h);
      else if (r.billingMode === 'sin_cargo_uca') uca = roundHours(uca + h);
      else pool = roundHours(pool + h);
    }

    const total = roundHours(pool + separate + uca);
    let subnote = '';

    if (total === 0) {
      if (ticket.billingMode === 'presupuesto_aparte' || ticket.status === 'Presupuesto aparte') {
        subnote = 'No se descuentan de la bolsa mensual.';
      } else if (ticket.billingMode === 'sin_cargo_uca') {
        subnote = 'Intervención de Sistemas UCA (no descuenta de la bolsa).';
      } else {
        subnote = 'Sin horas utilizadas registradas aún.';
      }
    } else if (pool > 0 && separate === 0 && uca === 0) {
      subnote = 'Descontadas de la bolsa mensual.';
    } else if (separate > 0 && pool === 0 && uca === 0) {
      subnote = 'No se descuentan de la bolsa mensual.';
    } else if (uca > 0 && pool === 0 && separate === 0) {
      subnote = 'Intervención de Sistemas UCA (no descuenta de la bolsa).';
    } else {
      const parts = [];
      if (pool > 0) parts.push(`${formatHours(pool)} de bolsa`);
      if (separate > 0) parts.push(`${formatHours(separate)} presupuesto aparte`);
      if (uca > 0) parts.push(`${formatHours(uca)} Sistemas UCA`);
      subnote = parts.join(' · ') + '.';
    }

    return { total, pool, separate, uca, subnote };
  }

  function computeMonthlyHoursLedger(monthKey) {
    const start = TicketStore.openingMonth();
    const isInTerm = inTerm(monthKey, start);
    const monthlyQuota = isInTerm ? CONFIG.contract.monthlyHoursIncluded : 0;
    const carryoverAvailable = TicketStore.getCarryoverForMonth(monthKey);
    const totalAvailable = roundHours(carryoverAvailable + monthlyQuota);

    const monthRows = TicketStore.getTickets()
      .flatMap(workRows)
      .filter(t => (t.billingMonth || (t.createdAt || '').slice(0, 7)) === monthKey)
      .sort((a, b) => String(a.workDate || '').localeCompare(String(b.workDate || '')) || String(a.id).localeCompare(String(b.id)));

    let carryRemaining = carryoverAvailable;
    let currentRemaining = monthlyQuota;
    let totalPoolConsumed = 0;
    let totalMajorHours = 0;
    let excessHours = 0;

    const ledgerRows = monthRows.map(ticket => {
      const hrs = Math.max(0, roundHours(ticket.hoursLogged));
      let carryUsedHere = 0;
      let currentUsedHere = 0;
      let excessHere = 0;
      let imputationLabel = '';

      if (ticket.billingMode === 'presupuesto_aparte') {
        totalMajorHours = roundHours(totalMajorHours + hrs);
        imputationLabel = ticket.separateQuoteRef
          ? `Presupuesto aparte (${ticket.separateQuoteRef})`
          : 'Presupuesto aparte';
      } else if (ticket.billingMode === 'sin_cargo_uca') {
        imputationLabel = 'Intervención Sistemas UCA (sin cargo a la bolsa)';
      } else {
        let toAllocate = hrs;
        if (carryRemaining > 0 && toAllocate > 0) {
          carryUsedHere = roundHours(Math.min(carryRemaining, toAllocate));
          carryRemaining = roundHours(carryRemaining - carryUsedHere);
          toAllocate = roundHours(toAllocate - carryUsedHere);
        }
        if (currentRemaining > 0 && toAllocate > 0) {
          currentUsedHere = roundHours(Math.min(currentRemaining, toAllocate));
          currentRemaining = roundHours(currentRemaining - currentUsedHere);
          toAllocate = roundHours(toAllocate - currentUsedHere);
        }
        if (toAllocate > 0) {
          excessHere = roundHours(toAllocate);
          excessHours = roundHours(excessHours + excessHere);
        }
        totalPoolConsumed = roundHours(totalPoolConsumed + carryUsedHere + currentUsedHere);

        if (hrs === 0) {
          imputationLabel = 'Sin horas utilizadas aún';
        } else if (carryUsedHere > 0 && currentUsedHere === 0 && excessHere === 0) {
          imputationLabel = `${formatHours(carryUsedHere)} de horas trasladadas`;
        } else if (currentUsedHere > 0 && carryUsedHere === 0 && excessHere === 0) {
          imputationLabel = `${formatHours(currentUsedHere)} de bolsa mensual`;
        } else {
          const parts = [];
          if (carryUsedHere > 0) parts.push(`${formatHours(carryUsedHere)} trasladadas`);
          if (currentUsedHere > 0) parts.push(`${formatHours(currentUsedHere)} mes actual`);
          if (excessHere > 0) parts.push(`${formatHours(excessHere)} excedente`);
          imputationLabel = parts.join(' + ');
        }
      }

      const runningBalance = roundHours(carryRemaining + currentRemaining);
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

    const carryUsedTotal = roundHours(carryoverAvailable - carryRemaining);
    const currentUsedTotal = roundHours(monthlyQuota - currentRemaining);
    const totalRemaining = roundHours(carryRemaining + currentRemaining);
    const nextMonthCarryover = isInTerm && monthIndex(monthKey) - monthIndex(start) + 1 < CONFIG.contract.contractDurationMonths
      ? roundHours(Math.min(CONFIG.contract.maxCarryoverHours, currentRemaining))
      : 0;

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
   * EVALUADOR DE ALCANCE (SOLO GESTIÓN INTERNA KARÍN)
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
    const peers = group
      ? TicketStore.getTickets().filter(t => t.requestKind === 'mejora' && t.id !== ticket.id && norm(t.linkedGroup) === group)
      : [];
    const total = peers.reduce((sum, t) => sum + (Number(t.estimatedHours) || 0), hrs);
    const items = [{ scopeCriteria: criteria, estimatedHours: hrs }, ...peers];
    const incomplete = items.some(t => !t.scopeCriteria || !Number(t.estimatedHours) || CONFIG.scopeCriteria.some(c => typeof t.scopeCriteria[c.id] !== 'boolean'));
    const disqualified = total > CONFIG.contract.minorAdjustmentMaxHours || items.some(t => t.estimatedHours > 0 && CONFIG.scopeCriteria.some(c => t.scopeCriteria?.[c.id] === false));

    if (incomplete && !disqualified) {
      return {
        classification: 'pendiente',
        label: 'Pendiente de evaluación',
        bannerClass: '',
        message: 'Completá la estimación y los cuatro criterios de la mejora y de sus pedidos vinculados.'
      };
    }

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
      if (el.type === 'radio' || el.type === 'checkbox' || el.type === 'file') return;

      let isInvalid = false;
      if (supportsUserInvalid) {
        isInvalid = el.matches(':user-invalid') || (dirtyFallback.get(el)?.touched && !el.validity.valid);
      } else {
        const st = dirtyFallback.get(el);
        isInvalid = Boolean(st && st.touched && !el.validity.valid);
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
   * CONSTRUCCIÓN DE CONTROLES DEL FORMULARIO Y DEL DRAWER
   * ======================================================================== */
  function buildControls() {
    // 5 Tarjetas ricas de Área de atención (Pantalla 1)
    const catGrid = document.getElementById('categorySelectorGrid');
    catGrid.innerHTML = CONFIG.serviceCategories.map((cat) => `
      <label class="area-choice">
        <input type="radio" name="serviceCategory" value="${escapeHtml(cat.id)}">
        <span class="area-choice-box">
          <span class="area-choice-head">
            <svg class="area-choice-icon" viewBox="0 0 24 24" aria-hidden="true">${CATEGORY_ICONS[cat.icon] || CATEGORY_ICONS.headset}</svg>
            <span class="area-choice-title">${escapeHtml(cat.label)}</span>
          </span>
          <span class="area-choice-desc">${escapeHtml(cat.description)}</span>
        </span>
      </label>
    `).join('');

    catGrid.addEventListener('change', () => {
      document.getElementById('categoryError')?.classList.remove('visible');
    });

    // Selectores del Drawer (gestión Karín)
    document.getElementById('editStatus').innerHTML = CONFIG.statuses
      .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.id)}</option>`)
      .join('');

    document.getElementById('editPriority').innerHTML = CONFIG.priorities
      .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.label)} · ${escapeHtml(p.sla)}</option>`)
      .join('');

    document.getElementById('editCategory').innerHTML = CONFIG.serviceCategories
      .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`)
      .join('');

    document.getElementById('assigneePresetList').innerHTML = (CONFIG.assigneePresets || [])
      .map(name => `<option value="${escapeHtml(name)}"></option>`)
      .join('');

    const criteriaContainer = document.getElementById('scopeCriteriaContainer');
    criteriaContainer.innerHTML = CONFIG.scopeCriteria.map(c => `
      <label class="inline-check-card">
        <input type="checkbox" id="crit_${escapeHtml(c.id)}" data-criterion="${escapeHtml(c.id)}">
        <span><strong>${escapeHtml(c.title)}:</strong> ${escapeHtml(c.minorText)}</span>
      </label>
    `).join('');
  }

  /* ========================================================================
   * GESTOR DE CAPTURAS E IMÁGENES ADJUNTAS (BOTÓN + DRAG&DROP + CTRL+V)
   * ======================================================================== */
  function addPendingImageFiles(fileList) {
    const files = [...(fileList || [])];
    if (!files.length) return;

    const { maxFiles, maxBytesPerFile, allowedMimes } = CONFIG.attachments;
    let added = 0;

    for (const file of files) {
      if (pendingAttachments.length >= maxFiles) {
        showToast(`Podés adjuntar hasta ${maxFiles} imágenes por ticket.`);
        break;
      }
      if (!allowedMimes.includes(file.type)) {
        showToast(`"${file.name || 'Archivo'}" no es un formato permitido (usá PNG, JPG, WebP o GIF).`);
        continue;
      }
      if (file.size <= 0 || file.size > maxBytesPerFile) {
        showToast(`"${file.name || 'Imagen'}" supera el límite de 5 MB.`);
        continue;
      }

      attachmentSeq += 1;
      const ext = (file.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const name = file.name && file.name.trim() ? file.name.trim() : `captura-${attachmentSeq}.${ext}`;
      const previewUrl = URL.createObjectURL(file);
      pendingAttachments.push({
        localId: `att-${attachmentSeq}`,
        file,
        name,
        mime: file.type,
        size: file.size,
        previewUrl
      });
      added += 1;
    }

    if (added > 0) {
      renderAttachmentPreviews();
    }
  }

  function removePendingAttachment(localId) {
    const idx = pendingAttachments.findIndex(item => item.localId === localId);
    if (idx === -1) return;
    URL.revokeObjectURL(pendingAttachments[idx].previewUrl);
    pendingAttachments.splice(idx, 1);
    renderAttachmentPreviews();
  }

  function clearPendingAttachments() {
    pendingAttachments.forEach(item => URL.revokeObjectURL(item.previewUrl));
    pendingAttachments = [];
    const fileInput = document.getElementById('ticketImagesInput');
    if (fileInput) fileInput.value = '';
    renderAttachmentPreviews();
  }

  function renderAttachmentPreviews() {
    const list = document.getElementById('attachmentPreviewList');
    if (!list) return;
    list.replaceChildren();

    pendingAttachments.forEach(item => {
      const card = document.createElement('div');
      card.className = 'attachment-preview-item';
      card.innerHTML = `
        <img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.name)}">
        <button type="button" class="btn-remove-attachment" data-remove-att="${escapeHtml(item.localId)}" aria-label="Quitar ${escapeHtml(item.name)}" title="Quitar imagen">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="attachment-preview-meta">
          <span class="attachment-preview-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          <span class="attachment-preview-size">${escapeHtml(formatBytes(item.size))}</span>
        </div>
      `;
      card.querySelector('[data-remove-att]').addEventListener('click', () => removePendingAttachment(item.localId));
      list.appendChild(card);
    });
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen adjunta.'));
      reader.readAsDataURL(file);
    });
  }

  function bindDropzoneEvents() {
    const dropzone = document.getElementById('imageDropzone');
    const fileInput = document.getElementById('ticketImagesInput');
    const triggerBtn = document.getElementById('btnTriggerAttach');

    triggerBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      addPendingImageFiles(fileInput.files);
      fileInput.value = '';
    });

    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.target === dropzone) {
          e.preventDefault();
          fileInput.click();
        }
      }
    });

    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });
    });

    ['dragleave', 'dragend'].forEach(ev => {
      dropzone.addEventListener(ev, (e) => {
        if (!dropzone.contains(e.relatedTarget)) {
          dropzone.classList.remove('drag-over');
        }
      });
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer?.files?.length) {
        addPendingImageFiles(e.dataTransfer.files);
      }
    });

    // Pegado directo de capturas con Ctrl + V cuando el formulario está visible
    document.addEventListener('paste', (e) => {
      const formSection = document.getElementById('viewNewTicket');
      const form = document.getElementById('ticketForm');
      if (!formSection?.classList.contains('active') || form?.style.display === 'none') return;
      if (document.querySelector('dialog[open]')) return;

      const items = [...(e.clipboardData?.items || [])];
      const imageFiles = items
        .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
        .map(item => item.getAsFile())
        .filter(Boolean);

      if (imageFiles.length > 0) {
        e.preventDefault();
        addPendingImageFiles(imageFiles);
        showToast(imageFiles.length === 1 ? 'Captura pegada y adjuntada.' : `${imageFiles.length} capturas pegadas y adjuntadas.`);
      }
    });
  }

  /* ========================================================================
   * NAVEGACIÓN DE VISTAS Y ENVÍO DEL FORMULARIO (1 SOLA PANTALLA)
   * ======================================================================== */
  function switchView(viewName) {
    if (online && (!signedUser || (isSystems() && viewName !== 'dashboard'))) return;
    if (viewName === 'report' && !isReportAllowed()) return;

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

  function validateTicketForm() {
    const titleEl = document.getElementById('ticketTitle');
    const descEl = document.getElementById('ticketDescription');
    const checkedCat = document.querySelector('input[name="serviceCategory"]:checked');
    const catErr = document.getElementById('categoryError');

    titleEl.setCustomValidity(titleEl.value.trim() ? '' : 'Completá el asunto del ticket.');
    if (!titleEl.checkValidity()) {
      titleEl.dispatchEvent(new Event('invalid', { cancelable: true }));
      titleEl.focus();
      showToast('Indicá un asunto para la solicitud.');
      return false;
    }

    if (!checkedCat) {
      catErr.classList.add('visible');
      document.querySelector('input[name="serviceCategory"]')?.focus();
      showToast('Seleccioná un área de atención.');
      return false;
    }
    catErr.classList.remove('visible');

    descEl.setCustomValidity(descEl.value.trim() ? '' : 'Describí los detalles de tu solicitud.');
    if (!descEl.checkValidity()) {
      descEl.dispatchEvent(new Event('invalid', { cancelable: true }));
      descEl.focus();
      showToast('Ingresá una descripción de la solicitud.');
      return false;
    }

    return true;
  }

  async function handleTicketSubmit(event) {
    event.preventDefault();
    if (!validateTicketForm()) return;

    const nowIso = argentinaNow();
    if (!requestKey) requestKey = crypto.randomUUID();
    const catId = document.querySelector('input[name="serviceCategory"]:checked')?.value || 'gestion_soporte';

    let newTicket = {
      id: 'ED-' + requestKey.replaceAll('-', '').slice(0, 16).toUpperCase(),
      title: document.getElementById('ticketTitle').value.trim(),
      requestKind: 'mantenimiento',
      category: catId,
      priority: 'normal',
      status: 'Nuevo',
      requesterName: signedUser?.name || 'Usuario El Derecho',
      requesterEmail: signedUser?.email || '',
      requesterArea: '',
      affectedUrl: '',
      evidenceUrl: '',
      description: document.getElementById('ticketDescription').value.trim(),
      linkedGroup: '',
      involvesAwsOrBackups: false,
      scopeCriteria: null,
      estimatedHours: 0,
      hoursLogged: 0,
      billingMode: 'bolsa',
      separateQuoteRef: '',
      assignee: 'Sin asignar',
      createdAt: nowIso,
      firstResponseAt: '',
      billingMonth: nowIso.slice(0, 7),
      technicalNotes: '',
      attachments: [],
      workLogs: []
    };

    if (online) newTicket.requestKey = requestKey;

    const submitBtn = document.getElementById('btnSubmitTicket');
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;

    try {
      if (!online && pendingAttachments.length > 0) {
        const localAttachments = [];
        for (const item of pendingAttachments) {
          const dataUrl = await readFileAsDataUrl(item.file);
          localAttachments.push({
            id: item.localId,
            name: item.name,
            mime: item.mime,
            size: item.size,
            url: dataUrl
          });
        }
        newTicket.attachments = localAttachments;
      }

      newTicket = await TicketStore.save(newTicket, true);

      if (online && pendingAttachments.length > 0) {
        try {
          const savedAttachments = await uploadAttachmentsOnline(newTicket.id, pendingAttachments);
          newTicket.attachments = savedAttachments;
          sharedTickets = sharedTickets.map(t => (t.id === newTicket.id ? { ...t, attachments: savedAttachments } : t));
        } catch (uploadError) {
          showToast(uploadError.message);
        }
      }
    } catch (error) {
      showToast(error.message);
      return;
    } finally {
      submitBtn.disabled = false;
    }

    activeMonth = newTicket.billingMonth;
    currentFilter = 'todos';
    document.getElementById('searchTicketsInput').value = '';
    document.querySelectorAll('.filter-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === currentFilter));
    });

    const attachedCount = (newTicket.attachments || []).length;
    clearPendingAttachments();
    updateNavCounter();

    const catMeta = getCategoryMeta(newTicket.category);
    document.getElementById('ticketForm').style.display = 'none';
    document.getElementById('successTicketId').textContent = `#${newTicket.id}`;
    document.getElementById('successDetailsBox').innerHTML = `
      <div class="summary-row"><span>Asunto:</span><strong>${escapeHtml(newTicket.title)}</strong></div>
      <div class="summary-row"><span>Área de atención:</span><strong>${escapeHtml(catMeta.fullName)}</strong></div>
      <div class="summary-row"><span>Solicitado por:</span><strong>${escapeHtml(newTicket.requesterName)}</strong></div>
      <div class="summary-row"><span>Estado inicial:</span><strong>${escapeHtml(newTicket.status)}</strong></div>
      <div class="summary-row"><span>Capturas adjuntas:</span><strong>${attachedCount === 0 ? 'Ninguna' : `${attachedCount} imagen${attachedCount > 1 ? 'es' : ''}`}</strong></div>
    `;
    document.getElementById('ticketSuccessCard').classList.add('active');
    showToast(`Ticket #${newTicket.id} enviado correctamente.`);
  }

  function resetTicketForm() {
    requestKey = null;
    const form = document.getElementById('ticketForm');
    form.reset();
    document.querySelectorAll('#ticketForm input, #ticketForm textarea').forEach(f => f.setCustomValidity(''));
    document.getElementById('categoryError')?.classList.remove('visible');
    clearPendingAttachments();
    form.style.display = 'block';
    document.getElementById('ticketSuccessCard').classList.remove('active');
  }

  /* ========================================================================
   * VISTA 2 & 3: PORTAL DE TICKETS, BOLSA DE HORAS Y TARJETAS DE TICKETS
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
    const monthTickets = allTickets.filter(t =>
      (t.billingMonth || (t.createdAt || '').slice(0, 7)) === activeMonth ||
      (t.workLogs || []).some(e => e.date.slice(0, 7) === activeMonth)
    );

    // Barra FIFO de Bolsa de Horas
    const hasTerm = inTerm(activeMonth, TicketStore.openingMonth());
    document.body.classList.toggle('outside-term', !hasTerm);
    const notice = document.getElementById('dashboardContractNotice');
    notice.hidden = hasTerm || isSystems();
    notice.textContent = TicketStore.openingMonth()
      ? 'Período fuera de la vigencia configurada.'
      : 'Falta confirmar el inicio del contrato. El saldo está pendiente.';

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

    // Filtros (5 pestañas exactas) + búsqueda
    const q = (document.getElementById('searchTicketsInput').value || '').toLowerCase().trim();
    const filtered = monthTickets.filter(t => {
      if (currentFilter === 'criticos' && t.priority !== 'critica' && t.priority !== 'alta') return false;
      if (currentFilter === 'activos' && t.status === 'Resuelto') return false;
      if (currentFilter === 'resueltos' && t.status !== 'Resuelto') return false;
      if (
        currentFilter === 'sistemas_uca' &&
        !t.involvesAwsOrBackups &&
        t.status !== 'Derivado a Sistemas UCA' &&
        !(t.assignee || '').toLowerCase().includes('sistemas uca') &&
        t.category !== 'infra_aws_uca'
      ) return false;

      if (q) {
        const cat = getCategoryMeta(t.category);
        const hay = `${t.id} ${t.title} ${t.description} ${t.requesterName} ${t.assignee} ${cat.label} ${t.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const grid = document.getElementById('ticketsGrid');
    const emptyState = document.getElementById('emptyTicketsState');
    grid.replaceChildren();

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    filtered.forEach(ticket => {
      const prio = getPriorityMeta(ticket.priority);
      const stClass = statusTextClass(ticket.status);
      const prClass = prioTextClass(ticket.priority);
      const hoursInfo = ticketPeriodHoursInfo(ticket, activeMonth);
      const assigneeText = ticket.assignee && ticket.assignee.trim() ? ticket.assignee.trim() : 'Sin asignar';
      const isUnassigned = assigneeText === 'Sin asignar';

      const card = document.createElement('article');
      card.className = 'ticket-card';
      card.innerHTML = `
        <div class="card-top">
          <span class="ticket-code">#${escapeHtml(ticket.id)}</span>
        </div>

        <h3 class="card-title">${escapeHtml(ticket.title)}</h3>
        <p class="card-desc">${escapeHtml(ticket.description)}</p>

        <div class="card-meta-list">
          <div class="meta-item">
            <span class="meta-label">Estado:</span>
            <span class="meta-val ${escapeHtml(stClass)}">${escapeHtml(ticket.status)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Prioridad:</span>
            <span class="meta-val ${escapeHtml(prClass)}">${escapeHtml(prio.label)} · ${escapeHtml(prio.sla)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Solicitado por:</span>
            <span class="meta-val">${escapeHtml(ticket.requesterName || 'Usuario UCA')}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Responsable:</span>
            <span class="meta-val assignee-val ${isUnassigned ? 'unassigned' : ''}">${escapeHtml(assigneeText)}</span>
          </div>
          <div class="meta-item meta-hours-row">
            <span class="meta-label">Horas utilizadas:</span>
            <div class="meta-hours-block">
              <span class="meta-val">${formatHours(hoursInfo.total)}</span>
              <span class="meta-hours-sub">${escapeHtml(hoursInfo.subnote)}</span>
            </div>
          </div>
        </div>

        <button type="button" class="card-btn-action">VER DETALLE</button>
      `;

      card.addEventListener('click', () => openTicketDrawer(ticket.id));
      grid.appendChild(card);
    });
  }

  /* ========================================================================
   * DRAWER NATIVO (<dialog>): CONSULTA DE DETALLE Y GESTIÓN KARÍN
   * ======================================================================== */
  function openImageLightbox(url, name) {
    const dlg = document.getElementById('imageLightboxDialog');
    const img = document.getElementById('lightboxImg');
    const cap = document.getElementById('lightboxCaption');
    img.src = url;
    img.alt = name || 'Captura adjunta';
    cap.textContent = name || 'Imagen adjunta';
    dlg.showModal();
  }

  function renderDrawerAttachments(ticket) {
    const section = document.getElementById('drawerAttachmentsSection');
    const grid = document.getElementById('drawerAttachmentsGrid');
    const items = ticket.attachments || [];
    grid.replaceChildren();
    section.hidden = items.length === 0;
    if (!items.length) return;

    items.forEach(att => {
      const card = document.createElement('div');
      card.className = 'drawer-attachment-card';

      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'drawer-attachment-trigger';
      trigger.innerHTML = `
        <img src="${escapeHtml(att.url)}" alt="${escapeHtml(att.name || 'Captura adjunta')}" loading="lazy">
        <span class="drawer-attachment-name" title="${escapeHtml(att.name || 'Captura')}">${escapeHtml(att.name || 'Captura')}</span>
      `;
      trigger.addEventListener('click', () => openImageLightbox(att.url, att.name));
      card.appendChild(trigger);

      if (canManage()) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-remove-attachment';
        delBtn.title = 'Eliminar imagen adjunta';
        delBtn.setAttribute('aria-label', `Eliminar ${att.name || 'imagen adjunta'}`);
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await deleteTicketAttachment(ticket.id, att.id);
        });
        card.appendChild(delBtn);
      }

      grid.appendChild(card);
    });
  }

  async function deleteTicketAttachment(ticketId, attId) {
    if (!canManage()) return;
    try {
      if (online) {
        await request(CONFIG.auth.attachmentsEndpoint, 'DELETE', { id: attId });
        sharedTickets = sharedTickets.map(t => (
          t.id === ticketId
            ? { ...t, attachments: (t.attachments || []).filter(a => a.id !== attId) }
            : t
        ));
      } else {
        const list = TicketStore.getTickets().map(t => (
          t.id === ticketId
            ? { ...t, attachments: (t.attachments || []).filter(a => a.id !== attId) }
            : t
        ));
        writeStorage(STORAGE.tickets, list);
      }
      const updated = TicketStore.getTickets().find(t => t.id === ticketId);
      if (updated) renderDrawerAttachments(updated);
      showToast('Imagen eliminada.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function openTicketDrawer(ticketId) {
    const ticket = TicketStore.getTickets().find(t => t.id === ticketId);
    if (!ticket) return;
    activeTicketId = ticketId;
    editingVersion = online ? ticket.version : JSON.stringify(ticket);

    const cat = getCategoryMeta(ticket.category);
    const prio = getPriorityMeta(ticket.priority);
    const stClass = statusTextClass(ticket.status);
    const prClass = prioTextClass(ticket.priority);
    const hoursInfo = ticketPeriodHoursInfo(ticket, null);
    const totalAll = hoursInfo.total;

    document.getElementById('drawerHeaderMeta').innerHTML = `
      <span class="ticket-code">#${escapeHtml(ticket.id)}</span>
      <span class="meta-val ${escapeHtml(stClass)}" style="font-size: 0.9rem;">${escapeHtml(ticket.status)}</span>
    `;
    document.getElementById('drawerTicketTitle').textContent = ticket.title;

    const slaBadge = document.getElementById('drawerSlaBadge');
    slaBadge.className = `drawer-priority-label ${prClass}`;
    slaBadge.textContent = `Prioridad: ${prio.label} · ${prio.sla}`;

    const assigneeText = ticket.assignee && ticket.assignee.trim() ? ticket.assignee.trim() : 'Sin asignar';
    const requesterDetail = ticket.requesterEmail && !isSystems()
      ? `${escapeHtml(ticket.requesterName)} (${escapeHtml(ticket.requesterEmail)})`
      : escapeHtml(ticket.requesterName || 'Usuario UCA');

    document.getElementById('drawerClientDetails').innerHTML = `
      <div class="detail-item">
        <span class="detail-label">Solicitado por</span>
        <span class="detail-value">${requesterDetail}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Área de atención</span>
        <span class="detail-value">${escapeHtml(cat.fullName)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Responsable</span>
        <span class="detail-value" style="color: var(--karin-yellow); font-weight: 700;">${escapeHtml(assigneeText)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Fecha de alta</span>
        <span class="detail-value">${escapeHtml(formatDateTime(ticket.createdAt))}</span>
      </div>
      ${!isSystems() ? `
        <div class="detail-item">
          <span class="detail-label">Horas utilizadas</span>
          <span class="detail-value"><strong>${formatHours(totalAll)}</strong><br><small style="color: var(--text-muted); font-style: italic;">${escapeHtml(hoursInfo.subnote)}</small></span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Primera respuesta</span>
          <span class="detail-value">${escapeHtml(formatDateTime(ticket.firstResponseAt))}</span>
        </div>
      ` : ''}
      ${ticket.involvesAwsOrBackups ? `
        <div class="detail-item full">
          <span class="detail-label">Coordinación técnica</span>
          <span class="detail-value">Requiere intervención o seguimiento con Sistemas UCA (AWS / Backups).</span>
        </div>
      ` : ''}
      <div class="detail-item full">
        <span class="detail-label">Descripción de la solicitud</span>
        <span class="detail-value" style="white-space: pre-wrap;">${escapeHtml(ticket.description)}</span>
      </div>
    `;

    renderDrawerAttachments(ticket);

    // Historial de intervenciones
    document.getElementById('workDate').value = argentinaNow().slice(0, 10);
    document.getElementById('workDate').max = argentinaNow().slice(0, 10);
    document.getElementById('workHours').value = '';
    document.getElementById('workDescription').value = '';
    document.getElementById('workAssignee').value = assigneeText === 'Sin asignar' ? '' : assigneeText;
    document.getElementById('workMode').value = ticket.billingMode || 'bolsa';

    const workHistoryEl = document.getElementById('workHistory');
    workHistoryEl.replaceChildren();
    for (const w of ticket.workLogs || []) {
      const li = document.createElement('li');
      li.textContent = [
        formatShortDate(w.date + 'T12:00'),
        w.description,
        w.assignee,
        formatHours(w.hours),
        billingLabel(w.billingMode)
      ].join(' · ');
      workHistoryEl.appendChild(li);
    }

    // Evaluador de alcance y gestión interna (solo visibles para admin)
    document.getElementById('editRequestKind').value = ticket.requestKind || 'mantenimiento';
    document.getElementById('editEstimatedHours').value = Number(ticket.estimatedHours) || 0;
    const crit = ticket.scopeCriteria || {};
    CONFIG.scopeCriteria.forEach(c => {
      const cb = document.getElementById(`crit_${c.id}`);
      if (cb) cb.checked = Boolean(crit[c.id]);
    });
    refreshDrawerScopeVerdict();

    document.getElementById('editStatus').value = ticket.status || 'Nuevo';
    document.getElementById('editPriority').value = ticket.priority || 'normal';
    document.getElementById('editCategory').value = resolveCategoryId(ticket.category);
    document.getElementById('editAssignee').value = ticket.assignee || 'Sin asignar';
    document.getElementById('editHoursLogged').value = Number(ticket.hoursLogged) || 0;
    document.getElementById('editBillingMonth').value = ticket.billingMonth || activeMonth;
    document.getElementById('editBillingMode').value = ticket.billingMode || 'bolsa';
    document.getElementById('editFirstResponseAt').value = ticket.firstResponseAt || '';
    document.getElementById('editLinkedGroup').value = ticket.linkedGroup || '';
    document.getElementById('editSeparateQuoteRef').value = ticket.separateQuoteRef || '';
    document.getElementById('editInvolvesAws').checked = Boolean(ticket.involvesAwsOrBackups);
    document.getElementById('editTechnicalNotes').value = ticket.technicalNotes || '';

    document.getElementById('editHoursLogged').closest('.form-group').hidden = !Number(ticket.hoursLogged);
    document.getElementById('editBillingMonth').closest('.form-group').hidden = !Number(ticket.hoursLogged);

    document.getElementById('detailDialog').showModal();
  }

  function refreshDrawerScopeVerdict() {
    const kind = document.getElementById('editRequestKind').value;
    const estHours = Number(document.getElementById('editEstimatedHours').value) || 0;
    const container = document.getElementById('scopeCriteriaContainer');

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
      if (field.closest('[hidden]') || field.disabled) continue;
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

    const t = { ...tickets[idx] };
    if (online) t.version = editingVersion;
    t.requestKind = document.getElementById('editRequestKind').value;
    t.estimatedHours = Math.max(0, Number(document.getElementById('editEstimatedHours').value) || 0);
    t.scopeCriteria = criteria;
    t.status = document.getElementById('editStatus').value;
    t.priority = document.getElementById('editPriority').value;
    t.category = document.getElementById('editCategory').value;
    t.assignee = document.getElementById('editAssignee').value.trim() || 'Sin asignar';
    t.hoursLogged = Math.max(0, Number(document.getElementById('editHoursLogged').value) || 0);
    t.billingMonth = document.getElementById('editBillingMonth').value || activeMonth;
    t.billingMode = document.getElementById('editBillingMode').value;
    t.firstResponseAt = document.getElementById('editFirstResponseAt').value;
    t.linkedGroup = document.getElementById('editLinkedGroup').value.trim();
    t.separateQuoteRef = document.getElementById('editSeparateQuoteRef').value.trim();
    t.involvesAwsOrBackups = document.getElementById('editInvolvesAws').checked
      || t.status === 'Derivado a Sistemas UCA'
      || t.assignee.toLowerCase().includes('sistemas uca');
    t.technicalNotes = document.getElementById('editTechnicalNotes').value.trim();

    const workHours = Number(document.getElementById('workHours').value);
    const description = document.getElementById('workDescription').value.trim();
    if (workHours || description) {
      const date = document.getElementById('workDate').value;
      const assignee = document.getElementById('workAssignee').value.trim() || (t.assignee !== 'Sin asignar' ? t.assignee : '');
      const billingMode = document.getElementById('workMode').value;
      if (!date || date > argentinaNow().slice(0, 10) || !workHours || !description || !assignee) {
        showToast('Para registrar la intervención completá fecha, tarea, responsable y horas.');
        return;
      }
      if (billingMode === 'bolsa' && !inTerm(date.slice(0, 7), TicketStore.openingMonth())) {
        showToast('La fecha debe estar dentro de la vigencia acordada para imputar a la bolsa.');
        return;
      }
      t.newWork = {
        date,
        description,
        assignee,
        billingMode,
        hours: workHours,
        status: t.status,
        quoteRef: t.separateQuoteRef
      };
    }

    const scope = evaluateScope(t.requestKind, criteria, t.estimatedHours, t);
    if (t.firstResponseAt && (t.firstResponseAt < t.createdAt || t.firstResponseAt > argentinaNow())) {
      showToast('La primera respuesta debe estar entre el alta y el momento actual.');
      return;
    }
    if (t.requestKind === 'mejora' && scope.classification !== 'menor') {
      if ((t.hoursLogged > 0 && t.billingMode === 'bolsa') || t.newWork?.billingMode === 'bolsa') {
        showToast('Revisá el alcance antes de imputar esta mejora a la bolsa.');
        return;
      }
      if (['En ejecución', 'En pruebas / QA', 'Resuelto'].includes(t.status) && (!t.estimatedHours || t.billingMode !== 'presupuesto_aparte' || !t.separateQuoteRef)) {
        showToast('Registrá la estimación, la imputación aparte y la referencia a la conformidad de la UCA.');
        return;
      }
    }

    const button = document.getElementById('btnSaveTicketChanges');
    if (button.disabled) return;
    button.disabled = true;
    try {
      await TicketStore.save(t, false);
    } catch (error) {
      showToast(error.message);
      if (online && signedUser) {
        try { await loadSharedTickets(); renderDashboard(); } catch {}
      }
      return;
    } finally {
      button.disabled = false;
    }

    updateNavCounter();
    renderDashboard();
    if (isReportAllowed()) renderReport();
    document.getElementById('detailDialog').close('');
    showToast(`Cambios guardados en #${t.id}.`);
  }

  function billingLabel(mode) {
    return {
      bolsa: 'Bolsa mensual',
      presupuesto_aparte: 'Presupuesto aparte',
      sin_cargo_uca: 'Sin cargo UCA'
    }[mode] || 'Bolsa mensual';
  }

  function copyActiveTicketSummary() {
    const ticket = TicketStore.getTickets().find(t => t.id === activeTicketId);
    if (!ticket) return;
    const cat = getCategoryMeta(ticket.category);
    const prio = getPriorityMeta(ticket.priority);
    const lines = [
      `TICKET #${ticket.id}: ${ticket.title}`,
      `- Área de atención: ${cat.fullName}`,
      `- Estado: ${ticket.status}`,
      `- Prioridad: ${prio.label} (${prio.sla})`,
      `- Solicitado por: ${ticket.requesterName}`,
      `- Responsable: ${ticket.assignee || 'Sin asignar'}`,
      `- Horas utilizadas: ${formatHours(totalHours(ticket))}`
    ];
    if (canManage() && ticket.technicalNotes) {
      lines.push(`- Notas internas: ${ticket.technicalNotes}`);
    }

    navigator.clipboard?.writeText(lines.join('\n'))
      .then(() => showToast('Resumen copiado al portapapeles.'))
      .catch(() => showToast('No se pudo copiar automáticamente.'));
  }

  /* ========================================================================
   * ELIMINACIÓN CON <dialog> NATIVO (SOLO ADMINISTRACIÓN KARÍN)
   * ======================================================================== */
  function requestDeleteTicket(ticketId) {
    if (!canManage()) return;
    pendingDeleteTicketId = ticketId;
    document.getElementById('confirmDeleteText').textContent =
      `¿Confirmás la eliminación permanente del ticket #${ticketId}? Esta acción actualizará el saldo de horas del período y no se puede deshacer.`;
    document.getElementById('confirmDeleteDialog').showModal();
  }

  async function executeDeleteTicket(ticketId) {
    if (!canManage()) return;
    const ticket = TicketStore.getTickets().find(t => t.id === ticketId);
    if (!ticket) return;
    try {
      await TicketStore.remove(activeTicketId === ticketId && online ? { ...ticket, version: editingVersion } : ticket);
    } catch (error) {
      showToast(error.message);
      return;
    }

    if (activeTicketId === ticketId) {
      activeTicketId = null;
      const detailDlg = document.getElementById('detailDialog');
      if (detailDlg.open) detailDlg.close('');
    }

    updateNavCounter();
    renderDashboard();
    if (isReportAllowed()) renderReport();
    showToast(`Ticket #${ticketId} eliminado.`);
  }

  /* ========================================================================
   * AJUSTE DE SALDO INICIAL / CORRECCIÓN (EXCLUSIVO KARÍN)
   * ======================================================================== */
  function renderBalanceAdjustHistory() {
    const list = document.getElementById('balanceAdjustHistoryList');
    if (!list) return;
    list.replaceChildren();
    const items = TicketStore.getBalanceAdjustments();
    items.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'balance-history-item';
      const prevText = entry.prevHours === null || entry.prevHours === undefined
        ? 'Sin registro previo'
        : formatHours(entry.prevHours);
      li.innerHTML = `
        <strong>${escapeHtml(formatMonthLabel(entry.period))} · ${escapeHtml(prevText)} → ${escapeHtml(formatHours(entry.newHours))}</strong>
        <span>${escapeHtml(entry.reason)}</span>
        <small style="color: var(--text-dim);">${escapeHtml(entry.actor)} · ${escapeHtml(formatDateTime(entry.createdAt))}</small>
      `;
      list.appendChild(li);
    });
  }

  function openBalanceAdjustDialog() {
    if (!canManage()) return;
    document.getElementById('adjustPeriod').value = activeMonth;
    document.getElementById('adjustHours').value = TicketStore.getCarryoverForMonth(activeMonth);
    document.getElementById('adjustReason').value = '';
    renderBalanceAdjustHistory();
    document.getElementById('balanceAdjustDialog').showModal();
  }

  async function handleBalanceAdjustSubmit(event) {
    event.preventDefault();
    if (!canManage()) return;

    const periodEl = document.getElementById('adjustPeriod');
    const hoursEl = document.getElementById('adjustHours');
    const reasonEl = document.getElementById('adjustReason');
    const period = periodEl.value;
    const hoursVal = Number(hoursEl.value);
    const reason = reasonEl.value.trim();

    if (!/^\d{4}-\d{2}$/.test(period)) {
      showToast('Indicá un período válido.');
      periodEl.focus();
      return;
    }
    if (!Number.isFinite(hoursVal) || hoursVal < 0 || hoursVal > CONFIG.contract.maxCarryoverHours) {
      showToast(`Las horas trasladadas deben estar entre 0 y ${CONFIG.contract.maxCarryoverHours} h.`);
      hoursEl.focus();
      return;
    }
    if (!reason) {
      showToast('Indicá el motivo del ajuste para dejar registro.');
      reasonEl.focus();
      return;
    }

    const btn = document.getElementById('btnSaveBalanceAdjust');
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      await TicketStore.saveBalanceAdjustment(period, hoursVal, reason);
      renderBalanceAdjustHistory();
      renderDashboard();
      if (isReportAllowed()) renderReport();
      document.getElementById('balanceAdjustDialog').close('');
      showToast(`Ajuste registrado para ${formatMonthLabel(period)}: ${formatHours(hoursVal)}.`);
    } catch (error) {
      showToast(error.message);
    } finally {
      btn.disabled = false;
    }
  }

  /* ========================================================================
   * VISTA 4: REPORTE MENSUAL DE HORAS Y EXPORTACIÓN CSV / PDF
   * ======================================================================== */
  function syncMonthInputs() {
    const dashMonth = document.getElementById('dashboardMonthSelect');
    const repMonth = document.getElementById('reportMonthSelect');
    if (dashMonth && dashMonth.value !== activeMonth) dashMonth.value = activeMonth;
    if (repMonth && repMonth.value !== activeMonth) repMonth.value = activeMonth;
  }

  function renderReport() {
    if (!isReportAllowed()) return;
    syncMonthInputs();

    const ledger = computeMonthlyHoursLedger(activeMonth);
    const isInTerm = inTerm(activeMonth, TicketStore.openingMonth());

    document.body.classList.toggle('outside-term', !isInTerm);
    document.getElementById('reportPeriodHeading').textContent = formatMonthLabel(activeMonth);

    document.getElementById('reportSummaryGrid').innerHTML = `
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.carryoverAvailable)}</div>
        <div class="report-kpi-label">Trasladadas del mes anterior</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.monthlyQuota)}</div>
        <div class="report-kpi-label">Bolsa mensual incluida</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.totalPoolConsumed)}</div>
        <div class="report-kpi-label">Horas utilizadas de la bolsa</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val accent">${formatHours(ledger.totalRemaining)}</div>
        <div class="report-kpi-label">Saldo disponible</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.nextMonthCarryover)}</div>
        <div class="report-kpi-label">Traslado estimado al próximo mes</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.totalMajorHours)}</div>
        <div class="report-kpi-label">Desarrollos aparte</div>
      </div>
      <div class="report-kpi">
        <div class="report-kpi-val">${formatHours(ledger.excessHours)}</div>
        <div class="report-kpi-label">Excedente pendiente de aprobación</div>
      </div>
    `;

    const tbody = document.getElementById('reportTableBody');
    if (ledger.rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="report-table-empty">No hay tareas registradas para el período seleccionado.</td></tr>';
    } else {
      tbody.innerHTML = ledger.rows.map(row => {
        const t = row.ticket;
        const cat = getCategoryMeta(t.category);
        const stClass = statusTextClass(t.status);
        const appLabel = !isInTerm && t.billingMode === 'bolsa'
          ? 'Vigencia a confirmar'
          : row.imputationLabel;
        const balanceLabel = isInTerm
          ? `Saldo: ${formatHours(row.runningBalance)}`
          : 'Saldo: Pendiente';

        return `
          <tr>
            <th scope="row">
              <strong>#${escapeHtml(t.id)} · ${escapeHtml(t.title)}</strong><br>
              <small style="color: var(--text-muted); font-weight: 400;">${escapeHtml(t.workTitle)}</small>
            </th>
            <td>${escapeHtml(formatShortDate(t.workDate))}</td>
            <td>${escapeHtml(cat.fullName)}</td>
            <td><strong>${formatHours(row.hours)}</strong></td>
            <td>${escapeHtml(t.assignee || 'Sin asignar')}</td>
            <td><span class="report-status-text ${escapeHtml(stClass)}">${escapeHtml(t.status)}</span></td>
            <td>
              ${escapeHtml(appLabel)}<br>
              <small style="color: var(--text-dim);">${escapeHtml(balanceLabel)}</small>
            </td>
          </tr>
        `;
      }).join('');
    }

    if (!online || signedUser) {
      document.querySelectorAll('.no-contract-notice').forEach(el => {
        el.hidden = isSystems() || isInTerm;
        el.textContent = TicketStore.openingMonth()
          ? 'Este período está fuera de la vigencia configurada.'
          : 'Falta confirmar el inicio del contrato. El saldo está pendiente.';
      });
    }

    const footnote = document.getElementById('reportFootnote');
    if (!isInTerm) {
      footnote.textContent = TicketStore.openingMonth()
        ? 'Período fuera de la vigencia configurada. Verificá la vigencia contractual antes de imputar horas.'
        : 'Falta configurar el mes de inicio acordado. Los saldos y excedentes no están disponibles.';
      return;
    }

    let carrySentence = '';
    if (ledger.carryoverAvailable > 0 && ledger.carryExpiredAtMonthEnd > 0) {
      carrySentence = `De las ${formatHours(ledger.carryoverAvailable)} recibidas, quedan ${formatHours(ledger.carryExpiredAtMonthEnd)} que no vuelven a trasladarse.`;
    } else if (ledger.carryoverAvailable > 0) {
      carrySentence = `Se utilizaron por completo las ${formatHours(ledger.carryoverAvailable)} recibidas del mes anterior.`;
    } else {
      carrySentence = 'Este período no registra horas trasladadas del mes anterior.';
    }

    const excessSentence = ledger.excessHours > 0
      ? ` Se registran ${formatHours(ledger.excessHours)} de excedente pendientes de aprobación.`
      : '';

    footnote.textContent =
      `Las horas trasladadas se utilizan primero y vencen al finalizar el mes. ${carrySentence} Solo las horas sin utilizar de la bolsa mensual actual pasan al mes siguiente, hasta un máximo de ${CONFIG.contract.maxCarryoverHours} h. Los desarrollos aparte no se descuentan de la bolsa.${excessSentence}`;
  }

  function exportMonthlyCsv() {
    if (!isReportAllowed()) return;
    const ledger = computeMonthlyHoursLedger(activeMonth);
    if (!ledger.rows.length) {
      showToast('No hay tareas en este período para exportar.');
      return;
    }

    const isInTerm = inTerm(activeMonth, TicketStore.openingMonth());
    const headers = [
      'ID', 'Ticket', 'Tarea', 'Fecha', 'Área de atención', 'Prioridad',
      'Horas utilizadas', 'Responsable', 'Estado', 'Aplicación',
      'Saldo disponible tras tarea', 'Ref. presupuesto aparte'
    ];

    const lines = [headers.join(';')];
    ledger.rows.forEach(row => {
      const t = row.ticket;
      const cat = getCategoryMeta(t.category);
      const prio = getPriorityMeta(t.priority);
      const cols = [
        t.id,
        t.title,
        t.workTitle,
        formatShortDate(t.workDate),
        cat.fullName,
        prio.label,
        String(row.hours).replace('.', ','),
        t.assignee || 'Sin asignar',
        t.status,
        !isInTerm && t.billingMode === 'bolsa' ? 'Vigencia a confirmar' : row.imputationLabel,
        isInTerm ? String(row.runningBalance).replace('.', ',') : 'Pendiente',
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
      try {
        await request(CONFIG.auth.loginEndpoint, 'DELETE');
        sessionEvents?.postMessage('cambio');
        clearPrivateView();
        showToast('Sesión cerrada.');
      } catch (error) {
        showToast(error.message);
      }
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.view === 'report' && !isReportAllowed()) return;
        if (online && signedUser && btn.dataset.view !== 'newTicket') {
          try {
            await loadSharedTickets();
            syncAuthUI();
            updateNavCounter();
          } catch (error) {
            showToast(error.message);
            return;
          }
        }
        switchView(btn.dataset.view);
      });
    });

    document.getElementById('ticketForm').addEventListener('submit', handleTicketSubmit);
    document.getElementById('btnNewAnotherTicket').addEventListener('click', resetTicketForm);
    document.getElementById('btnGoToDashboard').addEventListener('click', () => {
      resetTicketForm();
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
        const session = await request(CONFIG.auth.loginEndpoint, 'POST', {
          email: emailEl.value.trim(),
          password: passEl.value
        });
        passEl.value = '';
        sessionEvents?.postMessage('cambio');
        await startSession(session);
      } catch (error) {
        errBox.textContent = error.message;
        errBox.style.display = 'block';
      }
    });

    // Filtros, período y buscador del Portal de Tickets
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
      if (isReportAllowed()) renderReport();
    };
    document.getElementById('dashboardMonthSelect').addEventListener('change', onMonthChange);
    document.getElementById('reportMonthSelect').addEventListener('change', onMonthChange);

    document.getElementById('btnExportCsv').addEventListener('click', exportMonthlyCsv);
    document.getElementById('btnPrintReport').addEventListener('click', () => {
      if (isReportAllowed()) window.print();
    });

    // Ajuste de saldo (solo Karín)
    document.getElementById('btnOpenBalanceAdjust').addEventListener('click', openBalanceAdjustDialog);
    document.getElementById('btnCloseBalanceAdjust').addEventListener('click', () => {
      document.getElementById('balanceAdjustDialog').close('');
    });
    document.getElementById('btnCancelBalanceAdjust').addEventListener('click', () => {
      document.getElementById('balanceAdjustDialog').close('');
    });
    document.getElementById('balanceAdjustForm').addEventListener('submit', handleBalanceAdjustSubmit);

    // Visor de imágenes adjuntas
    const lightboxDlg = document.getElementById('imageLightboxDialog');
    document.getElementById('btnCloseLightbox').addEventListener('click', () => {
      lightboxDlg.close('');
    });
    lightboxDlg.addEventListener('close', () => {
      document.getElementById('lightboxImg').removeAttribute('src');
    });

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

    // Confirmación nativa de borrado
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
    buildControls();
    bindDropzoneEvents();
    initAccessibleValidation();
    initDialogLightDismissFallback();
    initToggletips();
    bindEvents();
    syncMonthInputs();
    syncAuthUI();

    if (online) {
      try {
        await startSession(await request(CONFIG.auth.loginEndpoint));
      } catch (error) {
        if (error.status !== 401) {
          const box = document.getElementById('loginErrorBox');
          box.textContent = error.message;
          box.style.display = 'block';
        }
      }
    } else {
      try {
        updateNavCounter();
        renderDashboard();
        renderReport();
      } catch (error) {
        showToast(error.message);
      }
    }
  });
})();
