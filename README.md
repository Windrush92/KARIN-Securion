# Portal de Gestión y Pedidos de Diseño | Securion & Karín

Plataforma web ágil y centralizada para la solicitud, seguimiento y gestión operativa de piezas de diseño entre **Securion** y el estudio **Karín Diseño** ([karin-d.com](https://karin-d.com/)).

Este desarrollo sustituye el formulario denso y las planillas tradicionales de Airtable por una interfaz visual, intuitiva y dividida en pasos secuenciales con diseño de marca fiel.

---

## Características Principales

### 1. Formulario Wizard Paso a Paso (Modo Solicitante)
* **Paso 1: La Pieza:** Título descriptivo, selector visual de tipo de pieza (Flyer, Carrusel, Mailing, Video, Presentación, Adaptación, Otro), cantidad de versiones y canal de uso (Humand, Correo, WhatsApp, Redes, etc.).
* **Paso 2: Contenido & Materiales:** Texto/copys, control estricto de materiales completos o faltantes (con campo condicional para qué falta y cuándo se envía) y enlace a Google Drive/Canva.
* **Paso 3: Fechas & Urgencia:** Selector de fecha/hora de primera entrega y entrega final, más control de entregas urgentes en 24h (especificando si aplica a la propuesta inicial o a la versión final).
* **Paso 4: Revisión:** Responsable de aprobación en Securion, especificaciones técnicas opcionales, referencias visuales y resumen previo al envío.

### 2. Panel de Gestión (Modo Karín / Seguimiento)
* **Cero desplazamiento horizontal (*no side-scroll*):** Visualización en tarjetas con acceso a un **cajón lateral (*drawer*) vertical** para editar cada pedido al detalle.
* **Control interno de Karín:** Asignación de diseñador responsable, estado operativo, imputación del cupo del fee mensual, adicionales fuera de cupo y registro de fechas de reprogramación conservando la fecha original.
* **Métricas clave en tiempo real:** Total de pedidos, pedidos en diseño/ajustes, pedidos pendientes de material y urgencias 24h.
* **Búsqueda y filtros rápidos:** Por estado (*Urgentes 24h*, *Falta Material*, *En Diseño*, *En Revisión*, *Finalizados*) y buscador por texto.

### 3. Identidad Visual & Experiencia
* **Estilo fiel a Karín Diseño:** Tipografía de títulos en `Bebas Neue` y cuerpo en `Open Sans`.
* **Colores de marca:** Amarillo vibrante `#FCBB15` y estética editorial de esquinas rectas (`border-radius: 0`).
* **Modo Oscuro / Modo Claro:** Selector discreto de tema en la barra superior con persistencia local (`localStorage`).
* **Sin dependencias pesadas:** Aplicación autónoma construida en HTML5, CSS3 y JavaScript moderno nativo.

---

## Cómo Visualizar y Usar

1. Clona o descarga el repositorio:
   ```bash
   git clone <URL_DEL_REPOSITORIO>
   ```
2. Abre directamente `index.html` en cualquier navegador web moderno (Chrome, Edge, Safari, Firefox).
3. No requiere instalación de Node.js, servidores ni dependencias para ejecutarse localmente.

---

## Estructura del Proyecto

```
SECURION/
├── index.html                           # Aplicación web completa
├── Plantilla_Airtable_Securion_Karin.csv # Copia de respaldo de campos
├── .gitignore
└── README.md
```
