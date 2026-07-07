-- Módulo 3: Inscripciones de estudiantes a cursos
-- Ejecutar después de los scripts 01-04

-- Tabla de inscripciones
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Inscripciones')
BEGIN
    CREATE TABLE Inscripciones (
        id_inscripcion   INT IDENTITY(1,1) NOT NULL,
        id_usuario       INT NOT NULL,
        id_curso         INT NOT NULL,
        fecha_inscripcion DATETIME NOT NULL CONSTRAINT DF_Inscripciones_fecha_inscripcion DEFAULT GETDATE(),
        estado           BIT NOT NULL CONSTRAINT DF_Inscripciones_estado DEFAULT 1,
        CONSTRAINT PK_Inscripciones PRIMARY KEY (id_inscripcion),
        CONSTRAINT FK_Inscripciones_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios(id_usuario),
        CONSTRAINT FK_Inscripciones_Cursos   FOREIGN KEY (id_curso)   REFERENCES Cursos(id_curso),
        CONSTRAINT UQ_Inscripciones_Usuario_Curso UNIQUE (id_usuario, id_curso)
    );
    PRINT 'Tabla Inscripciones creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Inscripciones ya existe.';
END






