async function apiModulo2(url) {
  const respuesta = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(data.mensaje || 'No se pudo completar la petición.');
  }

  return data;
}

function obtenerParametroUrl(nombre) {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get(nombre);
}

function mostrarEstado(elemento, mensaje, tipo) {
  if (!elemento) return;

  elemento.textContent = mensaje || '';
  elemento.className = `estado-modulo2 ${tipo || ''}`.trim();
  elemento.style.display = mensaje ? 'block' : 'none';
}

function normalizarTexto(valor, reemplazo = 'No disponible') {
  if (valor === null || valor === undefined) return reemplazo;
  const texto = String(valor).trim();
  return texto.length > 0 ? texto : reemplazo;
}

function escaparHtml(valor) {
  return normalizarTexto(valor, '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function rutaPublicaArchivo(url) {
  if (!url) return '';
  const valor = String(url).trim();
  if (valor.startsWith('http://') || valor.startsWith('https://')) {
    return normalizarUrlImagen(valor);
  }
  return valor.startsWith('/') ? valor : `/${valor}`;
}

const URL_ENCUESTA_SATISFACCION = 'https://docs.google.com/forms/d/e/1FAIpQLSctB-clDKd01CbTeElj8ccBSz0Vqd_V0KzNSe8Osp1-x8tKoQ/viewform?usp=publish-editor';

const estadoPlataformaCurso = {
  curso: null,
  lecciones: [],
  accesoCompleto: false,
  necesitaInscripcion: false,
  idCurso: null,
  leccionActivaId: null,
  progresoLecciones: {},
  porcentajeProgreso: 0,
  examenExiste: false,
  puedeRendir: false,
  yaAprobo: false,
  preguntasDisponibles: false,
  totalPreguntas: 0,
  certificado: null,
  rol: null,
  encuestaCompletada: false,
  encuestaGlobalCompletada: false
};

const ROLES_ACCESO_CONTENIDO = [
  'usuario',
  'estudiante',
  'estudiante_itq',
  'instructor',
  'administrador'
];

const ROLES_ESTUDIANTE = ['usuario', 'estudiante', 'estudiante_itq'];

async function obtenerEstadoAcceso(idCurso) {
  try {
    const respuesta = await fetch('/api/perfil', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!respuesta.ok) return { logueado: false };

    const data = await respuesta.json();
    const rol = data.usuario?.rol;

    if (!ROLES_ACCESO_CONTENIDO.includes(rol)) {
      return { logueado: false };
    }

    if (!ROLES_ESTUDIANTE.includes(rol)) {
      return { logueado: true, rol, accesoCompleto: true, necesitaInscripcion: false };
    }

    const inscritoResp = await fetch(`/api/inscripciones/curso/${encodeURIComponent(idCurso)}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!inscritoResp.ok) {
      return { logueado: true, rol, accesoCompleto: false, necesitaInscripcion: true };
    }

    const inscritoData = await inscritoResp.json();
    const inscrito = inscritoData.inscrito === true;

    return {
      logueado: true,
      rol,
      accesoCompleto: inscrito,
      necesitaInscripcion: !inscrito
    };
  } catch {
    return { logueado: false };
  }
}

function crearImagenCurso(curso) {
  const imagen = normalizarTexto(curso.imagen_portada, '');
  const titulo = escaparHtml(curso.titulo);

  if (imagen) {
    return `<img src="${escaparHtml(rutaPublicaArchivo(imagen))}" alt="${titulo}" class="imagen-curso">`;
  }

  return `
    <div class="placeholder-curso" aria-label="Curso sin imagen">
      <span>ITQ</span>
    </div>
  `;
}

function construirUrlCursos() {
  const buscar = document.getElementById('buscarCurso')?.value.trim() || '';
  const categoria = document.getElementById('categoriaCurso')?.value || '';
  const parametros = new URLSearchParams();

  if (categoria) parametros.set('categoria', categoria);
  if (buscar) parametros.set('buscar', buscar);

  const query = parametros.toString();
  return query ? `/api/cursos?${query}` : '/api/cursos';
}

async function cargarCategorias() {
  const select = document.getElementById('categoriaCurso');
  if (!select) return;

  const data = await apiModulo2('/api/categorias');
  const categorias = Array.isArray(data.categorias) ? data.categorias : [];

  select.innerHTML = '<option value="">Todas las categorías</option>';

  categorias.forEach((categoria) => {
    const option = document.createElement('option');
    option.value = categoria.id_categoria;
    option.textContent = normalizarTexto(categoria.nombre_categoria, 'Categoría');
    select.appendChild(option);
  });
}

async function cargarCursos() {
  const estado = document.getElementById('estadoCursos');
  const lista = document.getElementById('listaCursos');
  if (!lista) return;

  mostrarEstado(estado, 'Cargando cursos...', 'cargando');
  lista.innerHTML = '';

  try {
    const data = await apiModulo2(construirUrlCursos());
    const cursos = Array.isArray(data.cursos) ? data.cursos : [];
    renderizarCursos(cursos);

    if (cursos.length === 0) {
      mostrarEstado(estado, 'No hay cursos disponibles con esos filtros.', 'vacio');
    } else {
      mostrarEstado(estado, '', '');
    }
  } catch (error) {
    mostrarEstado(estado, error.message, 'error');
  }
}

function renderizarCursos(cursos) {
  const lista = document.getElementById('listaCursos');
  if (!lista) return;

  lista.innerHTML = cursos.map((curso) => `
    <article class="curso tarjeta-curso catalogo-tarjeta">
      <div class="catalogo-tarjeta-media">
        ${crearImagenCurso(curso)}
      </div>
      <div class="contenido-tarjeta-curso">
        <p class="etiqueta-curso">${escaparHtml(curso.nombre_categoria || 'Sin categoría')}</p>
        <h3>${escaparHtml(curso.titulo)}</h3>
        <p class="resumen-curso">${escaparHtml(curso.descripcion)}</p>
        <p class="meta-curso"><strong>Instructor:</strong> ${escaparHtml(curso.instructor)}</p>
        <a class="boton boton-catalogo" href="curso-detalle.html?id=${encodeURIComponent(curso.id_curso)}">Ver detalle</a>
      </div>
    </article>
  `).join('');
}

function configurarEventosCatalogo() {
  const buscar = document.getElementById('buscarCurso');
  const categoria = document.getElementById('categoriaCurso');
  const limpiar = document.getElementById('btnLimpiarFiltros');
  let temporizadorBusqueda = null;

  if (buscar) {
    buscar.addEventListener('input', () => {
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(cargarCursos, 350);
    });
  }

  if (categoria) {
    categoria.addEventListener('change', cargarCursos);
  }

  if (limpiar) {
    limpiar.addEventListener('click', () => {
      if (buscar) buscar.value = '';
      if (categoria) categoria.value = '';
      cargarCursos();
    });
  }
}

async function inicializarCatalogoCursos() {
  const estado = document.getElementById('estadoCursos');

  try {
    mostrarEstado(estado, 'Preparando catálogo...', 'cargando');
    await cargarCategorias();
    configurarEventosCatalogo();
    await cargarCursos();
  } catch (error) {
    mostrarEstado(estado, error.message, 'error');
  }
}

async function cargarDetalleCurso(idCurso) {
  const data = await apiModulo2(`/api/cursos/${encodeURIComponent(idCurso)}`);
  return data.curso;
}

async function cargarLecciones(idCurso) {
  const data = await apiModulo2(`/api/cursos/${encodeURIComponent(idCurso)}/lecciones`);
  return Array.isArray(data.lecciones) ? data.lecciones : [];
}

function renderizarDetalleCurso(curso) {
  const detalle = document.getElementById('detalleCurso');
  if (!detalle) return;

  detalle.innerHTML = `
    <article class="tarjeta detalle-curso-tarjeta">
      <div class="media-detalle-curso">
        ${crearImagenCurso(curso)}
      </div>
      <div class="info-detalle-curso">
        <p class="etiqueta-curso">${escaparHtml(curso.nombre_categoria || 'Sin categoría')}</p>
        <h1>${escaparHtml(curso.titulo)}</h1>
        <p class="descripcion-detalle">${escaparHtml(curso.descripcion)}</p>
        <div class="detalle-meta-chips">
          <span class="chip-meta"><strong>Instructor:</strong> ${escaparHtml(curso.instructor)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderizarOverlayAccesoUnico() {
  return `
    <div class="overlay-acceso-unico">
      <p>Debes iniciar sesión o registrarte como usuario para acceder al contenido del curso.</p>
      <div class="acciones-acceso-contenido">
        <a href="registro.html" class="boton">Registrarse</a>
        <a href="login.html" class="boton secundario">Iniciar sesión</a>
      </div>
    </div>
  `;
}

function renderizarOverlayInscripcion(idCurso) {
  return `
    <div class="overlay-acceso-unico overlay-inscripcion">
      <p>Inscribete a este curso para acceder a su contenido completo.</p>
      <div class="acciones-acceso-contenido">
        <button type="button" class="boton boton-inscribirse" data-inscribir="${idCurso}">Inscribirse ahora</button>
      </div>
    </div>
  `;
}

async function inscribirseCurso(idCurso) {
  try {
    const respuesta = await fetch('/api/inscripciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id_curso: parseInt(idCurso, 10) })
    });

    const data = await respuesta.json();

    if (respuesta.status === 409) {
      alert(data.mensaje || 'Ya estas inscrito en este curso.');
      inicializarDetalleCurso();
      return;
    }

    if (!respuesta.ok) {
      alert(data.mensaje || 'Error al inscribirse.');
      return;
    }

    inicializarDetalleCurso();
  } catch (error) {
    alert('Error al procesar la inscripcion.');
  }
}

async function cargarProgresoCurso(idCurso) {
  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/progreso`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!respuesta.ok) return;

    const data = await respuesta.json();
    const progreso = data.progreso;

    if (progreso) {
      estadoPlataformaCurso.porcentajeProgreso = progreso.porcentaje || 0;
      estadoPlataformaCurso.encuestaCompletada = !!progreso.encuesta_completada;
      estadoPlataformaCurso.encuestaGlobalCompletada = !!progreso.encuesta_global_completada;
      const mapa = {};
      (progreso.lecciones || []).forEach((l) => {
        mapa[l.id_leccion] = !!l.completada;
      });
      estadoPlataformaCurso.progresoLecciones = mapa;
    }
  } catch {
    // Silencioso: si falla, simplemente no hay progreso
  }
}

async function toggleProgresoLeccion(idLeccion) {
  try {
    const respuesta = await fetch(`/api/lecciones/${encodeURIComponent(idLeccion)}/progreso`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });

    if (!respuesta.ok) {
      const data = await respuesta.json();
      alert(data.mensaje || 'Error al actualizar progreso.');
      return;
    }

    const data = await respuesta.json();
    estadoPlataformaCurso.progresoLecciones[idLeccion] = data.completada;
    estadoPlataformaCurso.porcentajeProgreso = data.porcentaje;

    actualizarVistaLeccionActiva();
    actualizarBarraProgresoDOM();

    await cargarEstadoExamen(estadoPlataformaCurso.idCurso);
    actualizarSeccionExamenDOM();
    actualizarSeccionEncuestaDOM();
  } catch {
    alert('Error al actualizar progreso.');
  }
}

function renderizarBarraProgreso() {
  const { porcentajeProgreso, progresoLecciones, lecciones } = estadoPlataformaCurso;

  console.log(porcentajeProgreso, progresoLecciones);
  
  const completadas = Object.values(progresoLecciones).filter(Boolean).length;
  const total = lecciones.length;

  return `
    <div id="barraProgresoCurso" class="barra-progreso-curso">
      <div class="barra-progreso-info">
        <span class="barra-progreso-texto">${porcentajeProgreso}% completado</span>
        <span class="barra-progreso-detalle">${completadas}/${total} lecciones</span>
      </div>
      <div class="barra-progreso-fondo">
        <div class="barra-progreso-relleno" style="width:50%"></div>
      </div>
    </div>
  `;
}

function esUrlRecursoExterno(url) {
  return /^https?:\/\//i.test(normalizarTexto(url, ''));
}

function esArchivoVideoDirecto(url) {
  const valor = normalizarTexto(url, '').toLowerCase();
  return /\.(mp4|webm|ogg)(\?|$)/i.test(valor);
}

function obtenerYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;

  const valor = url.trim();
  if (!valor) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`);
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/').filter(Boolean)[1] || null;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/').filter(Boolean)[1] || null;
      }
      return parsed.searchParams.get('v');
    }
  } catch {
    // Continuar con patrones alternativos.
  }

  const patrones = [
    /youtu\.be\/([\w-]{11})/i,
    /youtube\.com\/embed\/([\w-]{11})/i,
    /youtube\.com\/shorts\/([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i
  ];

  for (const patron of patrones) {
    const coincidencia = valor.match(patron);
    if (coincidencia?.[1]) return coincidencia[1];
  }

  return null;
}

function esYouTubeUrl(url) {
  return Boolean(obtenerYoutubeVideoId(url));
}

function obtenerYoutubeEmbedUrl(url) {
  const id = obtenerYoutubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

function renderizarReproductorYoutube(url, opciones = {}) {
  const embedUrl = obtenerYoutubeEmbedUrl(url);
  if (!embedUrl) return '';

  const urlOriginal = /^https?:\/\//i.test(url) ? url.trim() : `https://${url.trim()}`;
  const claseContenedor = opciones.secundario
    ? 'contenedor-reproductor contenedor-reproductor-secundario contenedor-youtube'
    : 'contenedor-reproductor contenedor-youtube';

  return `
    <div class="${claseContenedor}">
      <div class="embed-youtube-responsive">
        <iframe
          src="${escaparHtml(embedUrl)}"
          title="Video de YouTube"
          width="100%"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>
      <a href="${escaparHtml(urlOriginal)}" target="_blank" rel="noopener" class="enlace-youtube-externo">Abrir en YouTube</a>
    </div>
  `;
}

function renderizarMediaDesdeUrl(url, opciones = {}) {
  const valor = normalizarTexto(url, '');
  if (!valor || valor === 'No disponible') return null;

  if (esYouTubeUrl(valor)) {
    return renderizarReproductorYoutube(valor, opciones);
  }

  if (esArchivoVideoDirecto(valor) || !esUrlRecursoExterno(valor)) {
    const enlace = esUrlRecursoExterno(valor) ? valor : rutaPublicaArchivo(valor);
    const claseContenedor = opciones.secundario
      ? 'contenedor-reproductor contenedor-reproductor-secundario'
      : 'contenedor-reproductor';

    return `
      <div class="${claseContenedor}">
        <video controls preload="metadata" class="reproductor-contenido">
          <source src="${escaparHtml(enlace)}">
        </video>
      </div>
    `;
  }

  if (esUrlRecursoExterno(valor)) {
    return `
      <div class="recurso-leccion-principal">
        <a href="${escaparHtml(valor)}" target="_blank" rel="noopener" class="boton boton-recurso-leccion">
          Abrir video / recurso de la lección
        </a>
      </div>
    `;
  }

  return null;
}

function renderizarReproductorLeccion(urlRecurso) {
  const url = normalizarTexto(urlRecurso, '');
  if (!url || url === 'No disponible') {
    return `
      <div class="visor-sin-video">
        <p>Esta lección no tiene un video o recurso principal disponible.</p>
      </div>
    `;
  }

  const media = renderizarMediaDesdeUrl(url);
  if (media) return media;

  const rutaPublica = rutaPublicaArchivo(url);
  return `
    <div class="contenedor-reproductor">
      <video controls preload="metadata" class="reproductor-contenido">
        <source src="${escaparHtml(rutaPublica)}">
      </video>
    </div>
  `;
}

function renderizarNavegacionLecciones(lecciones, leccionActivaId, interactiva, progresoLecciones) {
  if (lecciones.length === 0) {
    return '<p class="estado-modulo2 vacio">Este curso aún no tiene lecciones activas.</p>';
  }

  const progreso = progresoLecciones || {};

  return `
    <nav class="navegacion-lecciones" aria-label="Lecciones del curso">
      <ul class="lista-lecciones-nav">
        ${lecciones.map((leccion) => {
          const activa = leccion.id_leccion === leccionActivaId;
          const duracion = normalizarTexto(leccion.duracion_minutos, '');
          const claseActiva = activa ? ' leccion-nav-activa' : '';
          const completada = !!progreso[leccion.id_leccion];
          const claseCheck = completada ? 'check-leccion-completada' : '';

          if (interactiva) {
            return `
              <li class="leccion-nav-item">
                <button type="button" class="boton-leccion-nav${claseActiva}" data-leccion-id="${leccion.id_leccion}">
                  <span class="leccion-nav-orden">Lección ${escaparHtml(leccion.orden)}</span>
                  <span class="leccion-nav-titulo">${escaparHtml(leccion.titulo)}</span>
                  ${duracion ? `<span class="leccion-nav-duracion">${escaparHtml(duracion)} min</span>` : ''}
                </button>
                <input type="checkbox" class="${claseCheck}" data-leccion-check="${leccion.id_leccion}" ${completada ? 'checked' : ''} title="Marcar como completada">
              </li>
            `;
          }

          return `
            <li class="leccion-nav-bloqueada">
              <div class="boton-leccion-nav${claseActiva}">
                <span class="leccion-nav-orden">Lección ${escaparHtml(leccion.orden)}</span>
                <span class="leccion-nav-titulo">${escaparHtml(leccion.titulo)}</span>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    </nav>
  `;
}

function actualizarVistaLeccionActiva() {
  const { lecciones, accesoCompleto, leccionActivaId } = estadoPlataformaCurso;
  const visor = document.getElementById('visorPrincipal');
  const navegacion = document.getElementById('navegacionLecciones');

  if (!visor || !accesoCompleto) return;

  const leccion = lecciones.find((item) => item.id_leccion === leccionActivaId);

  visor.innerHTML = `
    <div class="encabezado-leccion-activa">
      <h3>${leccion ? escaparHtml(leccion.titulo) : 'Lección'}</h3>
      ${leccion?.descripcion ? `<p class="descripcion-leccion">${escaparHtml(leccion.descripcion)}</p>` : ''}
    </div>
    ${renderizarReproductorLeccion(leccion?.url_recurso)}
  `;

  if (navegacion) {
    navegacion.innerHTML = renderizarNavegacionLecciones(lecciones, leccionActivaId, true, estadoPlataformaCurso.progresoLecciones);
    configurarEventosNavegacionLecciones();
  }

  actualizarBarraProgresoDOM();
}

function actualizarBarraProgresoDOM() {
  const barra = document.getElementById('barraProgresoCurso');
  if (!barra) return;

  const { porcentajeProgreso, progresoLecciones, lecciones } = estadoPlataformaCurso;
  const completadas = Object.values(progresoLecciones).filter(Boolean).length;
  const total = lecciones.length;

  const texto = barra.querySelector('.barra-progreso-texto');
  const detalle = barra.querySelector('.barra-progreso-detalle');
  const relleno = barra.querySelector('.barra-progreso-relleno');

  if (texto) texto.textContent = `${porcentajeProgreso}% completado`;
  if (detalle) detalle.textContent = `${completadas}/${total} lecciones`;
  if (relleno) relleno.style.width = `${porcentajeProgreso}%`;
}

// ===== EXÁMENES Y CERTIFICACIÓN =====

async function cargarEstadoExamen(idCurso) {
  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/examen/estado`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!respuesta.ok) return;
    const data = await respuesta.json();
    estadoPlataformaCurso.examenExiste = data.examenExiste;
    estadoPlataformaCurso.puedeRendir = data.puedeRendir;
    estadoPlataformaCurso.yaAprobo = data.yaAprobo;
    estadoPlataformaCurso.preguntasDisponibles = data.preguntasDisponibles === true;
    estadoPlataformaCurso.totalPreguntas = data.totalPreguntas || 0;
  } catch { /* silencioso */ }
}

