/*
  SQL/11_preparar_base_produccion.sql
  Preparación de datos para PRODUCCIÓN — limpieza de datos transaccionales y usuarios @test.com

  ═══════════════════════════════════════════════════════════════════════════════
  ADVERTENCIA CRÍTICA
  ═══════════════════════════════════════════════════════════════════════════════
  • Ejecutar ÚNICAMENTE sobre la base: SistemaCursosProduccion
  • NUNCA ejecutar sobre SistemaCursos (desarrollo)
  • Este script ELIMINA datos. No ejecutar sin respaldo (.bak) reciente.
  • No modifica estructura (sin DROP TABLE, sin ALTER, sin DROP COLUMN).

  ═══════════════════════════════════════════════════════════════════════════════
  FLUJO RECOMENDADO ANTES DEL HOSTING
  ═══════════════════════════════════════════════════════════════════════════════
  1. Crear respaldo .bak de SistemaCursos (desarrollo) — ya existente.
  2. Restaurar el .bak como nueva base SistemaCursosProduccion
     (RESTORE DATABASE ... WITH MOVE ... o copia desde SSMS).
  3. Verificar que scripts 01–10 ya están aplicados en SistemaCursosProduccion.
  4. Revisar cursos/lecciones/recursos reales que deben conservarse.
  5. Si instructor@test.com (u otro @test.com) es dueño de cursos reales,
     reasignar esos cursos a un instructor real ANTES de ejecutar este script
     (ver sección comentada más abajo).
  6. Si aún necesita validación final con cuentas @test.com, cambiar
     @EliminarUsuariosPrueba = 0 antes de ejecutar.
  7. Ejecutar este script en SSMS conectado a SistemaCursosProduccion.
  8. Revisar las consultas de verificación al final.
  9. Crear usuarios reales (registro web + asignación de rol admin por SQL si aplica).
  10. Actualizar .env del hosting con DB_DATABASE=SistemaCursosProduccion.

  ═══════════════════════════════════════════════════════════════════════════════
  ANÁLISIS DE ESTRUCTURA (scripts 01–10)
  ═══════════════════════════════════════════════════════════════════════════════
  Orden de creación:
    01 → Roles, Usuarios (semilla: estudiante, instructor)
    02 → Categorias, Cursos, Lecciones, Contenidos (+ categorías semilla)
    03 → Columnas de subida en Contenidos
    04 → Roles: usuario, estudiante_itq, administrador
    05 → Inscripciones
    06 → ProgresoLecciones
    07 → Examenes, Preguntas, IntentosExamen, Certificados
    08 → Asigna rol administrador a admin@test.com (solo desarrollo)
    09 → encuesta_completada, fecha_encuesta_completada en Inscripciones
    10 → RecursosCurso

  Tablas transaccionales (se limpian aquí):
    Certificados → IntentosExamen → ProgresoLecciones → Inscripciones

  Tablas académicas (se conservan):
    Roles, Categorias, Cursos, Lecciones, Contenidos, RecursosCurso, Examenes, Preguntas

  Usuarios de prueba documentados en README:
    admin@test.com, instructor@test.com, estudiante@test.com
*/

USE SistemaCursosProduccion;
GO

SET NOCOUNT ON;
GO

/* ── Protección: solo base de producción ── */
IF DB_NAME() <> 'SistemaCursosProduccion'
BEGIN
    RAISERROR('Este script solo debe ejecutarse en SistemaCursosProduccion.', 16, 1);
    RETURN;
END;
GO

IF DB_NAME() = 'SistemaCursos'
BEGIN
    RAISERROR('PROHIBIDO: No ejecutar sobre SistemaCursos (desarrollo).', 16, 1);
    RETURN;
END;
GO

/* ── Configuración del operador (cambiar aquí antes de ejecutar) ── */
DECLARE @EliminarUsuariosPrueba BIT = 1;
/*
  @EliminarUsuariosPrueba = 0  →  Conserva cuentas @test.com (validación final pre-hosting).
  @EliminarUsuariosPrueba = 1  →  Elimina cuentas @test.com (producción real).

  ADVERTENCIA: Si aún está validando la plataforma con admin@test.com,
  instructor@test.com o estudiante@test.com, deje @EliminarUsuariosPrueba = 0
  hasta terminar esas pruebas.
*/

