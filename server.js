require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const {
  UPLOAD_DIR,
  eliminarArchivoSubido
} = require('./middleware/uploadContenido');
const {
  uploadPortada,
  rutaRelativaPortada,
  eliminarPortadaSubida
} = require('./middleware/uploadPortada');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

app.use(session({
  secret: process.env.SESSION_SECRET || 'cambia_esta_clave_en_el_env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60
  }
}));

const usarConexionWindows = (process.env.DB_TRUSTED_CONNECTION || 'false').toLowerCase() === 'true';
const dbServer = process.env.DB_SERVER || 'localhost';
const dbDatabase = process.env.DB_DATABASE || 'SistemaCursos';

function cargarDriverSql() {
  if (usarConexionWindows) {
    if (process.platform !== 'win32') {
      throw new Error(
        'Autenticacion Windows (DB_TRUSTED_CONNECTION=true) solo esta disponible en Windows. ' +
        'Use DB_TRUSTED_CONNECTION=false con DB_USER y DB_PASSWORD.'
      );
    }

    try {
      return require('mssql/msnodesqlv8');
    } catch (error) {
      throw new Error(
        'Para autenticacion Windows instale msnodesqlv8 (npm install msnodesqlv8). ' +
        `Detalle: ${error.message}`
      );
    }
  }

  return require('mssql');
}

function parseDbServer(valor) {
  const [server, instanceName] = valor.split('\\');
  return {
    server: server.trim(),
    instanceName: instanceName ? instanceName.trim() : undefined
  };
}

function buildWindowsConnectionString(server, instanceName, database) {
  const driver = process.env.DB_ODBC_DRIVER || 'ODBC Driver 17 for SQL Server';
  const serverPart = instanceName ? `${server}\\${instanceName}` : server;

  return [
    `Driver={${driver}}`,
    `Server=${serverPart}`,
    `Database=${database}`,
    'Trusted_Connection=Yes',
    'TrustServerCertificate=Yes',
    'Encrypt=No'
  ].join(';');
}

function buildDbConfig() {
  const { server, instanceName } = parseDbServer(dbServer);

  const pool = {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  };

  if (usarConexionWindows) {
    const config = {
      server,
      database: dbDatabase,
      connectionString: buildWindowsConnectionString(server, instanceName, dbDatabase),
      options: {
        trustedConnection: true,
        trustServerCertificate: true,
        encrypt: false
      },
      pool
    };

    if (instanceName) {
      config.options.instanceName = instanceName;
    }

    return config;
  }

  const config = {
    server,
    database: dbDatabase,
    options: {
      encrypt: true,
      trustServerCertificate: true
    },
    pool
  };

  if (instanceName) {
    config.options.instanceName = instanceName;
  }

  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;

  if (!config.user || !config.password) {
    throw new Error(
      'Faltan credenciales de SQL Server. Configure DB_USER y DB_PASSWORD en el archivo .env ' +
      'o use DB_TRUSTED_CONNECTION=true para autenticacion de Windows.'
    );
  }

  return config;
}

const sql = cargarDriverSql();
const dbConfig = buildDbConfig();

function mensajeError(error) {
  if (!error) return 'Error desconocido';
  if (typeof error.message === 'string' && error.message !== '[object Object]') {
    return error.message;
  }
  if (error.originalError?.message) return error.originalError.message;
  if (error.info?.message) return error.info.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

let poolPromise = null;

async function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(dbConfig).catch((error) => {
      poolPromise = null;
      throw error;
    });
  }
  return poolPromise;
}

function validarTexto(valor) {
  return valor && valor.toString().trim().length > 0;
}

const DOMINIO_INSTRUCTOR_ITQ = '@itq.edu.ec';

const ROLES_REGISTRO_PUBLICO = ['usuario', 'instructor'];
const ROLES_LEGACY_REGISTRO = ['estudiante'];
const ROLES_REPORTES = ['instructor', 'administrador'];

function esCorreoInstructorITQ(correo) {
  if (!validarTexto(correo)) return false;
  return correo.trim().toLowerCase().endsWith(DOMINIO_INSTRUCTOR_ITQ);
}

function validarCorreo(correo) {
  if (!validarTexto(correo)) {
    return null;
  }
  const normalizado = correo.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return null;
  }
  return normalizado;
}

function validarContrasena(contrasena) {
  return typeof contrasena === 'string' && contrasena.length >= 8;
}

function esRolRegistroPublico(rol) {
  return ROLES_REGISTRO_PUBLICO.includes(rol) || ROLES_LEGACY_REGISTRO.includes(rol);
}

function requiereSesion(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
  }
  next();
}

function requiereRolAdministrador(req, res, next) {
  if (!req.session.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
  }
  if (req.session.usuario.rol !== 'administrador') {
    return res.status(403).json({ ok: false, mensaje: 'No tiene permisos de administrador.' });
  }
  next();
}

function requiereRol(rol) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
    }
    if (req.session.usuario.rol !== rol) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para esta acción.' });
    }
    next();
  };
}

function parsearId(parametro, nombre) {
  const id = parseInt(parametro, 10);
  if (Number.isNaN(id) || id < 1) {
    return { error: { status: 400, mensaje: `Identificador de ${nombre} no válido.` } };
  }
  return { id };
}

function validarEnteroPositivo(valor, nombre) {
  const numero = parseInt(valor, 10);
  if (Number.isNaN(numero) || numero < 1) {
    return { error: { status: 400, mensaje: `${nombre} debe ser un entero mayor o igual a 1.` } };
  }
  return { numero };
}

function manejarErrorMulter(error, res) {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        mensaje: 'El archivo supera el tamano maximo permitido.'
      });
    }

    return res.status(400).json({
      ok: false,
      mensaje: 'Error al procesar la subida del archivo.'
    });
  }

  return res.status(400).json({
    ok: false,
    mensaje: error.message || 'Error al subir el archivo.'
  });
}

async function usuarioTieneEncuestaGlobalCompletada(pool, idUsuario) {
  const result = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .query(`
      SELECT CAST(CASE WHEN EXISTS (
        SELECT 1
        FROM Inscripciones
        WHERE id_usuario = @idUsuario
          AND encuesta_completada = 1
          AND estado = 1
      ) THEN 1 ELSE 0 END AS BIT) AS encuesta_global_completada
    `);

  return !!result.recordset[0]?.encuesta_global_completada;
}

const ROLES_ACCESO_CONTENIDO_CURSO = [
  'usuario',
  'estudiante',
  'estudiante_itq',
  'instructor',
  'administrador'
];

async function usuarioTieneAccesoContenidoCurso(pool, usuario, idCurso) {
  if (!usuario || !ROLES_ACCESO_CONTENIDO_CURSO.includes(usuario.rol)) {
    return false;
  }

  if (usuario.rol === 'administrador' || usuario.rol === 'instructor') {
    return true;
  }

  const inscripcion = await pool.request()
    .input('idUsuario', sql.Int, usuario.id_usuario)
    .input('idCurso', sql.Int, idCurso)
    .query(`
      SELECT id_inscripcion
      FROM Inscripciones
      WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
    `);

  return inscripcion.recordset.length > 0;
}

async function cursoPerteneceInstructor(pool, idCurso, idInstructor) {
  const result = await pool.request()
    .input('idCurso', sql.Int, idCurso)
    .input('idInstructor', sql.Int, idInstructor)
    .query(`
      SELECT id_curso
      FROM Cursos
      WHERE id_curso = @idCurso AND id_instructor = @idInstructor
    `);

  return result.recordset.length > 0;
}

async function obtenerLeccionConCurso(pool, idLeccion) {
  const result = await pool.request()
    .input('idLeccion', sql.Int, idLeccion)
    .query(`
      SELECT l.id_leccion, l.id_curso, l.estado AS leccion_estado,
             c.estado AS curso_estado, c.id_instructor
      FROM Lecciones l
      INNER JOIN Cursos c ON l.id_curso = c.id_curso
      WHERE l.id_leccion = @idLeccion
    `);

  return result.recordset[0] || null;
}

app.post('/api/registro', async (req, res) => {
  try {
    let { nombres, apellidos, correo, contrasena, rol } = req.body;

    if (![nombres, apellidos, correo, contrasena, rol].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Todos los campos son obligatorios.' });
    }

    rol = rol.trim().toLowerCase();

    if (!rol) {
      rol = 'usuario';
    }

    if (!esRolRegistroPublico(rol)) {
      return res.status(400).json({ ok: false, mensaje: 'Rol no válido para registro público.' });
    }

    const correoValidado = validarCorreo(correo);
    if (!correoValidado) {
      return res.status(400).json({ ok: false, mensaje: 'Ingrese un correo electrónico válido.' });
    }

    if (!validarContrasena(contrasena)) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    if (rol === 'instructor' && !esCorreoInstructorITQ(correoValidado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Solo los miembros del ITQ pueden registrarse como instructores.'
      });
    }

    correo = correoValidado;

    const pool = await getPool();

    const rolResult = await pool.request()
      .input('nombreRol', sql.VarChar(30), rol)
      .query('SELECT id_rol FROM Roles WHERE nombre_rol = @nombreRol AND estado = 1');

    if (rolResult.recordset.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El rol no existe en la base de datos.' });
    }

    const existe = await pool.request()
      .input('correo', sql.VarChar(120), correo)
      .query('SELECT id_usuario FROM Usuarios WHERE correo = @correo');

    if (existe.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'El correo ya está registrado.' });
    }

    const hash = await bcrypt.hash(contrasena, 10);

    await pool.request()
      .input('nombres', sql.VarChar(80), nombres.trim())
      .input('apellidos', sql.VarChar(80), apellidos.trim())
      .input('correo', sql.VarChar(120), correo)
      .input('hash', sql.VarChar(255), hash)
      .input('idRol', sql.Int, rolResult.recordset[0].id_rol)
      .query(`
        INSERT INTO Usuarios (nombres, apellidos, correo, contrasena_hash, id_rol)
        VALUES (@nombres, @apellidos, @correo, @hash, @idRol)
      `);

    res.json({ ok: true, mensaje: 'Usuario registrado correctamente.' });
  } catch (error) {
    console.error('Error en registro:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error en registro.', detalle: mensajeError(error) });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    if (![correo, contrasena].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Ingrese correo y contraseña.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('correo', sql.VarChar(120), correo.trim().toLowerCase())
      .query(`
        SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, u.contrasena_hash,
               r.nombre_rol AS rol, u.fecha_registro
        FROM Usuarios u
        INNER JOIN Roles r ON u.id_rol = r.id_rol
        WHERE u.correo = @correo AND u.estado = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    const usuario = result.recordset[0];
    const claveValida = await bcrypt.compare(contrasena, usuario.contrasena_hash);

    if (!claveValida) {
      return res.status(401).json({ ok: false, mensaje: 'Correo o contraseña incorrectos.' });
    }

    req.session.usuario = {
      id_usuario: usuario.id_usuario,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      correo: usuario.correo,
      rol: usuario.rol,
      fecha_registro: usuario.fecha_registro
    };

    res.json({ ok: true, mensaje: 'Inicio de sesión correcto.', usuario: req.session.usuario });
  } catch (error) {
    console.error('Error en login:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error en login.', detalle: mensajeError(error) });
  }
});

app.get('/api/perfil', requiereSesion, (req, res) => {
  res.json({ ok: true, usuario: req.session.usuario });
});

app.put('/api/perfil', requiereSesion, async (req, res) => {
  try {
    const { nombres, apellidos, correo, contrasena } = req.body;

    if (![nombres, apellidos, correo].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Nombre, apellido y correo son obligatorios.' });
    }

    const correoValidado = validarCorreo(correo);
    if (!correoValidado) {
      return res.status(400).json({ ok: false, mensaje: 'Ingrese un correo electrónico válido.' });
    }

    if (req.session.usuario.rol === 'instructor' && !esCorreoInstructorITQ(correoValidado)) {
      return res.status(400).json({
        ok: false,
        mensaje: 'Los instructores deben mantener un correo institucional @itq.edu.ec.'
      });
    }

    if (validarTexto(contrasena) && !validarContrasena(contrasena)) {
      return res.status(400).json({ ok: false, mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
    }

    const pool = await getPool();

    const correoExiste = await pool.request()
      .input('correo', sql.VarChar(120), correoValidado)
      .input('idUsuario', sql.Int, req.session.usuario.id_usuario)
      .query('SELECT id_usuario FROM Usuarios WHERE correo = @correo AND id_usuario <> @idUsuario');

    if (correoExiste.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ese correo ya está usado por otro usuario.' });
    }

    const request = pool.request()
      .input('idUsuario', sql.Int, req.session.usuario.id_usuario)
      .input('nombres', sql.VarChar(80), nombres.trim())
      .input('apellidos', sql.VarChar(80), apellidos.trim())
      .input('correo', sql.VarChar(120), correoValidado);

    if (validarTexto(contrasena)) {
      const hash = await bcrypt.hash(contrasena, 10);
      await request
        .input('hash', sql.VarChar(255), hash)
        .query(`
          UPDATE Usuarios
          SET nombres = @nombres,
              apellidos = @apellidos,
              correo = @correo,
              contrasena_hash = @hash
          WHERE id_usuario = @idUsuario
        `);
    } else {
      await request.query(`
        UPDATE Usuarios
        SET nombres = @nombres,
            apellidos = @apellidos,
            correo = @correo
        WHERE id_usuario = @idUsuario
      `);
    }

    req.session.usuario.nombres = nombres.trim();
    req.session.usuario.apellidos = apellidos.trim();
    req.session.usuario.correo = correoValidado;

    res.json({ ok: true, mensaje: 'Datos actualizados correctamente.', usuario: req.session.usuario });
  } catch (error) {
    console.error('Error al actualizar perfil:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar perfil.', detalle: mensajeError(error) });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true, mensaje: 'Sesión cerrada correctamente.' });
  });
});

app.get('/api/test-db', async (req, res) => {
  const esDesarrollo = (process.env.NODE_ENV || 'development') !== 'production';

  if (!esDesarrollo && !req.session.usuario) {
    return res.status(401).json({ ok: false, mensaje: 'Debe iniciar sesión.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Roles');

    res.json({ ok: true, roles: result.recordset });
  } catch (error) {
    console.error('Error al probar la base de datos:', mensajeError(error));
    res.status(500).json({ ok: false, error: mensajeError(error) });
  }
});

// ===== CATEGORIAS =====

app.get('/api/categorias', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id_categoria, nombre_categoria, descripcion, estado
      FROM Categorias
      WHERE estado = 1
      ORDER BY nombre_categoria
    `);

    res.json({ ok: true, categorias: result.recordset });
  } catch (error) {
    console.error('Error al listar categorías:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al listar categorías.', detalle: mensajeError(error) });
  }
});