function renderizarSeccionExamen() {
  const {
    puedeRendir,
    yaAprobo,
    examenExiste,
    preguntasDisponibles,
    porcentajeProgreso
  } = estadoPlataformaCurso;

  if (yaAprobo) {
    return `
      <div id="seccionExamenCurso" class="seccion-examen-curso">
        <div class="examen-aprobado-badge">Examen aprobado</div>
        <button type="button" class="boton boton-certificado" id="btnDescargarCertificado">Descargar certificado</button>
      </div>
    `;
  }

  if (puedeRendir) {
    return `
      <div id="seccionExamenCurso" class="seccion-examen-curso">
        <p class="examen-disponible-texto">Has completado todas las lecciones.</p>
        <button type="button" class="boton boton-examen" id="btnRendirExamen">Rendir prueba final</button>
      </div>
    `;
  }

  if (examenExiste && !preguntasDisponibles && porcentajeProgreso >= 100) {
    return `
      <div id="seccionExamenCurso" class="seccion-examen-curso">
        <p class="examen-disponible-texto">La evaluación aún no está disponible.</p>
      </div>
    `;
  }

  return '';
}

function configurarEventosExamen() {
  document.getElementById('btnRendirExamen')?.addEventListener('click', () => {
    abrirModalExamen(estadoPlataformaCurso.idCurso);
  });

  document.getElementById('btnDescargarCertificado')?.addEventListener('click', () => {
    abrirModalCertificado(estadoPlataformaCurso.idCurso);
  });
}

