# Referencia técnica — Ticketera El Derecho (UCA)

La guía de instalación, variables de entorno (`ED_DB_*`, `ED_MES_INICIO`, `ED_ALLOW_CLIENT_REPORT`), permisos y reglas FIFO están en [README.md](README.md).

## Archivos y responsabilidades

- `index.html` y `css/styles.css`: formulario único *Generar ticket*, *Portal de tickets*, tarjetas limpias de solo lectura, *Reporte mensual de horas*, drawer de detalle/gestión, visor de imágenes adjuntas y modal exclusivo de ajuste de saldo.
- `js/config.js`: catálogo de las 5 áreas de atención (*Gestión y soporte*, *Diseño y navegación*, *Búsquedas*, *Pagos y accesos*, *Informes y actividad*), mapa de compatibilidad `legacyCategoryMap`, equipos responsables (`Equipo Técnico Karín`, `Sistemas UCA`, `Karín y Sistemas UCA`), límites de adjuntos y datos de ejemplo locales.
- `js/app.js`: sesión por cuenta, carga de capturas (archivo, arrastrar/soltar y `Ctrl + V`), toggletips accesibles (`interestfor` + `popover="hint"` + fallback local sin CDN), motor FIFO compartido entre portal/tarjetas/reporte, CSV neutralizado contra inyección de fórmulas y gestión de intervenciones fechadas.
- `api/db.php`: sesión estricta, conexión PDO y función `canAccessReport()`.
- `api/login.php`: inicio, verificación y cierre de sesión con protección contra fuerza bruta y CSRF.
- `api/tickets.php`: alta vinculada estrictamente al usuario autenticado (`solicitante_id`, `solicitante_nombre`, `solicitante_email`), lectura filtrada por rol, edición/eliminación exclusiva para `admin` con concurrencia optimista (`version`) e historial transaccional.
- `api/adjuntos.php`: carga autenticada de imágenes PNG/JPG/WebP/GIF (hasta 5 MB, máx. 5 por ticket, verificadas con `finfo` y `getimagesizefromstring`) y entrega segura con `Content-Security-Policy: default-src 'none'; sandbox` y `X-Content-Type-Options: nosniff`.
- `api/bolsa.php`: endpoint exclusivo para `admin` para registrar ajustes de saldo inicial o correcciones (`0..30 h`) con motivo obligatorio y registro de auditoría en `bolsa_mensual_ajustes` y `ticketera_historial`.
- `database.sql` y `.htaccess`: esquema completo e importable sobre bases previas, y cabeceras CSP (`script-src 'self'`, `img-src 'self' blob: data: https://assets.zyrosite.com`).

## Identidad gráfica

- **Tipografías:** `Bebas Neue` (títulos, navegación, KPIs, botones principales) y `Open Sans` (formularios, tarjetas de detalle, tablas y botones secundarios).
- **Paleta:** Amarillo Karín `#FCBB15` (tinta `#D99B00` en modo claro), grafito `#0B0B0E` / `#141419` en oscuro y hueso `#F6F6FA` / `#FFFFFF` en claro.
- **Modo por defecto:** Claro, con alternancia sincronizada a oscuro (`assets/karin-oscuro.png` y sello UCA invertido automáticamente).
- **Cero emojis:** Solo SVG lineales minimalistas en toda la interfaz.
- **Sello UCA sutil:** Presente en el header general, pie de login y footer institucional (sin duplicarlo dentro de la hoja del reporte).
