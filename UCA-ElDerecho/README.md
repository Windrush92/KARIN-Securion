# Ticketera de mantenimiento de El Derecho UCA

El Derecho registra pedidos y controla el consumo del abono. Karín evalúa el alcance, registra intervenciones y documenta la primera respuesta. Sistemas UCA consulta los casos que Karín le deriva expresamente.

## Vista previa local

Abrir `index.html` con doble clic. La leyenda **Vista previa local** identifica los datos de ejemplo. Las modificaciones se guardan en ese navegador. La actualización reconoce las claves de almacenamiento anteriores. Los registros reales cargados alguna vez en la vista previa requieren una conciliación antes de incorporarlos a la base compartida.

## Versión compartida

Requiere PHP 8.1 o posterior con PDO MySQL, sesiones y un servidor MySQL o MariaDB con InnoDB. Las pruebas se hicieron con PHP 8.4 y MariaDB 10.11. Servir el portal mediante HTTPS. La excepción HTTP está limitada a pruebas desde la propia máquina por loopback.

1. En una base nueva, importar `database.sql`. Para actualizar una instalación previa, respaldar la base y aplicar el mismo archivo sobre el esquema original. Crea tablas auxiliares y conserva los registros. Los tickets con horas acumuladas siguen informándose como registros anteriores.
2. Configurar en el entorno privado del proceso PHP `ED_DB_NAME`, `ED_DB_USER`, `ED_DB_PASSWORD` y, si corresponden, `ED_DB_HOST` y `ED_DB_PORT`. Usar una cuenta de aplicación con los permisos necesarios sobre las tablas de la ticketera. Reservar cambios de esquema para la cuenta de instalación.
3. Configurar `ED_MES_INICIO` con el mes efectivamente acordado, en formato `AAAA-MM`. La vigencia modelada comprende doce períodos mensuales desde ese mes. Si la UCA acuerda un inicio a mitad de mes, definir el tratamiento del primer y último período antes de usar los saldos. Sin mes inicial, el portal permite atender pedidos y muestra la bolsa como pendiente.
4. Aprovisionar en `usuarios` las cuentas aprobadas y almacenar los hashes generados con `password_hash()`. La asignación de roles debe realizarla la administración. El portal compartido abre la sesión mediante el servidor. Los datos de ejemplo corresponden a la vista local.
5. Publicar los recursos de interfaz y `api/`. Mantener los respaldos, el SQL y la documentación fuera del directorio público. Se incluye `.htaccess` con cabeceras y restricciones para Apache/LiteSpeed. Verificar su aplicación y la detección de HTTPS en el alojamiento o proxy elegido.

## Permisos implementados

| Perfil | Acciones |
| --- | --- |
| Karín · `admin` | Crea y gestiona tickets, registra derivaciones y horas, consulta el reporte y puede eliminar con confirmación. El servidor guarda actor, fecha y valores anteriores y posteriores. |
| El Derecho · `el_derecho` | Crea solicitudes con su identidad, consulta los tickets compartidos de esta institución y controla el reporte mensual. |
| Sistemas UCA · `sistemas_uca` | Consulta únicamente tickets en el estado «Derivado a Sistemas UCA». Recibe el contexto operativo. Los campos de correo del solicitante, imputación, partes de horas y notas internas se excluyen de la respuesta. |

## Operación y reportes

- Los consumos nuevos se cargan en **Registrar una intervención**, con fecha, tarea, horas, responsable e imputación. Una intervención puede ser diagnóstico de Karín con cargo a bolsa, otra puede corresponder a Sistemas UCA sin cargo. Los movimientos fechados se conservan al editar el estado del ticket.
- El reporte consume primero el traslado y después el cupo mensual. El saldo del cupo vigente pasa al mes siguiente hasta 30 h. El saldo trasladado vence ese mes. El último período de la vigencia tiene traslado proyectado cero. Las horas excedentes se identifican para revisión y conformidad. El reporte no genera cobros.
- Para reconstruir saldos previos, las aperturas explícitas ya registradas en `bolsa_mensual_horas` tienen prioridad en su período. Mantenerlas solo cuando se haya conciliado ese saldo. En el servidor la apertura se administra en la base. En la demostración se puede editar la apertura del mes inicial.
- Los ajustes menores exigen los cuatro criterios del presupuesto y hasta 6 h estimadas, incluidas pruebas. Los tickets que comparten el nombre de una mejora se consideran en conjunto. Registrá la conformidad externa de UCA antes de iniciar un desarrollo mayor. El campo de referencia documenta ese acuerdo.
- La prioridad informa el compromiso de primera respuesta y diagnóstico. La fecha efectiva se registra en el ticket. El cómputo automático de vencimientos requiere que las partes acuerden el calendario hábil.