function cursoTerminadoParaEncuesta() {
  const { porcentajeProgreso, yaAprobo, examenExiste, preguntasDisponibles } = estadoPlataformaCurso;
  const examenExigeAprobacion = examenExiste && preguntasDisponibles;

  if (examenExigeAprobacion) {
    return yaAprobo;
  }

  return porcentajeProgreso >= 100;
}

function debeMostrarEncuesta() {
  if (!ROLES_ESTUDIANTE.includes(estadoPlataformaCurso.rol)) return false;
  if (!estadoPlataformaCurso.accesoCompleto) return false;
  if (estadoPlataformaCurso.encuestaGlobalCompletada) return false;
  return cursoTerminadoParaEncuesta();
}

function renderizarSeccionEncuesta() {
  if (!debeMostrarEncuesta()) return '';

  return `
    <div id="seccionEncuestaCurso" class="seccion-encuesta-curso">
      <div class="encuesta-encabezado">
        <div class="encuesta-icono-wrap" aria-hidden="true">
          <i class="fa-solid fa-clipboard-check"></i>
        </div>
        <div class="encuesta-encabezado-texto">
          <h4 class="encuesta-titulo">Encuesta de satisfacción</h4>
          <p class="encuesta-texto">Antes de finalizar el proceso, por favor completa la encuesta de satisfacción del curso.</p>
        </div>
      </div>
      <div class="encuesta-acciones">
        <a href="${escaparHtml(URL_ENCUESTA_SATISFACCION)}" target="_blank" rel="noopener noreferrer" class="boton boton-encuesta">
          Abrir encuesta
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
        </a>
        <button type="button" class="boton secundario boton-encuesta-completada" id="btnEncuestaCompletada">
          Ya llené la encuesta
          <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `;
}