app.get('/api/categorias/:id', async (req, res) => {
  try {
    const idCategoria = parseInt(req.params.id, 10);

    if (Number.isNaN(idCategoria)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('idCategoria', sql.Int, idCategoria)
      .query(`
        SELECT id_categoria, nombre_categoria, descripcion, estado
        FROM Categorias
        WHERE id_categoria = @idCategoria AND estado = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }

    res.json({ ok: true, categoria: result.recordset[0] });
  } catch (error) {
    console.error('Error al obtener categoría:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener categoría.', detalle: mensajeError(error) });
  }
});

app.post('/api/categorias', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    let { nombre_categoria, descripcion } = req.body;

    if (!validarTexto(nombre_categoria)) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre de la categoría es obligatorio.' });
    }

    nombre_categoria = nombre_categoria.trim();
    descripcion = validarTexto(descripcion) ? descripcion.trim() : null;

    const pool = await getPool();

    const existe = await pool.request()
      .input('nombreCategoria', sql.VarChar(80), nombre_categoria)
      .query('SELECT id_categoria FROM Categorias WHERE nombre_categoria = @nombreCategoria');

    if (existe.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre.' });
    }

    const result = await pool.request()
      .input('nombreCategoria', sql.VarChar(80), nombre_categoria)
      .input('descripcion', sql.VarChar(255), descripcion)
      .query(`
        INSERT INTO Categorias (nombre_categoria, descripcion)
        OUTPUT INSERTED.id_categoria, INSERTED.nombre_categoria, INSERTED.descripcion, INSERTED.estado
        VALUES (@nombreCategoria, @descripcion)
      `);

    res.json({
      ok: true,
      mensaje: 'Categoría creada correctamente.',
      categoria: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al crear categoría:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al crear categoría.', detalle: mensajeError(error) });
  }
});

app.put('/api/categorias/:id', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const idCategoria = parseInt(req.params.id, 10);
    let { nombre_categoria, descripcion } = req.body;

    if (Number.isNaN(idCategoria)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
    }

    if (!validarTexto(nombre_categoria)) {
      return res.status(400).json({ ok: false, mensaje: 'El nombre de la categoría es obligatorio.' });
    }

    nombre_categoria = nombre_categoria.trim();
    descripcion = validarTexto(descripcion) ? descripcion.trim() : null;

    const pool = await getPool();

    const categoriaExiste = await pool.request()
      .input('idCategoria', sql.Int, idCategoria)
      .query('SELECT id_categoria FROM Categorias WHERE id_categoria = @idCategoria AND estado = 1');

    if (categoriaExiste.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }

    const nombreDuplicado = await pool.request()
      .input('nombreCategoria', sql.VarChar(80), nombre_categoria)
      .input('idCategoria', sql.Int, idCategoria)
      .query(`
        SELECT id_categoria
        FROM Categorias
        WHERE nombre_categoria = @nombreCategoria AND id_categoria <> @idCategoria
      `);

    if (nombreDuplicado.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una categoría con ese nombre.' });
    }

    const result = await pool.request()
      .input('idCategoria', sql.Int, idCategoria)
      .input('nombreCategoria', sql.VarChar(80), nombre_categoria)
      .input('descripcion', sql.VarChar(255), descripcion)
      .query(`
        UPDATE Categorias
        SET nombre_categoria = @nombreCategoria,
            descripcion = @descripcion
        OUTPUT INSERTED.id_categoria, INSERTED.nombre_categoria, INSERTED.descripcion, INSERTED.estado
        WHERE id_categoria = @idCategoria
      `);

    res.json({
      ok: true,
      mensaje: 'Categoría actualizada correctamente.',
      categoria: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al actualizar categoría:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar categoría.', detalle: mensajeError(error) });
  }
});

app.patch('/api/categorias/:id/estado', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const idCategoria = parseInt(req.params.id, 10);
    const { estado } = req.body;

    if (Number.isNaN(idCategoria)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
    }

    if (estado !== 0 && estado !== 1) {
      return res.status(400).json({ ok: false, mensaje: 'El estado debe ser 0 o 1.' });
    }

    const pool = await getPool();

    const result = await pool.request()
      .input('idCategoria', sql.Int, idCategoria)
      .input('estado', sql.Bit, estado)
      .query(`
        UPDATE Categorias
        SET estado = @estado
        OUTPUT INSERTED.id_categoria, INSERTED.nombre_categoria, INSERTED.descripcion, INSERTED.estado
        WHERE id_categoria = @idCategoria
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Categoría no encontrada.' });
    }

    res.json({
      ok: true,
      mensaje: 'Estado de categoría actualizado correctamente.',
      categoria: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al cambiar estado de categoría:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al cambiar estado de categoría.', detalle: mensajeError(error) });
  }
});

// ===== CURSOS =====

app.get('/api/cursos', async (req, res) => {
  try {
    const idCategoria = req.query.categoria ? parseInt(req.query.categoria, 10) : null;
    const buscar = validarTexto(req.query.buscar) ? req.query.buscar.trim() : null;

    if (req.query.categoria && Number.isNaN(idCategoria)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('idCategoria', sql.Int, idCategoria)
      .input('buscar', sql.VarChar(120), buscar)
      .query(`
        SELECT c.id_curso, c.titulo, c.descripcion, c.id_categoria, c.url_video,
               c.imagen_portada, c.fecha_creacion, c.estado,
               cat.nombre_categoria,
               u.nombres + ' ' + u.apellidos AS instructor
        FROM Cursos c
        LEFT JOIN Categorias cat ON c.id_categoria = cat.id_categoria
        INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
        WHERE c.estado = 1
          AND (@idCategoria IS NULL OR c.id_categoria = @idCategoria)
          AND (@buscar IS NULL OR c.titulo LIKE '%' + @buscar + '%')
        ORDER BY c.fecha_creacion DESC
      `);

    res.json({ ok: true, cursos: result.recordset });
  } catch (error) {
    console.error('Error al listar cursos:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al listar cursos.', detalle: mensajeError(error) });
  }
});

app.get('/api/mis-cursos', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('idInstructor', sql.Int, req.session.usuario.id_usuario)
      .query(`
        SELECT c.id_curso, c.titulo, c.descripcion, c.id_categoria, c.url_video,
               c.imagen_portada, c.fecha_creacion, c.fecha_actualizacion, c.estado,
               cat.nombre_categoria
        FROM Cursos c
        LEFT JOIN Categorias cat ON c.id_categoria = cat.id_categoria
        WHERE c.id_instructor = @idInstructor
        ORDER BY c.fecha_creacion DESC
      `);

    res.json({ ok: true, cursos: result.recordset });
  } catch (error) {
    console.error('Error al listar mis cursos:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al listar mis cursos.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:id', async (req, res) => {
  try {
    const idCurso = parseInt(req.params.id, 10);

    if (Number.isNaN(idCurso)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de curso no válido.' });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .query(`
        SELECT c.id_curso, c.titulo, c.descripcion, c.id_categoria, c.id_instructor,
               c.url_video, c.imagen_portada, c.fecha_creacion, c.fecha_actualizacion, c.estado,
               cat.nombre_categoria,
               u.nombres + ' ' + u.apellidos AS instructor
        FROM Cursos c
        LEFT JOIN Categorias cat ON c.id_categoria = cat.id_categoria
        INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
        WHERE c.id_curso = @idCurso AND c.estado = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Curso no encontrado.' });
    }

    res.json({ ok: true, curso: result.recordset[0] });
  } catch (error) {
    console.error('Error al obtener curso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener curso.', detalle: mensajeError(error) });
  }
});

app.post('/api/cursos', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    let { titulo, descripcion, id_categoria, url_video, imagen_portada } = req.body;

    if (![titulo, descripcion].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Título y descripción son obligatorios.' });
    }

    titulo = titulo.trim();
    descripcion = descripcion.trim();
    url_video = validarTexto(url_video) ? url_video.trim() : null;
    imagen_portada = validarTexto(imagen_portada) ? imagen_portada.trim() : null;

    const pool = await getPool();

    if (id_categoria !== null && id_categoria !== undefined && id_categoria !== '') {
      id_categoria = parseInt(id_categoria, 10);

      if (Number.isNaN(id_categoria)) {
        return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
      }

      const categoriaValida = await pool.request()
        .input('idCategoria', sql.Int, id_categoria)
        .query('SELECT id_categoria FROM Categorias WHERE id_categoria = @idCategoria AND estado = 1');

      if (categoriaValida.recordset.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'La categoría seleccionada no existe o está inactiva.' });
      }
    } else {
      id_categoria = null;
    }

    const result = await pool.request()
      .input('titulo', sql.VarChar(120), titulo)
      .input('descripcion', sql.VarChar(sql.MAX), descripcion)
      .input('idInstructor', sql.Int, req.session.usuario.id_usuario)
      .input('idCategoria', sql.Int, id_categoria)
      .input('urlVideo', sql.VarChar(255), url_video)
      .input('imagenPortada', sql.VarChar(255), imagen_portada)
      .query(`
        INSERT INTO Cursos (titulo, descripcion, id_instructor, id_categoria, url_video, imagen_portada)
        OUTPUT INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion, INSERTED.id_instructor,
               INSERTED.id_categoria, INSERTED.url_video, INSERTED.imagen_portada,
               INSERTED.fecha_creacion, INSERTED.estado
        VALUES (@titulo, @descripcion, @idInstructor, @idCategoria, @urlVideo, @imagenPortada)
      `);

    res.json({
      ok: true,
      mensaje: 'Curso creado correctamente.',
      curso: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al crear curso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al crear curso.', detalle: mensajeError(error) });
  }
});

app.put('/api/cursos/:id', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const idCurso = parseInt(req.params.id, 10);
    let { titulo, descripcion, id_categoria, url_video, imagen_portada } = req.body;

    if (Number.isNaN(idCurso)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de curso no válido.' });
    }

    if (![titulo, descripcion].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Título y descripción son obligatorios.' });
    }

    titulo = titulo.trim();
    descripcion = descripcion.trim();
    url_video = validarTexto(url_video) ? url_video.trim() : null;
    imagen_portada = validarTexto(imagen_portada) ? imagen_portada.trim() : null;

    const pool = await getPool();

    const cursoPropio = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('idInstructor', sql.Int, req.session.usuario.id_usuario)
      .query(`
        SELECT id_curso
        FROM Cursos
        WHERE id_curso = @idCurso AND id_instructor = @idInstructor
      `);

    if (cursoPropio.recordset.length === 0) {
      return res.status(403).json({ ok: false, mensaje: 'No puede editar un curso que no le pertenece.' });
    }

    if (id_categoria !== null && id_categoria !== undefined && id_categoria !== '') {
      id_categoria = parseInt(id_categoria, 10);

      if (Number.isNaN(id_categoria)) {
        return res.status(400).json({ ok: false, mensaje: 'Identificador de categoría no válido.' });
      }

      const categoriaValida = await pool.request()
        .input('idCategoria', sql.Int, id_categoria)
        .query('SELECT id_categoria FROM Categorias WHERE id_categoria = @idCategoria AND estado = 1');

      if (categoriaValida.recordset.length === 0) {
        return res.status(400).json({ ok: false, mensaje: 'La categoría seleccionada no existe o está inactiva.' });
      }
    } else {
      id_categoria = null;
    }

    const result = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('titulo', sql.VarChar(120), titulo)
      .input('descripcion', sql.VarChar(sql.MAX), descripcion)
      .input('idCategoria', sql.Int, id_categoria)
      .input('urlVideo', sql.VarChar(255), url_video)
      .input('imagenPortada', sql.VarChar(255), imagen_portada)
      .query(`
        UPDATE Cursos
        SET titulo = @titulo,
            descripcion = @descripcion,
            id_categoria = @idCategoria,
            url_video = @urlVideo,
            imagen_portada = @imagenPortada,
            fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion, INSERTED.id_instructor,
               INSERTED.id_categoria, INSERTED.url_video, INSERTED.imagen_portada,
               INSERTED.fecha_creacion, INSERTED.fecha_actualizacion, INSERTED.estado
        WHERE id_curso = @idCurso
      `);

    res.json({
      ok: true,
      mensaje: 'Curso actualizado correctamente.',
      curso: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al actualizar curso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar curso.', detalle: mensajeError(error) });
  }
});

app.post(
  '/api/cursos/:idCurso/portada',
  requiereSesion,
  requiereRol('instructor'),
  (req, res, next) => {
    uploadPortada.single('archivo')(req, res, (error) => {
      if (error) return manejarErrorMulter(error, res);
      next();
    });
  },
  async (req, res) => {
    let rutaAbsoluta = null;

    try {
      const parsed = parsearId(req.params.idCurso, 'curso');
      if (parsed.error) {
        return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, mensaje: 'Debe adjuntar una imagen de portada.' });
      }

      rutaAbsoluta = req.file.path;
      const pool = await getPool();

      const cursoActual = await pool.request()
        .input('idCurso', sql.Int, parsed.id)
        .input('idInstructor', sql.Int, req.session.usuario.id_usuario)
        .query(`
          SELECT id_curso, imagen_portada
          FROM Cursos
          WHERE id_curso = @idCurso AND id_instructor = @idInstructor
        `);

      if (cursoActual.recordset.length === 0) {
        eliminarArchivoSubido(rutaAbsoluta);
        return res.status(403).json({ ok: false, mensaje: 'No puede modificar un curso que no le pertenece.' });
      }

      const rutaRelativa = rutaRelativaPortada(parsed.id, req.file.filename);
      const portadaAnterior = cursoActual.recordset[0].imagen_portada;

      const result = await pool.request()
        .input('idCurso', sql.Int, parsed.id)
        .input('imagenPortada', sql.VarChar(255), rutaRelativa)
        .query(`
          UPDATE Cursos
          SET imagen_portada = @imagenPortada,
              fecha_actualizacion = GETDATE()
          OUTPUT INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion, INSERTED.id_instructor,
                 INSERTED.id_categoria, INSERTED.url_video, INSERTED.imagen_portada,
                 INSERTED.fecha_creacion, INSERTED.fecha_actualizacion, INSERTED.estado
          WHERE id_curso = @idCurso
        `);

      eliminarPortadaSubida(portadaAnterior);

      res.json({
        ok: true,
        mensaje: 'Portada del curso actualizada correctamente.',
        curso: result.recordset[0],
        imagen_portada: rutaRelativa
      });
    } catch (error) {
      eliminarArchivoSubido(rutaAbsoluta);
      console.error('Error al subir portada:', mensajeError(error));
      res.status(500).json({ ok: false, mensaje: 'Error al subir portada.', detalle: mensajeError(error) });
    }
  }
);

