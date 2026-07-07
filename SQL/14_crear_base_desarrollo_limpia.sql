/*
  SQL/14_crear_base_desarrollo_limpia.sql
  Creación de base LIMPIA para DESARROLLO — SistemaCursosDesarrollo (Azure / pruebas locales)

  ═══════════════════════════════════════════════════════════════════════════════
  PROPÓSITO
  ═══════════════════════════════════════════════════════════════════════════════
  Crear (o recrear) la base SistemaCursosDesarrollo con la misma estructura final
  que el script 13 (producción limpia), sin datos de prueba obligatorios y
  SIN la tabla legacy RecursosCurso.

  Estructura consolidada equivalente a scripts: 01, 02, 03, 04, 05, 06, 07, 09

  NO incluye ni ejecuta:
    08_asignar_admin_prueba.sql
    10_crear_recursos_curso.sql
    11_preparar_base_produccion.sql
    12_eliminar_recursos_generales.sql

  ═══════════════════════════════════════════════════════════════════════════════
  ADVERTENCIAS CRÍTICAS
  ═══════════════════════════════════════════════════════════════════════════════
  • Ejecutar en el servidor Azure SQL (o instancia) destinada a DESARROLLO/PRUEBAS.
  • NUNCA ejecutar sobre SistemaCursosProduccion.
  • NO modifica ni elimina SistemaCursosProduccion.
  • NO ejecutar automáticamente desde la aplicación Node.js.
  • Si SistemaCursosDesarrollo ya tiene tablas, el script se detiene salvo que
    cambie @ConfirmarRecreacion = 1 (ELIMINA TODOS LOS DATOS y recrea estructura).
  • No inserta usuarios @test.com; registre cuentas desde la plataforma si las necesita.

  ═══════════════════════════════════════════════════════════════════════════════
  CÓMO USAR (PASOS MANUALES — NO AUTOMÁTICOS)
  ═══════════════════════════════════════════════════════════════════════════════
  1. Conectar SSMS o Azure Data Studio al servidor SQL de desarrollo en Azure.
  2. Confirmar que NO está conectado a SistemaCursosProduccion como base activa
     para ejecutar este script (el script crea/usa SistemaCursosDesarrollo).
  3. Revisar @ConfirmarRecreacion (0 = primera vez; 1 = borrar y recrear).
  4. Ejecutar el script completo (F5).
  5. Verificar al final:
       - roles = 5
       - usuarios = 0
       - categorías = 5
       - cursos, inscripciones, certificados, intentos = 0
       - RecursosCurso NO existe
  6. En .env local (cuando corresponda), apuntar a:
       DB_DATABASE=SistemaCursosDesarrollo
       DB_SERVER=<servidor-azure>.database.windows.net
  7. Registrar usuarios de prueba manualmente desde /registro.html si los necesita.
  8. Opcional: asignar administrador con UPDATE (consulta comentada al final).

  ═══════════════════════════════════════════════════════════════════════════════
  RELACIÓN CON OTRAS BASES
  ═══════════════════════════════════════════════════════════════════════════════
  • SistemaCursos          → base local histórica (scripts 01–12); no la toca este script.
  • SistemaCursosProduccion → producción; NO TOCAR con este script.
  • SistemaCursosDesarrollo → entorno separado para pruebas sin afectar producción.
*/

/* ── 1. Crear base de datos si no existe ── */
IF DB_ID('SistemaCursosDesarrollo') IS NULL
BEGIN
    CREATE DATABASE SistemaCursosDesarrollo;
    PRINT 'Base SistemaCursosDesarrollo creada.';
END
ELSE
BEGIN
    PRINT 'La base SistemaCursosDesarrollo ya existe.';
END;
GO

USE SistemaCursosDesarrollo;
GO

SET NOCOUNT ON;
GO

/* ── 2. Protección: nunca sobre producción ── */
IF DB_NAME() = 'SistemaCursosProduccion'
BEGIN
    RAISERROR('PROHIBIDO: No ejecutar sobre SistemaCursosProduccion.', 16, 1);
    RETURN;
END;
GO

