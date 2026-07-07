// ===== MENSAJES =====
const mensaje = document.getElementById('mensaje');

function mostrarMensaje(texto, tipo = 'exito') {
  if (!mensaje) return;
  mensaje.textContent = texto;
  mensaje.className = tipo; // aplica clase CSS según tipo
  mensaje.style.display = 'block';

  // Ocultar automáticamente después de unos segundos
  setTimeout(() => {
    mensaje.style.display = 'none';
  }, 4000);
}

// ===== CONSUMO API =====
async function consumirAPI(url, metodo = 'GET', datos = null) {
  const opciones = {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store'
  };

  if (datos) {
    opciones.body = JSON.stringify(datos);
  }

  const respuesta = await fetch(url, opciones);
  const data = await respuesta.json();
  if (!respuesta.ok) throw new Error(data.mensaje || 'Error en la petición');
  return data;
}

function redirigirPorRol(rol) {
  if (rol === 'instructor') return 'instructor.html';
  if (rol === 'usuario' || rol === 'estudiante_itq' || rol === 'estudiante') return 'estudiante.html';
  if (rol === 'administrador') return 'admin.html';
  return 'perfil.html';
}

const ROLES_PANEL_ESTUDIANTE = ['usuario', 'estudiante_itq', 'estudiante'];

const ITEMS_MENU_POR_ROL = {
  visitante: ['inicio', 'cursos', 'login', 'registro'],
  usuario: ['inicio', 'cursos', 'panel-estudiante', 'perfil'],
  estudiante_itq: ['inicio', 'cursos', 'panel-estudiante', 'perfil'],
  estudiante: ['inicio', 'cursos', 'panel-estudiante', 'perfil'],
  instructor: ['inicio', 'cursos', 'panel-instructor', 'perfil', 'reportes'],
  administrador: ['inicio', 'panel-admin', 'cursos', 'reportes', 'perfil']
};

function resolverEstadoMenu(rol) {
  if (!rol) return 'visitante';
  if (ITEMS_MENU_POR_ROL[rol]) return rol;
  return 'visitante';
}

async function ejecutarCerrarSesion() {
  await consumirAPI('/api/logout', 'POST');
  window.location.href = 'login.html';
}

function estructurarMenuContenedor(menu) {
  if (menu.dataset.estructurado === 'true') {
    return {
      enlaces: menu.querySelector('.menu-enlaces'),
      usuario: menu.querySelector('.menu-usuario')
    };
  }

  const contenedor = document.createElement('div');
  contenedor.className = 'menu-contenedor';

  const enlaces = document.createElement('div');
  enlaces.className = 'menu-enlaces';

  const usuario = document.createElement('div');
  usuario.className = 'menu-usuario';

  menu.querySelectorAll('[data-nav]:not([data-nav="logout"])').forEach((elemento) => {
    enlaces.appendChild(elemento);
  });

  const btnLogout = menu.querySelector('[data-nav="logout"]');
  if (btnLogout) {
    btnLogout.hidden = true;
    btnLogout.classList.add('menu-logout-reservado');
    usuario.appendChild(btnLogout);
  }

  contenedor.appendChild(enlaces);
  contenedor.appendChild(usuario);
  menu.appendChild(contenedor);
  menu.dataset.estructurado = 'true';

  return { enlaces, usuario };
}

async function obtenerPerfilMenu() {
  try {
    const data = await consumirAPI('/api/perfil');
    return data.usuario || null;
  } catch {
    return null;
  }
}

function generarInicialesUsuario(nombres, apellidos) {
  const inicialNombre = (nombres || '').trim().charAt(0);
  const inicialApellido = (apellidos || '').trim().charAt(0);
  const iniciales = `${inicialNombre}${inicialApellido}`.toUpperCase();
  return iniciales || 'IT';
}

function etiquetaRolUsuario(rol) {
  if (rol === 'usuario') return 'Usuario registrado';
  if (rol === 'estudiante_itq') return 'Estudiante ITQ';
  if (rol === 'estudiante') return 'Estudiante';
  if (rol === 'instructor') return 'Instructor';
  if (rol === 'administrador') return 'Administrador';
  return rol || 'Usuario';
}