function configurarEventosEncuesta() {
  document.getElementById('btnEncuestaCompletada')?.addEventListener('click', marcarEncuestaCompletada);
}

function mostrarNotificacionEncuesta(mensaje, tipo = 'exito') {
  document.getElementById('notificacionEncuestaCurso')?.remove();

  const icono = tipo === 'error'
    ? 'fa-circle-exclamation'
    : tipo === 'info'
      ? 'fa-circle-info'
      : 'fa-circle-check';

  const html = `
    <div id="notificacionEncuestaCurso" class="encuesta-notificacion encuesta-notificacion-${tipo}" role="status">
      <div class="encuesta-notificacion-icono" aria-hidden="true">
        <i class="fa-solid ${icono}"></i>
      </div>
      <p class="encuesta-notificacion-texto">${escaparHtml(mensaje)}</p>
    </div>
  `;

  const sidebar = document.querySelector('.plataforma-sidebar');
  if (sidebar) {
    sidebar.insertAdjacentHTML('afterbegin', html);
  }

  if (tipo !== 'error') {
    setTimeout(() => {
      const el = document.getElementById('notificacionEncuestaCurso');
      if (!el) return;
      el.classList.add('encuesta-notificacion-desvaneciendo');
      setTimeout(() => el.remove(), 400);
    }, 5000);
  }
}