IF DB_NAME() <> 'SistemaCursosDesarrollo'
BEGIN
    RAISERROR('Este script solo debe ejecutarse en SistemaCursosDesarrollo.', 16, 1);
    RETURN;
END;
GO

/* ── 3. Confirmación para recrear base que ya tiene tablas ── */
DECLARE @ConfirmarRecreacion BIT = 0;
/*
  @ConfirmarRecreacion = 0  →  Si ya hay tablas, el script se detiene (seguro).
  @ConfirmarRecreacion = 1  →  Elimina TODAS las tablas del esquema y las recrea vacías.
*/

IF EXISTS (
    SELECT 1
    FROM sys.tables
    WHERE name IN (
        'Roles', 'Usuarios', 'Categorias', 'Cursos', 'Lecciones', 'Contenidos',
        'Inscripciones', 'ProgresoLecciones', 'Examenes', 'Preguntas',
        'IntentosExamen', 'Certificados', 'RecursosCurso'
    )
)
BEGIN
    IF @ConfirmarRecreacion = 0
    BEGIN
        RAISERROR(
            'SistemaCursosDesarrollo ya contiene tablas. Para recrear desde cero cambie @ConfirmarRecreacion = 1 (ELIMINA TODOS LOS DATOS).',
            16,
            1
        );
        RETURN;
    END;

    PRINT 'Recreación confirmada: eliminando tablas existentes...';

    IF OBJECT_ID('Certificados', 'U') IS NOT NULL DROP TABLE Certificados;
    IF OBJECT_ID('IntentosExamen', 'U') IS NOT NULL DROP TABLE IntentosExamen;
    IF OBJECT_ID('Preguntas', 'U') IS NOT NULL DROP TABLE Preguntas;
    IF OBJECT_ID('Examenes', 'U') IS NOT NULL DROP TABLE Examenes;
    IF OBJECT_ID('ProgresoLecciones', 'U') IS NOT NULL DROP TABLE ProgresoLecciones;
    IF OBJECT_ID('Inscripciones', 'U') IS NOT NULL DROP TABLE Inscripciones;
    IF OBJECT_ID('Contenidos', 'U') IS NOT NULL DROP TABLE Contenidos;
    IF OBJECT_ID('Lecciones', 'U') IS NOT NULL DROP TABLE Lecciones;
    IF OBJECT_ID('RecursosCurso', 'U') IS NOT NULL DROP TABLE RecursosCurso;
    IF OBJECT_ID('Cursos', 'U') IS NOT NULL DROP TABLE Cursos;
    IF OBJECT_ID('Categorias', 'U') IS NOT NULL DROP TABLE Categorias;
    IF OBJECT_ID('Usuarios', 'U') IS NOT NULL DROP TABLE Usuarios;
    IF OBJECT_ID('Roles', 'U') IS NOT NULL DROP TABLE Roles;

    PRINT 'Tablas anteriores eliminadas.';
END;
GO

/* ═══════════════════════════════════════════════════════════════════════════════
   4. ESTRUCTURA FINAL (equivalente scripts 01–07 + 09, sin RecursosCurso)
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ── Roles ── */
IF OBJECT_ID('Roles', 'U') IS NULL
BEGIN
    CREATE TABLE Roles (
        id_rol      INT          NOT NULL IDENTITY(1,1),
        nombre_rol  VARCHAR(30)  NOT NULL,
        estado      BIT          NOT NULL CONSTRAINT DF_Roles_estado DEFAULT 1,

        CONSTRAINT PK_Roles PRIMARY KEY (id_rol),
        CONSTRAINT UQ_Roles_nombre_rol UNIQUE (nombre_rol)
    );
    PRINT 'Tabla Roles creada.';
END;
GO

