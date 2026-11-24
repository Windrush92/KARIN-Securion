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
 */
window.UCA_TICKETERA_CONFIG = {
  brand: {
    providerName: 'KARÍN',
    portalTitle: 'TICKETERA EL DERECHO',
    clientName: 'El Derecho · UCA',
    clientFullName: 'Pontificia Universidad Católica Argentina — El Derecho',
    karinLogoLightUrl: 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=375,fit=crop,q=95/mv0lGExe8ySg27l9/mesa-de-trabajo-1-AoP487wzX7uWODk9.png',
    karinLogoDarkUrl: 'assets/karin-oscuro.png',
    karinFaviconUrl: 'https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=32,h=32,fit=crop,f=png/mv0lGExe8ySg27l9/favicon-karin-AR0VG83LXwT9lnw8.png',
    ucaLogoPath: 'assets/logo-uca.png'
  },

  demoStartMonth: '2026-11',
  auth: {
    loginEndpoint: 'api/login.php',
    ticketsEndpoint: 'api/tickets.php',
    attachmentsEndpoint: 'api/adjuntos.php',
    balanceEndpoint: 'api/bolsa.php'
  },

  attachments: {
    maxFiles: 5,
    maxBytesPerFile: 5 * 1024 * 1024,
    allowedMimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  },

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
      balanceAdjustments: 'uca_elderecho_balance_adjustments_v1',
      theme: 'color-scheme'
    }
  },

  /**
   * 5 áreas de atención visibles en el formulario y en el reporte mensual
   */
  serviceCategories: [
    {
      id: 'gestion_soporte',
      label: 'Gestión y soporte',
      fullName: 'Gestión y soporte',
      description: 'Atención y seguimiento de consultas, solicitudes e inconvenientes con la plataforma.',
      icon: 'headset'
    },
    {
      id: 'diseno_navegacion',
      label: 'Diseño y navegación',
      fullName: 'Diseño y navegación',
      description: 'Inconvenientes con la visualización, los botones y la navegación entre secciones.',
      icon: 'window'
    },
    {
      id: 'busquedas',
      label: 'Búsquedas',
      fullName: 'Búsquedas',
      description: 'Inconvenientes con las búsquedas, los filtros y los resultados al consultar documentos.',
      icon: 'search'
    },
    {
      id: 'pagos_accesos',
      label: 'Pagos y accesos',
      fullName: 'Pagos y accesos',
      description: 'Consultas e inconvenientes con pagos, suscripciones y acceso a la plataforma.',
      icon: 'link'
    },
    {
      id: 'informes_actividad',
      label: 'Informes y actividad',
      fullName: 'Informes y actividad',
      description: 'Solicitudes de informes sobre el uso de la plataforma, los ingresos de usuarios y la actividad registrada.',
      icon: 'bars'
    }
  ],

  /**
   * Compatibilidad con registros históricos cargados con identificadores anteriores
   */
  legacyCategoryMap: {
    ux_ui_menor: 'diseno_navegacion',
    buscador_documental: 'busquedas',
    integraciones_operativas: 'pagos_accesos',
    monitoreo_rendimiento: 'informes_actividad',
    tecnico_seguridad: 'gestion_soporte',
    infra_aws_uca: 'gestion_soporte'
  },

  /**
   * Equipos responsables disponibles (incluye responsabilidad compartida)
   */
  assigneePresets: [
    'Sin asignar',
    'Equipo Técnico Karín',
    'Sistemas UCA',
    'Karín y Sistemas UCA'
  ],

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
      example: 'Ajustes de diseño o navegación',
      badgeClass: 'prio-baja'
    }
  ],

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

  seedCarryoverByMonth: {
    '2026-11': 15
  },

  seedTickets: [
    {
      id: 'ED-001',
      title: 'Documentos de jurisprudencia recientes no aparecen en filtro por tribunal',
      requestKind: 'mantenimiento',
      category: 'busquedas',
      priority: 'alta',
      status: 'En ejecución',
      requesterName: 'Equipo Editorial El Derecho',
      requesterEmail: 'redaccion@elderecho.uca.edu.ar',
      description: 'Al filtrar los fallos cargados en las últimas 48 horas por cámara comercial, algunos documentos no aparecen en los resultados del buscador.',
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
      technicalNotes: 'Se detectó desfasaje en la indexación incremental. Reindexación controlada en pruebas.',
      attachments: [],
      workLogs: []
    },
    {
      id: 'ED-002',
      title: 'Ajuste de jerarquía visual y textos en mensajes de renovación de suscripción',
      requestKind: 'mejora',
      category: 'diseno_navegacion',
      priority: 'baja',
      status: 'Resuelto',
      requesterName: 'Coordinación Comercial',
      requesterEmail: 'suscripciones@elderecho.uca.edu.ar',
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
      assignee: 'Equipo Técnico Karín',
      createdAt: '2026-11-06T14:10',
      firstResponseAt: '2026-11-07T10:00',
      billingMonth: '2026-11',
      technicalNotes: 'Cambios aplicados sobre el componente existente y validados en desktop y móvil.',
      attachments: [],
      workLogs: []
    },
    {
      id: 'ED-003',
      title: 'Pico de consumo de CPU en horarios de mayor consulta y revisión de snapshot',
      requestKind: 'mantenimiento',
      category: 'gestion_soporte',
      priority: 'normal',
      status: 'Derivado a Sistemas UCA',
      requesterName: 'Mesa Operativa El Derecho',
      requesterEmail: 'operaciones@elderecho.uca.edu.ar',
      description: 'Se observaron demoras intermitentes entre las 11:00 y 12:30. Se requiere revisar recursos del entorno y confirmar ventana de snapshots con Sistemas UCA.',
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
      assignee: 'Karín y Sistemas UCA',
      createdAt: '2026-11-10T11:45',
      firstResponseAt: '2026-11-10T15:20',
      billingMonth: '2026-11',
      technicalNotes: 'Diagnóstico desde logs enviado a Sistemas UCA. En seguimiento conjunto.',
      attachments: [],
      workLogs: []
    },
    {
      id: 'ED-004',
      title: 'Nuevo módulo de alertas temáticas personalizadas por correo con integración CRM',
      requestKind: 'mejora',
      category: 'pagos_accesos',
      priority: 'baja',
      status: 'Presupuesto aparte',
      requesterName: 'Dirección El Derecho',
      requesterEmail: 'direccion@elderecho.uca.edu.ar',
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
      separateQuoteRef: 'PROP-ED-2026-01 En análisis',
      assignee: 'Equipo Técnico Karín',
      createdAt: '2026-11-12T16:00',
      firstResponseAt: '2026-11-13T10:30',
      billingMonth: '2026-11',
      technicalNotes: 'Clasificado como Ajuste Mayor / Nuevo desarrollo. Las 1,5 h corresponden al análisis preliminar; desarrollo cotizado por separado.',
      attachments: [],
      workLogs: []
    }
  ]
};
