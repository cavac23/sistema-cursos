/*
  Módulo 2+: subida local de contenidos (videos y documentos)
  Base de datos: SistemaCursos
  Archivo: SQL/03_agregar_subida_contenidos.sql

  Requisito previo: ejecutar SQL/01_crear_base_modulo1.sql y SQL/02_crear_modulo2.sql

  Comportamiento:
    - Solo ALTER TABLE (sin DROP)
    - No modifica datos existentes
    - Idempotente: verifica columnas antes de crearlas
*/

USE SistemaCursos;
GO

IF OBJECT_ID('Contenidos', 'U') IS NULL
BEGIN
    RAISERROR(
        'La tabla Contenidos no existe. Ejecute primero SQL/02_crear_modulo2.sql.',
        16,
        1
    );
    RETURN;
END;
GO

/* Ampliar url_contenido para rutas locales más largas */
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('Contenidos')
      AND name = 'url_contenido'
)
BEGIN
    ALTER TABLE Contenidos ALTER COLUMN url_contenido VARCHAR(500) NULL;
    PRINT 'Columna url_contenido ampliada a VARCHAR(500).';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('Contenidos')
      AND name = 'origen_contenido'
)
BEGIN
    ALTER TABLE Contenidos
    ADD origen_contenido VARCHAR(20) NULL
        CONSTRAINT DF_Contenidos_origen_contenido DEFAULT 'url';

    PRINT 'Columna origen_contenido creada.';
END
ELSE
BEGIN
    PRINT 'La columna origen_contenido ya existe.';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_Contenidos_origen_contenido'
      AND parent_object_id = OBJECT_ID('Contenidos')
)
BEGIN
    ALTER TABLE Contenidos
    ADD CONSTRAINT CK_Contenidos_origen_contenido
        CHECK (origen_contenido IN ('url', 'archivo'));

    PRINT 'Constraint CK_Contenidos_origen_contenido creada.';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('Contenidos')
      AND name = 'nombre_archivo'
)
BEGIN
    ALTER TABLE Contenidos ADD nombre_archivo VARCHAR(255) NULL;
    PRINT 'Columna nombre_archivo creada.';
END
ELSE
BEGIN
    PRINT 'La columna nombre_archivo ya existe.';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('Contenidos')
      AND name = 'tamano_bytes'
)
BEGIN
    ALTER TABLE Contenidos ADD tamano_bytes BIGINT NULL;
    PRINT 'Columna tamano_bytes creada.';
END
ELSE
BEGIN
    PRINT 'La columna tamano_bytes ya existe.';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('Contenidos')
      AND name = 'mime_type'
)
BEGIN
    ALTER TABLE Contenidos ADD mime_type VARCHAR(100) NULL;
    PRINT 'Columna mime_type creada.';
END
ELSE
BEGIN
    PRINT 'La columna mime_type ya existe.';
END;
GO

SELECT TOP 5
    id_contenido,
    titulo,
    tipo_contenido,
    url_contenido,
    origen_contenido,
    nombre_archivo,
    tamano_bytes,
    mime_type
FROM Contenidos
ORDER BY id_contenido;
GO
