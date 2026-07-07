-- Módulo 3: Progreso de lecciones por estudiante
-- Ejecutar después de 05_crear_modulo3.sql

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProgresoLecciones')
BEGIN
    CREATE TABLE ProgresoLecciones (
        id_progreso        INT IDENTITY(1,1) NOT NULL,
        id_inscripcion     INT NOT NULL,
        id_leccion         INT NOT NULL,
        completada         BIT NOT NULL CONSTRAINT DF_ProgresoLecciones_completada DEFAULT 0,
        fecha_completada   DATETIME NULL,
        CONSTRAINT PK_ProgresoLecciones PRIMARY KEY (id_progreso),
        CONSTRAINT FK_ProgresoLecciones_Inscripciones FOREIGN KEY (id_inscripcion) REFERENCES Inscripciones(id_inscripcion),
        CONSTRAINT FK_ProgresoLecciones_Lecciones FOREIGN KEY (id_leccion) REFERENCES Lecciones(id_leccion),
        CONSTRAINT UQ_Progreso_Ins_Lecc UNIQUE (id_inscripcion, id_leccion)
    );
    PRINT 'Tabla ProgresoLecciones creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla ProgresoLecciones ya existe.';
END