app.patch('/api/cursos/:id/estado', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const idCurso = parseInt(req.params.id, 10);
    const { estado } = req.body;

    if (Number.isNaN(idCurso)) {
      return res.status(400).json({ ok: false, mensaje: 'Identificador de curso no válido.' });
    }

    if (estado !== 0 && estado !== 1) {
      return res.status(400).json({ ok: false, mensaje: 'El estado debe ser 0 o 1.' });
    }

    const pool = await getPool();

    const cursoPropio = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('idInstructor', sql.Int, req.session.usuario.id_usuario)
      .query(`
        SELECT id_curso
        FROM Cursos
        WHERE id_curso = @idCurso AND id_instructor = @idInstructor
      `);

    if (cursoPropio.recordset.length === 0) {
      return res.status(403).json({ ok: false, mensaje: 'No puede modificar un curso que no le pertenece.' });
    }

    const result = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('estado', sql.Bit, estado)
      .query(`
        UPDATE Cursos
        SET estado = @estado,
            fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion, INSERTED.id_instructor,
               INSERTED.id_categoria, INSERTED.url_video, INSERTED.imagen_portada,
               INSERTED.fecha_creacion, INSERTED.fecha_actualizacion, INSERTED.estado
        WHERE id_curso = @idCurso
      `);

    res.json({
      ok: true,
      mensaje: 'Estado de curso actualizado correctamente.',
      curso: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al cambiar estado de curso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al cambiar estado de curso.', detalle: mensajeError(error) });
  }
});

// ===== LECCIONES =====

const SQL_URL_RECURSO_LECCION = `
  (SELECT TOP 1 ct.url_contenido
   FROM Contenidos ct
   WHERE ct.id_leccion = l.id_leccion
     AND ct.estado = 1
     AND ct.tipo_contenido IN ('video', 'enlace')
     AND ct.origen_contenido = 'url'
   ORDER BY ct.orden ASC) AS url_recurso
`;

function inferirTipoRecursoLeccion(url) {
  const valor = url.toLowerCase();
  if (valor.includes('youtube.com') || valor.includes('youtu.be') || valor.includes('drive.google.com')) {
    return 'enlace';
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(valor)) {
    return 'video';
  }
  return 'enlace';
}

async function sincronizarRecursoPrincipalLeccion(pool, idLeccion, urlRecurso) {
  if (!validarTexto(urlRecurso)) {
    return;
  }

  const url = urlRecurso.trim();
  const tipo = inferirTipoRecursoLeccion(url);

  const existente = await pool.request()
    .input('idLeccion', sql.Int, idLeccion)
    .query(`
      SELECT TOP 1 id_contenido
      FROM Contenidos
      WHERE id_leccion = @idLeccion
        AND orden = 1
        AND tipo_contenido IN ('video', 'enlace')
        AND origen_contenido = 'url'
      ORDER BY id_contenido ASC
    `);

  if (existente.recordset.length > 0) {
    await pool.request()
      .input('idContenido', sql.Int, existente.recordset[0].id_contenido)
      .input('tipoContenido', sql.VarChar(30), tipo)
      .input('urlContenido', sql.VarChar(255), url)
      .query(`
        UPDATE Contenidos
        SET tipo_contenido = @tipoContenido,
            url_contenido = @urlContenido,
            titulo = COALESCE(NULLIF(titulo, ''), 'Recurso principal'),
            origen_contenido = 'url',
            fecha_actualizacion = GETDATE()
        WHERE id_contenido = @idContenido
      `);
    return;
  }

  await pool.request()
    .input('idLeccion', sql.Int, idLeccion)
    .input('tipoContenido', sql.VarChar(30), tipo)
    .input('urlContenido', sql.VarChar(255), url)
    .query(`
      INSERT INTO Contenidos (
        id_leccion, titulo, tipo_contenido, url_contenido, orden, origen_contenido
      )
      VALUES (@idLeccion, 'Recurso principal', @tipoContenido, @urlContenido, 1, 'url')
    `);
}

app.get('/api/cursos/:idCurso/lecciones', async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const pool = await getPool();

    const cursoActivo = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_curso FROM Cursos WHERE id_curso = @idCurso AND estado = 1');

    if (cursoActivo.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Curso no encontrado.' });
    }

    const result = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT l.id_leccion, l.id_curso, l.titulo, l.descripcion, l.orden,
               l.duracion_minutos, l.estado, l.fecha_creacion, l.fecha_actualizacion,
               ${SQL_URL_RECURSO_LECCION}
        FROM Lecciones l
        WHERE l.id_curso = @idCurso AND l.estado = 1
        ORDER BY l.orden
      `);

    res.json({ ok: true, lecciones: result.recordset });
  } catch (error) {
    console.error('Error al listar lecciones:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al listar lecciones.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/mis-lecciones', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const pool = await getPool();

    const esPropio = await cursoPerteneceInstructor(pool, parsed.id, req.session.usuario.id_usuario);
    if (!esPropio) {
      return res.status(403).json({ ok: false, mensaje: 'No puede consultar lecciones de un curso que no le pertenece.' });
    }

    const result = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT l.id_leccion, l.id_curso, l.titulo, l.descripcion, l.orden,
               l.duracion_minutos, l.estado, l.fecha_creacion, l.fecha_actualizacion,
               ${SQL_URL_RECURSO_LECCION}
        FROM Lecciones l
        WHERE l.id_curso = @idCurso
        ORDER BY l.orden
      `);

    res.json({ ok: true, lecciones: result.recordset });
  } catch (error) {
    console.error('Error al listar mis lecciones:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al listar mis lecciones.', detalle: mensajeError(error) });
  }
});

