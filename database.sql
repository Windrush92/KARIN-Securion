-- Script SQL para Hostinger (phpMyAdmin)
-- Base de datos: MySQL / MariaDB

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `rol` ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pedidos` (
  `id` VARCHAR(50) PRIMARY KEY,
  `nombre` VARCHAR(255) NOT NULL,
  `tipo_pieza` VARCHAR(100) NOT NULL,
  `cantidad_versiones` VARCHAR(100) NULL,
  `descripcion` TEXT NULL,
  `canal` VARCHAR(100) NULL,
  `primera_entrega` DATETIME NULL,
  `entrega_final` DATETIME NULL,
  `es_urgente` VARCHAR(10) DEFAULT 'No',
  `solicitante_nombre` VARCHAR(150) NOT NULL,
  `solicitante_email` VARCHAR(150) NOT NULL,
  `aprobador_securion` VARCHAR(150) NULL,
  `materiales_completos` VARCHAR(10) DEFAULT 'Sí',
  `missing_materials` TEXT NULL,
  `materials_url` TEXT NULL,
  `formato_medidas` TEXT NULL,
  `referencias_visuales` TEXT NULL,
  `fecha_evento` VARCHAR(100) NULL,
  `observaciones` TEXT NULL,
  `estado_interno` VARCHAR(50) DEFAULT 'Nuevo',
  `responsable_karin` VARCHAR(100) DEFAULT 'Sin asignar',
  `cupo_fee` VARCHAR(50) DEFAULT 'Dentro del fee',
  `aplica_adicional` VARCHAR(10) DEFAULT 'No',
  `detalles_adicional` TEXT NULL,
  `notas_karin` TEXT NULL,
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuarios de prueba iniciales (Contraseñas con hash BCRYPT seguro)
-- Contraseña admin@karin-d.com: karin123
-- Contraseña cliente@securion.com: securion123
INSERT INTO `usuarios` (`nombre`, `email`, `password`, `rol`) VALUES
('Karín Diseño', 'admin@karin-d.com', '$2y$10$wN1e1o7YmF6L8yGZqj211e0GqM58zKkW71X1P2pE3R8T.5hS8Pqre', 'admin'),
('Securion', 'cliente@securion.com', '$2y$10$tW0dE2i4N5Q7xJ6zV1u8seW3Q8.Kq9P8Y2a0R9uV3R4S5hT6Pqre', 'cliente')
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);
