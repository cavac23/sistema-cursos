-- Script 12: Eliminar tabla RecursosCurso (funcionalidad retirada del proyecto)
-- Ejecutar manualmente solo cuando se confirme que ya no se necesitan los datos.
-- Ejecutar después de SQL/11_preparar_base_produccion.sql (si aplica).
-- NO ejecutar automáticamente desde la aplicación.

USE SistemaCursos;
GO

IF EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'RecursosCurso'
)
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_RecursosCurso_Cursos'
    )
    BEGIN
        ALTER TABLE RecursosCurso DROP CONSTRAINT FK_RecursosCurso_Cursos;
        PRINT 'Restricción FK_RecursosCurso_Cursos eliminada.';
    END

    IF EXISTS (
        SELECT 1 FROM sys.indexes WHERE name = 'IX_RecursosCurso_id_curso' AND object_id = OBJECT_ID('RecursosCurso')
    )
    BEGIN
        DROP INDEX IX_RecursosCurso_id_curso ON RecursosCurso;
        PRINT 'Índice IX_RecursosCurso_id_curso eliminado.';
    END

    DROP TABLE RecursosCurso;
    PRINT 'Tabla RecursosCurso eliminada.';
END
ELSE
BEGIN
    PRINT 'La tabla RecursosCurso no existe; no hay nada que eliminar.';
END
GO