app.get('/api/lecciones/:id', async (req, res) => {
  try {
    const parsed = parsearId(req.params.id, 'lección');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const pool = await getPool();
    const result = await pool.request()
      .input('idLeccion', sql.Int, parsed.id)
      .query(`
        SELECT l.id_leccion, l.id_curso, l.titulo, l.descripcion, l.orden,
               l.duracion_minutos, l.estado, l.fecha_creacion, l.fecha_actualizacion
        FROM Lecciones l
        INNER JOIN Cursos c ON l.id_curso = c.id_curso
        WHERE l.id_leccion = @idLeccion AND l.estado = 1 AND c.estado = 1
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Lección no encontrada.' });
    }

    res.json({ ok: true, leccion: result.recordset[0] });
  } catch (error) {
    console.error('Error al obtener lección:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener lección.', detalle: mensajeError(error) });
  }
});

app.post('/api/cursos/:idCurso/lecciones', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    let { titulo, descripcion, orden, duracion_minutos, url_recurso } = req.body;

    if (!validarTexto(titulo)) {
      return res.status(400).json({ ok: false, mensaje: 'El título de la lección es obligatorio.' });
    }

    const ordenValidado = validarEnteroPositivo(orden, 'El orden');
    if (ordenValidado.error) {
      return res.status(ordenValidado.error.status).json({ ok: false, mensaje: ordenValidado.error.mensaje });
    }

    titulo = titulo.trim();
    descripcion = validarTexto(descripcion) ? descripcion.trim() : null;
    orden = ordenValidado.numero;

    if (duracion_minutos !== null && duracion_minutos !== undefined && duracion_minutos !== '') {
      const duracionValidada = validarEnteroPositivo(duracion_minutos, 'La duración en minutos');
      if (duracionValidada.error) {
        return res.status(duracionValidada.error.status).json({ ok: false, mensaje: duracionValidada.error.mensaje });
      }
      duracion_minutos = duracionValidada.numero;
    } else {
      duracion_minutos = null;
    }

    const pool = await getPool();

    const esPropio = await cursoPerteneceInstructor(pool, parsed.id, req.session.usuario.id_usuario);
    if (!esPropio) {
      return res.status(403).json({ ok: false, mensaje: 'No puede crear lecciones en un curso que no le pertenece.' });
    }

    const ordenDuplicado = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .input('orden', sql.Int, orden)
      .query(`
        SELECT id_leccion
        FROM Lecciones
        WHERE id_curso = @idCurso AND orden = @orden
      `);

    if (ordenDuplicado.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una lección con ese orden en el curso.' });
    }

    const result = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .input('titulo', sql.VarChar(120), titulo)
      .input('descripcion', sql.VarChar(500), descripcion)
      .input('orden', sql.Int, orden)
      .input('duracionMinutos', sql.Int, duracion_minutos)
      .query(`
        INSERT INTO Lecciones (id_curso, titulo, descripcion, orden, duracion_minutos)
        OUTPUT INSERTED.id_leccion, INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion,
               INSERTED.orden, INSERTED.duracion_minutos, INSERTED.estado,
               INSERTED.fecha_creacion, INSERTED.fecha_actualizacion
        VALUES (@idCurso, @titulo, @descripcion, @orden, @duracionMinutos)
      `);

    const leccionCreada = result.recordset[0];
    await sincronizarRecursoPrincipalLeccion(pool, leccionCreada.id_leccion, url_recurso);

    res.json({
      ok: true,
      mensaje: 'Lección creada correctamente.',
      leccion: leccionCreada
    });
  } catch (error) {
    console.error('Error al crear lección:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al crear lección.', detalle: mensajeError(error) });
  }
});

app.put('/api/lecciones/:id', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.id, 'lección');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    let { titulo, descripcion, orden, duracion_minutos, url_recurso } = req.body;

    if (!validarTexto(titulo)) {
      return res.status(400).json({ ok: false, mensaje: 'El título de la lección es obligatorio.' });
    }

    const ordenValidado = validarEnteroPositivo(orden, 'El orden');
    if (ordenValidado.error) {
      return res.status(ordenValidado.error.status).json({ ok: false, mensaje: ordenValidado.error.mensaje });
    }

    titulo = titulo.trim();
    descripcion = validarTexto(descripcion) ? descripcion.trim() : null;
    orden = ordenValidado.numero;

    if (duracion_minutos !== null && duracion_minutos !== undefined && duracion_minutos !== '') {
      const duracionValidada = validarEnteroPositivo(duracion_minutos, 'La duración en minutos');
      if (duracionValidada.error) {
        return res.status(duracionValidada.error.status).json({ ok: false, mensaje: duracionValidada.error.mensaje });
      }
      duracion_minutos = duracionValidada.numero;
    } else {
      duracion_minutos = null;
    }

    const pool = await getPool();
    const leccion = await obtenerLeccionConCurso(pool, parsed.id);

    if (!leccion) {
      return res.status(404).json({ ok: false, mensaje: 'Lección no encontrada.' });
    }

    if (leccion.id_instructor !== req.session.usuario.id_usuario) {
      return res.status(403).json({ ok: false, mensaje: 'No puede editar una lección de un curso que no le pertenece.' });
    }

    const ordenDuplicado = await pool.request()
      .input('idCurso', sql.Int, leccion.id_curso)
      .input('orden', sql.Int, orden)
      .input('idLeccion', sql.Int, parsed.id)
      .query(`
        SELECT id_leccion
        FROM Lecciones
        WHERE id_curso = @idCurso AND orden = @orden AND id_leccion <> @idLeccion
      `);

    if (ordenDuplicado.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una lección con ese orden en el curso.' });
    }

    const result = await pool.request()
      .input('idLeccion', sql.Int, parsed.id)
      .input('titulo', sql.VarChar(120), titulo)
      .input('descripcion', sql.VarChar(500), descripcion)
      .input('orden', sql.Int, orden)
      .input('duracionMinutos', sql.Int, duracion_minutos)
      .query(`
        UPDATE Lecciones
        SET titulo = @titulo,
            descripcion = @descripcion,
            orden = @orden,
            duracion_minutos = @duracionMinutos,
            fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_leccion, INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion,
               INSERTED.orden, INSERTED.duracion_minutos, INSERTED.estado,
               INSERTED.fecha_creacion, INSERTED.fecha_actualizacion
        WHERE id_leccion = @idLeccion
      `);

    const leccionActualizada = result.recordset[0];
    await sincronizarRecursoPrincipalLeccion(pool, parsed.id, url_recurso);

    res.json({
      ok: true,
      mensaje: 'Lección actualizada correctamente.',
      leccion: leccionActualizada
    });
  } catch (error) {
    console.error('Error al actualizar lección:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar lección.', detalle: mensajeError(error) });
  }
});

app.patch('/api/lecciones/:id/estado', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.id, 'lección');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const { estado } = req.body;

    if (estado !== 0 && estado !== 1) {
      return res.status(400).json({ ok: false, mensaje: 'El estado debe ser 0 o 1.' });
    }

    const pool = await getPool();
    const leccion = await obtenerLeccionConCurso(pool, parsed.id);

    if (!leccion) {
      return res.status(404).json({ ok: false, mensaje: 'Lección no encontrada.' });
    }

    if (leccion.id_instructor !== req.session.usuario.id_usuario) {
      return res.status(403).json({ ok: false, mensaje: 'No puede modificar una lección de un curso que no le pertenece.' });
    }

    const result = await pool.request()
      .input('idLeccion', sql.Int, parsed.id)
      .input('estado', sql.Bit, estado)
      .query(`
        UPDATE Lecciones
        SET estado = @estado,
            fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_leccion, INSERTED.id_curso, INSERTED.titulo, INSERTED.descripcion,
               INSERTED.orden, INSERTED.duracion_minutos, INSERTED.estado,
               INSERTED.fecha_creacion, INSERTED.fecha_actualizacion
        WHERE id_leccion = @idLeccion
      `);

    res.json({
      ok: true,
      mensaje: 'Estado de lección actualizado correctamente.',
      leccion: result.recordset[0]
    });
  } catch (error) {
    console.error('Error al cambiar estado de lección:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al cambiar estado de lección.', detalle: mensajeError(error) });
  }
});

// ===== M�DULO 3: INSCRIPCIONES =====

const ROLES_INSCRIPCION = ['usuario', 'estudiante', 'estudiante_itq'];

app.post('/api/inscripciones', requiereSesion, async (req, res) => {
  try {
    const rol = req.session.usuario.rol;
    if (!ROLES_INSCRIPCION.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los estudiantes pueden inscribirse a cursos.' });
    }

    const { id_curso } = req.body;
    const parsed = parsearId(id_curso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const cursoExiste = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_curso, estado FROM Cursos WHERE id_curso = @idCurso');

    if (cursoExiste.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Curso no encontrado.' });
    }

    if (!cursoExiste.recordset[0].estado) {
      return res.status(400).json({ ok: false, mensaje: 'Este curso no esta disponible para inscripcion.' });
    }

    const yaInscrito = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT id_inscripcion
        FROM Inscripciones
        WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
      `);

    if (yaInscrito.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya estas inscrito en este curso.' });
    }

    await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        INSERT INTO Inscripciones (id_usuario, id_curso)
        VALUES (@idUsuario, @idCurso)
      `);

    res.json({ ok: true, mensaje: 'Inscripcion exitosa.' });
  } catch (error) {
    console.error('Error al inscribirse:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al inscribirse.', detalle: mensajeError(error) });
  }
});

app.get('/api/mis-inscripciones', requiereSesion, async (req, res) => {
  try {
    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const result = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .query(`
        SELECT
          i.id_inscripcion,
          i.fecha_inscripcion,
          i.estado AS inscripcion_estado,
          c.id_curso,
          c.titulo,
          c.descripcion,
          c.imagen_portada,
          c.url_video,
          u.nombres + ' ' + u.apellidos AS instructor,
          cat.nombre_categoria,
          (SELECT COUNT(*) FROM Lecciones l WHERE l.id_curso = c.id_curso AND l.estado = 1) AS total_lecciones,
          (SELECT COUNT(*)
           FROM ProgresoLecciones pl
           INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
           WHERE pl.id_inscripcion = i.id_inscripcion
             AND pl.completada = 1
             AND l.id_curso = c.id_curso
             AND l.estado = 1) AS lecciones_completadas,
          CAST(CASE
            WHEN EXISTS (
              SELECT 1 FROM Examenes e
              INNER JOIN Preguntas p ON p.id_examen = e.id_examen AND p.estado = 1
              WHERE e.id_curso = c.id_curso AND e.estado = 1
            ) AND EXISTS (
              SELECT 1 FROM Certificados cert
              WHERE cert.id_usuario = @idUsuario AND cert.id_curso = c.id_curso
            ) THEN 1 ELSE 0
          END AS BIT) AS evaluacion_aprobada
        FROM Inscripciones i
        INNER JOIN Cursos c ON i.id_curso = c.id_curso
        INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
        LEFT JOIN Categorias cat ON c.id_categoria = cat.id_categoria
        WHERE i.id_usuario = @idUsuario AND i.estado = 1
        ORDER BY i.fecha_inscripcion DESC
      `);

    const inscripciones = result.recordset.map((row) => {
      const total = Number(row.total_lecciones) || 0;
      const completadas = Number(row.lecciones_completadas) || 0;
      const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
      return {
        ...row,
        total_lecciones: total,
        lecciones_completadas: completadas,
        porcentaje,
        evaluacion_aprobada: !!row.evaluacion_aprobada
      };
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.json({ ok: true, inscripciones });
  } catch (error) {
    console.error('Error al obtener inscripciones:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener inscripciones.', detalle: mensajeError(error) });
  }
});

app.get('/api/inscripciones/curso/:idCurso', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const result = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT id_inscripcion
        FROM Inscripciones
        WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
      `);

    res.json({ ok: true, inscrito: result.recordset.length > 0 });
  } catch (error) {
    console.error('Error al verificar inscripcion:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al verificar inscripcion.', detalle: mensajeError(error) });
  }
});

// ===== M�DULO 3: PROGRESO DE LECCIONES =====