/* ── Usuarios (vacía — sin cuentas obligatorias) ── */
IF OBJECT_ID('Usuarios', 'U') IS NULL
BEGIN
    CREATE TABLE Usuarios (
        id_usuario       INT           NOT NULL IDENTITY(1,1),
        nombres          VARCHAR(80)   NOT NULL,
        apellidos        VARCHAR(80)   NOT NULL,
        correo           VARCHAR(120)  NOT NULL,
        contrasena_hash  VARCHAR(255)  NOT NULL,
        id_rol           INT           NOT NULL,
        fecha_registro   DATETIME      NOT NULL CONSTRAINT DF_Usuarios_fecha_registro DEFAULT GETDATE(),
        estado           BIT           NOT NULL CONSTRAINT DF_Usuarios_estado DEFAULT 1,

        CONSTRAINT PK_Usuarios PRIMARY KEY (id_usuario),
        CONSTRAINT UQ_Usuarios_correo UNIQUE (correo),
        CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (id_rol) REFERENCES Roles (id_rol)
    );

    CREATE INDEX IX_Usuarios_id_rol ON Usuarios (id_rol);

    PRINT 'Tabla Usuarios creada (sin datos semilla).';
END;
GO

/* ── Categorias ── */
IF OBJECT_ID('Categorias', 'U') IS NULL
BEGIN
    CREATE TABLE Categorias (
        id_categoria     INT           NOT NULL IDENTITY(1,1),
        nombre_categoria VARCHAR(80)   NOT NULL,
        descripcion      VARCHAR(255)  NULL,
        estado           BIT           NOT NULL CONSTRAINT DF_Categorias_estado DEFAULT 1,

        CONSTRAINT PK_Categorias PRIMARY KEY (id_categoria),
        CONSTRAINT UQ_Categorias_nombre_categoria UNIQUE (nombre_categoria)
    );
    PRINT 'Tabla Categorias creada.';
END;
GO

/* ── Cursos ── */
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
        CONSTRAINT FK_Cursos_Usuarios FOREIGN KEY (id_instructor) REFERENCES Usuarios (id_usuario),
        CONSTRAINT FK_Cursos_Categorias FOREIGN KEY (id_categoria) REFERENCES Categorias (id_categoria)
    );

    CREATE INDEX IX_Cursos_id_instructor ON Cursos (id_instructor);
    CREATE INDEX IX_Cursos_estado ON Cursos (estado);
    CREATE INDEX IX_Cursos_id_categoria ON Cursos (id_categoria);

    PRINT 'Tabla Cursos creada.';
END;
GO

/* ── Lecciones ── */
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
        CONSTRAINT FK_Lecciones_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos (id_curso),
        CONSTRAINT UQ_Lecciones_id_curso_orden UNIQUE (id_curso, orden)
    );

    CREATE INDEX IX_Lecciones_id_curso ON Lecciones (id_curso);

    PRINT 'Tabla Lecciones creada.';
END;
GO

/* ── Contenidos (incluye columnas del script 03) ── */
IF OBJECT_ID('Contenidos', 'U') IS NULL
BEGIN
    CREATE TABLE Contenidos (
        id_contenido        INT           NOT NULL IDENTITY(1,1),
        id_leccion          INT           NOT NULL,
        titulo              VARCHAR(120)  NULL,
        tipo_contenido      VARCHAR(30)   NOT NULL,
        url_contenido       VARCHAR(500)  NULL,
        texto_contenido     VARCHAR(MAX)  NULL,
        orden               INT           NOT NULL CONSTRAINT DF_Contenidos_orden DEFAULT 1,
        duracion_minutos    INT           NULL,
        origen_contenido    VARCHAR(20)   NULL CONSTRAINT DF_Contenidos_origen_contenido DEFAULT 'url',
        nombre_archivo      VARCHAR(255)  NULL,
        tamano_bytes        BIGINT        NULL,
        mime_type           VARCHAR(100)  NULL,
        estado              BIT           NOT NULL CONSTRAINT DF_Contenidos_estado DEFAULT 1,
        fecha_creacion      DATETIME      NOT NULL CONSTRAINT DF_Contenidos_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion DATETIME      NULL,

        CONSTRAINT PK_Contenidos PRIMARY KEY (id_contenido),
        CONSTRAINT FK_Contenidos_Lecciones FOREIGN KEY (id_leccion) REFERENCES Lecciones (id_leccion),
        CONSTRAINT UQ_Contenidos_id_leccion_orden UNIQUE (id_leccion, orden),
        CONSTRAINT CK_Contenidos_tipo_contenido CHECK (tipo_contenido IN ('video', 'texto', 'documento', 'enlace')),
        CONSTRAINT CK_Contenidos_origen_contenido CHECK (origen_contenido IN ('url', 'archivo'))
    );

    CREATE INDEX IX_Contenidos_id_leccion ON Contenidos (id_leccion);

    PRINT 'Tabla Contenidos creada.';
