<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

const COLUMNS = [
    'id'=>'id', 'title'=>'asunto', 'requestKind'=>'naturaleza', 'category'=>'categoria_servicio',
    'priority'=>'prioridad', 'status'=>'estado', 'requesterName'=>'solicitante_nombre',
    'requesterEmail'=>'solicitante_email', 'requesterArea'=>'solicitante_area', 'affectedUrl'=>'url_afectada',
    'evidenceUrl'=>'evidencia_url', 'description'=>'descripcion', 'linkedGroup'=>'mejora_vinculada',
    'involvesAwsOrBackups'=>'involucra_aws_backups', 'scopeCriteria'=>'criterios_alcance_json',
    'estimatedHours'=>'horas_estimadas', 'hoursLogged'=>'horas_consumidas', 'billingMode'=>'imputacion_contractual',
    'separateQuoteRef'=>'referencia_presupuesto', 'assignee'=>'responsable', 'billingMonth'=>'mes_imputacion',
    'firstResponseAt'=>'primera_respuesta_en', 'technicalNotes'=>'notas_tecnicas', 'createdAt'=>'creado_en'
];

const TICKET_SELECT = 'SELECT t.*, p.registros AS partes FROM tickets t LEFT JOIN ticketera_partes p ON p.ticket_id=t.id';

function ticketView(array $row, string $role): array {
    $t = [];
    foreach (COLUMNS as $key => $column) $t[$key] = $row[$column] ?? '';
    if ($role !== 'sistemas_uca') $t['workLogs'] = json_decode($row['partes'] ?? '[]', true);
    $t['scopeCriteria'] = json_decode($t['scopeCriteria'], true);
    $t['involvesAwsOrBackups'] = (bool)$t['involvesAwsOrBackups'];
    foreach (['hoursLogged','estimatedHours'] as $key) $t[$key] = (float)$t[$key];
    foreach (['createdAt','firstResponseAt'] as $key) $t[$key] = substr(str_replace(' ', 'T', $t[$key]), 0, 16);
    if ($role === 'admin') $t['version'] = hash('sha256', json_encode($row));
    else unset($t['technicalNotes']);
    if ($role === 'sistemas_uca') {
        foreach (['requesterEmail','hoursLogged','estimatedHours','separateQuoteRef','billingMode','scopeCriteria'] as $key) unset($t[$key]);
    }
    return $t;
}

function field(array $d, string $key, int $max, bool $required = false): string {
    $s = $d[$key] ?? '';
    if (!is_string($s)) fail(422, "Formato incorrecto en $key.");
    $s = trim($s);
    if (($required && $s === '') || preg_match_all('/./us', $s) > $max) fail(422, "Revisá el campo $key.");
    return $s;
}

function choice(array $d, string $key, array $allowed): string {
    if (!in_array($d[$key] ?? null, $allowed, true)) fail(422, "Opción inválida en $key.");
    return $d[$key];
}

function hours(array $d, string $key): float {
    $n = $d[$key] ?? null;
    if (!is_numeric($n) || !is_finite((float)$n) || $n < 0 || $n > 500 || abs(round($n * 100) - $n * 100) > 0.000001) {
        fail(422, 'Las horas deben estar entre 0 y 500 con hasta dos decimales.');
    }
    return (float)$n;
}

function period(string $s): bool {
    return (bool)preg_match('/^[1-9]\d{3}-(0[1-9]|1[0-2])$/D', $s);
}

function linkField(array $d, string $key): string {
    $s = field($d, $key, 2048);
    if ($s !== '' && (!filter_var($s, FILTER_VALIDATE_URL) || strtolower((string)parse_url($s, PHP_URL_SCHEME)) !== 'https'
        || parse_url($s, PHP_URL_USER) !== null || preg_match('/[\x00-\x20\\\\]/', $s))) fail(422, 'Ingresá un enlace HTTPS sin credenciales.');
    return $s;
}

function creation(array $d, array $user): array {
    $kind = choice($d, 'requestKind', ['mantenimiento','mejora']);
    $cat = choice($d, 'category', ['gestion_soporte','ux_ui_menor','tecnico_seguridad','buscador_documental','integraciones_operativas','monitoreo_rendimiento','infra_aws_uca']);
    $infra = $cat === 'infra_aws_uca' || ($d['involvesAwsOrBackups'] ?? false) === true;
    $name = $user['role'] === 'admin' ? field($d,'requesterName',150,true) : $user['name'];
    $email = $user['role'] === 'admin' ? field($d,'requesterEmail',160,true) : $user['email'];
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(422, 'Revisá el correo del solicitante.');
    return [
        'asunto'=>field($d,'title',255,true), 'naturaleza'=>$kind, 'categoria_servicio'=>$cat,
        'prioridad'=>choice($d,'priority',['critica','alta','normal','baja']),
        'estado'=>$kind === 'mejora' ? 'Validación de alcance' : 'Nuevo',
        'solicitante_nombre'=>$name, 'solicitante_email'=>$email, 'solicitante_area'=>field($d,'requesterArea',120),
        'url_afectada'=>linkField($d,'affectedUrl'), 'evidencia_url'=>linkField($d,'evidenceUrl'),
        'descripcion'=>field($d,'description',8000,true), 'mejora_vinculada'=>field($d,'linkedGroup',160),
        'involucra_aws_backups'=>(int)$infra, 'mes_imputacion'=>date('Y-m'), 'creado_en'=>date('Y-m-d H:i:s')
    ];
}

