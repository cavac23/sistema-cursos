const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR
    ? path.join(__dirname, '..', process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads')
);

const MAX_PORTADA_BYTES = parseInt(process.env.UPLOAD_MAX_PORTADA_MB || '5', 10) * 1024 * 1024;

const EXTENSIONES_PORTADA = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MIME_PORTADA = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const destino = path.join(UPLOAD_DIR, 'portadas', String(req.params.idCurso));
    fs.mkdirSync(destino, { recursive: true });
    cb(null, destino);
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});

const uploadPortada = multer({
  storage,
  limits: { fileSize: MAX_PORTADA_BYTES },
  fileFilter(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!EXTENSIONES_PORTADA.has(extension)) {
      return cb(new Error('Solo se permiten imágenes JPG, JPEG, PNG o WEBP.'));
    }

    if (!MIME_PORTADA.has(file.mimetype)) {
      return cb(new Error('El tipo MIME de la imagen no es válido.'));
    }

    cb(null, true);
  }
});

function rutaRelativaPortada(idCurso, nombreArchivo) {
  return ['uploads', 'portadas', String(idCurso), nombreArchivo].join('/');
}

function esRutaPortadaSubida(ruta) {
  if (!ruta || typeof ruta !== 'string') return false;
  const normalizada = ruta.replace(/\\/g, '/').trim();
  return normalizada.startsWith('uploads/portadas/');
}

function eliminarPortadaSubida(rutaRelativa) {
  if (!esRutaPortadaSubida(rutaRelativa)) return;

  const rutaAbsoluta = path.join(UPLOAD_DIR, rutaRelativa.replace(/^uploads[\\/]/, ''));

  try {
    if (fs.existsSync(rutaAbsoluta)) {
      fs.unlinkSync(rutaAbsoluta);
    }
  } catch (error) {
    console.error('No se pudo eliminar la portada anterior:', error.message);
  }
}

module.exports = {
  UPLOAD_DIR,
  MAX_PORTADA_BYTES,
  uploadPortada,
  rutaRelativaPortada,
  esRutaPortadaSubida,
  eliminarPortadaSubida
};