END;
GO

/* ── Inscripciones (incluye columnas encuesta del script 09) ── */
IF OBJECT_ID('Inscripciones', 'U') IS NULL
BEGIN
    CREATE TABLE Inscripciones (
        id_inscripcion              INT      NOT NULL IDENTITY(1,1),
        id_usuario                  INT      NOT NULL,
        id_curso                    INT      NOT NULL,
        fecha_inscripcion           DATETIME NOT NULL CONSTRAINT DF_Inscripciones_fecha_inscripcion DEFAULT GETDATE(),
        estado                      BIT      NOT NULL CONSTRAINT DF_Inscripciones_estado DEFAULT 1,
        encuesta_completada         BIT      NOT NULL CONSTRAINT DF_Inscripciones_encuesta_completada DEFAULT 0,
        fecha_encuesta_completada   DATETIME NULL,

        CONSTRAINT PK_Inscripciones PRIMARY KEY (id_inscripcion),
        CONSTRAINT FK_Inscripciones_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios (id_usuario),
        CONSTRAINT FK_Inscripciones_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos (id_curso),
        CONSTRAINT UQ_Inscripciones_Usuario_Curso UNIQUE (id_usuario, id_curso)
    );

    CREATE INDEX IX_Inscripciones_id_usuario ON Inscripciones (id_usuario);
    CREATE INDEX IX_Inscripciones_id_curso ON Inscripciones (id_curso);

    PRINT 'Tabla Inscripciones creada.';
END;
GO

/* ── ProgresoLecciones ── */
IF OBJECT_ID('ProgresoLecciones', 'U') IS NULL
BEGIN
    CREATE TABLE ProgresoLecciones (
        id_progreso      INT      NOT NULL IDENTITY(1,1),
        id_inscripcion   INT      NOT NULL,
        id_leccion       INT      NOT NULL,
        completada       BIT      NOT NULL CONSTRAINT DF_ProgresoLecciones_completada DEFAULT 0,
        fecha_completada DATETIME NULL,

        CONSTRAINT PK_ProgresoLecciones PRIMARY KEY (id_progreso),
        CONSTRAINT FK_ProgresoLecciones_Inscripciones FOREIGN KEY (id_inscripcion) REFERENCES Inscripciones (id_inscripcion),
        CONSTRAINT FK_ProgresoLecciones_Lecciones FOREIGN KEY (id_leccion) REFERENCES Lecciones (id_leccion),
        CONSTRAINT UQ_Progreso_Ins_Lecc UNIQUE (id_inscripcion, id_leccion)
    );

    CREATE INDEX IX_ProgresoLecciones_id_inscripcion ON ProgresoLecciones (id_inscripcion);
    CREATE INDEX IX_ProgresoLecciones_id_leccion ON ProgresoLecciones (id_leccion);

    PRINT 'Tabla ProgresoLecciones creada.';
END;
GO

/* ── Examenes ── */
IF OBJECT_ID('Examenes', 'U') IS NULL
BEGIN
    CREATE TABLE Examenes (
        id_examen             INT          NOT NULL IDENTITY(1,1),
        id_curso              INT          NOT NULL,
        porcentaje_aprobacion INT          NOT NULL CONSTRAINT DF_Examenes_porcentaje_aprobacion DEFAULT 70,
        instrucciones         VARCHAR(500) NULL,
        estado                BIT          NOT NULL CONSTRAINT DF_Examenes_estado DEFAULT 1,
        fecha_creacion        DATETIME     NOT NULL CONSTRAINT DF_Examenes_fecha_creacion DEFAULT GETDATE(),
        fecha_actualizacion   DATETIME     NULL,

        CONSTRAINT PK_Examenes PRIMARY KEY (id_examen),
        CONSTRAINT FK_Examenes_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos (id_curso),
        CONSTRAINT UQ_Examenes_id_curso UNIQUE (id_curso),
        CONSTRAINT CK_Examenes_porcentaje CHECK (porcentaje_aprobacion BETWEEN 0 AND 100)
    );

    PRINT 'Tabla Examenes creada.';