function edits(PDO $pdo, array $d, array $old): array {
    $kind = choice($d,'requestKind',['mantenimiento','mejora']);
    $state = choice($d,'status',['Nuevo','En diagnóstico','Validación de alcance','Derivado a Sistemas UCA','En ejecución','En pruebas / QA','Esperando El Derecho','Presupuesto aparte','Resuelto']);
    $mode = choice($d,'billingMode',['bolsa','presupuesto_aparte','sin_cargo_uca']);
    $est = hours($d,'estimatedHours');
    $used = hours($d,'hoursLogged');
    if ($used !== (float)$old['horas_consumidas'] && (float)$old['horas_consumidas'] === 0.0) {
        fail(422, 'Registrá las horas nuevas como intervención fechada.');
    }
    $month = field($d,'billingMonth',7,true);
    if (!period($month)) fail(422, 'Revisá el período de imputación.');
    $response = field($d,'firstResponseAt',16);
    if ($response !== '') {
        $at = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $response);
        if (!$at || $at->format('Y-m-d\TH:i') !== $response || $response < substr(str_replace(' ', 'T', $old['creado_en']),0,16) || $response > date('Y-m-d\TH:i')) {
            fail(422, 'La primera respuesta debe estar entre el alta y el momento actual.');
        }
    }
    $criteria = $d['scopeCriteria'] ?? null;
    $keys = ['existingComponentOnly','withinSixHours','noDataOrIntegrationChanges','localizedLowRisk'];
    if ($criteria !== null) {
        if (!is_array($criteria)) fail(422,'Criterios de alcance inválidos.');
        foreach ($keys as $key) if (!is_bool($criteria[$key] ?? null)) fail(422,'Completá los cuatro criterios.');
        $criteria = array_intersect_key($criteria, array_flip($keys));
    }
    $ref = field($d,'separateQuoteRef',160);
    $work = $d['newWork'] ?? null;
    if ($work !== null) {
        if (!is_array($work)) fail(422,'Intervención inválida.');
        $date = field($work,'date',10,true);
        $day = DateTimeImmutable::createFromFormat('!Y-m-d',$date);
        if (!$day || $day->format('Y-m-d') !== $date || $date > date('Y-m-d')) fail(422,'Revisá la fecha de la intervención.');
        $duration = hours($work,'hours');
        if ($duration <= 0) fail(422,'La intervención debe tener horas positivas.');
        $workMode = choice($work,'billingMode',['bolsa','presupuesto_aparte','sin_cargo_uca']);
        if ($workMode === 'bolsa') {
            $start = getenv('ED_MES_INICIO') ?: '';
            $end = period($start) ? (new DateTimeImmutable($start.'-01'))->modify('+12 months')->format('Y-m') : '';
            if (!$end || substr($date,0,7) < $start || substr($date,0,7) >= $end) fail(422,'La fecha debe estar dentro de la vigencia acordada para imputar a la bolsa.');
        }
        $newEntry = ['date'=>$date,'hours'=>$duration,'billingMode'=>$workMode,'assignee'=>field($work,'assignee',120,true),
            'description'=>field($work,'description',500,true),'status'=>$state,'quoteRef'=>$ref];
    }
    if ($kind === 'mejora') {
        $total = $est;
        $peersMinor = true;
        if (trim((string)$old['mejora_vinculada']) !== '') {
            $peers = $pdo->prepare("SELECT horas_estimadas, criterios_alcance_json FROM tickets WHERE naturaleza='mejora' AND TRIM(mejora_vinculada)=TRIM(?) AND id<>?");
            $peers->execute([$old['mejora_vinculada'],$old['id']]);
            foreach ($peers as $peer) {
                $other = json_decode((string)$peer['criterios_alcance_json'],true) ?: [];
                $total += (float)$peer['horas_estimadas'];
                foreach ($keys as $key) if (($other[$key] ?? null) !== true) $peersMinor = false;
                if ((float)$peer['horas_estimadas'] <= 0) $peersMinor = false;
            }
        }
        $minor = $criteria && !in_array(false,$criteria,true) && $est > 0 && $total <= 6 && $peersMinor;
        $working = in_array($state,['En ejecución','En pruebas / QA','Resuelto'],true);
        if (!$minor && $working && ($mode !== 'presupuesto_aparte' || $ref === '' || !$est)) fail(422, 'Para ejecutar esta mejora registrá la estimación, la imputación aparte y la referencia a la conformidad de la UCA.');
        if (!$minor && (($used > 0 && $mode === 'bolsa') || ($newEntry['billingMode'] ?? '') === 'bolsa')) fail(422, 'Revisá el alcance antes de imputar esta mejora a la bolsa.');
    }
    if (isset($newEntry)) {
        $entries = json_decode($old['partes'] ?? '[]',true);
        $entries[] = $newEntry;
        $pdo->prepare('INSERT INTO ticketera_partes(ticket_id,registros) VALUES (?,?) ON DUPLICATE KEY UPDATE registros=VALUES(registros)')
            ->execute([$old['id'],json_encode($entries,JSON_THROW_ON_ERROR)]);
    }
    return ['naturaleza'=>$kind,'estado'=>$state,'horas_estimadas'=>$est,'horas_consumidas'=>$used,
        'criterios_alcance_json'=>$criteria === null ? null : json_encode($criteria), 'mes_imputacion'=>$month,
        'imputacion_contractual'=>$mode,'referencia_presupuesto'=>$ref,'responsable'=>field($d,'assignee',120) ?: 'Sin asignar',
        'primera_respuesta_en'=>$response === '' ? null : str_replace('T',' ',$response).':00',
        'notas_tecnicas'=>field($d,'technicalNotes',8000)];
}