app.patch('/api/lecciones/:idLeccion/progreso', requiereSesion, async (req, res) => {
  try {
    const rol = req.session.usuario.rol;
    if (!ROLES_INSCRIPCION.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los estudiantes pueden registrar progreso.' });
    }

    const parsed = parsearId(req.params.idLeccion, 'leccion');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const leccionData = await pool.request()
      .input('idLeccion', sql.Int, parsed.id)
      .query('SELECT id_curso FROM Lecciones WHERE id_leccion = @idLeccion');

    if (leccionData.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Leccion no encontrada.' });
    }

    const idCurso = leccionData.recordset[0].id_curso;

    const inscripcion = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, idCurso)
      .query(`
        SELECT id_inscripcion
        FROM Inscripciones
        WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
      `);

    if (inscripcion.recordset.length === 0) {
      return res.status(403).json({ ok: false, mensaje: 'No estas inscrito en este curso.' });
    }

    const idInscripcion = inscripcion.recordset[0].id_inscripcion;

    const progresoExistente = await pool.request()
      .input('idInscripcion', sql.Int, idInscripcion)
      .input('idLeccion', sql.Int, parsed.id)
      .query(`
        SELECT id_progreso, completada
        FROM ProgresoLecciones
        WHERE id_inscripcion = @idInscripcion AND id_leccion = @idLeccion
      `);

    let nuevaCompletada;
    if (progresoExistente.recordset.length > 0) {
      nuevaCompletada = !progresoExistente.recordset[0].completada;
      await pool.request()
        .input('idProgreso', sql.Int, progresoExistente.recordset[0].id_progreso)
        .input('completada', sql.Bit, nuevaCompletada)
        .input('fecha', sql.DateTime, nuevaCompletada ? new Date() : null)
        .query(`
          UPDATE ProgresoLecciones
          SET completada = @completada, fecha_completada = @fecha
          WHERE id_progreso = @idProgreso
        `);
    } else {
      nuevaCompletada = true;
      await pool.request()
        .input('idInscripcion', sql.Int, idInscripcion)
        .input('idLeccion', sql.Int, parsed.id)
        .input('fecha', sql.DateTime, new Date())
        .query(`
          INSERT INTO ProgresoLecciones (id_inscripcion, id_leccion, completada, fecha_completada)
          VALUES (@idInscripcion, @idLeccion, 1, @fecha)
        `);
    }

    const totalLecciones = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');

    const total = totalLecciones.recordset[0].total;
    const completadasData = await pool.request()
      .input('idInscripcion', sql.Int, idInscripcion)
      .input('idCurso', sql.Int, idCurso)
      .query(`
        SELECT COUNT(*) AS completadas
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = @idInscripcion
          AND pl.completada = 1
          AND l.id_curso = @idCurso
          AND l.estado = 1
      `);

    const completadas = completadasData.recordset[0].completadas;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    res.json({ ok: true, completada: nuevaCompletada, porcentaje, completadas, total });
  } catch (error) {
    console.error('Error al actualizar progreso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar progreso.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/progreso', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();
    const encuestaGlobalCompletada = await usuarioTieneEncuestaGlobalCompletada(pool, idUsuario);

    const inscripcion = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT
          id_inscripcion,
          CAST(ISNULL(encuesta_completada, 0) AS BIT) AS encuesta_completada,
          fecha_encuesta_completada
        FROM Inscripciones
        WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
      `);

    if (inscripcion.recordset.length === 0) {
      const totalActivas = await pool.request()
        .input('idCurso', sql.Int, parsed.id)
        .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');

      return res.json({
        ok: true,
        progreso: {
          porcentaje: 0,
          completadas: 0,
          total: totalActivas.recordset[0].total,
          lecciones: [],
          encuesta_completada: false,
          encuesta_global_completada: encuestaGlobalCompletada
        }
      });
    }

    const idInscripcion = inscripcion.recordset[0].id_inscripcion;
    const encuestaCompletada = !!inscripcion.recordset[0].encuesta_completada;
    const fechaEncuestaCompletada = inscripcion.recordset[0].fecha_encuesta_completada;

    const result = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .input('idInscripcion', sql.Int, idInscripcion)
      .query(`
        SELECT
          l.id_leccion,
          l.orden,
          l.titulo,
          CAST(ISNULL(pl.completada, 0) AS BIT) AS completada,
          pl.fecha_completada
        FROM Lecciones l
        LEFT JOIN ProgresoLecciones pl
          ON pl.id_leccion = l.id_leccion AND pl.id_inscripcion = @idInscripcion
        WHERE l.id_curso = @idCurso AND l.estado = 1
        ORDER BY l.orden
      `);

    const lecciones = result.recordset;
    const completadas = lecciones.filter((l) => l.completada).length;
    const total = lecciones.length;
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    res.json({
      ok: true,
      progreso: {
        porcentaje,
        completadas,
        total,
        lecciones,
        encuesta_completada: encuestaCompletada,
        encuesta_global_completada: encuestaGlobalCompletada,
        fecha_encuesta_completada: fechaEncuestaCompletada
      }
    });
  } catch (error) {
    console.error('Error al obtener progreso:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener progreso.', detalle: mensajeError(error) });
  }
});

app.post('/api/cursos/:idCurso/encuesta-completada', requiereSesion, async (req, res) => {
  try {
    const rol = req.session.usuario.rol;
    if (!ROLES_INSCRIPCION.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los estudiantes pueden registrar la encuesta.' });
    }

    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const inscripcion = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT id_inscripcion, CAST(ISNULL(encuesta_completada, 0) AS BIT) AS encuesta_completada
        FROM Inscripciones
        WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1
      `);

    if (inscripcion.recordset.length === 0) {
      return res.status(403).json({ ok: false, mensaje: 'No estas inscrito en este curso.' });
    }

    const encuestaGlobalCompletada = await usuarioTieneEncuestaGlobalCompletada(pool, idUsuario);
    if (encuestaGlobalCompletada) {
      return res.json({
        ok: true,
        mensaje: 'Encuesta ya registrada previamente',
        encuesta_completada: true,
        encuesta_global_completada: true
      });
    }

    const fila = inscripcion.recordset[0];

    if (fila.encuesta_completada) {
      return res.json({
        ok: true,
        mensaje: 'Encuesta ya registrada previamente',
        encuesta_completada: true,
        encuesta_global_completada: true
      });
    }

    await pool.request()
      .input('idInscripcion', sql.Int, fila.id_inscripcion)
      .query(`
        UPDATE Inscripciones
        SET encuesta_completada = 1, fecha_encuesta_completada = GETDATE()
        WHERE id_inscripcion = @idInscripcion
      `);

    res.json({
      ok: true,
      mensaje: 'Encuesta registrada correctamente.',
      encuesta_completada: true,
      encuesta_global_completada: true
    });
  } catch (error) {
    console.error('Error al registrar encuesta:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al registrar encuesta.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/estudiantes', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const idInstructor = req.session.usuario.id_usuario;
    const pool = await getPool();

    const pertenece = await cursoPerteneceInstructor(pool, parsed.id, idInstructor);
    if (!pertenece) {
      return res.status(403).json({ ok: false, mensaje: 'No puede ver los estudiantes de un curso que no le pertenece.' });
    }

    const totalActivas = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');

    const total = totalActivas.recordset[0].total;

    const estudiantes = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT
          u.id_usuario,
          u.nombres,
          u.apellidos,
          u.correo,
          i.fecha_inscripcion,
          i.id_inscripcion
        FROM Inscripciones i
        INNER JOIN Usuarios u ON i.id_usuario = u.id_usuario
        WHERE i.id_curso = @idCurso AND i.estado = 1
        ORDER BY i.fecha_inscripcion
      `);

    const resultado = await Promise.all(estudiantes.recordset.map(async (est) => {
      const progreso = await pool.request()
        .input('idInscripcion', sql.Int, est.id_inscripcion)
        .input('idCurso', sql.Int, parsed.id)
        .query(`
          SELECT COUNT(*) AS completadas
          FROM ProgresoLecciones pl
          INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
          WHERE pl.id_inscripcion = @idInscripcion
            AND pl.completada = 1
            AND l.id_curso = @idCurso
            AND l.estado = 1
        `);

      const completadas = progreso.recordset[0].completadas;
      const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

      return {
        id_usuario: est.id_usuario,
        nombres: est.nombres,
        apellidos: est.apellidos,
        correo: est.correo,
        fecha_inscripcion: est.fecha_inscripcion,
        porcentaje,
        completadas,
        total_lecciones: total
      };
    }));

    res.json({ ok: true, estudiantes: resultado });
  } catch (error) {
    console.error('Error al obtener estudiantes:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener estudiantes.', detalle: mensajeError(error) });
  }
});

// ===== M�DULO 4: EXÁMENES Y CERTIFICACI�N =====

// --- Instructor: CRUD examen ---

app.post('/api/cursos/:idCurso/examen', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idInstructor = req.session.usuario.id_usuario;
    const pool = await getPool();

    const pertenece = await cursoPerteneceInstructor(pool, parsed.id, idInstructor);
    if (!pertenece) return res.status(403).json({ ok: false, mensaje: 'Este curso no le pertenece.' });

    const existe = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen FROM Examenes WHERE id_curso = @idCurso');
    if (existe.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe un examen para este curso.' });
    }

    const { porcentaje_aprobacion, instrucciones } = req.body;
    const pct = Math.min(100, Math.max(0, parseInt(porcentaje_aprobacion) || 70));

    const result = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .input('porcentaje', sql.Int, pct)
      .input('instrucciones', sql.VarChar(500), (instrucciones || '').trim() || null)
      .query(`
        INSERT INTO Examenes (id_curso, porcentaje_aprobacion, instrucciones)
        OUTPUT INSERTED.id_examen, INSERTED.porcentaje_aprobacion, INSERTED.instrucciones, INSERTED.estado, INSERTED.fecha_creacion
        VALUES (@idCurso, @porcentaje, @instrucciones)
      `);

    res.json({ ok: true, mensaje: 'Examen creado.', examen: result.recordset[0] });
  } catch (error) {
    console.error('Error al crear examen:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al crear examen.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/examen', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idInstructor = req.session.usuario.id_usuario;
    const pool = await getPool();

    const pertenece = await cursoPerteneceInstructor(pool, parsed.id, idInstructor);
    if (!pertenece) return res.status(403).json({ ok: false, mensaje: 'Este curso no le pertenece.' });

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT * FROM Examenes WHERE id_curso = @idCurso AND estado = 1');

    if (examen.recordset.length === 0) {
      return res.json({ ok: true, examen: null, preguntas: [] });
    }

    const preguntas = await pool.request()
      .input('idExamen', sql.Int, examen.recordset[0].id_examen)
      .query('SELECT * FROM Preguntas WHERE id_examen = @idExamen AND estado = 1 ORDER BY orden');

    res.json({ ok: true, examen: examen.recordset[0], preguntas: preguntas.recordset });
  } catch (error) {
    console.error('Error al obtener examen:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener examen.', detalle: mensajeError(error) });
  }
});

app.put('/api/cursos/:idCurso/examen', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idInstructor = req.session.usuario.id_usuario;
    const pool = await getPool();

    const pertenece = await cursoPerteneceInstructor(pool, parsed.id, idInstructor);
    if (!pertenece) return res.status(403).json({ ok: false, mensaje: 'Este curso no le pertenece.' });

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen FROM Examenes WHERE id_curso = @idCurso AND estado = 1');
    if (examen.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'No hay examen creado para este curso.' });
    }

    const { porcentaje_aprobacion, instrucciones } = req.body;
    const pct = Math.min(100, Math.max(0, parseInt(porcentaje_aprobacion) || 70));

    await pool.request()
      .input('idExamen', sql.Int, examen.recordset[0].id_examen)
      .input('porcentaje', sql.Int, pct)
      .input('instrucciones', sql.VarChar(500), (instrucciones || '').trim() || null)
      .query(`
        UPDATE Examenes
        SET porcentaje_aprobacion = @porcentaje,
            instrucciones = @instrucciones,
            fecha_actualizacion = GETDATE()
        WHERE id_examen = @idExamen
      `);

    res.json({ ok: true, mensaje: 'Examen actualizado.' });
  } catch (error) {
    console.error('Error al actualizar examen:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al actualizar examen.', detalle: mensajeError(error) });
  }
});

// --- Instructor: CRUD preguntas ---

app.post('/api/cursos/:idCurso/examen/preguntas', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idInstructor = req.session.usuario.id_usuario;
    const pool = await getPool();

    const pertenece = await cursoPerteneceInstructor(pool, parsed.id, idInstructor);
    if (!pertenece) return res.status(403).json({ ok: false, mensaje: 'Este curso no le pertenece.' });

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen FROM Examenes WHERE id_curso = @idCurso AND estado = 1');
    if (examen.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Primero debe crear el examen.' });
    }

    const { enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, orden } = req.body;
    if (![enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta].every(validarTexto)) {
      return res.status(400).json({ ok: false, mensaje: 'Todos los campos de la pregunta son obligatorios.' });
    }

    const resp = respuesta_correcta.trim().toUpperCase();
    if (!['A','B','C','D'].includes(resp)) {
      return res.status(400).json({ ok: false, mensaje: 'La respuesta correcta debe ser A, B, C o D.' });
    }

    const ordenVal = validarEnteroPositivo(orden, 'El orden');
    if (ordenVal.error) return res.status(400).json({ ok: false, mensaje: ordenVal.error.mensaje });

    const idExamen = examen.recordset[0].id_examen;

    const result = await pool.request()
      .input('idExamen', sql.Int, idExamen)
      .input('enunciado', sql.VarChar(500), enunciado.trim())
      .input('opcion_a', sql.VarChar(255), opcion_a.trim())
      .input('opcion_b', sql.VarChar(255), opcion_b.trim())
      .input('opcion_c', sql.VarChar(255), opcion_c.trim())
      .input('opcion_d', sql.VarChar(255), opcion_d.trim())
      .input('respuesta', sql.Char(1), resp)
      .input('orden', sql.Int, ordenVal.numero)
      .query(`
        INSERT INTO Preguntas (id_examen, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, orden)
        OUTPUT INSERTED.*
        VALUES (@idExamen, @enunciado, @opcion_a, @opcion_b, @opcion_c, @opcion_d, @respuesta, @orden)
      `);

    res.json({ ok: true, mensaje: 'Pregunta agregada.', pregunta: result.recordset[0] });
  } catch (error) {
    if (mensajeError(error).includes('UQ_Preguntas_Examen_Orden')) {
      return res.status(409).json({ ok: false, mensaje: 'Ya existe una pregunta con ese orden en el examen.' });
    }
    console.error('Error al agregar pregunta:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al agregar pregunta.', detalle: mensajeError(error) });
  }
});

app.put('/api/examen/preguntas/:idPregunta', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idPregunta, 'pregunta');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const pool = await getPool();

    const preguntaData = await pool.request()
      .input('idPregunta', sql.Int, parsed.id)
      .query(`
        SELECT p.id_pregunta, e.id_curso, c.id_instructor
        FROM Preguntas p
        INNER JOIN Examenes e ON p.id_examen = e.id_examen
        INNER JOIN Cursos c ON e.id_curso = c.id_curso
        WHERE p.id_pregunta = @idPregunta
      `);

    if (preguntaData.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Pregunta no encontrada.' });
    }

    if (preguntaData.recordset[0].id_instructor !== req.session.usuario.id_usuario) {
      return res.status(403).json({ ok: false, mensaje: 'No puede editar preguntas de otro instructor.' });
    }

    const { enunciado, opcion_a, opcion_b, opcion_c, opcion_d, respuesta_correcta, orden } = req.body;
    const resp = respuesta_correcta ? respuesta_correcta.trim().toUpperCase() : null;

    const request = pool.request().input('idPregunta', sql.Int, parsed.id);

    const sets = [];
    if (enunciado !== undefined) { sets.push('enunciado = @enunciado'); request.input('enunciado', sql.VarChar(500), enunciado.trim()); }
    if (opcion_a !== undefined) { sets.push('opcion_a = @opcion_a'); request.input('opcion_a', sql.VarChar(255), opcion_a.trim()); }
    if (opcion_b !== undefined) { sets.push('opcion_b = @opcion_b'); request.input('opcion_b', sql.VarChar(255), opcion_b.trim()); }
    if (opcion_c !== undefined) { sets.push('opcion_c = @opcion_c'); request.input('opcion_c', sql.VarChar(255), opcion_c.trim()); }
    if (opcion_d !== undefined) { sets.push('opcion_d = @opcion_d'); request.input('opcion_d', sql.VarChar(255), opcion_d.trim()); }
    if (resp) {
      if (!['A','B','C','D'].includes(resp)) return res.status(400).json({ ok: false, mensaje: 'Respuesta debe ser A, B, C o D.' });
      sets.push('respuesta_correcta = @respuesta');
      request.input('respuesta', sql.Char(1), resp);
    }
    if (orden !== undefined) {
      const ov = validarEnteroPositivo(orden, 'El orden');
      if (ov.error) return res.status(400).json({ ok: false, mensaje: ov.error.mensaje });
      sets.push('orden = @orden');
      request.input('orden', sql.Int, ov.numero);
    }

    if (sets.length === 0) return res.status(400).json({ ok: false, mensaje: 'No hay campos para actualizar.' });

    await request.query(`UPDATE Preguntas SET ${sets.join(', ')} WHERE id_pregunta = @idPregunta`);
    res.json({ ok: true, mensaje: 'Pregunta actualizada.' });
  } catch (error) {
    console.error('Error al editar pregunta:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al editar pregunta.', detalle: mensajeError(error) });
  }
});

app.delete('/api/examen/preguntas/:idPregunta', requiereSesion, requiereRol('instructor'), async (req, res) => {
  try {
    const parsed = parsearId(req.params.idPregunta, 'pregunta');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const pool = await getPool();

    const preguntaData = await pool.request()
      .input('idPregunta', sql.Int, parsed.id)
      .query(`
        SELECT p.id_pregunta, c.id_instructor
        FROM Preguntas p
        INNER JOIN Examenes e ON p.id_examen = e.id_examen
        INNER JOIN Cursos c ON e.id_curso = c.id_curso
        WHERE p.id_pregunta = @idPregunta
      `);

    if (preguntaData.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Pregunta no encontrada.' });
    }

    if (preguntaData.recordset[0].id_instructor !== req.session.usuario.id_usuario) {
      return res.status(403).json({ ok: false, mensaje: 'No puede eliminar preguntas de otro instructor.' });
    }

    await pool.request()
      .input('idPregunta', sql.Int, parsed.id)
      .query('UPDATE Preguntas SET estado = 0 WHERE id_pregunta = @idPregunta');

    res.json({ ok: true, mensaje: 'Pregunta eliminada.' });
  } catch (error) {
    console.error('Error al eliminar pregunta:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al eliminar pregunta.', detalle: mensajeError(error) });
  }
});

// --- Estudiante: tomar examen ---

async function calcularProgresoExamenEstudiante(pool, idUsuario, idCurso) {
  const inscripcion = await pool.request()
    .input('idUsuario', sql.Int, idUsuario)
    .input('idCurso', sql.Int, idCurso)
    .query('SELECT id_inscripcion FROM Inscripciones WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1');

  if (inscripcion.recordset.length === 0) {
    return { inscrito: false, progreso: 0 };
  }

  const idInscripcion = inscripcion.recordset[0].id_inscripcion;

  const totalLecciones = await pool.request()
    .input('idCurso', sql.Int, idCurso)
    .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');
  const total = totalLecciones.recordset[0].total;

  if (total === 0) {
    return { inscrito: true, progreso: 0, idInscripcion };
  }

  const completadasData = await pool.request()
    .input('idInscripcion', sql.Int, idInscripcion)
    .input('idCurso', sql.Int, idCurso)
    .query(`
      SELECT COUNT(*) AS completadas FROM ProgresoLecciones pl
      INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
      WHERE pl.id_inscripcion = @idInscripcion AND pl.completada = 1 AND l.id_curso = @idCurso AND l.estado = 1
    `);

  const completadas = completadasData.recordset[0].completadas;
  const progreso = Math.round((completadas / total) * 100);

  return { inscrito: true, progreso, idInscripcion };
}

app.get('/api/cursos/:idCurso/examen/estado', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen, porcentaje_aprobacion, instrucciones FROM Examenes WHERE id_curso = @idCurso AND estado = 1');

    const examenExiste = examen.recordset.length > 0;

    let puedeRendir = false;
    let yaAprobo = false;
    let progreso = 0;
    let totalPreguntas = 0;
    let preguntasDisponibles = false;

    if (examenExiste) {
      const preguntasCount = await pool.request()
        .input('idExamen', sql.Int, examen.recordset[0].id_examen)
        .query('SELECT COUNT(*) AS total FROM Preguntas WHERE id_examen = @idExamen AND estado = 1');
      totalPreguntas = preguntasCount.recordset[0].total;
      preguntasDisponibles = totalPreguntas > 0;

      const totalLecciones = await pool.request()
        .input('idCurso', sql.Int, parsed.id)
        .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');
      const total = totalLecciones.recordset[0].total;

      const inscripcion = await pool.request()
        .input('idUsuario', sql.Int, idUsuario)
        .input('idCurso', sql.Int, parsed.id)
        .query('SELECT id_inscripcion FROM Inscripciones WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1');

      if (inscripcion.recordset.length > 0) {
        const idInscripcion = inscripcion.recordset[0].id_inscripcion;
        const completadasData = await pool.request()
          .input('idInscripcion', sql.Int, idInscripcion)
          .input('idCurso', sql.Int, parsed.id)
          .query(`
            SELECT COUNT(*) AS completadas FROM ProgresoLecciones pl
            INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
            WHERE pl.id_inscripcion = @idInscripcion AND pl.completada = 1 AND l.id_curso = @idCurso AND l.estado = 1
          `);
        const completadas = completadasData.recordset[0].completadas;
        progreso = total > 0 ? Math.round((completadas / total) * 100) : 0;
        puedeRendir = total > 0 && progreso >= 100 && preguntasDisponibles;
      }

      const certificado = await pool.request()
        .input('idUsuario', sql.Int, idUsuario)
        .input('idCurso', sql.Int, parsed.id)
        .query('SELECT id_certificado FROM Certificados WHERE id_usuario = @idUsuario AND id_curso = @idCurso');
      yaAprobo = certificado.recordset.length > 0;
    }

    res.json({ ok: true, examenExiste, puedeRendir, yaAprobo, progreso, preguntasDisponibles, totalPreguntas });
  } catch (error) {
    console.error('Error al obtener estado examen:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener estado examen.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/examen/estudiante', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const rol = req.session.usuario.rol;
    if (!ROLES_INSCRIPCION.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los estudiantes pueden rendir el examen.' });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen, porcentaje_aprobacion, instrucciones FROM Examenes WHERE id_curso = @idCurso AND estado = 1');

    if (examen.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Este curso no tiene examen.' });
    }

    const idExamen = examen.recordset[0].id_examen;

    const acceso = await calcularProgresoExamenEstudiante(pool, idUsuario, parsed.id);
    if (!acceso.inscrito) {
      return res.status(403).json({ ok: false, mensaje: 'No estas inscrito en este curso.' });
    }

    if (acceso.progreso < 100) {
      return res.status(403).json({
        ok: false,
        mensaje: `Debes completar el 100% de las lecciones antes de rendir el examen. Progreso actual: ${acceso.progreso}%.`
      });
    }

    const preguntas = await pool.request()
      .input('idExamen', sql.Int, idExamen)
      .query('SELECT id_pregunta, enunciado, opcion_a, opcion_b, opcion_c, opcion_d, orden FROM Preguntas WHERE id_examen = @idExamen AND estado = 1 ORDER BY orden');

    if (preguntas.recordset.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El examen no tiene preguntas activas.' });
    }

    res.json({
      ok: true,
      examen: examen.recordset[0],
      preguntas: preguntas.recordset
    });
  } catch (error) {
    console.error('Error al obtener examen estudiante:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener examen.', detalle: mensajeError(error) });
  }
});

app.post('/api/cursos/:idCurso/examen/intento', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const rol = req.session.usuario.rol;
    if (!ROLES_INSCRIPCION.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'Solo los estudiantes pueden rendir el examen.' });
    }

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const examen = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_examen, porcentaje_aprobacion FROM Examenes WHERE id_curso = @idCurso AND estado = 1');
    if (examen.recordset.length === 0) {
      return res.status(404).json({ ok: false, mensaje: 'Este curso no tiene examen.' });
    }

    const idExamen = examen.recordset[0].id_examen;
    const porcentajeAprobacion = examen.recordset[0].porcentaje_aprobacion;

    const inscripcion = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_inscripcion FROM Inscripciones WHERE id_usuario = @idUsuario AND id_curso = @idCurso AND estado = 1');

    if (inscripcion.recordset.length === 0) {
      return res.status(403).json({ ok: false, mensaje: 'No estas inscrito en este curso.' });
    }

    const idInscripcion = inscripcion.recordset[0].id_inscripcion;

    const totalLecciones = await pool.request()
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT COUNT(*) AS total FROM Lecciones WHERE id_curso = @idCurso AND estado = 1');

    const total = totalLecciones.recordset[0].total;

    if (total === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El curso no tiene lecciones activas.' });
    }

    const completadasData = await pool.request()
      .input('idInscripcion', sql.Int, idInscripcion)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT COUNT(*) AS completadas FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = @idInscripcion AND pl.completada = 1 AND l.id_curso = @idCurso AND l.estado = 1
      `);

    const completadas = completadasData.recordset[0].completadas;
    const progreso = Math.round((completadas / total) * 100);

    if (progreso < 100) {
      return res.status(400).json({ ok: false, mensaje: `Debes completar el 100% de las lecciones antes de rendir el examen. Progreso actual: ${progreso}%.` });
    }

    const yaCert = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query('SELECT id_certificado FROM Certificados WHERE id_usuario = @idUsuario AND id_curso = @idCurso');

    if (yaCert.recordset.length > 0) {
      return res.status(409).json({ ok: false, mensaje: 'Ya aprobaste este examen y el certificado fue emitido.' });
    }

    const preguntas = await pool.request()
      .input('idExamen', sql.Int, idExamen)
      .query('SELECT id_pregunta, respuesta_correcta FROM Preguntas WHERE id_examen = @idExamen AND estado = 1');

    if (preguntas.recordset.length === 0) {
      return res.status(400).json({ ok: false, mensaje: 'El examen no tiene preguntas.' });
    }

    const { respuestas } = req.body;
    if (!respuestas || typeof respuestas !== 'object') {
      return res.status(400).json({ ok: false, mensaje: 'Debe enviar las respuestas.' });
    }

    let aciertos = 0;
    preguntas.recordset.forEach((p) => {
      const rta = (respuestas[String(p.id_pregunta)] || '').trim().toUpperCase();
      if (rta === p.respuesta_correcta) aciertos++;
    });

    const totalPreguntas = preguntas.recordset.length;
    const puntaje = Math.round((aciertos / totalPreguntas) * 100 * 100) / 100;
    const aprobado = puntaje >= porcentajeAprobacion;

    let idCertificado = null;
    let codigoCertificado = null;

    const intentoResult = await pool.request()
      .input('idExamen', sql.Int, idExamen)
      .input('idUsuario', sql.Int, idUsuario)
      .input('puntaje', sql.Decimal(5, 2), puntaje)
      .input('aprobado', sql.Bit, aprobado)
      .query(`
        INSERT INTO IntentosExamen (id_examen, id_usuario, puntaje, aprobado, fecha_inicio, fecha_fin)
        OUTPUT INSERTED.id_intento
        VALUES (@idExamen, @idUsuario, @puntaje, @aprobado, GETDATE(), GETDATE())
      `);

    const idIntento = intentoResult.recordset[0].id_intento;

    if (aprobado) {
      const yaCert = await pool.request()
        .input('idUsuario', sql.Int, idUsuario)
        .input('idCurso', sql.Int, parsed.id)
        .query('SELECT id_certificado FROM Certificados WHERE id_usuario = @idUsuario AND id_curso = @idCurso');

      if (yaCert.recordset.length === 0) {
        const { randomUUID } = require('crypto');
        codigoCertificado = randomUUID();

        const certResult = await pool.request()
          .input('idUsuario', sql.Int, idUsuario)
          .input('idCurso', sql.Int, parsed.id)
          .input('idIntento', sql.Int, idIntento)
          .input('codigo', sql.VarChar(36), codigoCertificado)
          .input('puntaje', sql.Decimal(5, 2), puntaje)
          .query(`
            INSERT INTO Certificados (id_usuario, id_curso, id_intento, codigo, puntaje_obtenido)
            OUTPUT INSERTED.id_certificado
            VALUES (@idUsuario, @idCurso, @idIntento, @codigo, @puntaje)
          `);
        idCertificado = certResult.recordset[0].id_certificado;
      } else {
        idCertificado = yaCert.recordset[0].id_certificado;
        const certData = await pool.request()
          .input('idCertificado', sql.Int, idCertificado)
          .query('SELECT codigo FROM Certificados WHERE id_certificado = @idCertificado');
        codigoCertificado = certData.recordset[0]?.codigo || null;
      }
    }

    const certificado = aprobado && idCertificado ? {
      id_certificado: idCertificado,
      codigo: codigoCertificado
    } : null;

    res.json({
      ok: true,
      puntaje,
      aprobado,
      aciertos,
      total: totalPreguntas,
      certificado
    });
  } catch (error) {
    console.error('Error al procesar intento:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al procesar el examen.', detalle: mensajeError(error) });
  }
});