PRINT '=== SQL/11 — Preparación base de producción ===';
PRINT 'Base actual: ' + DB_NAME();
PRINT '@EliminarUsuariosPrueba = ' + CAST(@EliminarUsuariosPrueba AS VARCHAR(1));

/* ── Verificación de tablas requeridas ── */
IF OBJECT_ID('Inscripciones', 'U') IS NULL
   OR OBJECT_ID('ProgresoLecciones', 'U') IS NULL
   OR OBJECT_ID('Certificados', 'U') IS NULL
   OR OBJECT_ID('IntentosExamen', 'U') IS NULL
BEGIN
    RAISERROR('Faltan tablas del Módulo 3/4. Ejecute scripts 05–07 antes de continuar.', 16, 1);
    RETURN;
END;

PRINT '';
PRINT '--- Estado ANTES de la limpieza ---';

SELECT r.nombre_rol, COUNT(*) AS total_usuarios
FROM Usuarios u
INNER JOIN Roles r ON r.id_rol = u.id_rol
GROUP BY r.nombre_rol
ORDER BY r.nombre_rol;

SELECT
    (SELECT COUNT(*) FROM Inscripciones) AS inscripciones,
    (SELECT COUNT(*) FROM ProgresoLecciones) AS progresos,
    (SELECT COUNT(*) FROM IntentosExamen) AS intentos_examen,
    (SELECT COUNT(*) FROM Certificados) AS certificados,
    (SELECT COUNT(*) FROM Inscripciones WHERE encuesta_completada = 1) AS encuestas_completadas;

SELECT
    (SELECT COUNT(*) FROM Cursos WHERE estado = 1) AS cursos_activos,
    (SELECT COUNT(*) FROM Lecciones WHERE estado = 1) AS lecciones_activas,
    (SELECT COUNT(*) FROM RecursosCurso WHERE estado = 1) AS recursos_generales_activos,
    (SELECT COUNT(*) FROM Examenes WHERE estado = 1) AS examenes_activos,
    (SELECT COUNT(*) FROM Preguntas WHERE estado = 1) AS preguntas_activas;

IF EXISTS (
    SELECT 1
    FROM Cursos c
    INNER JOIN Usuarios u ON u.id_usuario = c.id_instructor
    WHERE u.correo LIKE '%@test.com'
)
BEGIN
    PRINT '';
    PRINT '*** ATENCIÓN: Hay cursos cuyo instructor tiene correo @test.com ***';
    SELECT c.id_curso, c.titulo, u.correo AS instructor_correo
    FROM Cursos c
    INNER JOIN Usuarios u ON u.id_usuario = c.id_instructor
    WHERE u.correo LIKE '%@test.com'
    ORDER BY c.id_curso;

    PRINT 'Reasigne esos cursos a un instructor real antes de eliminar usuarios @test.com.';
    PRINT 'Ejemplo: UPDATE Cursos SET id_instructor = <id_real> WHERE id_instructor = <id_prueba>;';
END;

