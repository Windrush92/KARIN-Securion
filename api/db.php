<?php
// Configuración de conexión MySQL para Hostinger
// Tu hermano solo debe colocar los datos de la base de datos creada en hPanel

header('Content-Type: application/json; charset=utf-8');

$db_host = 'localhost'; // En Hostinger suele ser 'localhost'
$db_name = 'u123456789_karin'; // Reemplazar por el nombre de la BD en Hostinger
$db_user = 'u123456789_admin'; // Reemplazar por el usuario de la BD
$db_pass = 'TuPasswordSeguro123!'; // Reemplazar por la contraseña de la BD

try {
    $pdo = new PDO("mysql:host={$db_host};dbname={$db_name};charset=utf8mb4", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos']);
    exit;
}