function renderizarIndicadorSesion(menu, usuario) {
  const bloqueUsuario = menu.querySelector('.menu-usuario');
  if (!bloqueUsuario) return;

  bloqueUsuario.querySelector('#indicadorSesionUsuario')?.remove();

  if (!usuario) return;

  const indicador = document.createElement('div');
  indicador.id = 'indicadorSesionUsuario';
  indicador.className = 'indicador-sesion-usuario';
  indicador.setAttribute('role', 'status');
  indicador.setAttribute('aria-label', 'Sesión activa del usuario');

  const nombreCompleto = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
  const iniciales = generarInicialesUsuario(usuario.nombres, usuario.apellidos);
  const rol = etiquetaRolUsuario(usuario.rol);

  indicador.innerHTML = `
    <div class="avatar-sesion" aria-hidden="true">${escaparHtmlSimple(iniciales)}</div>
    <div class="datos-sesion">
      <strong class="nombre-sesion">${escaparHtmlSimple(nombreCompleto)}</strong>
      <span class="rol-sesion">${escaparHtmlSimple(rol)}</span>
      <span class="estado-sesion-activa">
        <span class="punto-sesion-activa" aria-hidden="true"></span>
        Sesión iniciada
      </span>
    </div>
    <button type="button" class="boton-cerrar-sesion-menu">Cerrar sesión</button>
  `;

  const btnReservado = bloqueUsuario.querySelector('[data-nav="logout"]');
  if (btnReservado) {
    bloqueUsuario.insertBefore(indicador, btnReservado);
  } else {
    bloqueUsuario.appendChild(indicador);
  }

  indicador.querySelector('.boton-cerrar-sesion-menu')
    ?.addEventListener('click', ejecutarCerrarSesion);
}

async function inicializarMenuNavegacion() {
  const menu = document.querySelector('nav.menu[data-menu-dinamico]');
  if (!menu) return;

  estructurarMenuContenedor(menu);

  const usuario = await obtenerPerfilMenu();
  const estado = resolverEstadoMenu(usuario?.rol);

  const visibles = new Set(ITEMS_MENU_POR_ROL[estado] || ITEMS_MENU_POR_ROL.visitante);

  menu.querySelectorAll('[data-nav]:not([data-nav="logout"])').forEach((elemento) => {
    elemento.hidden = !visibles.has(elemento.dataset.nav);
  });

  const btnLogout = menu.querySelector('[data-nav="logout"]');
  if (btnLogout) btnLogout.hidden = true;

  renderizarIndicadorSesion(menu, estado !== 'visitante' ? usuario : null);
}

