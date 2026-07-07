-- Módulo 4: Exámenes y Certificación
-- Ejecutar después de 06_crear_modulo3_progreso.sql

-- 1. Exámenes (uno por curso)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Examenes')
BEGIN
    CREATE TABLE Examenes (
        id_examen            INT IDENTITY(1,1) NOT NULL,
        id_curso             INT NOT NULL,
        porcentaje_aprobacion INT NOT NULL CONSTRAINT DF_Examenes_porcentaje_aprobacion DEFAULT 70,
        instrucciones        VARCHAR(500) NULL,
        estado               BIT NOT NULL CONSTRAINT DF_Examenes_estado DEFAULT 1,
        fecha_creacion       DATETIME NOT NULL CONSTRAINT DF_Examenes_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion  DATETIME NULL,
        CONSTRAINT PK_Examenes PRIMARY KEY (id_examen),
        CONSTRAINT FK_Examenes_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso),
        CONSTRAINT UQ_Examenes_id_curso UNIQUE (id_curso),
        CONSTRAINT CK_Examenes_porcentaje CHECK (porcentaje_aprobacion BETWEEN 0 AND 100)
    );
    PRINT 'Tabla Examenes creada.';
END

-- 2. Preguntas del examen
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Preguntas')
BEGIN
    CREATE TABLE Preguntas (
        id_pregunta        INT IDENTITY(1,1) NOT NULL,
        id_examen          INT NOT NULL,
        enunciado          VARCHAR(500) NOT NULL,
        opcion_a           VARCHAR(255) NOT NULL,
        opcion_b           VARCHAR(255) NOT NULL,
        opcion_c           VARCHAR(255) NOT NULL,
        opcion_d           VARCHAR(255) NOT NULL,
        respuesta_correcta CHAR(1) NOT NULL,
        orden              INT NOT NULL CONSTRAINT DF_Preguntas_orden DEFAULT 1,
        estado             BIT NOT NULL CONSTRAINT DF_Preguntas_estado DEFAULT 1,
        CONSTRAINT PK_Preguntas PRIMARY KEY (id_pregunta),
        CONSTRAINT FK_Preguntas_Examenes FOREIGN KEY (id_examen) REFERENCES Examenes(id_examen),
        CONSTRAINT CK_Preguntas_respuesta CHECK (respuesta_correcta IN ('A','B','C','D')),
        CONSTRAINT UQ_Preguntas_Examen_Orden UNIQUE (id_examen, orden)
    );
    PRINT 'Tabla Preguntas creada.';
END

-- 3. Intentos de examen
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'IntentosExamen')
BEGIN
    CREATE TABLE IntentosExamen (
        id_intento   INT IDENTITY(1,1) NOT NULL,
        id_examen    INT NOT NULL,
        id_usuario   INT NOT NULL,
        puntaje      DECIMAL(5,2) NULL,
        aprobado     BIT NULL,
        fecha_inicio DATETIME NOT NULL CONSTRAINT DF_IntentosExamen_fecha_inicio DEFAULT GETDATE(),
        fecha_fin    DATETIME NULL,
        CONSTRAINT PK_IntentosExamen PRIMARY KEY (id_intento),
        CONSTRAINT FK_IntentosExamen_Examenes FOREIGN KEY (id_examen) REFERENCES Examenes(id_examen),
        CONSTRAINT FK_IntentosExamen_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario)
    );
    PRINT 'Tabla IntentosExamen creada.';
END

-- 4. Certificados
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Certificados')
BEGIN
    CREATE TABLE Certificados (
        id_certificado   INT IDENTITY(1,1) NOT NULL,
        id_usuario       INT NOT NULL,
        id_curso         INT NOT NULL,
        id_intento       INT NOT NULL,
        codigo           VARCHAR(36) NOT NULL,
        puntaje_obtenido DECIMAL(5,2) NOT NULL,
        fecha_emision    DATETIME NOT NULL CONSTRAINT DF_Certificados_fecha_emision DEFAULT GETDATE(),
        CONSTRAINT PK_Certificados PRIMARY KEY (id_certificado),
        CONSTRAINT FK_Certificados_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),
        CONSTRAINT FK_Certificados_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso),
        CONSTRAINT FK_Certificados_Intentos FOREIGN KEY (id_intento) REFERENCES IntentosExamen(id_intento),
        CONSTRAINT UQ_Certificados_codigo UNIQUE (codigo),
        CONSTRAINT UQ_Certificados_Usuario_Curso UNIQUE (id_usuario, id_curso)
    );
    PRINT 'Tabla Certificados creada.';
END
