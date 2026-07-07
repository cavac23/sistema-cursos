/**
 * Normalización de texto para títulos y descripciones del panel instructor.
 * Los acrónimos se pueden ampliar editando ACROMIMOS_CANONICOS.
 */

const ACROMIMOS_CANONICOS = {
  html: 'HTML',
  css: 'CSS',
  sql: 'SQL',
  json: 'JSON',
  xml: 'XML',
  api: 'API',
  rest: 'REST',
  restful: 'RESTful',
  http: 'HTTP',
  https: 'HTTPS',
  url: 'URL',
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  ppt: 'PPT',
  pptx: 'PPTX',
  zip: 'ZIP',
  csv: 'CSV',
  javascript: 'JavaScript',
  'node.js': 'Node.js',
  express: 'Express',
  itq: 'ITQ',
  crud: 'CRUD',
  ui: 'UI',
  ux: 'UX',
  jwt: 'JWT',
  mvc: 'MVC'
};

const PALABRAS_MENORES_TITULO = new Set([
  'a', 'de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'e', 'en', 'para', 'con', 'por'
]);

function colapsarEspacios(texto) {
  if (texto == null) return '';
  return String(texto).replace(/\s+/g, ' ').trim();
}

function separarNucleoYSufijo(token) {
  const coincidencia = token.match(/^((?:[\w\u00C0-\u024F]+(?:\.[\w\u00C0-\u024F]+)?))(.*)$/u);
  if (!coincidencia) {
    return { nucleo: token, sufijo: '' };
  }
  return { nucleo: coincidencia[1], sufijo: coincidencia[2] || '' };
}

function obtenerAcronimoCanonico(palabra) {
  if (!palabra) return null;

  const lower = palabra.toLocaleLowerCase('es');
  if (Object.prototype.hasOwnProperty.call(ACROMIMOS_CANONICOS, lower)) {
    return ACROMIMOS_CANONICOS[lower];
  }

  return null;
}

function capitalizarPalabra(palabra) {
  if (!palabra) return palabra;
  const lower = palabra.toLocaleLowerCase('es');
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1);
}

function normalizarTokenTitulo(token, esPrimeraPalabra) {
  const { nucleo, sufijo } = separarNucleoYSufijo(token);
  if (!nucleo) return token;

  const acronimo = obtenerAcronimoCanonico(nucleo);
  if (acronimo) {
    return acronimo + sufijo;
  }

  const lower = nucleo.toLocaleLowerCase('es');
  if (!esPrimeraPalabra && PALABRAS_MENORES_TITULO.has(lower)) {
    return lower + sufijo;
  }

  return capitalizarPalabra(lower) + sufijo;
}

function normalizarTitulo(texto) {
  const limpio = colapsarEspacios(texto);
  if (!limpio) return '';

  return limpio
    .split(' ')
    .map((token, indice) => normalizarTokenTitulo(token, indice === 0))
    .join(' ');
}

function corregirAcronimosEnToken(token) {
  const { nucleo, sufijo } = separarNucleoYSufijo(token);
  if (!nucleo) return token;

  const acronimo = obtenerAcronimoCanonico(nucleo);
  if (acronimo) {
    return acronimo + sufijo;
  }

  return token;
}

function capitalizarPrimeraLetra(texto) {
  if (!texto) return texto;

  const primera = texto.charAt(0);
  const mayuscula = primera.toLocaleUpperCase('es');
  if (primera === mayuscula) return texto;

  return mayuscula + texto.slice(1);
}

function normalizarDescripcion(texto) {
  const limpio = colapsarEspacios(texto);
  if (!limpio) return '';

  const conPrimeraLetra = capitalizarPrimeraLetra(limpio);

  return conPrimeraLetra
    .split(' ')
    .map(corregirAcronimosEnToken)
    .join(' ');
}
