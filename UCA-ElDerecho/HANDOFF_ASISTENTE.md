# Referencia de mantenimiento de la ticketera de El Derecho

La guía de instalación, las variables de entorno, los permisos y las reglas de imputación están en [README.md](README.md).

## Archivos y responsabilidades

- `index.html` y `css/styles.css` contienen el formulario, el panel, el detalle de tickets y el reporte imprimible.
- `js/config.js` contiene el catálogo, la presentación de las reglas y los ejemplos de la vista local.
- `js/app.js` gestiona los formularios, la sesión en memoria, el libro mensual, las intervenciones fechadas, el evaluador de alcance y la exportación.
- `api/db.php` configura la sesión y la conexión. `api/login.php` abre, consulta y cierra la sesión. `api/tickets.php` autoriza cada operación, valida campos y alcance, controla versiones y registra el historial en la misma transacción que el cambio.
- `database.sql` conserva las tablas originales y añade control de intentos, serialización de escrituras, intervenciones e historial. `.htaccess` reúne reglas del servidor web.
- Al modificar una regla contractual, revisar sus validaciones en PHP y su presentación en JavaScript. Probar también los registros anteriores y las intervenciones que cruzan meses.

## Identidad gráfica

Esta base replica la identidad validada con el cliente en el portal de SECURION / **Karín Diseño**:

* **Tipografías:** `Bebas Neue` (títulos, botones, tabs, KPIs, etiquetas) + `Open Sans` (cuerpo, formularios, tablas).
* **Paleta principal:** Amarillo Karín `#FCBB15` (tinta `#D99B00` en modo claro para contraste sobre blanco), grafito `#0B0B0E` / `#141419` (oscuro), hueso `#F6F6FA` / `#FFFFFF` (claro).
* **Modo por defecto:** **Modo claro**, con botón discreto en el header para alternar a oscuro (`<meta name="color-scheme">` sincronizado con CSS y `localStorage`).
* **Geometría editorial:** Esquinas rectas (`border-radius: 0`) en tarjetas, botones, badges, aviso amarillo y modales.
* **Navegación y filtros sin pastillas:** Texto en `Bebas Neue` con línea inferior amarilla (`border-bottom: 2px solid var(--karin-yellow)`) al estar activo.
* **Botón de eliminar para administración:** Cruz discreta, cuadrada (`26px × 26px`) y amarilla arriba a la derecha de cada tarjeta, con confirmación en `<dialog>`.
* **Cero emojis:** No usar emojis en ningún texto, botón, validación ni estado. Solo SVG lineales minimalistas.
* **Copy limpio en formularios:** No usar textos de ejemplo (`placeholder="Ej. ..."`) en los campos de entrada ni mostrar referencias internas al documento comercial (*Apartado 1/2/4/5/7*) en la interfaz visible.
* **Logo de la UCA sutil:** Ubicado con baja prominencia en monocromo (`assets/logo-uca.png`, con inversión automática en modo oscuro) en el header junto a *Ticketera El Derecho*, en el pie del login, en el encabezado del reporte imprimible y en el footer.

---


## Decisiones operativas pendientes

Confirmar el inicio, el horario hábil y los referentes de cada perfil. La entrega de facturas por Everest es un circuito operativo del cliente. Una integración nueva o el envío automático de notificaciones desde la ticketera requiere su propio alcance y un canal autorizado por la UCA.

