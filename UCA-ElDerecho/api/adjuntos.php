<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_TICKET = 5;
const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

$user = currentUser();
$role = $user['role'];
$pdo = db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) fail(400, 'Identificador de adjunto inválido.');
    $stmt = $pdo->prepare(
        'SELECT a.id, a.ticket_id, a.nombre_archivo, a.mime_type, a.contenido, t.estado
         FROM ticketera_adjuntos a
         INNER JOIN tickets t ON t.id = a.ticket_id
         WHERE a.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) fail(404, 'Adjunto no encontrado.');
    if ($role === 'sistemas_uca' && $row['estado'] !== 'Derivado a Sistemas UCA') {
        fail(403, 'Tu perfil no tiene acceso a este adjunto.');
    }

    header_remove('Content-Type');
    header('Content-Type: ' . $row['mime_type']);
    header('Content-Length: ' . strlen((string)$row['contenido']));
    header('Content-Disposition: inline; filename="' . preg_replace('/[^a-zA-Z0-9._-]/', '_', (string)$row['nombre_archivo']) . '"');
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    echo $row['contenido'];
    exit;
}

verifyWrite();

if ($method === 'POST') {
    if (!in_array($role, ['admin', 'el_derecho'], true)) {
        fail(403, 'Tu perfil no puede adjuntar archivos.');
    }
    $ticketId = trim((string)($_POST['ticketId'] ?? ''));
    if ($ticketId === '' || strlen($ticketId) > 20) fail(422, 'Ticket inválido.');

    $tStmt = $pdo->prepare('SELECT id, solicitante_email, creado_en FROM tickets WHERE id = ? LIMIT 1');
    $tStmt->execute([$ticketId]);
    $ticket = $tStmt->fetch();
    if (!$ticket) fail(404, 'El ticket no existe.');

    // Los administrativos solo pueden adjuntar capturas al crear su propio ticket (ventana inmediata).
    if ($role === 'el_derecho') {
        $isOwner = strcasecmp((string)$ticket['solicitante_email'], (string)$user['email']) === 0;
        $age = time() - strtotime((string)$ticket['creado_en']);
        if (!$isOwner || $age > 300) {
            fail(403, 'No es posible modificar un ticket ya enviado.');
        }
    }

    if (empty($_FILES['images'])) fail(422, 'No se recibieron imágenes.');
    $files = $_FILES['images'];
    $names = is_array($files['name']) ? $files['name'] : [$files['name']];
    $tmps = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
    $errs = is_array($files['error']) ? $files['error'] : [$files['error']];
    $sizes = is_array($files['size']) ? $files['size'] : [$files['size']];

    $countStmt = $pdo->prepare('SELECT COUNT(*) FROM ticketera_adjuntos WHERE ticket_id = ?');
    $countStmt->execute([$ticketId]);
    $existingCount = (int)$countStmt->fetchColumn();
    if ($existingCount + count($names) > MAX_ATTACHMENTS_PER_TICKET) {
        fail(422, 'Se permiten hasta ' . MAX_ATTACHMENTS_PER_TICKET . ' imágenes por ticket.');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $saved = [];
    $pdo->beginTransaction();
    $ins = $pdo->prepare('INSERT INTO ticketera_adjuntos (ticket_id, nombre_archivo, mime_type, tamano_bytes, contenido, subido_por) VALUES (?, ?, ?, ?, ?, ?)');

    for ($i = 0; $i < count($names); $i++) {
        if ((int)$errs[$i] !== UPLOAD_ERR_OK) fail(422, 'Error al recibir una de las imágenes.');
        $size = (int)$sizes[$i];
        if ($size <= 0 || $size > MAX_ATTACHMENT_BYTES) {
            fail(422, 'Cada imagen debe pesar hasta 5 MB.');
        }
        $bytes = file_get_contents($tmps[$i]);
        if ($bytes === false || strlen($bytes) > MAX_ATTACHMENT_BYTES) {
            fail(422, 'No se pudo leer la imagen cargada.');
        }
        $mime = (string)$finfo->buffer($bytes);
        if (!in_array($mime, ALLOWED_IMAGE_MIMES, true) || @getimagesizefromstring($bytes) === false) {
            fail(422, 'Solo se permiten imágenes PNG, JPG, WebP o GIF válidas.');
        }
        $safeName = preg_replace('/[^\w.\- ]+/u', '_', basename((string)$names[$i]));
        $safeName = trim(substr($safeName ?: 'captura.png', 0, 160));
        $ins->execute([$ticketId, $safeName, $mime, strlen($bytes), $bytes, (int)$user['id']]);
        $attId = (int)$pdo->lastInsertId();
        $saved[] = [
            'id' => $attId,
            'name' => $safeName,
            'mime' => $mime,
            'size' => strlen($bytes),
            'url' => 'api/adjuntos.php?id=' . $attId
        ];
    }
    $pdo->commit();
    reply(201, ['success' => true, 'attachments' => $saved]);
}

if ($method === 'DELETE') {
    if ($role !== 'admin') fail(403, 'Solo administración puede eliminar adjuntos.');
    $d = input();
    $id = (int)($d['id'] ?? 0);
    if ($id <= 0) fail(422, 'Adjunto inválido.');
    $pdo->prepare('DELETE FROM ticketera_adjuntos WHERE id = ?')->execute([$id]);
    reply(200, ['success' => true]);
}

fail(405, 'Método no permitido.');
