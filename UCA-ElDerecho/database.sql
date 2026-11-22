-- Esquema MySQL / MariaDB para Hostinger (phpMyAdmin)
-- Proyecto: Ticketera de Mantenimiento El Derecho (UCA) — Operada por Karín

CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(120) NOT NULL,
  `email` VARCHAR(160) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `rol` ENUM('admin', 'el_derecho', 'sistemas_uca') NOT NULL DEFAULT 'el_derecho',
  `creado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `bolsa_mensual_horas` (
  `periodo_mes` CHAR(7) PRIMARY KEY COMMENT 'Formato YYYY-MM, ej. 2026-11',
  `horas_bolsa_mes` DECIMAL(5,2) NOT NULL DEFAULT 30.00,
  `horas_trasladadas_anterior` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Tope contractual: 30.00 h; se consumen primero y vencen a fin de mes',
  `observaciones` VARCHAR(255) NULL,
  `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tickets` (
  `id` VARCHAR(20) PRIMARY KEY COMMENT 'Formato ED-001',
  `asunto` VARCHAR(255) NOT NULL,
  `naturaleza` ENUM('mantenimiento', 'mejora') NOT NULL DEFAULT 'mantenimiento',
  `categoria_servicio` VARCHAR(60) NOT NULL,
  `prioridad` ENUM('critica', 'alta', 'normal', 'baja') NOT NULL DEFAULT 'normal',
  `estado` VARCHAR(50) NOT NULL DEFAULT 'Nuevo',
  `solicitante_nombre` VARCHAR(150) NOT NULL,
  `solicitante_email` VARCHAR(160) NOT NULL,
  `solicitante_area` VARCHAR(120) NULL,
  `url_afectada` TEXT NULL,
  `evidencia_url` TEXT NULL,
  `descripcion` TEXT NOT NULL,
  `mejora_vinculada` VARCHAR(160) NULL,
  `involucra_aws_backups` TINYINT(1) NOT NULL DEFAULT 0,
  `criterios_alcance_json` JSON NULL COMMENT '4 criterios acumulativos del Apartado 5',
  `horas_estimadas` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `horas_consumidas` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  `imputacion_contractual` ENUM('bolsa', 'presupuesto_aparte', 'sin_cargo_uca') NOT NULL DEFAULT 'bolsa',
  `referencia_presupuesto` VARCHAR(160) NULL,
  `responsable` VARCHAR(120) NOT NULL DEFAULT 'Sin asignar',
  `mes_imputacion` CHAR(7) NOT NULL COMMENT 'Formato YYYY-MM',
  `primera_respuesta_en` DATETIME NULL,
  `notas_tecnicas` TEXT NULL,
  `creado_en` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tickets_mes` (`mes_imputacion`),
  INDEX `idx_tickets_estado` (`estado`),
  INDEX `idx_tickets_prioridad` (`prioridad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticketera_intentos (
  origen CHAR(64) PRIMARY KEY,
  ventana BIGINT NOT NULL,
  cantidad INT UNSIGNED NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticketera_historial (
  evento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id VARCHAR(20) NOT NULL,
  usuario_id INT NOT NULL,
  accion VARCHAR(16) NOT NULL,
  anterior JSON NULL,
  posterior JSON NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_historial_ticket (ticket_id, evento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ticketera_control (
  id TINYINT PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO ticketera_control (id) VALUES (1);

CREATE TABLE IF NOT EXISTS ticketera_partes (
  ticket_id VARCHAR(20) PRIMARY KEY,
  registros JSON NOT NULL,
  CONSTRAINT fk_partes_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
