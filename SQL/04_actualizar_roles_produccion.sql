/*
  SQL/04_actualizar_roles_produccion.sql
  Evolución incremental del modelo de roles para producción ITQ.

  - No modifica SQL/01, SQL/02 ni SQL/03.
  - No elimina roles existentes.
  - No migra usuarios automáticamente.
  - El rol "estudiante" permanece como legacy compatible.
*/

USE SistemaCursos;
GO

IF NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'usuario')
BEGIN
    INSERT INTO Roles (nombre_rol, estado) VALUES ('usuario', 1);
    PRINT 'Rol usuario creado.';
END
ELSE
BEGIN
    PRINT 'Rol usuario ya existe.';
END
GO

IF NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'estudiante_itq')
BEGIN
    INSERT INTO Roles (nombre_rol, estado) VALUES ('estudiante_itq', 1);
    PRINT 'Rol estudiante_itq creado.';
END
ELSE
BEGIN
    PRINT 'Rol estudiante_itq ya existe.';
END
GO

IF NOT EXISTS (SELECT 1 FROM Roles WHERE nombre_rol = 'administrador')
BEGIN
    INSERT INTO Roles (nombre_rol, estado) VALUES ('administrador', 1);
    PRINT 'Rol administrador creado.';
END
ELSE
BEGIN
    PRINT 'Rol administrador ya existe.';
END
GO

/*
  Roles legacy y operativos esperados:
  - estudiante      (legacy, no eliminar)
  - instructor      (docente ITQ)
  - usuario         (registro público externo)
  - estudiante_itq  (asignación futura institucional)
  - administrador   (gestión futura)

  Migración opcional MANUAL (no ejecutar automáticamente):
  UPDATE u
  SET u.id_rol = rNuevo.id_rol
  FROM Usuarios u
  INNER JOIN Roles rLegacy ON u.id_rol = rLegacy.id_rol
  INNER JOIN Roles rNuevo ON rNuevo.nombre_rol = 'usuario'
  WHERE rLegacy.nombre_rol = 'estudiante';
*/

SELECT id_rol, nombre_rol, estado
FROM Roles
ORDER BY id_rol;
GO
