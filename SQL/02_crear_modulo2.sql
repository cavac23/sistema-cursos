/*
  Módulo 2: Categorias, Cursos, Lecciones y Contenidos
  Base de datos: SistemaCursos
  Archivo propuesto: SQL/02_crear_modulo2.sql

  Requisito previo: ejecutar SQL/01_crear_base_modulo1.sql

  Referencias verificadas al Módulo 1:
    - Roles.id_rol
    - Usuarios.id_usuario

  Comportamiento colaborativo:
    - NO usa DROP TABLE
    - Crea tablas solo si no existen
    - Si una tabla ya existe, muestra mensaje informativo
    - NO modifica ni elimina datos existentes
    - Categorías semilla: inserta solo si no existen
*/

USE SistemaCursos;
GO

/* ============================================================
   1. Verificación de tablas del Módulo 1
   ============================================================ */
IF OBJECT_ID('Usuarios', 'U') IS NULL OR OBJECT_ID('Roles', 'U') IS NULL
BEGIN
    RAISERROR(
        'Ejecute primero SQL/01_crear_base_modulo1.sql. Faltan las tablas Roles y/o Usuarios.',
        16,
        1
    );
    RETURN;
END;
GO

/* ============================================================
   2. Categorias
   ============================================================ */
IF OBJECT_ID('Categorias', 'U') IS NULL
BEGIN
    CREATE TABLE Categorias (
        id_categoria      INT           NOT NULL IDENTITY(1,1),
        nombre_categoria  VARCHAR(80)   NOT NULL,
        descripcion       VARCHAR(255)  NULL,
        estado            BIT           NOT NULL CONSTRAINT DF_Categorias_estado DEFAULT 1,

        CONSTRAINT PK_Categorias PRIMARY KEY (id_categoria),
        CONSTRAINT UQ_Categorias_nombre_categoria UNIQUE (nombre_categoria)
    );

    PRINT 'Tabla Categorias creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Categorias ya existe. No se realizaron cambios.';
END;
GO

/* ============================================================
   3. Cursos
   ============================================================ */
IF OBJECT_ID('Cursos', 'U') IS NULL
BEGIN
    CREATE TABLE Cursos (
        id_curso            INT           NOT NULL IDENTITY(1,1),
        titulo              VARCHAR(120)  NOT NULL,
        descripcion         VARCHAR(MAX)  NOT NULL,
        id_instructor       INT           NOT NULL,
        id_categoria        INT           NULL,
        url_video           VARCHAR(255)  NULL,
        imagen_portada      VARCHAR(255)  NULL,
        fecha_creacion      DATETIME      NOT NULL CONSTRAINT DF_Cursos_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion DATETIME      NULL,
        estado              BIT           NOT NULL CONSTRAINT DF_Cursos_estado DEFAULT 1,

        CONSTRAINT PK_Cursos PRIMARY KEY (id_curso),

        CONSTRAINT FK_Cursos_Usuarios
            FOREIGN KEY (id_instructor)
            REFERENCES Usuarios (id_usuario),

        CONSTRAINT FK_Cursos_Categorias
            FOREIGN KEY (id_categoria)
            REFERENCES Categorias (id_categoria)
    );

    PRINT 'Tabla Cursos creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Cursos ya existe. No se realizaron cambios.';
END;
GO

/* ============================================================
   4. Lecciones
   ============================================================ */
IF OBJECT_ID('Lecciones', 'U') IS NULL
BEGIN
    CREATE TABLE Lecciones (
        id_leccion          INT           NOT NULL IDENTITY(1,1),
        id_curso            INT           NOT NULL,
        titulo              VARCHAR(120)  NOT NULL,
        descripcion         VARCHAR(500)  NULL,
        orden               INT           NOT NULL,
        duracion_minutos    INT           NULL,
        estado              BIT           NOT NULL CONSTRAINT DF_Lecciones_estado DEFAULT 1,
        fecha_creacion      DATETIME      NOT NULL CONSTRAINT DF_Lecciones_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion DATETIME      NULL,

        CONSTRAINT PK_Lecciones PRIMARY KEY (id_leccion),

        CONSTRAINT FK_Lecciones_Cursos
            FOREIGN KEY (id_curso)
            REFERENCES Cursos (id_curso),

        CONSTRAINT UQ_Lecciones_id_curso_orden
            UNIQUE (id_curso, orden)
    );

    PRINT 'Tabla Lecciones creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Lecciones ya existe. No se realizaron cambios.';
END;
GO

/* ============================================================
   5. Contenidos
   ============================================================ */