async function marcarEncuestaCompletada() {
  const idCurso = estadoPlataformaCurso.idCurso;
  if (!idCurso || estadoPlataformaCurso.encuestaGlobalCompletada) return;

  const btn = document.getElementById('btnEncuestaCompletada');
  if (btn?.disabled) return;
  if (btn) btn.disabled = true;

  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/encuesta-completada`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await respuesta.json();

    if (!respuesta.ok || data.ok === false) {
      mostrarNotificacionEncuesta(data.mensaje || 'No se pudo registrar la encuesta.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    estadoPlataformaCurso.encuestaCompletada = !!data.encuesta_completada;
    estadoPlataformaCurso.encuestaGlobalCompletada = !!data.encuesta_global_completada || !!data.encuesta_completada;
    actualizarSeccionEncuestaDOM();

    if (data.mensaje === 'Encuesta ya registrada previamente') {
      mostrarNotificacionEncuesta(data.mensaje, 'info');
    } else {
      mostrarNotificacionEncuesta('Gracias. Su encuesta fue registrada correctamente.');
    }
  } catch {
    mostrarNotificacionEncuesta('Error al registrar la encuesta.', 'error');
    if (btn) btn.disabled = false;
  }
}

function actualizarSeccionEncuestaDOM() {
  const seccion = document.getElementById('seccionEncuestaCurso');
  const html = estadoPlataformaCurso.encuestaGlobalCompletada ? '' : renderizarSeccionEncuesta();

  if (seccion) {
    if (html) {
      seccion.outerHTML = html;
    } else {
      seccion.remove();
    }
  } else if (html) {
    const sidebar = document.querySelector('.plataforma-sidebar');
    if (sidebar) {
      sidebar.insertAdjacentHTML('afterbegin', html);
    }
  }

  configurarEventosEncuesta();
}

function mostrarNotificacionPlataforma(mensaje, tipo = 'info') {
  document.getElementById('notificacionPlataformaCurso')?.remove();

  const icono = tipo === 'error'
    ? 'fa-circle-exclamation'
    : tipo === 'info'
      ? 'fa-circle-info'
      : 'fa-circle-check';

  const html = `
    <div id="notificacionPlataformaCurso" class="encuesta-notificacion encuesta-notificacion-${tipo}" role="status">
      <div class="encuesta-notificacion-icono" aria-hidden="true">
        <i class="fa-solid ${icono}"></i>
      </div>
      <p class="encuesta-notificacion-texto">${escaparHtml(mensaje)}</p>
    </div>
  `;

  const sidebar = document.querySelector('.plataforma-sidebar');
  if (sidebar) {
    sidebar.insertAdjacentHTML('afterbegin', html);
  }

  if (tipo !== 'error') {
    setTimeout(() => {
      const el = document.getElementById('notificacionPlataformaCurso');
      if (!el) return;
      el.classList.add('encuesta-notificacion-desvaneciendo');
      setTimeout(() => el.remove(), 400);
    }, 5000);
  }
}

function sincronizarEstadoExamenAprobado() {
  estadoPlataformaCurso.yaAprobo = true;
  estadoPlataformaCurso.puedeRendir = false;
  document.getElementById('modalExamenOverlay')?.remove();
  actualizarSeccionExamenDOM();
  actualizarSeccionEncuestaDOM();
}

async function abrirModalExamen(idCurso) {
  if (estadoPlataformaCurso.yaAprobo) {
    mostrarNotificacionPlataforma('Ya aprobaste este examen. Puedes consultar tu certificado.', 'info');
    return;
  }

  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/examen/estudiante`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      mostrarNotificacionPlataforma(data.mensaje || 'No se pudo cargar el examen.', 'error');
      return;
    }

    if (!data.preguntas || data.preguntas.length === 0) {
      mostrarNotificacionPlataforma('La evaluación aún no está disponible.', 'info');
      return;
    }

    renderizarModalExamen(data.examen, data.preguntas);
  } catch {
    mostrarNotificacionPlataforma('Error al cargar el examen.', 'error');
  }
}