function escaparHtmlSimple(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function rutaPublicaArchivoEstudiante(url) {
  if (!url) return '';
  const valor = String(url).trim();
  if (valor.startsWith('http://') || valor.startsWith('https://')) {
    return normalizarUrlImagen(valor);
  }
  return valor.startsWith('/') ? valor : `/${valor}`;
}

function crearImagenCursoEstudiante(curso) {
  const imagen = (curso.imagen_portada || '').trim();
  const titulo = escaparHtmlSimple(curso.titulo || 'Curso');

  if (imagen) {
    return `<img src="${escaparHtmlSimple(rutaPublicaArchivoEstudiante(imagen))}" alt="${titulo}" class="imagen-curso">`;
  }

  return `
    <div class="placeholder-curso" aria-label="Curso sin imagen">
      <span>ITQ</span>
    </div>
  `;
}


function crearProgresoTarjetaInscrita(ins) {
  const completadas = Number(ins.lecciones_completadas) || 0;
  const total = Number(ins.total_lecciones) || 0;
  const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;
  const evalAprobada = ins.evaluacion_aprobada === true;

  const evalHtml = porcentaje >= 100 && evalAprobada
    ? '<p class="tarjeta-inscrito-eval-aprobada">✔ Evaluación aprobada</p>'
    : '';

  return `
    <div class="tarjeta-inscrito-progreso">
      <div class="barra-progreso-fondo">
        <div class="barra-progreso-relleno tarjeta-inscrito-progreso-relleno" style="width:${porcentaje}%"></div>
      </div>
      <p class="tarjeta-inscrito-progreso-porcentaje">${porcentaje}% completado</p>
      <p class="tarjeta-inscrito-progreso-detalle">${completadas} de ${total} lecciones completadas</p>
      ${evalHtml}
    </div>
  `;
}

async function inicializarPanelEstudiante() {
  if (document.body.dataset.pagina !== 'panel-estudiante') return;

  try {
    const data = await consumirAPI('/api/perfil');
    const usuario = data.usuario;

    if (!ROLES_PANEL_ESTUDIANTE.includes(usuario.rol)) {
      window.location.href = redirigirPorRol(usuario.rol);
      return;
    }

    const bienvenida = document.getElementById('bienvenidaEstudiante');
    if (bienvenida) {
      bienvenida.textContent = `Bienvenido, ${usuario.nombres} ${usuario.apellidos}. Revisa los cursos disponibles del ITQ.`;
    }

    await cargarCursosInscritos();
    await cargarCursosDisponiblesEstudiante();
  } catch (error) {
    window.location.href = 'login.html';
  }
}

async function cargarCursosInscritos() {
  const mensaje = document.getElementById('mensajeInscritos');
  const lista = document.getElementById('listaCursosInscritos');
  if (!mensaje || !lista) return;

  try {
    mostrarEstadoModulo(mensaje, 'Cargando cursos inscritos...', 'cargando');
    const data = await consumirAPI('/api/mis-inscripciones');
    const inscripciones = data.inscripciones || [];

    if (inscripciones.length === 0) {
      lista.innerHTML = '';
      mostrarEstadoModulo(mensaje, 'Aún no te has inscrito a ningún curso. Explora el catálogo.', 'vacio');
      return;
    }

    lista.innerHTML = inscripciones.map((ins) => `
      <article class="curso tarjeta-curso catalogo-tarjeta tarjeta-inscrito">
        <div class="catalogo-tarjeta-media">
          ${crearImagenCursoEstudiante(ins)}
        </div>
        <div class="contenido-tarjeta-curso">
          <p class="etiqueta-curso">${escaparHtmlSimple(ins.nombre_categoria || 'Sin categoría')}</p>
          <h3>${escaparHtmlSimple(ins.titulo)}</h3>
          <p>${escaparHtmlSimple(ins.descripcion)}</p>
          <div class="tarjeta-inscrito-grupo-progreso">
            <p class="meta-curso"><strong>Instructor:</strong> ${escaparHtmlSimple(ins.instructor)}</p>
            ${crearProgresoTarjetaInscrita(ins)}
          </div>
          <p class="meta-curso"><strong>Inscrito:</strong> ${formatearFecha(ins.fecha_inscripcion)}</p>
          <a class="boton" href="curso-detalle.html?id=${encodeURIComponent(ins.id_curso)}">Ir al curso</a>
        </div>
      </article>
    `).join('');

    mostrarEstadoModulo(mensaje, '', '');
  } catch {
    mostrarEstadoModulo(mensaje, 'No se pudieron cargar los cursos inscritos.', 'error');
  }
}

async function cargarCursosDisponiblesEstudiante() {
  const estado = document.getElementById('estadoCursosEstudiante');
  const lista = document.getElementById('listaCursosEstudiante');
  if (!estado || !lista) return;

  try {
    mostrarEstadoModulo(estado, 'Cargando cursos...', 'cargando');
    const cursosData = await consumirAPI('/api/cursos');
    const cursos = cursosData.cursos || [];

    if (cursos.length === 0) {
      lista.innerHTML = '';
      mostrarEstadoModulo(estado, 'No hay cursos disponibles por ahora.', 'vacio');
      return;
    }

    lista.innerHTML = cursos.map((curso) => `
      <article class="curso tarjeta-curso catalogo-tarjeta">
        <div class="catalogo-tarjeta-media">
          ${crearImagenCursoEstudiante(curso)}
        </div>
        <div class="contenido-tarjeta-curso">
          <p class="etiqueta-curso">${escaparHtmlSimple(curso.nombre_categoria || 'Sin categoría')}</p>
          <h3>${escaparHtmlSimple(curso.titulo)}</h3>
          <p>${escaparHtmlSimple(curso.descripcion)}</p>
          <p class="meta-curso"><strong>Instructor:</strong> ${escaparHtmlSimple(curso.instructor)}</p>
          <a class="boton" href="curso-detalle.html?id=${encodeURIComponent(curso.id_curso)}">Ver detalle</a>
        </div>
      </article>
    `).join('');

    mostrarEstadoModulo(estado, '', '');
  } catch {
    mostrarEstadoModulo(estado, 'No se pudieron cargar los cursos.', 'error');
  }
}

function mostrarEstadoModulo(elemento, texto, tipo) {
  if (!elemento) return;
  elemento.textContent = texto || '';
  elemento.className = `estado-modulo2 ${tipo || ''}`.trim();
  elemento.style.display = texto ? 'block' : 'none';
}

function formatearFecha(valor) {
  if (!valor) return '';
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

const DOMINIO_INSTRUCTOR_ITQ = '@itq.edu.ec';

function esCorreoInstructorITQ(correo) {
  return correo.trim().toLowerCase().endsWith(DOMINIO_INSTRUCTOR_ITQ);
}

function validarRegistroInstructor(datos) {
  if (datos.rol === 'instructor' && !esCorreoInstructorITQ(datos.correo)) {
    throw new Error('Solo los miembros del ITQ pueden registrarse como instructores.');
  }
}

function validarCorreoFormulario(correo) {
  const normalizado = (correo || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    throw new Error('Ingrese un correo electrónico válido.');
  }
  return normalizado;
}

function validarContrasenaFormulario(contrasena) {
  if ((contrasena || '').length < 8) {
    throw new Error('La contraseña debe tener al menos 8 caracteres.');
  }
}

function validarCorreoInstructorPerfil(correo, rol) {
  if (rol === 'instructor' && !esCorreoInstructorITQ(correo)) {
    throw new Error('Los instructores deben mantener un correo institucional @itq.edu.ec.');
  }
}

function validarDatosRegistro(datos) {
  datos.correo = validarCorreoFormulario(datos.correo);
  validarContrasenaFormulario(datos.contrasena);
  validarRegistroInstructor(datos);
}

// ===== REGISTRO =====
const formRegistro = document.getElementById('formRegistro');
if (formRegistro) {
  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = {
      nombres: document.getElementById('nombres').value,
      apellidos: document.getElementById('apellidos').value,
      correo: document.getElementById('correo').value,
      contrasena: document.getElementById('contrasena').value,
      rol: document.getElementById('rol').value
    };

    try {
      validarDatosRegistro(datos);
      const data = await consumirAPI('/api/registro', 'POST', datos);
      mostrarMensaje(data.mensaje, 'exito');
      formRegistro.reset();
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  });
}

// ===== LOGIN =====
const formLogin = document.getElementById('formLogin');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = {
      correo: document.getElementById('correoLogin').value,
      contrasena: document.getElementById('contrasenaLogin').value
    };

    try {
      const data = await consumirAPI('/api/login', 'POST', datos);
      mostrarMensaje(data.mensaje, 'exito');
      setTimeout(() => {
        window.location.href = redirigirPorRol(data.usuario.rol);
      }, 800);
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  });
}

