const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR
    ? path.join(__dirname, '..', process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads')
);

const MAX_VIDEO_BYTES = parseInt(process.env.UPLOAD_MAX_VIDEO_MB || '200', 10) * 1024 * 1024;
const MAX_DOC_BYTES = parseInt(process.env.UPLOAD_MAX_DOC_MB || '50', 10) * 1024 * 1024;

const EXTENSIONES_VIDEO = new Set(['.mp4']);
const EXTENSIONES_DOCUMENTO = new Set(['.pdf', '.docx', '.pptx']);

const MIME_VIDEO = new Set(['video/mp4']);
const MIME_DOCUMENTO = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

function subcarpetaPorTipo(tipo) {
  return tipo === 'video' ? 'videos' : 'documentos';
}

function extensionPermitida(tipo, extension) {
  if (tipo === 'video') return EXTENSIONES_VIDEO.has(extension);
  if (tipo === 'documento') return EXTENSIONES_DOCUMENTO.has(extension);
  return false;
}

function mimePermitido(tipo, mime) {
  if (tipo === 'video') return MIME_VIDEO.has(mime);
  if (tipo === 'documento') return MIME_DOCUMENTO.has(mime);
  return false;
}

function limitePorTipo(tipo) {
  return tipo === 'video' ? MAX_VIDEO_BYTES : MAX_DOC_BYTES;
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const tipo = (req.body.tipo_contenido || '').trim().toLowerCase();
    const subcarpeta = subcarpetaPorTipo(tipo);
    const destino = path.join(UPLOAD_DIR, subcarpeta, String(req.params.idLeccion));

    fs.mkdirSync(destino, { recursive: true });
    req._subcarpetaUpload = subcarpeta;
    cb(null, destino);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const uploadContenido = multer({
  storage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter(req, file, cb) {
    const tipo = (req.body.tipo_contenido || '').trim().toLowerCase();

    if (!['video', 'documento'].includes(tipo)) {
      return cb(new Error('Solo se permiten archivos para contenidos de tipo video o documento.'));
    }

    const extension = path.extname(file.originalname).toLowerCase();

    if (!extensionPermitida(tipo, extension)) {
      if (tipo === 'video') {
        return cb(new Error('Solo se permiten videos MP4.'));
      }
      return cb(new Error('Solo se permiten documentos PDF, DOCX o PPTX.'));
    }

    if (!mimePermitido(tipo, file.mimetype)) {
      return cb(new Error('El tipo MIME del archivo no es valido.'));
    }

    cb(null, true);
  }
});

function rutaRelativaArchivo(subcarpeta, idLeccion, nombreArchivo) {
  return ['uploads', subcarpeta, String(idLeccion), nombreArchivo].join('/');
}

function eliminarArchivoSubido(rutaAbsoluta) {
  if (!rutaAbsoluta) return;

  try {
    if (fs.existsSync(rutaAbsoluta)) {
      fs.unlinkSync(rutaAbsoluta);
    }
  } catch (error) {
    console.error('No se pudo eliminar el archivo subido:', error.message);
  }
}

function validarTamanoArchivo(tipo, tamanoBytes) {
  const limite = limitePorTipo(tipo);

  if (tamanoBytes > limite) {
    const limiteMb = Math.round(limite / (1024 * 1024));
    return `El archivo supera el tamano maximo permitido (${limiteMb} MB).`;
  }

  return null;
}

module.exports = {
  UPLOAD_DIR,
  MAX_VIDEO_BYTES,
  MAX_DOC_BYTES,
  uploadContenido,
  rutaRelativaArchivo,
  eliminarArchivoSubido,
  validarTamanoArchivo,
  subcarpetaPorTipo
};
