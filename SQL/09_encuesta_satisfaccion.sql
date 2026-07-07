-- Módulo 3: Encuesta de satisfacción por inscripción
-- Ejecutar después de los scripts 01-08

USE SistemaCursos;
GO

SELECT DB_NAME() AS BaseActual;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Inscripciones' AND COLUMN_NAME = 'encuesta_completada'
)
BEGIN
    ALTER TABLE Inscripciones
    ADD encuesta_completada BIT NOT NULL CONSTRAINT DF_Inscripciones_encuesta_completada DEFAULT 0;
    PRINT 'Columna encuesta_completada agregada a Inscripciones.';
END
ELSE
BEGIN
    PRINT 'La columna encuesta_completada ya existe en Inscripciones.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Inscripciones' AND COLUMN_NAME = 'fecha_encuesta_completada'
)
BEGIN
    ALTER TABLE Inscripciones
    ADD fecha_encuesta_completada DATETIME NULL;
    PRINT 'Columna fecha_encuesta_completada agregada a Inscripciones.';
END
ELSE
BEGIN
    PRINT 'La columna fecha_encuesta_completada ya existe en Inscripciones.';
END