// ===== PERFIL =====
const formPerfil = document.getElementById('formPerfil');
if (formPerfil) {
  cargarPerfil();

  async function cargarPerfil() {
    try {
      const data = await consumirAPI('/api/perfil');
      const u = data.usuario;
      document.getElementById('perfilNombres').value = u.nombres;
      document.getElementById('perfilApellidos').value = u.apellidos;
      document.getElementById('perfilCorreo').value = u.correo;
      document.getElementById('perfilRol').value = u.rol;
      document.getElementById('perfilFecha').value = formatearFecha(u.fecha_registro);
    } catch (error) {
      window.location.href = 'login.html';
    }
  }

  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = {
      nombres: document.getElementById('perfilNombres').value,
      apellidos: document.getElementById('perfilApellidos').value,
      correo: document.getElementById('perfilCorreo').value,
      contrasena: document.getElementById('perfilContrasena').value
    };

    try {
      const rol = document.getElementById('perfilRol').value;
      datos.correo = validarCorreoFormulario(datos.correo);
      validarCorreoInstructorPerfil(datos.correo, rol);
      if (datos.contrasena.trim()) {
        validarContrasenaFormulario(datos.contrasena);
      }

      const data = await consumirAPI('/api/perfil', 'PUT', datos);
      mostrarMensaje(data.mensaje, 'exito');
      document.getElementById('perfilContrasena').value = '';
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  });
}

