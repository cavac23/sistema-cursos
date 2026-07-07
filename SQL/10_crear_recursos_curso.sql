-- Script 10: Recursos generales del curso (materiales a nivel curso, no por lección)
-- Ejecutar después de SQL/09_encuesta_satisfaccion.sql

USE SistemaCursos;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'RecursosCurso'
)
BEGIN
    CREATE TABLE RecursosCurso (
        id_recurso_curso INT IDENTITY(1,1) PRIMARY KEY,
        id_curso INT NOT NULL,
        titulo VARCHAR(150) NOT NULL,
        descripcion VARCHAR(255) NULL,
        tipo VARCHAR(50) NULL,
        url_recurso VARCHAR(500) NULL,
        archivo_ruta VARCHAR(500) NULL,
        fecha_creacion DATETIME NOT NULL CONSTRAINT DF_RecursosCurso_fecha_creacion DEFAULT GETDATE(),
        estado BIT NOT NULL CONSTRAINT DF_RecursosCurso_estado DEFAULT 1,
        CONSTRAINT FK_RecursosCurso_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos(id_curso)
    );

    CREATE INDEX IX_RecursosCurso_id_curso ON RecursosCurso(id_curso);

    PRINT 'Tabla RecursosCurso creada.';
END
ELSE
BEGIN
    PRINT 'La tabla RecursosCurso ya existe.';
END
GO