IF OBJECT_ID('Contenidos', 'U') IS NULL
BEGIN
    CREATE TABLE Contenidos (
        id_contenido        INT           NOT NULL IDENTITY(1,1),
        id_leccion          INT           NOT NULL,
        titulo              VARCHAR(120)  NULL,
        tipo_contenido      VARCHAR(30)   NOT NULL,
        url_contenido       VARCHAR(255)  NULL,
        texto_contenido     VARCHAR(MAX)  NULL,
        orden               INT           NOT NULL CONSTRAINT DF_Contenidos_orden DEFAULT 1,
        duracion_minutos    INT           NULL,
        estado              BIT           NOT NULL CONSTRAINT DF_Contenidos_estado DEFAULT 1,
        fecha_creacion      DATETIME      NOT NULL CONSTRAINT DF_Contenidos_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion DATETIME      NULL,

        CONSTRAINT PK_Contenidos PRIMARY KEY (id_contenido),

        CONSTRAINT FK_Contenidos_Lecciones
            FOREIGN KEY (id_leccion)
            REFERENCES Lecciones (id_leccion),

        CONSTRAINT UQ_Contenidos_id_leccion_orden
            UNIQUE (id_leccion, orden),

        CONSTRAINT CK_Contenidos_tipo_contenido
            CHECK (tipo_contenido IN ('video', 'texto', 'documento', 'enlace'))
    );

    PRINT 'Tabla Contenidos creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Contenidos ya existe. No se realizaron cambios.';
END;
GO

/* ============================================================
   6. Índices recomendados (solo si no existen)
   ============================================================ */
IF OBJECT_ID('Cursos', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Cursos_id_instructor'
      AND object_id = OBJECT_ID('Cursos')
)
BEGIN
    CREATE INDEX IX_Cursos_id_instructor ON Cursos (id_instructor);
    PRINT 'Indice IX_Cursos_id_instructor creado correctamente.';
END;
GO

IF OBJECT_ID('Cursos', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Cursos_estado'
      AND object_id = OBJECT_ID('Cursos')
)
BEGIN
    CREATE INDEX IX_Cursos_estado ON Cursos (estado);
    PRINT 'Indice IX_Cursos_estado creado correctamente.';
END;
GO

IF OBJECT_ID('Cursos', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Cursos_id_categoria'
      AND object_id = OBJECT_ID('Cursos')
)
BEGIN
    CREATE INDEX IX_Cursos_id_categoria ON Cursos (id_categoria);
    PRINT 'Indice IX_Cursos_id_categoria creado correctamente.';
END;
GO

IF OBJECT_ID('Lecciones', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Lecciones_id_curso'
      AND object_id = OBJECT_ID('Lecciones')
)
BEGIN
    CREATE INDEX IX_Lecciones_id_curso ON Lecciones (id_curso);
    PRINT 'Indice IX_Lecciones_id_curso creado correctamente.';
END;
GO

IF OBJECT_ID('Contenidos', 'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_Contenidos_id_leccion'
      AND object_id = OBJECT_ID('Contenidos')
)
BEGIN
    CREATE INDEX IX_Contenidos_id_leccion ON Contenidos (id_leccion);
    PRINT 'Indice IX_Contenidos_id_leccion creado correctamente.';
END;
GO

/* ============================================================
   7. Categorías semilla (sin duplicar)
   ============================================================ */
IF OBJECT_ID('Categorias', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM Categorias
        WHERE nombre_categoria = 'Programacion'
    )
    BEGIN
        INSERT INTO Categorias (nombre_categoria, descripcion)
        VALUES (
            'Programacion',
            'Cursos de logica y desarrollo de software'
        );
        PRINT 'Categoria semilla insertada: Programacion.';
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM Categorias
        WHERE nombre_categoria = 'Bases de datos'
    )
    BEGIN
        INSERT INTO Categorias (nombre_categoria, descripcion)
        VALUES (
            'Bases de datos',
            'Diseno, consultas y administracion de bases de datos'
        );
        PRINT 'Categoria semilla insertada: Bases de datos.';
    END;

    IF NOT EXISTS (
        SELECT 1
        FROM Categorias
        WHERE nombre_categoria = 'Desarrollo web'
    )
    BEGIN
        INSERT INTO Categorias (nombre_categoria, descripcion)
        VALUES (
            'Desarrollo web',
            'HTML, CSS, JavaScript y tecnologias web'
        );
        PRINT 'Categoria semilla insertada: Desarrollo web.';
    END;
END;
GO

/* ============================================================
   8. Verificación (solo lectura)
   ============================================================ */
SELECT * FROM Categorias;
SELECT * FROM Cursos;
SELECT * FROM Lecciones;
SELECT * FROM Contenidos;
GO