END;
GO

/* ── Preguntas ── */
IF OBJECT_ID('Preguntas', 'U') IS NULL
BEGIN
    CREATE TABLE Preguntas (
        id_pregunta        INT           NOT NULL IDENTITY(1,1),
        id_examen          INT           NOT NULL,
        enunciado          VARCHAR(500)  NOT NULL,
        opcion_a           VARCHAR(255)  NOT NULL,
        opcion_b           VARCHAR(255)  NOT NULL,
        opcion_c           VARCHAR(255)  NOT NULL,
        opcion_d           VARCHAR(255)  NOT NULL,
        respuesta_correcta CHAR(1)       NOT NULL,
        orden              INT           NOT NULL CONSTRAINT DF_Preguntas_orden DEFAULT 1,
        estado             BIT           NOT NULL CONSTRAINT DF_Preguntas_estado DEFAULT 1,

        CONSTRAINT PK_Preguntas PRIMARY KEY (id_pregunta),
        CONSTRAINT FK_Preguntas_Examenes FOREIGN KEY (id_examen) REFERENCES Examenes (id_examen),
        CONSTRAINT CK_Preguntas_respuesta CHECK (respuesta_correcta IN ('A', 'B', 'C', 'D')),
        CONSTRAINT UQ_Preguntas_Examen_Orden UNIQUE (id_examen, orden)
    );

    CREATE INDEX IX_Preguntas_id_examen ON Preguntas (id_examen);

    PRINT 'Tabla Preguntas creada.';
END;
GO

/* ── IntentosExamen ── */
IF OBJECT_ID('IntentosExamen', 'U') IS NULL
BEGIN
    CREATE TABLE IntentosExamen (
        id_intento   INT           NOT NULL IDENTITY(1,1),
        id_examen    INT           NOT NULL,
        id_usuario   INT           NOT NULL,
        puntaje      DECIMAL(5,2)  NULL,
        aprobado     BIT           NULL,
        fecha_inicio DATETIME      NOT NULL CONSTRAINT DF_IntentosExamen_fecha_inicio DEFAULT GETDATE(),
        fecha_fin    DATETIME      NULL,

        CONSTRAINT PK_IntentosExamen PRIMARY KEY (id_intento),
        CONSTRAINT FK_IntentosExamen_Examenes FOREIGN KEY (id_examen) REFERENCES Examenes (id_examen),
        CONSTRAINT FK_IntentosExamen_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios (id_usuario)
    );

    CREATE INDEX IX_IntentosExamen_id_examen ON IntentosExamen (id_examen);
    CREATE INDEX IX_IntentosExamen_id_usuario ON IntentosExamen (id_usuario);

    PRINT 'Tabla IntentosExamen creada.';
END;
GO

/* ── Certificados ── */
IF OBJECT_ID('Certificados', 'U') IS NULL
BEGIN
    CREATE TABLE Certificados (
        id_certificado   INT           NOT NULL IDENTITY(1,1),
        id_usuario       INT           NOT NULL,
        id_curso         INT           NOT NULL,
        id_intento       INT           NOT NULL,
        codigo           VARCHAR(36)   NOT NULL,
        puntaje_obtenido DECIMAL(5,2)  NOT NULL,
        fecha_emision    DATETIME      NOT NULL CONSTRAINT DF_Certificados_fecha_emision DEFAULT GETDATE(),

        CONSTRAINT PK_Certificados PRIMARY KEY (id_certificado),
        CONSTRAINT FK_Certificados_Usuarios FOREIGN KEY (id_usuario) REFERENCES Usuarios (id_usuario),
        CONSTRAINT FK_Certificados_Cursos FOREIGN KEY (id_curso) REFERENCES Cursos (id_curso),
        CONSTRAINT FK_Certificados_Intentos FOREIGN KEY (id_intento) REFERENCES IntentosExamen (id_intento),
        CONSTRAINT UQ_Certificados_codigo UNIQUE (codigo),
        CONSTRAINT UQ_Certificados_Usuario_Curso UNIQUE (id_usuario, id_curso)
    );

    CREATE INDEX IX_Certificados_id_usuario ON Certificados (id_usuario);
    CREATE INDEX IX_Certificados_id_curso ON Certificados (id_curso);

    PRINT 'Tabla Certificados creada.';