app.get('/api/cursos/:idCurso/certificado', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) return res.status(400).json({ ok: false, mensaje: parsed.error.mensaje });

    const idUsuario = req.session.usuario.id_usuario;
    const pool = await getPool();

    const cert = await pool.request()
      .input('idUsuario', sql.Int, idUsuario)
      .input('idCurso', sql.Int, parsed.id)
      .query(`
        SELECT ctf.id_certificado, ctf.codigo, ctf.puntaje_obtenido, ctf.fecha_emision,
               u.nombres, u.apellidos,
               cur.titulo AS curso_titulo
        FROM Certificados ctf
        INNER JOIN Usuarios u ON ctf.id_usuario = u.id_usuario
        INNER JOIN Cursos cur ON ctf.id_curso = cur.id_curso
        WHERE ctf.id_usuario = @idUsuario AND ctf.id_curso = @idCurso
      `);

    if (cert.recordset.length === 0) {
      return res.json({ ok: true, certificado: null });
    }

    res.json({ ok: true, certificado: cert.recordset[0] });
  } catch (error) {
    console.error('Error al obtener certificado:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener certificado.', detalle: mensajeError(error) });
  }
});

// ===== M�DULO DE REPORTES =====

async function obtenerCursosReporte(pool, esAdmin, idInstructor) {
  const consulta = `
    SELECT
      c.id_curso,
      c.titulo,
      c.estado AS curso_estado,
      u.nombres + ' ' + u.apellidos AS instructor_nombre,
      (SELECT COUNT(*) FROM Inscripciones i WHERE i.id_curso = c.id_curso AND i.estado = 1) AS total_estudiantes,
      (SELECT COUNT(*) FROM Lecciones l WHERE l.id_curso = c.id_curso AND l.estado = 1) AS total_lecciones
    FROM Cursos c
    INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
    ${esAdmin ? '' : 'WHERE c.id_instructor = @idInstructor'}
    ORDER BY c.fecha_creacion DESC
  `;

  const request = pool.request();
  if (!esAdmin) {
    request.input('idInstructor', sql.Int, idInstructor);
  }

  const cursos = await request.query(consulta);
  return cursos.recordset;
}

async function obtenerParticipantesReporteExcel(pool, esAdmin, idInstructor) {
  const consulta = `
    SELECT
      c.id_curso,
      c.titulo,
      c.estado AS curso_estado,
      ui.nombres + ' ' + ui.apellidos AS instructor_nombre,
      (SELECT COUNT(*) FROM Inscripciones i2 WHERE i2.id_curso = c.id_curso AND i2.estado = 1) AS total_estudiantes,
      (SELECT COUNT(*) FROM Lecciones l2 WHERE l2.id_curso = c.id_curso AND l2.estado = 1) AS total_lecciones,
      u.apellidos + ' ' + u.nombres AS nombre_completo,
      u.correo,
      i.fecha_inscripcion,
      CAST(CASE
        WHEN EXISTS (
          SELECT 1
          FROM Inscripciones i2
          WHERE i2.id_usuario = u.id_usuario
            AND i2.encuesta_completada = 1
            AND i2.estado = 1
        ) THEN 1
        ELSE 0
      END AS BIT) AS encuesta_global_completada,
      (
        SELECT COUNT(*)
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = i.id_inscripcion
          AND pl.completada = 1
          AND l.id_curso = c.id_curso
          AND l.estado = 1
      ) AS lecciones_completadas,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM Certificados cert
          WHERE cert.id_usuario = u.id_usuario AND cert.id_curso = c.id_curso
        ) THEN 1
        ELSE 0
      END AS tiene_certificado,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM IntentosExamen ie
          INNER JOIN Examenes e ON ie.id_examen = e.id_examen
          WHERE e.id_curso = c.id_curso
            AND ie.id_usuario = u.id_usuario
            AND ie.aprobado = 1
        ) THEN 1
        ELSE 0
      END AS aprobo_examen,
      (
        SELECT TOP 1 ctf.fecha_emision
        FROM Certificados ctf
        WHERE ctf.id_usuario = u.id_usuario AND ctf.id_curso = c.id_curso
      ) AS fecha_certificado,
      (
        SELECT MAX(pl.fecha_completada)
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = i.id_inscripcion
          AND pl.completada = 1
          AND l.id_curso = c.id_curso
          AND l.estado = 1
      ) AS fecha_ultima_leccion
    FROM Inscripciones i
    INNER JOIN Usuarios u ON i.id_usuario = u.id_usuario
    INNER JOIN Cursos c ON i.id_curso = c.id_curso
    INNER JOIN Usuarios ui ON c.id_instructor = ui.id_usuario
    WHERE i.estado = 1
    ${esAdmin ? '' : 'AND c.id_instructor = @idInstructor'}
    ORDER BY c.titulo, u.apellidos, u.nombres
  `;

  const request = pool.request();
  if (!esAdmin) {
    request.input('idInstructor', sql.Int, idInstructor);
  }

  const result = await request.query(consulta);
  return result.recordset;
}

