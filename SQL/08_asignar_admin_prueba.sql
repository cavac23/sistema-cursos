-- Usuario administrador de prueba (opcional)
-- Ejecutar en SistemaCursos después de los scripts 01-07.
-- NO borra usuarios ni modifica contraseñas existentes.

USE SistemaCursos;
GO

-- ============================================================
-- Opción recomendada
-- ============================================================
-- 1. Registrar admin@test.com en /registro.html como "Usuario registrado"
--    con contraseña Test1234
-- 2. Ejecutar solo el UPDATE siguiente para asignar rol administrador:

IF EXISTS (SELECT 1 FROM Usuarios WHERE correo = 'admin@test.com' AND estado = 1)
BEGIN
    UPDATE u
    SET u.id_rol = r.id_rol
    FROM Usuarios u
    INNER JOIN Roles r ON r.nombre_rol = 'administrador' AND r.estado = 1
    WHERE u.correo = 'admin@test.com'
      AND u.estado = 1
      AND u.id_rol <> r.id_rol;

    IF @@ROWCOUNT > 0
        PRINT 'Usuario admin@test.com actualizado a rol administrador.';
    ELSE
        PRINT 'Usuario admin@test.com ya tiene rol administrador o no requiere cambio.';
END
ELSE
BEGIN
    PRINT 'No existe admin@test.com. Regístrelo primero en la aplicación con contraseña Test1234.';
END
GO

-- Verificación
SELECT u.correo, r.nombre_rol
FROM Usuarios u
INNER JOIN Roles r ON u.id_rol = r.id_rol
WHERE u.correo = 'admin@test.com';
GO