// ===== LOGOUT =====
const btnCerrar = document.getElementById('btnCerrar');
if (btnCerrar) {
  btnCerrar.addEventListener('click', ejecutarCerrarSesion);
}

// ===== SLIDER AUTOMÁTICO =====
let slideIndex = 0;

function mostrarSlides() {
  const slides = document.getElementsByClassName("slides");

  if (slides.length === 0) return;

  for (let i = 0; i < slides.length; i++) {
    slides[i].style.display = "none";
  }

  slideIndex++;

  if (slideIndex > slides.length) {
    slideIndex = 1;
  }

  slides[slideIndex - 1].style.display = "block";

  setTimeout(mostrarSlides, 4000);
}

mostrarSlides();

// ===== CHAT ASISTENTE =====
function abrirChat() {
  const chatBox = document.getElementById('chatBox');
  if (chatBox) {
    chatBox.style.display = 'block';
  }
}

function cerrarChat() {
  const chatBox = document.getElementById('chatBox');
  if (chatBox) {
    chatBox.style.display = 'none';
  }
}

// ===== Registro dinámico en registro.html =====
const selectRol = document.getElementById('rol');
const formEstudiante = document.getElementById('form-estudiante');
const formInstructor = document.getElementById('form-instructor');

if (selectRol) {
  selectRol.addEventListener('change', () => {
    if (selectRol.value === 'usuario') {
      formEstudiante.style.display = 'block';
      formInstructor.style.display = 'none';
    } else if (selectRol.value === 'instructor') {
      formInstructor.style.display = 'block';
      formEstudiante.style.display = 'none';
    } else {
      formEstudiante.style.display = 'none';
      formInstructor.style.display = 'none';
    }
  });
}

// Envío Estudiante
if (formEstudiante) {
  formEstudiante.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
  rol: 'usuario',
  nombres: document.getElementById('nombreEst').value,
  apellidos: document.getElementById('apellidoEst').value,
  correo: document.getElementById('correoEst').value,
  contrasena: document.getElementById('contrasenaEst').value
};
    try {
      validarDatosRegistro(datos);
      await consumirAPI('/api/registro', 'POST', datos);
      window.location.href = 'login.html';
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  });
}

// Envío Instructor
if (formInstructor) {
  formInstructor.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      rol: 'instructor',
      nombres: document.getElementById('nombreInst').value,
      apellidos: document.getElementById('apellidoInst').value,
      correo: document.getElementById('correoInst').value,
      contrasena: document.getElementById('contrasenaInst').value
    };
    try {
      validarDatosRegistro(datos);
      await consumirAPI('/api/registro', 'POST', datos);
      mostrarMensaje('Instructor registrado correctamente.', 'exito');
      formInstructor.reset();
      formInstructor.style.display = 'none';
      selectRol.value = '';
    } catch (error) {
      mostrarMensaje(error.message, 'error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  inicializarMenuNavegacion();
  inicializarPanelEstudiante();
});

window.addEventListener('pageshow', (event) => {
  if (document.body.dataset.pagina !== 'panel-estudiante') return;
  if (event.persisted) {
    void cargarCursosInscritos();
  }
});