async function obtenerEstudiantesReporte(pool, idCurso) {
  const cursoData = await pool.request()
    .input('idCurso', sql.Int, idCurso)
    .query(`
      SELECT c.id_curso, c.titulo,
        (SELECT COUNT(*) FROM Lecciones WHERE id_curso = c.id_curso AND estado = 1) AS total_lecciones
      FROM Cursos c
      WHERE c.id_curso = @idCurso
    `);

  if (cursoData.recordset.length === 0) {
    return null;
  }

  const curso = cursoData.recordset[0];
  const totalLecciones = curso.total_lecciones;

  const totalEstudiantes = await pool.request()
    .input('idCurso', sql.Int, idCurso)
    .query('SELECT COUNT(*) AS total FROM Inscripciones WHERE id_curso = @idCurso AND estado = 1');

  curso.total_estudiantes = totalEstudiantes.recordset[0].total;

  const estudiantes = await pool.request()
    .input('idCurso', sql.Int, idCurso)
    .query(`
      SELECT u.id_usuario, u.nombres, u.apellidos, u.correo, i.id_inscripcion
      FROM Inscripciones i
      INNER JOIN Usuarios u ON i.id_usuario = u.id_usuario
      WHERE i.id_curso = @idCurso AND i.estado = 1
      ORDER BY u.apellidos, u.nombres
    `);

  const resultado = await Promise.all(estudiantes.recordset.map(async (est) => {
    const progreso = await pool.request()
      .input('idInscripcion', sql.Int, est.id_inscripcion)
      .input('idCurso', sql.Int, idCurso)
      .query(`
        SELECT COUNT(*) AS completadas
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = @idInscripcion
          AND pl.completada = 1
          AND l.id_curso = @idCurso
          AND l.estado = 1
      `);

    const completadas = progreso.recordset[0].completadas;
    const porcentaje = totalLecciones > 0 ? Math.round((completadas / totalLecciones) * 100) : 0;

    const intentosData = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('idUsuario', sql.Int, est.id_usuario)
      .query(`
        SELECT ie.id_intento, ie.puntaje, ie.aprobado, ie.fecha_fin
        FROM IntentosExamen ie
        INNER JOIN Examenes e ON ie.id_examen = e.id_examen
        WHERE e.id_curso = @idCurso AND ie.id_usuario = @idUsuario
        ORDER BY ie.fecha_fin DESC
      `);

    const intentos = intentosData.recordset.map((i) => ({
      id_intento: i.id_intento,
      puntaje: i.puntaje,
      aprobado: i.aprobado,
      fecha_fin: i.fecha_fin
    }));

    const mejorNota = intentos.length > 0
      ? Math.max(...intentos.map((i) => i.puntaje))
      : null;

    const aproboExamen = intentos.some((i) => i.aprobado);

    const certificadoData = await pool.request()
      .input('idCurso', sql.Int, idCurso)
      .input('idUsuario', sql.Int, est.id_usuario)
      .query('SELECT id_certificado FROM Certificados WHERE id_curso = @idCurso AND id_usuario = @idUsuario');

    return {
      id_usuario: est.id_usuario,
      nombres: est.nombres,
      apellidos: est.apellidos,
      correo: est.correo,
      porcentaje,
      completadas,
      total_lecciones: totalLecciones,
      estado: porcentaje === 100 ? 'finalizado' : 'en curso',
      mejor_nota: mejorNota,
      aprobo_examen: aproboExamen,
      certificado: certificadoData.recordset.length > 0,
      intentos
    };
  }));

  return { curso, estudiantes: resultado };
}

const NOMBRE_ARCHIVO_EXCEL_PARTICIPANTES = 'Reporte_Participantes_Vinculacion_2026.xlsx';
const NOMBRE_HOJA_EXCEL_PARTICIPANTES = 'Participantes 2026';

function formatearFechaUsuario(valor) {
  if (!valor) return '�';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHoraGeneracion(fecha = new Date()) {
  return fecha.toLocaleString('es-EC', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function calcularPorcentajeProgreso(completadas, total) {
  if (!total || total <= 0) return 0;
  return Math.round((completadas / total) * 100);
}

function determinarEstadoParticipacion(porcentaje, aproboExamen, tieneCertificado) {
  if (aproboExamen || tieneCertificado) return 'Aprobado';
  if (porcentaje >= 100) return 'Completado';
  return 'En progreso';
}

function determinarFechaFinalizacion(fechaCertificado, fechaUltimaLeccion, porcentaje) {
  if (fechaCertificado) return fechaCertificado;
  if (porcentaje >= 100 && fechaUltimaLeccion) return fechaUltimaLeccion;
  return null;
}

function generarExcelCursos(participantes) {
  const encabezadoInstitucional = [
    ['INSTITUTO SUPERIOR TECNOL�GICO QUITO'],
    ['Proyecto de Vinculación con la Sociedad 2026'],
    ['Reporte de Participantes'],
    [`Fecha de generación: ${formatearFechaHoraGeneracion()}`],
    []
  ];

  const columnas = [
    'ID curso',
    'Título',
    'Instructor',
    'Estado',
    'Estudiantes inscritos',
    'Total lecciones',
    'Nombre completo',
    'Correo',
    'Curso',
    'Estado del curso',
    'Porcentaje de progreso',
    'Certificado emitido',
    'Encuesta de satisfacción (Global)',
    'Fecha de inscripción',
    'Fecha de finalización'
  ];

  const filasDatos = participantes.map((p) => {
    const porcentaje = calcularPorcentajeProgreso(p.lecciones_completadas, p.total_lecciones);
    const tieneCertificado = !!p.tiene_certificado;
    const aproboExamen = !!p.aprobo_examen;
    const fechaFinalizacion = determinarFechaFinalizacion(
      p.fecha_certificado,
      p.fecha_ultima_leccion,
      porcentaje
    );

    return [
      p.id_curso,
      p.titulo,
      p.instructor_nombre || '',
      p.curso_estado ? 'Activo' : 'Inactivo',
      p.total_estudiantes,
      p.total_lecciones,
      p.nombre_completo || '',
      p.correo || '',
      p.titulo,
      determinarEstadoParticipacion(porcentaje, aproboExamen, tieneCertificado),
      porcentaje,
      tieneCertificado ? 'Sí' : 'No',
      p.encuesta_global_completada ? 'Sí' : 'No',
      formatearFechaUsuario(p.fecha_inscripcion),
      formatearFechaUsuario(fechaFinalizacion)
    ];
  });

  const datosCompletos = [...encabezadoInstitucional, columnas, ...filasDatos];
  const ws = XLSX.utils.aoa_to_sheet(datosCompletos);

  const filaEncabezadoTabla = encabezadoInstitucional.length + 1;
  const ultimaFila = datosCompletos.length;
  const ultimaColumna = XLSX.utils.encode_col(columnas.length - 1);

  if (ultimaFila >= filaEncabezadoTabla) {
    ws['!autofilter'] = {
      ref: `A${filaEncabezadoTabla}:${ultimaColumna}${Math.max(ultimaFila, filaEncabezadoTabla)}`
    };
  }

  ws['!cols'] = columnas.map((nombre) => ({
    wch: Math.min(Math.max(nombre.length + 4, 14), 40)
  }));

  ws['!views'] = [{
    state: 'frozen',
    ySplit: filaEncabezadoTabla,
    topLeftCell: `A${filaEncabezadoTabla + 1}`,
    activeCell: 'A1'
  }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, NOMBRE_HOJA_EXCEL_PARTICIPANTES);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function generarExcelEstudiantes(curso, estudiantes) {
  const wb = XLSX.utils.book_new();

  const dataEstudiantes = estudiantes.map((est) => ({
    'Estudiante': `${est.apellidos} ${est.nombres}`,
    'Correo': est.correo,
    'Progreso (%)': est.porcentaje,
    'Lecciones completadas': `${est.completadas}/${est.total_lecciones}`,
    'Estado': est.estado,
    'Mejor nota': est.mejor_nota !== null ? est.mejor_nota : '�',
    'Aprobó examen': est.aprobo_examen ? 'Sí' : 'No',
    'Certificado': est.certificado ? 'Sí' : 'No'
  }));

  const wsEstudiantes = XLSX.utils.json_to_sheet(dataEstudiantes);
  XLSX.utils.book_append_sheet(wb, wsEstudiantes, 'Estudiantes');

  const dataIntentos = [];
  estudiantes.forEach((est) => {
    const nombre = `${est.apellidos} ${est.nombres}`;
    est.intentos.forEach((intento, index) => {
      dataIntentos.push({
        'Estudiante': nombre,
        'N.º intento': est.intentos.length - index,
        'Calificación': intento.puntaje,
        'Resultado': intento.aprobado ? 'Aprobado' : 'No aprobado',
        'Fecha': formatearFechaUsuario(intento.fecha_fin)
      });
    });
  });

  const wsIntentos = XLSX.utils.json_to_sheet(dataIntentos);
  XLSX.utils.book_append_sheet(wb, wsIntentos, 'Intentos');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function enviarExcel(res, buffer, nombreArchivo) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.send(buffer);
}

function fechaReporte() {
  return new Date().toISOString().split('T')[0];
}

app.get('/api/reportes/cursos', requiereSesion, async (req, res) => {
  try {
    const rol = req.session.usuario.rol;
    if (!ROLES_REPORTES.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para ver reportes.' });
    }

    const pool = await getPool();
    const cursos = await obtenerCursosReporte(pool, rol === 'administrador', req.session.usuario.id_usuario);

    res.json({ ok: true, cursos });
  } catch (error) {
    console.error('Error al obtener reportes de cursos:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener reportes de cursos.', detalle: mensajeError(error) });
  }
});

app.get('/api/reportes/cursos/excel', requiereSesion, async (req, res) => {
  try {
    const rol = req.session.usuario.rol;
    if (!ROLES_REPORTES.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para ver reportes.' });
    }

    const pool = await getPool();
    const participantes = await obtenerParticipantesReporteExcel(
      pool,
      rol === 'administrador',
      req.session.usuario.id_usuario
    );
    const buffer = generarExcelCursos(participantes);

    enviarExcel(res, buffer, NOMBRE_ARCHIVO_EXCEL_PARTICIPANTES);
  } catch (error) {
    console.error('Error al generar Excel de cursos:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al generar Excel de cursos.', detalle: mensajeError(error) });
  }
});

app.get('/api/reportes/cursos/:idCurso/estudiantes', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const rol = req.session.usuario.rol;
    if (!ROLES_REPORTES.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para ver reportes.' });
    }

    const pool = await getPool();

    if (rol === 'instructor') {
      const pertenece = await cursoPerteneceInstructor(pool, parsed.id, req.session.usuario.id_usuario);
      if (!pertenece) {
        return res.status(403).json({ ok: false, mensaje: 'No puede ver el reporte de un curso que no le pertenece.' });
      }
    }

    const data = await obtenerEstudiantesReporte(pool, parsed.id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Curso no encontrado.' });
    }

    res.json({ ok: true, curso: data.curso, estudiantes: data.estudiantes });
  } catch (error) {
    console.error('Error al obtener reporte de estudiantes:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al obtener reporte de estudiantes.', detalle: mensajeError(error) });
  }
});

app.get('/api/reportes/cursos/:idCurso/estudiantes/excel', requiereSesion, async (req, res) => {
  try {
    const parsed = parsearId(req.params.idCurso, 'curso');
    if (parsed.error) {
      return res.status(parsed.error.status).json({ ok: false, mensaje: parsed.error.mensaje });
    }

    const rol = req.session.usuario.rol;
    if (!ROLES_REPORTES.includes(rol)) {
      return res.status(403).json({ ok: false, mensaje: 'No tiene permisos para ver reportes.' });
    }

    const pool = await getPool();

    if (rol === 'instructor') {
      const pertenece = await cursoPerteneceInstructor(pool, parsed.id, req.session.usuario.id_usuario);
      if (!pertenece) {
        return res.status(403).json({ ok: false, mensaje: 'No puede ver el reporte de un curso que no le pertenece.' });
      }
    }

    const data = await obtenerEstudiantesReporte(pool, parsed.id);
    if (!data) {
      return res.status(404).json({ ok: false, mensaje: 'Curso no encontrado.' });
    }

    const buffer = generarExcelEstudiantes(data.curso, data.estudiantes);
    enviarExcel(res, buffer, `reporte-curso-${parsed.id}-${fechaReporte()}.xlsx`);
  } catch (error) {
    console.error('Error al generar Excel de estudiantes:', mensajeError(error));
    res.status(500).json({ ok: false, mensaje: 'Error al generar Excel de estudiantes.', detalle: mensajeError(error) });
  }
});

// ===== DASHBOARD ADMINISTRADOR =====