END;
GO

/* ═══════════════════════════════════════════════════════════════════════════════
   5. DATOS SEMILLA (solo roles y categorías base)
   ═══════════════════════════════════════════════════════════════════════════════ */

INSERT INTO Roles (nombre_rol, estado)
SELECT v.nombre_rol, 1
FROM (VALUES
    ('estudiante'),
    ('instructor'),
    ('usuario'),
    ('estudiante_itq'),
    ('administrador')
) AS v(nombre_rol)
WHERE NOT EXISTS (
    SELECT 1 FROM Roles r WHERE r.nombre_rol = v.nombre_rol
);
PRINT 'Roles semilla verificados/insertados.';
GO

INSERT INTO Categorias (nombre_categoria, descripcion)
SELECT v.nombre_categoria, v.descripcion
FROM (VALUES
    (N'Informática',       N'Cursos de tecnología e informática general'),
    (N'Ofimática',         N'Herramientas de productividad y suites ofimáticas'),
    (N'Programación',      N'Lógica, desarrollo de software y lenguajes'),
    (N'Mantenimiento',     N'Mantenimiento de equipos y sistemas'),
    (N'Seguridad digital', N'Ciberseguridad, privacidad y buenas prácticas digitales')
) AS v(nombre_categoria, descripcion)
WHERE NOT EXISTS (
    SELECT 1 FROM Categorias c WHERE c.nombre_categoria = v.nombre_categoria
);
PRINT 'Categorias base verificadas/insertadas.';
GO

/*
  NO se insertan usuarios de prueba obligatorios.
  Registre cuentas manualmente desde la plataforma cuando las necesite.

  Opcional — asignar administrador a un usuario ya registrado:

  UPDATE u
  SET u.id_rol = r.id_rol
  FROM Usuarios u
  INNER JOIN Roles r ON r.nombre_rol = 'administrador'
  WHERE u.correo = 'tu.correo@itq.edu.ec';
*/

/* ═══════════════════════════════════════════════════════════════════════════════
   6. VERIFICACIÓN FINAL
   ═══════════════════════════════════════════════════════════════════════════════ */

PRINT '';
PRINT '=== VERIFICACION SistemaCursosDesarrollo ===';
PRINT 'Base actual: ' + DB_NAME();
GO

SELECT COUNT(*) AS total_roles FROM Roles;
SELECT COUNT(*) AS total_usuarios FROM Usuarios;
SELECT COUNT(*) AS total_categorias FROM Categorias;
SELECT COUNT(*) AS total_cursos FROM Cursos;
SELECT COUNT(*) AS total_inscripciones FROM Inscripciones;
SELECT COUNT(*) AS total_certificados FROM Certificados;
SELECT COUNT(*) AS total_intentos FROM IntentosExamen;
GO

SELECT
    CASE
        WHEN OBJECT_ID('RecursosCurso', 'U') IS NULL THEN 'OK — RecursosCurso NO existe'
        ELSE 'ERROR — RecursosCurso aun existe (no deberia en desarrollo limpio)'
    END AS estado_recursos_curso;
GO

SELECT id_rol, nombre_rol, estado FROM Roles ORDER BY id_rol;
SELECT id_categoria, nombre_categoria, estado FROM Categorias ORDER BY id_categoria;
GO

PRINT 'Script 14 finalizado. Revise que total_usuarios = 0 y RecursosCurso no exista.';
GO
