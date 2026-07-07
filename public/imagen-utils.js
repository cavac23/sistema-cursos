/**
 * Normaliza URLs de imagen externas para visualización en la UI.
 * Convierte enlaces compartidos de Google Drive a URL directa de vista previa.
 */
function normalizarUrlImagen(url) {
  if (url == null) return '';

  const valor = String(url).trim();
  if (!valor) return '';

  const matchArchivo = valor.match(/drive\.google\.com\/file\/d\/([^/?#&]+)/i);
  if (matchArchivo) {
    return `https://drive.google.com/uc?export=view&id=${matchArchivo[1]}`;
  }

  const matchOpen = valor.match(/drive\.google\.com\/open\?(?:[^#]*&)?id=([^&#]+)/i);
  if (matchOpen) {
    return `https://drive.google.com/uc?export=view&id=${matchOpen[1]}`;
  }

  return valor;
}