async function obtenerResumenDashboard(pool) {
  const [usuarios, cursos, inscripciones, completados, certificados, examenes] = await Promise.all([
    pool.request().query('SELECT COUNT(*) AS total FROM Usuarios WHERE estado = 1'),
    pool.request().query('SELECT COUNT(*) AS total FROM Cursos WHERE estado = 1'),
    pool.request().query('SELECT COUNT(*) AS total FROM Inscripciones WHERE estado = 1'),
    pool.request().query(`
      SELECT COUNT(*) AS total
      FROM Inscripciones i
      INNER JOIN Cursos c ON i.id_curso = c.id_curso
      CROSS APPLY (
        SELECT COUNT(*) AS total_lecciones
        FROM Lecciones l
        WHERE l.id_curso = c.id_curso AND l.estado = 1
      ) tl
      CROSS APPLY (
        SELECT COUNT(*) AS completadas
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = i.id_inscripcion
          AND pl.completada = 1
          AND l.id_curso = c.id_curso
          AND l.estado = 1
      ) pc
      WHERE i.estado = 1
        AND tl.total_lecciones > 0
        AND pc.completadas = tl.total_lecciones
    `),
    pool.request().query('SELECT COUNT(*) AS total FROM Certificados'),
    pool.request().query('SELECT COUNT(*) AS total FROM IntentosExamen WHERE fecha_fin IS NOT NULL')
  ]);

  return {
    totalUsuariosActivos: usuarios.recordset[0].total,
    totalCursosActivos: cursos.recordset[0].total,
    totalInscripciones: inscripciones.recordset[0].total,
    totalCursosCompletados: completados.recordset[0].total,
    totalCertificados: certificados.recordset[0].total,
    totalExamenesRendidos: examenes.recordset[0].total
  };
}

async function obtenerCursosReportePdf(pool) {
  const resultado = await pool.request().query(`
    WITH ProgresoPorInscripcion AS (
      SELECT
        i.id_curso,
        i.id_inscripcion,
        CASE
          WHEN tl.total_lecciones > 0
          THEN CAST(ISNULL(pc.completadas, 0) AS FLOAT) / tl.total_lecciones * 100
          ELSE 0
        END AS porcentaje
      FROM Inscripciones i
      CROSS APPLY (
        SELECT COUNT(*) AS total_lecciones
        FROM Lecciones l
        WHERE l.id_curso = i.id_curso AND l.estado = 1
      ) tl
      OUTER APPLY (
        SELECT COUNT(*) AS completadas
        FROM ProgresoLecciones pl
        INNER JOIN Lecciones l ON pl.id_leccion = l.id_leccion
        WHERE pl.id_inscripcion = i.id_inscripcion
          AND pl.completada = 1
          AND l.id_curso = i.id_curso
          AND l.estado = 1
      ) pc
      WHERE i.estado = 1
    ),
    StatsCurso AS (
      SELECT
        id_curso,
        ROUND(AVG(porcentaje), 1) AS promedio_progreso,
        SUM(CASE WHEN porcentaje = 100 THEN 1 ELSE 0 END) AS completados
      FROM ProgresoPorInscripcion
      GROUP BY id_curso
    )
    SELECT
      c.id_curso,
      c.titulo,
      u.nombres + ' ' + u.apellidos AS instructor_nombre,
      ISNULL(ins.inscritos, 0) AS inscritos,
      ISNULL(stats.promedio_progreso, 0) AS promedio_progreso,
      ISNULL(stats.completados, 0) AS completados,
      ISNULL(cert.total_certificados, 0) AS certificados
    FROM Cursos c
    INNER JOIN Usuarios u ON c.id_instructor = u.id_usuario
    LEFT JOIN (
      SELECT id_curso, COUNT(*) AS inscritos
      FROM Inscripciones
      WHERE estado = 1
      GROUP BY id_curso
    ) ins ON ins.id_curso = c.id_curso
    LEFT JOIN StatsCurso stats ON stats.id_curso = c.id_curso
    LEFT JOIN (
      SELECT id_curso, COUNT(*) AS total_certificados
      FROM Certificados
      GROUP BY id_curso
    ) cert ON cert.id_curso = c.id_curso
    ORDER BY c.fecha_creacion DESC
  `);

  return resultado.recordset;
}

function formatearCantidad(valor, singular, plural) {
  const numero = Number(valor) || 0;
  const palabra = numero === 1 ? singular : plural;
  return `${numero} ${palabra}`;
}

function generarPdfReporteGeneral(resumen, cursos, administrador = null) {
  return new Promise((resolve, reject) => {
    const RUTA_MEMBRETE = path.join(__dirname, 'public', 'img', 'membrete-itq.png.jpg');
    const ROJO = '#bb0606';
    const GRIS_FILA = '#f7f7f7';
    const GRIS_BORDE = '#d9d9d9';
    const GRIS_TEXTO = '#555555';
    const NEGRO = '#1a1a1a';

    const ANCHO_PAGINA = 595.28;
    const ALTO_PAGINA = 841.89;
    const MARGEN_IZQ = 72;
    const MARGEN_DER = 85;
    const ANCHO_CONTENIDO = ANCHO_PAGINA - MARGEN_IZQ - MARGEN_DER;
    const Y_INICIO_CONTENIDO = 118;
    const Y_TOPE_CONTENIDO = 728;
    const Y_NUMERO_PAGINA = 718;

    if (!fs.existsSync(RUTA_MEMBRETE)) {
      reject(new Error('No se encontro la hoja membretada institucional.'));
      return;
    }

    const doc = new PDFDocument({ margin: 0, size: 'A4', bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fechaGeneracion = formatearFechaHoraGeneracion();

    const nombreAdministrador = administrador
      ? [administrador.nombres, administrador.apellidos].filter(Boolean).join(' ').trim()
      : '';

    const truncar = (texto, max) => {
      const valor = String(texto ?? '');
      return valor.length > max ? `${valor.slice(0, max - 3)}...` : valor;
    };

    const dibujarMembrete = () => {
      doc.image(RUTA_MEMBRETE, 0, 0, { width: ANCHO_PAGINA, height: ALTO_PAGINA });
    };

    const dibujarTitulo = (y, incluirMeta = true) => {
      doc.font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(ROJO)
        .text('REPORTE GENERAL DEL SISTEMA', MARGEN_IZQ, y, {
          width: ANCHO_CONTENIDO,
          align: 'center'
        });

      let yActual = y + 22;

      if (incluirMeta) {
        doc.font('Helvetica')
          .fontSize(9)
          .fillColor(GRIS_TEXTO)
          .text(`Fecha y hora de generación: ${fechaGeneracion}`, MARGEN_IZQ, yActual, {
            width: ANCHO_CONTENIDO,
            align: 'center'
          });
        yActual += 14;

        if (nombreAdministrador) {
          doc.text(`Administrador: ${nombreAdministrador}`, MARGEN_IZQ, yActual, {
            width: ANCHO_CONTENIDO,
            align: 'center'
          });
          yActual += 14;
        }
      }

      doc.fillColor(NEGRO);
      return yActual + 6;
    };

    const indicadores = [
      { etiqueta: 'Usuarios activos', valor: resumen.totalUsuariosActivos, singular: 'usuario', plural: 'usuarios' },
      { etiqueta: 'Cursos activos', valor: resumen.totalCursosActivos, singular: 'curso', plural: 'cursos' },
      { etiqueta: 'Inscripciones', valor: resumen.totalInscripciones, singular: 'inscripción', plural: 'inscripciones' },
      { etiqueta: 'Cursos completados', valor: resumen.totalCursosCompletados, singular: 'curso', plural: 'cursos' },
      { etiqueta: 'Certificados emitidos', valor: resumen.totalCertificados, singular: 'certificado', plural: 'certificados' },
      { etiqueta: 'Exámenes rendidos', valor: resumen.totalExamenesRendidos, singular: 'examen', plural: 'exámenes' }
    ];

    const dibujarTarjetasResumen = (yInicio) => {
      const columnas = 3;
      const gap = 12;
      const tarjetaAncho = (ANCHO_CONTENIDO - gap * (columnas - 1)) / columnas;
      const tarjetaAlto = 58;

      indicadores.forEach((item, index) => {
        const col = index % columnas;
        const fila = Math.floor(index / columnas);
        const x = MARGEN_IZQ + col * (tarjetaAncho + gap);
        const y = yInicio + fila * (tarjetaAlto + gap);

        doc.save();
        doc.roundedRect(x, y, tarjetaAncho, tarjetaAlto, 4)
          .lineWidth(0.5)
          .strokeColor(GRIS_BORDE)
          .stroke();
        doc.restore();

        doc.save();
        doc.rect(x + 10, y + 6, tarjetaAncho - 20, 2).fill(ROJO);
        doc.restore();

        doc.font('Helvetica')
          .fontSize(7.5)
          .fillColor(GRIS_TEXTO)
          .text(item.etiqueta, x + 10, y + 14, { width: tarjetaAncho - 20, lineBreak: false });

        doc.font('Helvetica-Bold')
          .fontSize(15)
          .fillColor(NEGRO)
          .text(formatearCantidad(item.valor, item.singular, item.plural), x + 10, y + 30, { width: tarjetaAncho - 20, lineBreak: false });
      });

      doc.fillColor(NEGRO);
      return yInicio + 2 * (tarjetaAlto + gap) + 10;
    };

    const columnas = [
      { x: MARGEN_IZQ, ancho: 158, titulo: 'Curso', align: 'left' },
      { x: MARGEN_IZQ + 158, ancho: 108, titulo: 'Instructor', align: 'left' },
      { x: MARGEN_IZQ + 266, ancho: 38, titulo: 'Insc.', align: 'right' },
      { x: MARGEN_IZQ + 304, ancho: 44, titulo: 'Prom.%', align: 'right' },
      { x: MARGEN_IZQ + 348, ancho: 40, titulo: 'Compl.', align: 'right' },
      { x: MARGEN_IZQ + 388, ancho: 40, titulo: 'Cert.', align: 'right' }
    ];
    const ALTURA_FILA = 17;
    const ALTURA_ENCABEZADO_TABLA = 20;

    const dibujarEncabezadoTabla = (y) => {
      doc.save();
      doc.rect(MARGEN_IZQ, y, ANCHO_CONTENIDO, ALTURA_ENCABEZADO_TABLA).fill(ROJO);
      doc.restore();

      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
      columnas.forEach((col) => {
        doc.text(col.titulo, col.x + (col.align === 'right' ? 0 : 5), y + 6, {
          width: col.ancho - 5,
          align: col.align,
          lineBreak: false
        });
      });

      doc.fillColor(NEGRO);
      return y + ALTURA_ENCABEZADO_TABLA;
    };

    const dibujarLineaFila = (y) => {
      doc.save();
      doc.moveTo(MARGEN_IZQ, y)
        .lineTo(MARGEN_IZQ + ANCHO_CONTENIDO, y)
        .lineWidth(0.25)
        .strokeColor(GRIS_BORDE)
        .stroke();
      doc.restore();
    };

    const dibujarFilaTabla = (curso, y, indice) => {
      if (indice % 2 === 0) {
        doc.save();
        doc.rect(MARGEN_IZQ, y, ANCHO_CONTENIDO, ALTURA_FILA).fill(GRIS_FILA);
        doc.restore();
      }

      const fila = [
        truncar(curso.titulo, 38),
        truncar(curso.instructor_nombre, 28),
        String(curso.inscritos ?? 0),
        String(curso.promedio_progreso ?? 0),
        String(curso.completados ?? 0),
        String(curso.certificados ?? 0)
      ];

      doc.font('Helvetica').fontSize(7.5).fillColor(NEGRO);
      columnas.forEach((col, index) => {
        doc.text(fila[index], col.x + (col.align === 'right' ? 0 : 5), y + 5, {
          width: col.ancho - 5,
          align: col.align,
          lineBreak: false
        });
      });

      dibujarLineaFila(y + ALTURA_FILA);
      return y + ALTURA_FILA;
    };

    const nuevaPaginaTabla = () => {
      doc.addPage();
      dibujarMembrete();
      let y = dibujarTitulo(Y_INICIO_CONTENIDO, false);
      return dibujarEncabezadoTabla(y);
    };

    dibujarMembrete();
    let y = dibujarTitulo(Y_INICIO_CONTENIDO, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO).text('Resumen general', MARGEN_IZQ, y);
    y += 16;
    y = dibujarTarjetasResumen(y);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(NEGRO).text('Detalle por curso', MARGEN_IZQ, y);
    y += 18;
    y = dibujarEncabezadoTabla(y);

    if (!cursos.length) {
      doc.font('Helvetica').fontSize(9).fillColor(GRIS_TEXTO)
        .text('No hay cursos registrados en el sistema.', MARGEN_IZQ + 5, y + 6);
    } else {
      cursos.forEach((curso, indice) => {
        if (y + ALTURA_FILA > Y_TOPE_CONTENIDO) {
          y = nuevaPaginaTabla();
        }
        y = dibujarFilaTabla(curso, y, indice);
      });
    }

    const totalPaginas = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPaginas; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor(GRIS_TEXTO)
        .text(`Página ${i + 1} de ${totalPaginas}`, MARGEN_IZQ, Y_NUMERO_PAGINA, {
          width: ANCHO_CONTENIDO,
          align: 'right',
          lineBreak: false
        });
    }

    doc.end();
  });
}

app.get('/api/dashboard/admin', requiereSesion, requiereRolAdministrador, async (req, res) => {
  try {
    const pool = await getPool();
    const resumen = await obtenerResumenDashboard(pool);
    res.json({ ok: true, ...resumen });
  } catch (error) {
    console.error('Error al obtener dashboard administrador:', mensajeError(error));
    res.status(500).json({
      ok: false,
      mensaje: 'Error al obtener dashboard administrador.',
      detalle: mensajeError(error)
    });
  }
});

app.get('/api/reportes/general/pdf', requiereSesion, requiereRolAdministrador, async (req, res) => {
  try {
    const pool = await getPool();
    const [resumen, cursos] = await Promise.all([
      obtenerResumenDashboard(pool),
      obtenerCursosReportePdf(pool)
    ]);

    const buffer = await generarPdfReporteGeneral(resumen, cursos, req.session.usuario);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-general-${fechaReporte()}.pdf"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error al generar PDF general:', mensajeError(error));
    res.status(500).json({
      ok: false,
      mensaje: 'Error al generar reporte PDF general.',
      detalle: mensajeError(error)
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});
