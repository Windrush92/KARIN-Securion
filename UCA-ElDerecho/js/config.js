// Aplicar la preferencia de tema antes del primer render.
(function () {
    try {
      var savedScheme = localStorage.getItem('color-scheme');
      var effective = savedScheme || 'light';
      document.querySelector('meta[name="color-scheme"]').content = effective;
      if (effective === 'dark' || effective === 'light') {
        document.documentElement.setAttribute('data-theme', effective);
      }
    } catch (e) {}
})();

/**
 * Configuración centralizada — Ticketera de Mantenimiento El Derecho (UCA)
 * Fuente: Propuesta Preliminar · Noviembre 2026 (Mantenimiento mensual de El Derecho)
 *
 * Modificar este archivo para ajustar parámetros contractuales, categorías, SLAs,
 * estados o activar la autenticación contra el backend de Hostinger.
 */
window.UCA_TICKETERA_CONFIG = {
  brand: {
    providerName: 'KARÍN',
    portalTitle: 'TICKETERA EL DERECHO',
    clientName: 'El Derecho · UCA',
    clientFullName: 'Pontificia Universidad Católica Argentina — El Derecho',
    proposalLabel: 'Mantenimiento Mensual · Propuesta Noviembre 2026',
    karinLogoUrl: 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop,q=95/mv0lGExe8ySg27l9/mesa-de-trabajo-1-AoP487wzX7uWODk9.png',
    karinFaviconUrl: 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=32,h=32,fit=crop,f=png/mv0lGExe8ySg27l9/favicon-karin-AR0VG83LXwT9lnw8.png',
    ucaLogoPath: 'assets/logo-uca.png'
  },

  // HTTP(S) requiere sesión en PHP. El archivo local permite probar con datos de ejemplo.
  demoStartMonth: '2026-11',
  auth: {
    loginEndpoint: 'api/login.php',
    ticketsEndpoint: 'api/tickets.php'
  },

  /**
   * Parámetros del abono mensual (Apartados 4, 5 y 6 del presupuesto)
   */
  contract: {
    monthlyHoursIncluded: 30,
    maxCarryoverHours: 30,
    carryoverConsumedFirst: true,
    minorAdjustmentMaxHours: 6,
    monthlyFeeArs: 1600000,
    hourlyReferenceArs: 53333.33,
    contractDurationMonths: 12,
    storageKeys: {
      tickets: 'uca_elderecho_tickets_v1',
      carryoverByMonth: 'uca_elderecho_carryover_v1',
      theme: 'color-scheme'
    }
  },

  /**
   * Apartado 1 y Apartado 2 — Servicios incluidos y coordinación con Sistemas UCA
   */
  serviceCategories: [
    {
      id: 'gestion_soporte',
      label: 'Gestión y soporte',
      fullName: 'Gestión, reuniones y soporte',
      description: 'Seguimiento, recepción y priorización de pedidos, consultas e incidencias derivadas por El Derecho.',
      icon: 'headset',
      defaultTrack: 'mantenimiento'
    },
    {
      id: 'ux_ui_menor',
      label: 'Ajustes UX/UI',
      fullName: 'Iteraciones y ajustes menores (UX/UI)',
      description: 'Cambios acotados en componentes existentes: botones, colores, textos, mensajes, espaciados y navegación.',
      icon: 'layout',
      defaultTrack: 'mejora'
    },
    {
      id: 'tecnico_seguridad',
      label: 'Técnico / WP',
      fullName: 'Mantenimiento técnico y seguridad',
      description: 'Actualización controlada de WordPress, plugins y componentes; seguridad de aplicación y corrección de errores.',
      icon: 'shield',
      defaultTrack: 'mantenimiento'
    },
    {
      id: 'buscador_documental',
      label: 'Buscador / Elastic',
      fullName: 'Buscador y base documental',
      description: 'Supervisión de Elasticsearch, búsquedas, filtros, indexación y relaciones técnicas documentales.',
      icon: 'search',
      defaultTrack: 'mantenimiento'
    },
    {
      id: 'integraciones_operativas',
      label: 'Pagos / Accesos',
      fullName: 'Servicios e integraciones operativas',
      description: 'Control funcional de accesos, suscripciones, pagos y notificaciones automáticas ya implementadas.',
      icon: 'link',
      defaultTrack: 'mantenimiento'
    },
    {
      id: 'monitoreo_rendimiento',
      label: 'Monitoreo',
      fullName: 'Monitoreo técnico y seguimiento',
      description: 'Revisión de rendimiento, CPU, RAM, espacio, PHP, base de datos y registros de errores.',
      icon: 'activity',
      defaultTrack: 'mantenimiento'
    },
    {
      id: 'infra_aws_uca',
      label: 'AWS / Sistemas UCA',
      fullName: 'Infraestructura AWS / Backups (Sistemas UCA)',
      description: 'Diagnóstico desde accesos disponibles y derivación o seguimiento con Sistemas UCA.',
      icon: 'server',
      defaultTrack: 'sistemas_uca'
    }
  ],

  /**
   * Apartado 4 — Prioridades y tiempos de primera respuesta
   */
  priorities: [
    {
      id: 'critica',
      label: 'Crítica',
      sla: '2 h hábiles',
      example: 'Plataforma caída / usuarios no pueden ingresar',
      badgeClass: 'prio-critica'
    },
    {
      id: 'alta',
      label: 'Alta',
      sla: '4 h hábiles',
      example: 'Pagos, suscripciones o buscador con falla importante',
      badgeClass: 'prio-alta'
    },
    {
      id: 'normal',
      label: 'Normal',
      sla: '1 día hábil',
      example: 'Error sin bloqueo operativo',
      badgeClass: 'prio-normal'
    },
    {
      id: 'baja',
      label: 'Baja',
      sla: '2 días hábiles',
      example: 'Ajustes UX/UI',
      badgeClass: 'prio-baja'
    }
  ],

  /**
   * Apartado 5 — Criterios acumulativos para Ajuste Menor (incluido) vs. Ajuste Mayor (presupuesto aparte)
   */
  scopeCriteria: [
    {
      id: 'existingComponentOnly',
      title: 'Alcance en componente existente',
      minorText: 'Modifica una pantalla, componente o función existente, sin crear otra ni rediseñar áreas completas.'
    },
    {
      id: 'withinSixHours',
      title: 'Tiempo estimado hasta 6 horas',
      minorText: 'Hasta 6 horas estimadas por solicitud (o conjunto vinculado), incluidas revisión y pruebas.'
    },
    {
      id: 'noDataOrIntegrationChanges',
      title: 'Sin cambios en datos o integraciones',
      minorText: 'No cambia estructuras de datos, relaciones documentales, integraciones externas ni reglas críticas (pagos/accesos).'
    },
    {
      id: 'localizedLowRisk',
      title: 'Impacto localizado y bajo riesgo',
      minorText: 'Alcance localizado, bajo riesgo operativo y comprobaciones habituales.'
    }
  ],

  /**
   * Estados operativos del ticket
   */
  statuses: [
    { id: 'Nuevo', badgeClass: 'status-nuevo' },
    { id: 'En diagnóstico', badgeClass: 'status-diagnostico' },
    { id: 'Validación de alcance', badgeClass: 'status-alcance' },
    { id: 'Derivado a Sistemas UCA', badgeClass: 'status-uca' },
    { id: 'En ejecución', badgeClass: 'status-ejecucion' },
    { id: 'En pruebas / QA', badgeClass: 'status-qa' },
    { id: 'Esperando El Derecho', badgeClass: 'status-espera' },
    { id: 'Presupuesto aparte', badgeClass: 'status-mayor' },
    { id: 'Resuelto', badgeClass: 'status-resuelto' }
  ],

  /**
   * Datos semilla iniciales (solo para vista previa local cuando no hay registros en localStorage).
   * El otro asistente puede vaciarlos o reemplazarlos por datos reales al integrar con MySQL.
   */
  seedCarryoverByMonth: {
    '2026-11': 6
  },

  seedTickets: [
    {
      id: 'ED-001',
      title: 'Documentos de jurisprudencia recientes no aparecen en filtro por tribunal',
      requestKind: 'mantenimiento',
      category: 'buscador_documental',
      priority: 'alta',
      status: 'En ejecución',
      requesterName: 'Equipo Editorial El Derecho',
      requesterEmail: 'redaccion@elderecho.uca.edu.ar',
      requesterArea: 'Contenidos / Base Documental',
      affectedUrl: 'https://elderecho.com.ar/buscador',
      evidenceUrl: '',
      description: 'Al filtrar fallos cargados en las últimas 48 h por cámara comercial, Elasticsearch devuelve resultados incompletos o duplicados en la segunda página.',
      linkedGroup: '',
      involvesAwsOrBackups: false,
      scopeCriteria: {
        existingComponentOnly: true,
        withinSixHours: true,
        noDataOrIntegrationChanges: true,
        localizedLowRisk: true
      },
      estimatedHours: 3.5,
      hoursLogged: 2.5,
      billingMode: 'bolsa',
      separateQuoteRef: '',
      assignee: 'Equipo Técnico Karín',
      createdAt: '2026-11-04T09:30',
      firstResponseAt: '2026-11-04T11:15',
      billingMonth: '2026-11',
      technicalNotes: 'Se detectó desfasaje en el índice incremental de Elasticsearch. Reindexación controlada en pruebas.'
    },
    {
      id: 'ED-002',
      title: 'Ajuste de jerarquía visual y textos en mensajes de renovación de suscripción',
      requestKind: 'mejora',
      category: 'ux_ui_menor',
      priority: 'baja',
      status: 'Resuelto',
      requesterName: 'Coordinación Comercial',
      requesterEmail: 'suscripciones@elderecho.uca.edu.ar',
      requesterArea: 'Suscripciones',
      affectedUrl: 'https://elderecho.com.ar/mi-cuenta/suscripcion',
      evidenceUrl: '',
      description: 'Actualizar el texto informativo de vencimiento y ajustar el espaciado y contraste del botón de confirmación en la pantalla actual de cuenta.',
      linkedGroup: '',
      involvesAwsOrBackups: false,
      scopeCriteria: {
        existingComponentOnly: true,
        withinSixHours: true,
        noDataOrIntegrationChanges: true,
        localizedLowRisk: true
      },
      estimatedHours: 2.0,
      hoursLogged: 2.0,
      billingMode: 'bolsa',
      separateQuoteRef: '',
      assignee: 'Diseño UX/UI Karín',
      createdAt: '2026-11-06T14:10',
      firstResponseAt: '2026-11-07T10:00',
      billingMonth: '2026-11',
      technicalNotes: 'Cambios aplicados sobre el componente existente y validados en desktop y móvil.'
    },
    {
      id: 'ED-003',
      title: 'Pico de consumo de CPU en horarios de mayor consulta y revisión de snapshot',
      requestKind: 'mantenimiento',
      category: 'infra_aws_uca',
      priority: 'normal',
      status: 'Derivado a Sistemas UCA',
      requesterName: 'Mesa Operativa El Derecho',
      requesterEmail: 'operaciones@elderecho.uca.edu.ar',
      requesterArea: 'Operaciones',
      affectedUrl: 'https://elderecho.com.ar',
      evidenceUrl: '',
      description: 'Se observaron demoras intermitentes entre las 11:00 y 12:30. Se requiere ampliar recursos de instancia AWS y confirmar ventana de snapshots con Sistemas UCA.',
      linkedGroup: '',
      involvesAwsOrBackups: true,
      scopeCriteria: {
        existingComponentOnly: true,
        withinSixHours: true,
        noDataOrIntegrationChanges: true,
        localizedLowRisk: true
      },
      estimatedHours: 2.0,
      hoursLogged: 1.5,
      billingMode: 'bolsa',
      separateQuoteRef: '',
      assignee: 'Infra / Seguimiento Karín',
      createdAt: '2026-11-10T11:45',
      firstResponseAt: '2026-11-10T15:20',
      billingMonth: '2026-11',
      technicalNotes: 'Diagnóstico desde logs PHP y consultas lentas enviado a Sistemas UCA. A la espera de intervención en instancia AWS.'
    },
    {
      id: 'ED-004',
      title: 'Nuevo módulo de alertas temáticas personalizadas por correo con integración CRM',
      requestKind: 'mejora',
      category: 'integraciones_operativas',
      priority: 'baja',
      status: 'Presupuesto aparte',
      requesterName: 'Dirección El Derecho',
      requesterEmail: 'direccion@elderecho.uca.edu.ar',
      requesterArea: 'Dirección',
      affectedUrl: 'https://elderecho.com.ar/alertas',
      evidenceUrl: '',
      description: 'Crear una nueva sección donde cada suscriptor configure materias jurídicas, frecuencia de envío y sincronización automática con herramienta externa de email marketing.',
      linkedGroup: 'Fase Alertas 2026',
      involvesAwsOrBackups: false,
      scopeCriteria: {
        existingComponentOnly: false,
        withinSixHours: false,
        noDataOrIntegrationChanges: false,
        localizedLowRisk: false
      },
      estimatedHours: 24.0,
      hoursLogged: 1.5,
      billingMode: 'presupuesto_aparte',
      separateQuoteRef: 'PROP-ED-2026-01 (En análisis)',
      assignee: 'Líder Técnico Karín',
      createdAt: '2026-11-12T16:00',
      firstResponseAt: '2026-11-13T10:30',
      billingMonth: '2026-11',
      technicalNotes: 'Clasificado como Ajuste Mayor / Nuevo desarrollo. Las 1.5 h corresponden al análisis preliminar; desarrollo cotizado por separado.'
    }
  ]
};