# Ticketera de mantenimiento de El Derecho UCA

Portal de soporte, seguimiento y control mensual de horas para El Derecho — Pontificia Universidad Católica Argentina, operado por Karín.

## Pantallas principales

1. **Generar ticket:** formulario en una sola pantalla con asunto, área de atención (5 áreas amigables con ícono y descripción), descripción de la solicitud y adjunto opcional de capturas de pantalla (botón **Adjuntar imagen**, arrastrar y soltar, o `Ctrl + V`). La identidad del solicitante (`Solicitado por`) siempre se toma en el servidor desde la cuenta autenticada.
2. **Portal de tickets:** vista compartida de todos los tickets autorizados de la institución, selector de mes contable en modo consulta, barra FIFO de la bolsa mensual de 30 horas con ícono de información (`ⓘ`), 4 indicadores y filtros editoriales (*Todos*, *Críticos / Altos*, *En curso*, *Resueltos*, *Sistemas UCA (AWS)*) más buscador.
3. **Tarjetas y detalle de ticket:** muestra número `#ED-...`, título, descripción, estado y prioridad en texto de color sin chips, *Solicitado por*, *Responsable* en dorado (*Equipo Técnico Karín*, *Sistemas UCA* o *Karín y Sistemas UCA*), *Horas utilizadas* con aclaración de aplicación a bolsa o presupuesto aparte, y botón **VER DETALLE** (modo consulta con capturas adjuntas para administrativos; gestión, intervenciones y eliminación solo para Karín).
4. **Reporte mensual de horas:** selector de período y botones **CSV** y **PDF** integrados en el encabezado del reporte, 7 indicadores de solo lectura, tabla con área de atención amigable, horas con coma decimal y aplicación/saldo FIFO. Incluye un modal separado **Ajuste de saldo** exclusivo para administración (`admin`), con registro de actor y motivo.

## Vista local (archivo `index.html`)

Al abrir `index.html` directamente desde el sistema de archivos (`file://`), la interfaz funciona en modo local usando los datos de ejemplo configurados en `js/config.js` y `localStorage`. En el servidor compartido (HTTPS), el portal siempre exige inicio de sesión por cuenta habilitada.

## Versión compartida (Servidor PHP + MySQL/MariaDB)

Requiere PHP 8.1 o posterior con PDO MySQL, extensión `fileinfo`, sesiones y MySQL o MariaDB con InnoDB. Servir mediante HTTPS (la excepción HTTP aplica solo a loopback local).

1. **Base de datos:** importar `database.sql`. En instalaciones existentes, respaldar primero y ejecutar `database.sql` (añade `solicitante_id`, `ticketera_adjuntos` y `bolsa_mensual_ajustes` conservando datos previos).
2. **Variables de entorno PHP:** configurar `ED_DB_NAME`, `ED_DB_USER`, `ED_DB_PASSWORD` (y opcionalmente `ED_DB_HOST`, `ED_DB_PORT`).
3. **Vigencia contractual:** configurar `ED_MES_INICIO` en formato `AAAA-MM` (12 períodos mensuales desde ese mes).
4. **Acceso al reporte para administrativos:** por defecto el reporte mensual queda restringido a `admin` (`ED_ALLOW_CLIENT_REPORT=0`). Para habilitar la vista de consulta y exportación a los usuarios `el_derecho`, definir `ED_ALLOW_CLIENT_REPORT=1` en el entorno del servidor.
5. **Cuentas:** aprovisionar cada usuario en la tabla `usuarios` con contraseña generada mediante `password_hash()` y rol `admin`, `el_derecho` o `sistemas_uca`.
6. **Publicación:** subir la interfaz (`index.html`, `css/`, `js/`, `assets/`), `api/` y `.htaccess`. Mantener `database.sql` y la documentación fuera del directorio público web.

## Permisos implementados (servidor + interfaz)

| Perfil | Acciones permitidas |
| --- | --- |
| Karín · `admin` | Crea y gestiona tickets, define prioridad, área, responsable (incluye responsabilidad compartida), intervenciones fechadas, capturas, ajustes de saldo con motivo, reporte mensual y eliminación con confirmación. |
| El Derecho · `el_derecho` | Crea solicitudes con su propia identidad (no modificable), adjunta capturas al crear el ticket y consulta todos los tickets compartidos y sus imágenes en modo solo lectura. No puede editar, eliminar ni cambiar estado, prioridad, responsable ni horas. El acceso al reporte mensual se controla en el servidor con `ED_ALLOW_CLIENT_REPORT`. |
| Sistemas UCA · `sistemas_uca` | Consulta únicamente tickets en estado «Derivado a Sistemas UCA» junto con sus capturas adjuntas. Se excluyen correo del solicitante, horas, imputación, presupuesto aparte y notas internas. |

## Reglas de cálculo FIFO de horas

- La bolsa mensual incluye **30 h**. Se suman las horas sin utilizar de la bolsa del mes anterior hasta un máximo de **30 h trasladadas** (inicio entre 30 h y 60 h).
- Se utilizan primero las horas trasladadas (vencen al cierre del mes y no vuelven a trasladarse) y luego las 30 h del mes actual.
- Solo las horas sin utilizar de la bolsa mensual actual pasan al mes siguiente (máx. 30 h).
- Los trabajos con **Presupuesto aparte** y las intervenciones de **Sistemas UCA** sin cargo no descuentan horas de la bolsa mensual.
- La asignación de prioridad (SLA de primera respuesta) o de responsable nunca descuenta horas por sí sola.
- Para cargar un saldo inicial o corregir un cierre, administración utiliza `api/bolsa.php` (modal **Ajuste de saldo**), dejando auditoría de actor, fecha, valor anterior, nuevo valor y motivo.
