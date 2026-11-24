<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

$user = currentUser();
if ($user['role'] !== 'admin') {
    fail(403, 'Solo el equipo de Karín puede registrar ajustes de saldo.');
}

$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $pdo->query(
        'SELECT id, periodo_mes AS period, horas_anterior AS prevHours, horas_nueva AS newHours,
                motivo AS reason, usuario_nombre AS actor, fecha AS createdAt
         FROM bolsa_mensual_ajustes ORDER BY id DESC LIMIT 50'
    )->fetchAll();
    reply(200, ['success' => true, 'adjustments' => $rows]);
}

if ($method !== 'POST') fail(405, 'Método no permitido.');
verifyWrite();

$d = input();
$period = trim((string)($d['period'] ?? ''));
if (!preg_match('/^[1-9]\d{3}-(0[1-9]|1[0-2])$/D', $period)) {
    fail(422, 'Indicá un período válido en formato AAAA-MM.');
}

$hours = $d['hours'] ?? null;
if (!is_numeric($hours) || !is_finite((float)$hours) || (float)$hours < 0 || (float)$hours > 30 || abs(round((float)$hours * 100) - (float)$hours * 100) > 0.000001) {
    fail(422, 'El ajuste de horas trasladadas debe estar entre 0 y 30 horas (hasta dos decimales).');
}
$hoursVal = (float)$hours;

$reason = trim((string)($d['reason'] ?? ''));
if ($reason === '' || preg_match_all('/./us', $reason) > 255) {
    fail(422, 'Indicá el motivo del ajuste (hasta 255 caracteres).');
}

$pdo->beginTransaction();
$prevStmt = $pdo->prepare('SELECT horas_trasladadas_anterior FROM bolsa_mensual_horas WHERE periodo_mes = ? FOR UPDATE');
$prevStmt->execute([$period]);
$prev = $prevStmt->fetchColumn();
$prevVal = $prev === false ? null : (float)$prev;

$pdo->prepare(
    'INSERT INTO bolsa_mensual_horas (periodo_mes, horas_bolsa_mes, horas_trasladadas_anterior, observaciones)
     VALUES (?, 30.00, ?, ?)
     ON DUPLICATE KEY UPDATE horas_trasladadas_anterior = VALUES(horas_trasladadas_anterior), observaciones = VALUES(observaciones)'
)->execute([$period, $hoursVal, $reason]);

$pdo->prepare(
    'INSERT INTO bolsa_mensual_ajustes (periodo_mes, horas_anterior, horas_nueva, motivo, usuario_id, usuario_nombre)
     VALUES (?, ?, ?, ?, ?, ?)'
)->execute([$period, $prevVal, $hoursVal, $reason, (int)$user['id'], $user['name']]);

$pdo->prepare(
    'INSERT INTO ticketera_historial (ticket_id, usuario_id, accion, anterior, posterior)
     VALUES (?, ?, ?, ?, ?)'
)->execute([
    'BOLSA-' . $period,
    (int)$user['id'],
    'ajuste_saldo',
    json_encode(['periodo' => $period, 'horas_trasladadas' => $prevVal]),
    json_encode(['periodo' => $period, 'horas_trasladadas' => $hoursVal, 'motivo' => $reason])
]);
$pdo->commit();

$balances = $pdo->query('SELECT periodo_mes, horas_trasladadas_anterior FROM bolsa_mensual_horas')->fetchAll(PDO::FETCH_KEY_PAIR);
$adjustments = $pdo->query(
    'SELECT id, periodo_mes AS period, horas_anterior AS prevHours, horas_nueva AS newHours,
            motivo AS reason, usuario_nombre AS actor, fecha AS createdAt
     FROM bolsa_mensual_ajustes ORDER BY id DESC LIMIT 30'
)->fetchAll();

reply(200, [
    'success' => true,
    'carryover' => (object)$balances,
    'adjustments' => $adjustments
]);