BEGIN TRANSACTION PrepararProduccion;
BEGIN TRY

    PRINT '';
    PRINT '--- Limpiando datos transaccionales ---';

    DELETE FROM Certificados;
    PRINT 'Certificados eliminados: ' + CAST(@@ROWCOUNT AS VARCHAR(20));

    DELETE FROM IntentosExamen;
    PRINT 'IntentosExamen eliminados: ' + CAST(@@ROWCOUNT AS VARCHAR(20));

    DELETE FROM ProgresoLecciones;
    PRINT 'ProgresoLecciones eliminados: ' + CAST(@@ROWCOUNT AS VARCHAR(20));

    DELETE FROM Inscripciones;
    PRINT 'Inscripciones eliminadas (incluye encuestas): ' + CAST(@@ROWCOUNT AS VARCHAR(20));

    IF NOT EXISTS (SELECT 1 FROM Certificados)
        DBCC CHECKIDENT ('Certificados', RESEED, 0);

    IF NOT EXISTS (SELECT 1 FROM IntentosExamen)
        DBCC CHECKIDENT ('IntentosExamen', RESEED, 0);

    IF NOT EXISTS (SELECT 1 FROM ProgresoLecciones)
        DBCC CHECKIDENT ('ProgresoLecciones', RESEED, 0);

    IF NOT EXISTS (SELECT 1 FROM Inscripciones)
        DBCC CHECKIDENT ('Inscripciones', RESEED, 0);

    PRINT 'Identidades reiniciadas en tablas transaccionales.';

    IF @EliminarUsuariosPrueba = 1
    BEGIN
        IF EXISTS (
            SELECT 1
            FROM Cursos c
            INNER JOIN Usuarios u ON u.id_usuario = c.id_instructor
            WHERE u.correo LIKE '%@test.com'
        )
        BEGIN
            RAISERROR(
                'No se pueden eliminar usuarios @test.com: aún hay cursos asignados a instructores de prueba. Reasigne esos cursos primero.',
                16,
                1
            );
        END;

        DELETE u
        FROM Usuarios u
        WHERE u.correo IN (
            'admin@test.com',
            'instructor@test.com',
            'estudiante@test.com'
        )
           OR u.correo LIKE '%@test.com';

        PRINT 'Usuarios @test.com eliminados: ' + CAST(@@ROWCOUNT AS VARCHAR(20));
    END
    ELSE
    BEGIN
        PRINT 'Usuarios @test.com CONSERVADOS (@EliminarUsuariosPrueba = 0).';
        PRINT 'Recuerde: en producción real no deben quedar cuentas @test.com.';
    END;

    COMMIT TRANSACTION PrepararProduccion;
    PRINT '';
    PRINT '=== Limpieza completada correctamente ===';

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION PrepararProduccion;

    DECLARE @ErrorMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR('Error en SQL/11 — operación revertida: %s', 16, 1, @ErrorMsg);
END CATCH;
GO

/* ═══════════════════════════════════════════════════════════════════════════════
   USUARIOS REALES — CREAR MANUALMENTE SI NO EXISTEN
   ═══════════════════════════════════════════════════════════════════════════════
   1. Instructor ITQ: registrarse en /registro.html con correo @itq.edu.ec
   2. Administrador: registrarse como usuario y luego ejecutar (ajustar correo):

      UPDATE u SET u.id_rol = r.id_rol
      FROM Usuarios u
      INNER JOIN Roles r ON r.nombre_rol = 'administrador'
      WHERE u.correo = 'admin.real@itq.edu.ec';

   3. Estudiantes reales: se registran en /registro.html como "Usuario registrado"
   ═══════════════════════════════════════════════════════════════════════════════ */

PRINT '';
PRINT '--- VERIFICACIÓN FINAL (resultado esperado en producción) ---';
PRINT 'Esperado: inscripciones=0, certificados=0, encuestas=0, progreso=0';
PRINT 'Esperado: cursos/lecciones/recursos/exámenes reales conservados';
PRINT 'Esperado: sin usuarios @test.com (si @EliminarUsuariosPrueba = 1)';
PRINT '';

SELECT r.nombre_rol, COUNT(*) AS total_usuarios
FROM Usuarios u
INNER JOIN Roles r ON r.id_rol = u.id_rol
GROUP BY r.nombre_rol
ORDER BY r.nombre_rol;

SELECT COUNT(*) AS cursos_activos FROM Cursos WHERE estado = 1;
SELECT COUNT(*) AS lecciones_activas FROM Lecciones WHERE estado = 1;
SELECT COUNT(*) AS recursos_generales_activos FROM RecursosCurso WHERE estado = 1;

SELECT
    (SELECT COUNT(*) FROM Inscripciones) AS total_inscripciones,
    (SELECT COUNT(*) FROM ProgresoLecciones) AS total_progresos,
    (SELECT COUNT(*) FROM IntentosExamen) AS total_intentos_examen,
    (SELECT COUNT(*) FROM Certificados) AS total_certificados,
    (SELECT COUNT(*) FROM Inscripciones WHERE encuesta_completada = 1) AS total_encuestas_completadas;

SELECT COUNT(*) AS usuarios_test_restantes
FROM Usuarios
WHERE correo LIKE '%@test.com';

SELECT TOP 20
    u.correo,
    r.nombre_rol,
    u.fecha_registro
FROM Usuarios u
INNER JOIN Roles r ON r.id_rol = u.id_rol
ORDER BY u.fecha_registro DESC;
GO
