<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
date_default_timezone_set('America/Argentina/Buenos_Aires');

function reply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail(int $status, string $message): never {
    reply($status, ['success' => false, 'error' => $message]);
}

set_exception_handler(static function (Throwable $e): void {
    error_log('Ticketera: ' . get_class($e) . ' (' . $e->getCode() . ')');
    fail(500, 'El servidor no pudo completar la operación. Revisá la conexión y la configuración.');
});

$secure = isset($_SERVER['HTTPS']) && !in_array($_SERVER['HTTPS'], ['', 'off'], true);
$loopback = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)
    && in_array(parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST), ['127.0.0.1', 'localhost', '[::1]'], true);
if (!$secure && !$loopback) fail(403, 'Se requiere una conexión HTTPS.');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_name('EDTICKETERA');
session_set_cookie_params(['lifetime' => 0, 'httponly' => true, 'secure' => $secure, 'samesite' => 'Strict', 'path' => rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/']);
session_start();

function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $name = getenv('ED_DB_NAME');
    $user = getenv('ED_DB_USER');
    $pass = getenv('ED_DB_PASSWORD');
    if (!$name || !$user || $pass === false || $pass === '') fail(503, 'La base de la ticketera aún no está configurada.');
    $host = getenv('ED_DB_HOST') ?: 'localhost';
    $port = (int)(getenv('ED_DB_PORT') ?: 3306);
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);
    $pdo->exec("SET time_zone = '-03:00'");
    return $pdo;
}

function canAccessReport(string $role): bool {
    if ($role === 'admin') return true;
    if ($role === 'el_derecho') {
        $flag = strtolower(trim((string)(getenv('ED_ALLOW_CLIENT_REPORT') ?: '0')));
        return in_array($flag, ['1', 'true', 'yes', 'si'], true);
    }
    return false;
}

function currentUser(): array {
    if (empty($_SESSION['id']) || time() - ($_SESSION['last'] ?? 0) > 3600 || time() - ($_SESSION['start'] ?? 0) > 43200) {
        $_SESSION = [];
        fail(401, 'Iniciá sesión para continuar.');
    }
    $stmt = db()->prepare('SELECT id, nombre AS name, email, rol AS role FROM usuarios WHERE id = ?');
    $stmt->execute([$_SESSION['id']]);
    $user = $stmt->fetch();
    if (!$user || !in_array($user['role'], ['admin', 'el_derecho', 'sistemas_uca'], true)) {
        $_SESSION = [];
        fail(401, 'La cuenta ya no tiene acceso.');
    }
    $_SESSION['last'] = time();
    return $user;
}

function verifyWrite(): void {
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        fail(403, 'La sesión cambió. Actualizá la página.');
    }
}

function input(): array {
    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
        fail(415, 'Se requiere contenido JSON.');
    }
    $raw = file_get_contents('php://input', false, null, 0, 98305);
    if ($raw === false || strlen($raw) > 98304) fail(413, 'La solicitud es demasiado extensa.');
    $data = json_decode($raw, true);
    if (!is_array($data) || array_is_list($data)) fail(422, 'Los datos enviados no son válidos.');
    return $data;
}
