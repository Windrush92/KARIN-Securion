<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Listar todos los pedidos
    try {
        $stmt = $pdo->query("SELECT * FROM pedidos ORDER BY creado_en DESC");
        $rows = $stmt->fetchAll();
        
        // Mapear campos a la estructura de la aplicación
        $orders = array_map(function($r) {
            return [
                'id' => $r['id'],
                'name' => $r['nombre'],
                'pieceType' => $r['tipo_pieza'],
                'quantity' => $r['cantidad_versiones'],
                'description' => $r['descripcion'],
                'channel' => $r['canal'],
                'firstDeliveryDate' => $r['primera_entrega'],
                'finalDeliveryDate' => $r['entrega_final'],
                'isUrgent' => $r['es_urgente'],
                'requesterName' => $r['solicitante_nombre'],
                'requesterEmail' => $r['solicitante_email'],
                'approverSecurion' => $r['aprobador_securion'],
                'materialsComplete' => $r['materiales_completos'],
                'missingMaterials' => $r['missing_materials'],
                'materialsUrl' => $r['materials_url'],
                'formatSpecs' => $r['formato_medidas'],
                'visualRefs' => $r['referencias_visuales'],
                'eventDate' => $r['fecha_evento'],
                'notes' => $r['observaciones'],
                'internalStatus' => $r['estado_interno'],
                'karinAssignee' => $r['responsable_karin'],
                'quotaConsumption' => $r['cupo_fee'],
                'hasAdditional' => $r['aplica_adicional'],
                'additionalDetails' => $r['detalles_adicional'],
                'karinNotes' => $r['notas_karin']
            ];
        }, $rows);

        echo json_encode(['success' => true, 'orders' => $orders]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al obtener pedidos']);
    }
    exit;
}

if ($method === 'POST') {
    // Crear o actualizar un pedido
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Datos inválidos']);
        exit;
    }

    try {
        $sql = "INSERT INTO pedidos (
            id, nombre, tipo_pieza, cantidad_versiones, descripcion, canal,
            primera_entrega, entrega_final, es_urgente, solicitante_nombre, solicitante_email,
            aprobador_securion, materiales_completos, missing_materials, materials_url,
            formato_medidas, referencias_visuales, fecha_evento, observaciones,
            estado_interno, responsable_karin, cupo_fee, aplica_adicional, detalles_adicional, notas_karin
        ) VALUES (
            :id, :nombre, :tipo_pieza, :cantidad_versiones, :descripcion, :canal,
            :primera_entrega, :entrega_final, :es_urgente, :solicitante_nombre, :solicitante_email,
            :aprobador_securion, :materiales_completos, :missing_materials, :materials_url,
            :formato_medidas, :referencias_visuales, :fecha_evento, :observaciones,
            :estado_interno, :responsable_karin, :cupo_fee, :aplica_adicional, :detalles_adicional, :notas_karin
        ) ON DUPLICATE KEY UPDATE
            nombre = VALUES(nombre),
            tipo_pieza = VALUES(tipo_pieza),
            cantidad_versiones = VALUES(cantidad_versiones),
            descripcion = VALUES(descripcion),
            canal = VALUES(canal),
            primera_entrega = VALUES(primera_entrega),
            entrega_final = VALUES(entrega_final),
            es_urgente = VALUES(es_urgente),
            solicitante_nombre = VALUES(solicitante_nombre),
            solicitante_email = VALUES(solicitante_email),
            aprobador_securion = VALUES(aprobador_securion),
            materiales_completos = VALUES(materiales_completos),
            missing_materials = VALUES(missing_materials),
            materials_url = VALUES(materials_url),
            formato_medidas = VALUES(formato_medidas),
            referencias_visuales = VALUES(referencias_visuales),
            fecha_evento = VALUES(fecha_evento),
            observaciones = VALUES(observaciones),
            estado_interno = VALUES(estado_interno),
            responsable_karin = VALUES(responsable_karin),
            cupo_fee = VALUES(cupo_fee),
            aplica_adicional = VALUES(aplica_adicional),
            detalles_adicional = VALUES(detalles_adicional),
            notas_karin = VALUES(notas_karin)";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':id' => $data['id'],
            ':nombre' => $data['name'] ?? '',
            ':tipo_pieza' => $data['pieceType'] ?? '',
            ':cantidad_versiones' => $data['quantity'] ?? '',
            ':descripcion' => $data['description'] ?? '',
            ':canal' => $data['channel'] ?? '',
            ':primera_entrega' => !empty($data['firstDeliveryDate']) ? $data['firstDeliveryDate'] : null,
            ':entrega_final' => !empty($data['finalDeliveryDate']) ? $data['finalDeliveryDate'] : null,
            ':es_urgente' => $data['isUrgent'] ?? 'No',
            ':solicitante_nombre' => $data['requesterName'] ?? '',
            ':solicitante_email' => $data['requesterEmail'] ?? '',
            ':aprobador_securion' => $data['approverSecurion'] ?? '',
            ':materiales_completos' => $data['materialsComplete'] ?? 'Sí',
            ':missing_materials' => $data['missingMaterials'] ?? '',
            ':materials_url' => $data['materialsUrl'] ?? '',
            ':formato_medidas' => $data['formatSpecs'] ?? '',
            ':referencias_visuales' => $data['visualRefs'] ?? '',
            ':fecha_evento' => $data['eventDate'] ?? '',
            ':observaciones' => $data['notes'] ?? '',
            ':estado_interno' => $data['internalStatus'] ?? 'Nuevo',
            ':responsable_karin' => $data['karinAssignee'] ?? 'Sin asignar',
            ':cupo_fee' => $data['quotaConsumption'] ?? 'Dentro del fee',
            ':aplica_adicional' => $data['hasAdditional'] ?? 'No',
            ':detalles_adicional' => $data['additionalDetails'] ?? '',
            ':notas_karin' => $data['karinNotes'] ?? ''
        ]);

        echo json_encode(['success' => true, 'id' => $data['id']]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al guardar el pedido: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'DELETE') {
    // Eliminar un pedido
    $id = $_GET['id'] ?? '';
    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'ID no proporcionado']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM pedidos WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Error al eliminar el pedido']);
    }
    exit;
}
