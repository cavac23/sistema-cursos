IF DB_ID('SistemaCursos') IS NULL
BEGIN
    CREATE DATABASE SistemaCursos;
END;
GO

USE SistemaCursos;
GO

IF OBJECT_ID('Usuarios', 'U') IS NOT NULL
    DROP TABLE Usuarios;
GO

IF OBJECT_ID('Roles', 'U') IS NOT NULL
    DROP TABLE Roles;
GO

CREATE TABLE Roles (
    id_rol INT PRIMARY KEY IDENTITY(1,1),
    nombre_rol VARCHAR(30) NOT NULL UNIQUE,
    estado BIT DEFAULT 1
);
GO

CREATE TABLE Usuarios (
    id_usuario INT PRIMARY KEY IDENTITY(1,1),
    nombres VARCHAR(80) NOT NULL,
    apellidos VARCHAR(80) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    contrasena_hash VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    fecha_registro DATETIME DEFAULT GETDATE(),
    estado BIT DEFAULT 1,
    CONSTRAINT FK_Usuarios_Roles FOREIGN KEY (id_rol) REFERENCES Roles(id_rol)
);
GO

INSERT INTO Roles(nombre_rol) VALUES
('estudiante'),
('instructor');
GO

SELECT * FROM Roles;
SELECT * FROM Usuarios;
GO