function renderizarModalExamen(examen, preguntas) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalExamenOverlay';

  overlay.innerHTML = `
    <div class="modal-examen-contenido">
      <div class="modal-examen-header">
        <h2>Examen final</h2>
        ${examen.instrucciones ? `<p class="examen-instrucciones">${escaparHtml(examen.instrucciones)}</p>` : ''}
        <p class="examen-requisito">Debes obtener al menos <strong>${examen.porcentaje_aprobacion}%</strong> para aprobar.</p>
      </div>
      <div class="modal-examen-body" id="modalExamenBody">
        ${preguntas.map((p, i) => `
          <div class="pregunta-examen" data-pregunta-id="${p.id_pregunta}">
            <p class="pregunta-enunciado"><strong>${i + 1}.</strong> ${escaparHtml(p.enunciado)}</p>
            <div class="pregunta-opciones">
              ${['A','B','C','D'].map((letra) => `
                <label class="opcion-label">
                  <input type="radio" name="pregunta_${p.id_pregunta}" value="${letra}">
                  <span class="opcion-texto"><strong>${letra})</strong> ${escaparHtml(p['opcion_' + letra.toLowerCase()])}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <div class="modal-examen-footer">
        <button type="button" class="boton secundario" id="btnCerrarModalExamen">Cancelar</button>
        <button type="button" class="boton" id="btnEnviarExamen">Enviar examen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btnCerrarModalExamen').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('btnEnviarExamen').addEventListener('click', async () => {
    if (estadoPlataformaCurso.yaAprobo) {
      overlay.remove();
      mostrarNotificacionPlataforma('Ya aprobaste este examen. Puedes consultar tu certificado.', 'info');
      return;
    }

    const respuestas = {};
    preguntas.forEach((p) => {
      const seleccionada = overlay.querySelector(`input[name="pregunta_${p.id_pregunta}"]:checked`);
      if (seleccionada) respuestas[p.id_pregunta] = seleccionada.value;
    });

    if (Object.keys(respuestas).length < preguntas.length) {
      mostrarNotificacionPlataforma('Debes responder todas las preguntas antes de enviar.', 'error');
      return;
    }

    const btnEnviar = document.getElementById('btnEnviarExamen');
    if (btnEnviar) btnEnviar.disabled = true;

    const enviado = await enviarExamen(examen.id_curso || estadoPlataformaCurso.idCurso, respuestas);

    if (enviado || estadoPlataformaCurso.yaAprobo) {
      overlay.remove();
    } else if (btnEnviar) {
      btnEnviar.disabled = false;
    }
  });
}

async function enviarExamen(idCurso, respuestas) {
  if (estadoPlataformaCurso.yaAprobo) {
    mostrarNotificacionPlataforma('Ya aprobaste este examen. Puedes consultar tu certificado.', 'info');
    return false;
  }

  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/examen/intento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ respuestas })
    });

    const data = await respuesta.json();

    if (respuesta.status === 409) {
      sincronizarEstadoExamenAprobado();
      mostrarNotificacionPlataforma(
        data.mensaje || 'Ya aprobaste este examen. Puedes consultar tu certificado.',
        'info'
      );
      return false;
    }

    if (!respuesta.ok) {
      mostrarNotificacionPlataforma(data.mensaje || 'Error al enviar el examen.', 'error');
      return false;
    }

    estadoPlataformaCurso.yaAprobo = data.aprobado;
    estadoPlataformaCurso.certificado = data.certificado;
    estadoPlataformaCurso.puedeRendir = !data.aprobado;

    if (data.aprobado) {
      actualizarSeccionExamenDOM();
      actualizarSeccionEncuestaDOM();
    }

    document.getElementById('modalExamenOverlay')?.remove();
    renderizarModalResultado(data);
    return true;
  } catch {
    mostrarNotificacionPlataforma('Error al enviar el examen.', 'error');
    return false;
  }
}

function renderizarModalResultado(data) {
  document.getElementById('modalExamenOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modalResultadoOverlay';

  const accionesHtml = data.aprobado
    ? `
      <div class="modal-examen-footer modal-resultado-acciones">
        <button type="button" class="boton boton-certificado" id="btnResultadoCertificado">Ver certificado</button>
        <button type="button" class="boton secundario" id="btnCerrarResultado">Volver al curso</button>
      </div>
    `
    : `
      <p class="resultado-reintento">Puedes intentarlo nuevamente cuando estés listo.</p>
      <div class="modal-examen-footer modal-resultado-acciones">
        <button type="button" class="boton" id="btnCerrarResultado">Volver al curso</button>
      </div>
    `;

  overlay.innerHTML = `
    <div class="modal-examen-contenido modal-resultado">
      <h2>Resultado del examen</h2>
      <div class="resultado-puntaje">
        <div class="resultado-circulo ${data.aprobado ? 'aprobado' : 'reprobado'}">
          <span class="resultado-numero">${data.puntaje}%</span>
        </div>
        <p class="resultado-detalle">${data.aciertos} de ${data.total} respuestas correctas</p>
      </div>
      ${data.aprobado
        ? '<div class="resultado-aprobado">Examen aprobado</div><p class="resultado-aprobado-detalle">Tu certificado ya está disponible.</p>'
        : '<div class="resultado-reprobado">No aprobaste</div>'}
      ${accionesHtml}
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('btnCerrarResultado')?.addEventListener('click', () => {
    overlay.remove();
    refrescarSeccionExamen();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      refrescarSeccionExamen();
    }
  });

  document.getElementById('btnResultadoCertificado')?.addEventListener('click', () => {
    overlay.remove();
    refrescarSeccionExamen();
    abrirModalCertificado(estadoPlataformaCurso.idCurso);
  });
}

