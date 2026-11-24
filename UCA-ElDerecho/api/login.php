<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'GET') {
    $user = currentUser();
    reply(200, [
        'success' => true,
        'user' => $user,
        'canViewReport' => canAccessReport($user['role']),
        'csrf' => $_SESSION['csrf']
    ]);
}
if ($method === 'DELETE') {
    currentUser();
    verifyWrite();
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => 1, 'path' => $params['path'], 'secure' => $params['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    reply(200, ['success' => true]);
}
if ($method !== 'POST') fail(405, 'Método no permitido.');
$d = input();
$email = is_string($d['email'] ?? null) ? trim($d['email']) : '';
$password = $d['password'] ?? null;
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 160 || !is_string($password) || $password === '' || strlen($password) > 1024) {
    fail(422, 'Ingresá un correo y una contraseña válidos.');
}
$pdo = db();
$origin = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
$now = time();
$pdo->beginTransaction();
$pdo->prepare('INSERT INTO ticketera_intentos (origen, ventana, cantidad) VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE cantidad = IF(ventana <= ?, 1, cantidad + 1), ventana = IF(ventana <= ?, ?, ventana)')
    ->execute([$origin, $now, $now - 900, $now - 900, $now]);
$count = $pdo->prepare('SELECT cantidad FROM ticketera_intentos WHERE origen = ?');
$count->execute([$origin]);
$attempts = (int)$count->fetchColumn();
$pdo->commit();
if ($attempts > 40) fail(429, 'Demasiados intentos. Volvé a intentar en 15 minutos.');
$stmt = $pdo->prepare('SELECT id, nombre AS name, email, password, rol AS role FROM usuarios WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();
$verified = password_verify($password, $user['password'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.');
if (!$verified || !$user) fail(401, 'Credenciales inválidas.');
unset($user['password']);
session_regenerate_id(true);
$_SESSION = ['id' => $user['id'], 'csrf' => bin2hex(random_bytes(32)), 'start' => $now, 'last' => $now];
$pdo->prepare('DELETE FROM ticketera_intentos WHERE origen = ? OR ventana < ?')->execute([$origin, $now - 900]);
reply(200, [
    'success' => true,
    'user' => $user,
    'canViewReport' => canAccessReport($user['role']),
    'csrf' => $_SESSION['csrf']
]);