$user = currentUser();
$role = $user['role'];
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $where = $role === 'sistemas_uca' ? " WHERE estado='Derivado a Sistemas UCA'" : '';
    $rows = $pdo->query(TICKET_SELECT . "$where ORDER BY t.creado_en DESC, t.id DESC")->fetchAll();
    $start = getenv('ED_MES_INICIO') ?: '';
    $balances = $role === 'sistemas_uca' ? [] : $pdo->query('SELECT periodo_mes, horas_trasladadas_anterior FROM bolsa_mensual_horas')->fetchAll(PDO::FETCH_KEY_PAIR);
    reply(200, ['success'=>true,'tickets'=>array_map(fn($r)=>ticketView($r,$role),$rows),
        'carryover'=>(object)$balances,'startMonth'=>period($start) ? $start : null]);
}
if (!in_array($method, ['POST','PUT','DELETE'], true)) fail(405,'Método no permitido.');
verifyWrite();
if ($role !== 'admin' && !($role === 'el_derecho' && $method === 'POST')) fail(403, 'Tu perfil no tiene permiso para esta acción.');
$d = input();
if ($method === 'POST') {
    $key = field($d,'requestKey',64,true);
    if (!preg_match('/^[a-f0-9-]{32,64}$/D',$key)) fail(422,'Identificador de solicitud inválido.');
    $id = 'ED-' . strtoupper(substr(hash('sha256', $user['id'] . '/' . $key),0,16));
    $values = creation($d,$user);
} else {
    $id = field($d,'id',20,true);
}
$pdo->beginTransaction();
// La misma mejora puede abarcar varios tickets. Serializar las escrituras mantiene coherente la evaluación conjunta.
$pdo->query('SELECT id FROM ticketera_control WHERE id=1 FOR UPDATE')->fetchColumn();
$find = $pdo->prepare(TICKET_SELECT . ' WHERE t.id=?');
$find->execute([$id]);
$old = $find->fetch() ?: null;
if ($method === 'POST') {
    $previous = $pdo->prepare("SELECT evento FROM ticketera_historial WHERE ticket_id=? AND accion='alta' LIMIT 1");
    $previous->execute([$id]);
    if ($previous->fetchColumn()) {
        $pdo->commit();
        if (!$old) fail(409,'Esta solicitud ya fue registrada y luego eliminada.');
        reply(200, ['success'=>true,'ticket'=>ticketView($old,$role)]);
    }
    if ($old) fail(409,'El identificador ya está ocupado. Actualizá la página.');
    $values['id'] = $id;
    $columns = implode(',', array_keys($values));
    $marks = implode(',',array_fill(0,count($values),'?'));
    $pdo->prepare("INSERT INTO tickets ($columns) VALUES ($marks)")->execute(array_values($values));
    $action = 'alta';
} else {
    if (!$old) fail(404,'El ticket ya no está disponible.');
    if (!hash_equals(ticketView($old,'admin')['version'],field($d,'version',64,true))) fail(409,'Otro usuario modificó el ticket. Volvé a abrirlo para revisar los cambios.');
    if ($method === 'PUT') {
        $values = edits($pdo,$d,$old);
        $assignments = implode(',',array_map(fn($name)=>"$name=?",array_keys($values)));
        $pdo->prepare("UPDATE tickets SET $assignments WHERE id=?")->execute([...array_values($values),$id]);
        $action = 'edicion';
    } else {
        $pdo->prepare('DELETE FROM tickets WHERE id=?')->execute([$id]);
        $action = 'baja';
    }
}
$find->execute([$id]);
$new = $find->fetch() ?: null;
$pdo->prepare('INSERT INTO ticketera_historial (ticket_id,usuario_id,accion,anterior,posterior) VALUES (?,?,?,?,?)')
    ->execute([$id,$user['id'],$action,$old ? json_encode($old) : null,$new ? json_encode($new) : null]);
$pdo->commit();
reply($method === 'POST' ? 201 : 200,['success'=>true,'ticket'=>$new ? ticketView($new,$role) : null]);