async function abrirModalCertificado(idCurso) {
  try {
    const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/certificado`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!respuesta.ok) {
      alert('No se pudo obtener el certificado.');
      return;
    }
    const data = await respuesta.json();
    if (!data.certificado) {
      alert('No tienes un certificado para este curso.');
      return;
    }

    const cert = data.certificado;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-examen-contenido modal-certificado">
        <h2>Certificado de finalización</h2>
        <div class="certificado-vista-previa">
          <div class="certificado-borde">
            <h3>${escaparHtml(cert.curso_titulo)}</h3>
            <p class="certificado-nombre">${escaparHtml(cert.nombres + ' ' + cert.apellidos)}</p>
            <p class="certificado-puntaje">Puntaje: ${cert.puntaje_obtenido}%</p>
            <p class="certificado-fecha">Emitido: ${formatearFecha(cert.fecha_emision)}</p>
            <p class="certificado-codigo">Código: ${escaparHtml(cert.codigo)}</p>
          </div>
        </div>
        <p class="certificado-aviso">La descarga en PDF estara disponible proximamente.</p>
        <button type="button" class="boton secundario" id="btnCerrarCertificado">Cerrar</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.getElementById('btnCerrarCertificado').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  } catch {
    alert('Error al obtener el certificado.');
  }
}

function actualizarSeccionExamenDOM() {
  const seccion = document.getElementById('seccionExamenCurso');
  const html = renderizarSeccionExamen();

  if (seccion) {
    seccion.outerHTML = html;
  } else {
    const barra = document.getElementById('barraProgresoCurso');
    if (barra && html) {
      barra.insertAdjacentHTML('afterend', html);
    }
  }

  configurarEventosExamen();
}

async function refrescarSeccionExamen() {
  if (estadoPlataformaCurso.idCurso) {
    await cargarEstadoExamen(estadoPlataformaCurso.idCurso);
  }
  actualizarSeccionExamenDOM();
  actualizarSeccionEncuestaDOM();
}

function configurarEventosNavegacionLecciones() {
  document.querySelectorAll('[data-leccion-id]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const id = parseInt(boton.dataset.leccionId, 10);
      if (Number.isNaN(id)) return;
      estadoPlataformaCurso.leccionActivaId = id;
      actualizarVistaLeccionActiva();
    });
  });

  document.querySelectorAll('[data-leccion-check]').forEach((check) => {
    check.addEventListener('click', () => {
      const id = parseInt(check.dataset.leccionCheck, 10);
      if (Number.isNaN(id)) return;
      toggleProgresoLeccion(id);
    });
  });
}

function renderizarPlataformaCurso(curso, lecciones, accesoCompleto, necesitaInscripcion) {
  const contenedor = document.getElementById('contenedorPlataformaCurso');
  if (!contenedor) return;

  estadoPlataformaCurso.curso = curso;
  estadoPlataformaCurso.lecciones = lecciones;
  estadoPlataformaCurso.accesoCompleto = accesoCompleto;
  estadoPlataformaCurso.necesitaInscripcion = !!necesitaInscripcion;
  estadoPlataformaCurso.idCurso = curso.id_curso;
  estadoPlataformaCurso.leccionActivaId = lecciones[0]?.id_leccion || null;

  if (!accesoCompleto) {
    const overlay = necesitaInscripcion
      ? renderizarOverlayInscripcion(curso.id_curso)
      : renderizarOverlayAccesoUnico();

    contenedor.innerHTML = `
      <div class="layout-plataforma-curso layout-plataforma-bloqueada">
        <div class="plataforma-principal">
          <div class="zona-reproductor-bloqueada">
            <div class="contenido-difuminado-fondo" aria-hidden="true">
              <div class="contenedor-reproductor reproductor-fantasma"></div>
            </div>
            ${overlay}
          </div>
        </div>
        <aside class="plataforma-sidebar">
          <h3 class="titulo-sidebar-lecciones">Lecciones</h3>
          ${renderizarNavegacionLecciones(lecciones, null, false)}
        </aside>
      </div>
    `;

    if (necesitaInscripcion) {
      const btnInscribir = contenedor.querySelector('[data-inscribir]');
      if (btnInscribir) {
        btnInscribir.addEventListener('click', () => {
          const id = parseInt(btnInscribir.dataset.inscribir, 10);
          if (!Number.isNaN(id)) inscribirseCurso(id);
        });
      }
    }

    return;
  }

  contenedor.innerHTML = `
    <div class="layout-plataforma-curso">
      <div class="plataforma-principal">
        <div id="visorPrincipal" class="visor-principal"></div>
      </div>
      <aside class="plataforma-sidebar">
        ${renderizarSeccionEncuesta()}
        ${renderizarBarraProgreso()}
        ${renderizarSeccionExamen()}
        <h3 class="titulo-sidebar-lecciones">Lecciones</h3>
        <div id="navegacionLecciones"></div>
      </aside>
    </div>
  `;

  actualizarVistaLeccionActiva();
  configurarEventosExamen();
  configurarEventosEncuesta();
}

async function inicializarDetalleCurso() {
  const estado = document.getElementById('estadoDetalle');
  const idCurso = obtenerParametroUrl('id');

  if (!idCurso || Number.isNaN(parseInt(idCurso, 10)) || parseInt(idCurso, 10) < 1) {
    mostrarEstado(estado, 'No se indicó un curso válido.', 'error');
    return;
  }

  try {
    mostrarEstado(estado, 'Cargando detalle del curso...', 'cargando');
    const estadoAcceso = await obtenerEstadoAcceso(idCurso);
    estadoPlataformaCurso.rol = estadoAcceso.rol || null;
    const curso = await cargarDetalleCurso(idCurso);
    renderizarDetalleCurso(curso);

    const lecciones = await cargarLecciones(idCurso);

    if (estadoAcceso.accesoCompleto) {
      await cargarProgresoCurso(idCurso);
      await cargarEstadoExamen(idCurso);
    }

    renderizarPlataformaCurso(
      curso,
      lecciones,
      estadoAcceso.accesoCompleto,
      estadoAcceso.necesitaInscripcion
    );
    mostrarEstado(estado, '', '');
  } catch (error) {
    mostrarEstado(estado, error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pagina = document.querySelector('[data-pagina]')?.dataset.pagina;

  if (pagina === 'catalogo-cursos') {
    inicializarCatalogoCursos();
  }

  if (pagina === 'detalle-curso') {
    inicializarDetalleCurso();
  }
});
