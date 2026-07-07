let cursoSeleccionado = null;

function mostrarPanelMensaje(texto, tipo = 'exito') {
  const elemento = document.getElementById('mensajePanel');
  if (!elemento) return;

  if (!texto) {
    elemento.textContent = '';
    elemento.className = 'estado-modulo2';
    elemento.style.display = 'none';
    return;
  }

  elemento.textContent = texto;
  elemento.className = `estado-modulo2 ${tipo === 'error' ? 'error' : ''}`.trim();
  elemento.style.display = 'block';
}

function mostrarMensajeCurso(texto, tipo = 'exito') {
  const elemento = document.getElementById('mensajeCurso');
  if (!elemento) return;

  if (!texto) {
    elemento.textContent = '';
    elemento.className = 'estado-modulo2 mensaje-curso';
    elemento.style.display = 'none';
    return;
  }

  elemento.textContent = texto;
  elemento.className = `estado-modulo2 mensaje-curso ${tipo === 'error' ? 'error' : 'exito'}`.trim();
  elemento.style.display = 'block';
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function etiquetaEstado(activo) {
  return activo
    ? '<span class="badge-estado activo">Activo</span>'
    : '<span class="badge-estado inactivo">Inactivo</span>';
}

async function verificarInstructor() {
  const data = await consumirAPI('/api/perfil');
  const usuario = data.usuario;

  console.log('usuario',usuario);
  
  if (usuario.rol !== 'instructor') {
    const rolesPanelEstudiante = ['usuario', 'estudiante_itq', 'estudiante'];
    if (rolesPanelEstudiante.includes(usuario.rol)) {
      window.location.href = 'estudiante.html';
    } else if (usuario.rol === 'administrador') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'login.html';
    }
    return null;
  }

  const bienvenida = document.getElementById('bienvenidaInstructor');
  if (bienvenida) {
    bienvenida.textContent = `Bienvenido, ${usuario.nombres} ${usuario.apellidos}. Gestiona categorías, cursos y lecciones.`;
  }

  return usuario;
}

function limpiarFormulario(formId, camposOcultos = []) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.reset();
  camposOcultos.forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.value = '';
  });

  if (formId === 'formCurso') {
    actualizarCampoPortada('');
  }

  if (formId === 'formRecursoCurso') {
    actualizarCamposRecursoCurso();
  }
}

const TEXTO_BTN_CURSO_CREAR = 'Guardar curso';
const TEXTO_BTN_CURSO_EDITAR = 'Actualizar curso';

function restablecerFormularioCurso() {
  limpiarFormulario('formCurso', ['cursoIdEdicion']);
  const btn = document.getElementById('btnGuardarCurso');
  if (btn) btn.textContent = TEXTO_BTN_CURSO_CREAR;
}

function prepararEdicionCurso(curso) {
  mostrarMensajeCurso('');
  document.getElementById('cursoIdEdicion').value = curso.id_curso;
  document.getElementById('cursoTitulo').value = curso.titulo;
  document.getElementById('cursoDescripcion').value = curso.descripcion;
  document.getElementById('cursoCategoria').value = curso.id_categoria || '';
  document.getElementById('cursoImagen').value = curso.imagen_portada || curso.url_video || '';
  actualizarCampoPortada(curso.id_curso, curso.imagen_portada || curso.url_video || '');

  const btn = document.getElementById('btnGuardarCurso');
  if (btn) btn.textContent = TEXTO_BTN_CURSO_EDITAR;

  document.getElementById('formCurso')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function rutaPublicaPortada(ruta) {
  if (!ruta) return '';
  const valor = String(ruta).trim();
  if (valor.startsWith('http://') || valor.startsWith('https://')) {
    return normalizarUrlImagen(valor);
  }
  return valor.startsWith('/') ? valor : `/${valor}`;
}

function actualizarCampoPortada(cursoId, rutaPortada = '') {
  const inputArchivo = document.getElementById('cursoPortadaArchivo');

  if (inputArchivo && cursoId) {
    inputArchivo.value = '';
  }

  mostrarVistaPreviaPortada(rutaPortada);
}

async function subirPortadaCurso(idCurso, archivoExplicito = null) {
  const archivoInput = document.getElementById('cursoPortadaArchivo');
  const archivo = archivoExplicito || archivoInput?.files?.[0];

  if (!archivo) {
    throw new Error('Seleccione una imagen para subir.');
  }

  const formData = new FormData();
  formData.append('archivo', archivo);

  const respuesta = await fetch(`/api/cursos/${encodeURIComponent(idCurso)}/portada`, {
    method: 'POST',
    credentials: 'include',
    body: formData
  });

  const data = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(data.mensaje || 'No se pudo subir la portada.');
  }

  if (archivoInput) {
    archivoInput.value = '';
  }

  return data;
}

async function guardarPortadaSiSeleccionada(idCurso) {
  const archivo = document.getElementById('cursoPortadaArchivo')?.files?.[0];
  if (!archivo || !idCurso) return null;

  const respuesta = await subirPortadaCurso(idCurso, archivo);
  return respuesta.imagen_portada || respuesta.curso?.imagen_portada || null;
}

function mostrarVistaPreviaPortada(ruta) {
  const contenedor = document.getElementById('vistaPreviaPortada');
  if (!contenedor) return;

  if (!ruta) {
    contenedor.hidden = true;
    contenedor.innerHTML = '';
    return;
  }

  contenedor.hidden = false;
  contenedor.innerHTML = `
    <img src="${escaparHtml(rutaPublicaPortada(ruta))}" alt="Portada del curso" class="imagen-previa-portada">
  `;
}

async function cargarCategoriasPanel() {
  const data = await consumirAPI('/api/categorias');
  const categorias = data.categorias || [];
  const tbody = document.getElementById('tablaCategorias');
  const selectCurso = document.getElementById('cursoCategoria');

  if (selectCurso) {
    selectCurso.innerHTML = '<option value="">Sin categoría</option>';
    categorias.forEach((categoria) => {
      const option = document.createElement('option');
      option.value = categoria.id_categoria;
      option.textContent = categoria.nombre_categoria;
      selectCurso.appendChild(option);
    });
  }

  if (!tbody) return;

  if (categorias.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay categorías activas.</td></tr>';
    return;
  }

  tbody.innerHTML = categorias.map((categoria) => `
    <tr>
      <td>${categoria.id_categoria}</td>
      <td>${escaparHtml(categoria.nombre_categoria)}</td>
      <td>${escaparHtml(categoria.descripcion || '-')}</td>
      <td>${etiquetaEstado(categoria.estado)}</td>
      <td class="acciones-tabla">
        <button type="button" class="boton-mini" data-editar-categoria='${JSON.stringify(categoria).replaceAll("'", '&#39;')}'>Editar</button>
        <button type="button" class="boton-mini secundario" data-estado-categoria="${categoria.id_categoria}" data-activo="${categoria.estado ? 0 : 1}">
          ${categoria.estado ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function cargarCursosPanel() {
  const data = await consumirAPI('/api/mis-cursos');
  const cursos = data.cursos || [];
  const tbody = document.getElementById('tablaCursos');

  if (!tbody) return;

  if (cursos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Aun no tienes cursos registrados.</td></tr>';
    return;
  }

  tbody.innerHTML = cursos.map((curso) => `
    <tr>
      <td>${curso.id_curso}</td>
      <td>${escaparHtml(curso.titulo)}</td>
      <td>${escaparHtml(curso.nombre_categoria || 'Sin categoría')}</td>
      <td>${etiquetaEstado(curso.estado)}</td>
      <td class="acciones-tabla">
        <button type="button" class="boton-mini" data-editar-curso='${JSON.stringify(curso).replaceAll("'", '&#39;')}'>Editar</button>
        <button type="button" class="boton-mini" data-lecciones='${JSON.stringify({ id: curso.id_curso, titulo: curso.titulo }).replaceAll("'", '&#39;')}'>Lecciones</button>
        <button type="button" class="boton-mini" data-estudiantes='${JSON.stringify({ id: curso.id_curso, titulo: curso.titulo }).replaceAll("'", '&#39;')}'>Estudiantes</button>
        <button type="button" class="boton-mini" data-examen='${JSON.stringify({ id: curso.id_curso, titulo: curso.titulo }).replaceAll("'", '&#39;')}'>Examen</button>
        <button type="button" class="boton-mini secundario" data-estado-curso="${curso.id_curso}" data-activo="${curso.estado ? 0 : 1}">
          ${curso.estado ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function cargarLeccionesPanel() {
  if (!cursoSeleccionado) return;

  const data = await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/mis-lecciones`);
  const lecciones = data.lecciones || [];
  const tbody = document.getElementById('tablaLecciones');

  if (!tbody) return;

  if (lecciones.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">Este curso aún no tiene lecciones.</td></tr>';
    return;
  }

  tbody.innerHTML = lecciones.map((leccion) => `
    <tr>
      <td>${leccion.orden}</td>
      <td>${escaparHtml(leccion.titulo)}</td>
      <td>${leccion.duracion_minutos ? `${leccion.duracion_minutos} min` : '-'}</td>
      <td>${etiquetaEstado(leccion.estado)}</td>
      <td class="acciones-tabla">
        <button type="button" class="boton-mini" data-editar-leccion='${JSON.stringify(leccion).replaceAll("'", '&#39;')}'>Editar</button>
        <button type="button" class="boton-mini secundario" data-estado-leccion="${leccion.id_leccion}" data-activo="${leccion.estado ? 0 : 1}">
          ${leccion.estado ? 'Desactivar' : 'Activar'}
        </button>
      </td>
    </tr>
  `).join('');
}

function ocultarSeccionesCursoExcepto(excluirId) {
  const secciones = [
    'seccionLecciones',
    'seccionEstudiantes',
    'seccionExamenes'
  ];

  secciones.forEach((id) => {
    if (id !== excluirId) {
      const elemento = document.getElementById(id);
      if (elemento) elemento.hidden = true;
    }
  });
}

function mostrarSeccionLecciones(curso) {
  cursoSeleccionado = { id: curso.id, titulo: curso.titulo };

  document.getElementById('nombreCursoSeleccionado').textContent = curso.titulo;
  ocultarSeccionesCursoExcepto('seccionLecciones');
  document.getElementById('seccionLecciones').hidden = false;
  limpiarFormulario('formLeccion', ['leccionIdEdicion']);

  cargarLeccionesPanel().catch((error) => mostrarPanelMensaje(error.message, 'error'));
}

function mostrarSeccionEstudiantes(curso) {
  cursoSeleccionado = { id: curso.id, titulo: curso.titulo };

  document.getElementById('nombreCursoEstudiantes').textContent = curso.titulo;
  ocultarSeccionesCursoExcepto('seccionEstudiantes');
  document.getElementById('seccionEstudiantes').hidden = false;

  cargarEstudiantesPanel().catch((error) => mostrarPanelMensaje(error.message, 'error'));
  document.getElementById('seccionEstudiantes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function cargarEstudiantesPanel() {
  if (!cursoSeleccionado) return;

  const data = await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/estudiantes`);
  const estudiantes = data.estudiantes || [];
  const tbody = document.getElementById('tablaEstudiantes');

  if (!tbody) return;

  if (estudiantes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay estudiantes inscritos en este curso.</td></tr>';
    return;
  }

  tbody.innerHTML = estudiantes.map((est) => `
    <tr>
      <td>${escaparHtml(est.nombres + ' ' + est.apellidos)}</td>
      <td>${escaparHtml(est.correo)}</td>
      <td>${typeof formatearFecha === 'function' ? formatearFecha(est.fecha_inscripcion) : est.fecha_inscripcion}</td>
      <td>
        <div class="barra-progreso-mini">
          <div class="barra-progreso-relleno" style="width:${est.porcentaje}%"></div>
        </div>
        <span class="progreso-texto-mini">${est.completadas}/${est.total_lecciones} lecciones</span>
      </td>
      <td><strong>${est.porcentaje}%</strong></td>
    </tr>
  `).join('');
}

// ===== EXÁMENES =====

async function cargarExamenPanel() {
  if (!cursoSeleccionado) return;

  const data = await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/examen`);
  const examen = data.examen;
  const preguntas = data.preguntas || [];

  if (examen) {
    document.getElementById('examenPorcentaje').value = examen.porcentaje_aprobacion;
    document.getElementById('examenInstrucciones').value = examen.instrucciones || '';
    document.getElementById('formPregunta').hidden = false;
    document.getElementById('avisoPreguntas').hidden = true;
  } else {
    document.getElementById('examenPorcentaje').value = '70';
    document.getElementById('examenInstrucciones').value = '';
    document.getElementById('formPregunta').hidden = true;
    document.getElementById('avisoPreguntas').hidden = false;
  }

  const tbody = document.getElementById('tablaPreguntas');
  if (preguntas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4">No hay preguntas en el examen.</td></tr>';
  } else {
    tbody.innerHTML = preguntas.map((p) => `
      <tr>
        <td>${p.orden}</td>
        <td>${escaparHtml(p.enunciado)}</td>
        <td>${escaparHtml(p.respuesta_correcta)}</td>
        <td class="acciones-tabla">
          <button type="button" class="boton-mini" data-editar-pregunta='${JSON.stringify(p).replaceAll("'", '&#39;')}'>Editar</button>
          <button type="button" class="boton-mini secundario" data-eliminar-pregunta="${p.id_pregunta}">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }
}

function mostrarSeccionExamenes(curso) {
  cursoSeleccionado = { id: curso.id, titulo: curso.titulo };

  document.getElementById('nombreCursoExamenes').textContent = curso.titulo;
  ocultarSeccionesCursoExcepto('seccionExamenes');
  document.getElementById('seccionExamenes').hidden = false;
  limpiarFormularioPregunta();

  cargarExamenPanel().catch((error) => mostrarPanelMensaje(error.message, 'error'));
  document.getElementById('seccionExamenes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limpiarFormularioPregunta() {
  document.getElementById('preguntaIdEdicion').value = '';
  document.getElementById('preguntaEnunciado').value = '';
  document.getElementById('preguntaA').value = '';
  document.getElementById('preguntaB').value = '';
  document.getElementById('preguntaC').value = '';
  document.getElementById('preguntaD').value = '';
  document.getElementById('preguntaCorrecta').value = 'A';
  document.getElementById('preguntaOrden').value = '1';
}

function configurarFormulariosExamen() {
  document.getElementById('formExamen')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!cursoSeleccionado) return;

    const datos = {
      porcentaje_aprobacion: parseInt(document.getElementById('examenPorcentaje').value) || 70,
      instrucciones: document.getElementById('examenInstrucciones').value.trim() || null
    };

    try {
      const data = await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/examen`);
      if (data.examen) {
        await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/examen`, 'PUT', datos);
        mostrarPanelMensaje('Examen actualizado.');
      } else {
        await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/examen`, 'POST', datos);
        mostrarPanelMensaje('Examen creado.');
      }
      await cargarExamenPanel();
    } catch (error) {
      mostrarPanelMensaje(error.message, 'error');
    }
  });

  document.getElementById('formPregunta')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!cursoSeleccionado) return;

    const id = document.getElementById('preguntaIdEdicion').value;
    const datos = {
      enunciado: normalizarDescripcion(document.getElementById('preguntaEnunciado').value),
      opcion_a: document.getElementById('preguntaA').value.trim(),
      opcion_b: document.getElementById('preguntaB').value.trim(),
      opcion_c: document.getElementById('preguntaC').value.trim(),
      opcion_d: document.getElementById('preguntaD').value.trim(),
      respuesta_correcta: document.getElementById('preguntaCorrecta').value,
      orden: parseInt(document.getElementById('preguntaOrden').value) || 1
    };

    try {
      if (id) {
        await consumirAPI(`/api/examen/preguntas/${id}`, 'PUT', datos);
        mostrarPanelMensaje('Pregunta actualizada.');
      } else {
        await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/examen/preguntas`, 'POST', datos);
        mostrarPanelMensaje('Pregunta agregada.');
      }
      limpiarFormularioPregunta();
      await cargarExamenPanel();
    } catch (error) {
      mostrarPanelMensaje(error.message, 'error');
    }
  });

  document.getElementById('btnCancelarPregunta')?.addEventListener('click', () => {
    limpiarFormularioPregunta();
  });
}

function configurarTablaPreguntas() {
  document.getElementById('tablaPreguntas')?.addEventListener('click', async (event) => {
    const boton = event.target.closest('button');
    if (!boton) return;

    if (boton.dataset.editarPregunta) {
      const p = JSON.parse(boton.dataset.editarPregunta);
      document.getElementById('preguntaIdEdicion').value = p.id_pregunta;
      document.getElementById('preguntaEnunciado').value = p.enunciado;
      document.getElementById('preguntaA').value = p.opcion_a;
      document.getElementById('preguntaB').value = p.opcion_b;
      document.getElementById('preguntaC').value = p.opcion_c;
      document.getElementById('preguntaD').value = p.opcion_d;
      document.getElementById('preguntaCorrecta').value = p.respuesta_correcta;
      document.getElementById('preguntaOrden').value = p.orden;
      return;
    }

    if (boton.dataset.eliminarPregunta) {
      if (!confirm('Eliminar esta pregunta?')) return;
      try {
        await consumirAPI(`/api/examen/preguntas/${boton.dataset.eliminarPregunta}`, 'DELETE');
        mostrarPanelMensaje('Pregunta eliminada.');
        await cargarExamenPanel();
      } catch (error) {
        mostrarPanelMensaje(error.message, 'error');
      }
    }
  });
}

function configurarFormularios() {
  document.getElementById('formCategoria')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('categoriaIdEdicion').value;
    const datos = {
      nombre_categoria: document.getElementById('categoriaNombre').value.trim(),
      descripcion: document.getElementById('categoriaDescripcion').value.trim() || null
    };

    try {
      if (id) {
        await consumirAPI(`/api/categorias/${id}`, 'PUT', datos);
        mostrarPanelMensaje('Categoría actualizada correctamente.');
      } else {
        await consumirAPI('/api/categorias', 'POST', datos);
        mostrarPanelMensaje('Categoría creada correctamente.');
      }

      limpiarFormulario('formCategoria', ['categoriaIdEdicion']);
      await cargarCategoriasPanel();
    } catch (error) {
      mostrarPanelMensaje(error.message, 'error');
    }
  });

  document.getElementById('btnCancelarCategoria')?.addEventListener('click', () => {
    limpiarFormulario('formCategoria', ['categoriaIdEdicion']);
  });

  document.getElementById('formCurso')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const id = document.getElementById('cursoIdEdicion').value;
    const categoria = document.getElementById('cursoCategoria').value;
    const datos = {
      titulo: normalizarTitulo(document.getElementById('cursoTitulo').value),
      descripcion: normalizarDescripcion(document.getElementById('cursoDescripcion').value),
      id_categoria: categoria || null,
      url_video: null,
      imagen_portada: document.getElementById('cursoImagen').value.trim() || null
    };

    try {
      if (id) {
        await consumirAPI(`/api/cursos/${id}`, 'PUT', datos);
        await guardarPortadaSiSeleccionada(id);
        restablecerFormularioCurso();
        await cargarCursosPanel();
        mostrarMensajeCurso('Curso actualizado correctamente.');
        document.getElementById('mensajeCurso')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        const respuesta = await consumirAPI('/api/cursos', 'POST', datos);
        const cursoCreado = respuesta.curso;
        if (cursoCreado?.id_curso) {
          await guardarPortadaSiSeleccionada(cursoCreado.id_curso);
        }
        restablecerFormularioCurso();
        await cargarCursosPanel();
        mostrarMensajeCurso('Curso creado correctamente.');
        document.getElementById('mensajeCurso')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (error) {
      mostrarMensajeCurso(error.message, 'error');
      document.getElementById('mensajeCurso')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  document.getElementById('btnSubirPortada')?.addEventListener('click', async () => {
    const idCurso = document.getElementById('cursoIdEdicion').value;
    if (!idCurso) return;

    try {
      const respuesta = await subirPortadaCurso(idCurso);
      const ruta = respuesta.imagen_portada || respuesta.curso?.imagen_portada || '';
      document.getElementById('cursoImagen').value = ruta;
      actualizarCampoPortada(idCurso, ruta);
      mostrarMensajeCurso('Portada subida correctamente.');
      await cargarCursosPanel();
    } catch (error) {
      mostrarMensajeCurso(error.message, 'error');
    }
  });

  document.getElementById('btnCancelarCurso')?.addEventListener('click', () => {
    mostrarMensajeCurso('');
    restablecerFormularioCurso();
  });

  document.getElementById('cursoImagen')?.addEventListener('input', () => {
    const url = document.getElementById('cursoImagen')?.value.trim() || '';
    mostrarVistaPreviaPortada(url);
  });

  document.getElementById('formLeccion')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!cursoSeleccionado) return;

    const id = document.getElementById('leccionIdEdicion').value;
    const duracion = document.getElementById('leccionDuracion').value;
    const urlRecurso = document.getElementById('leccionUrlRecurso').value.trim();

    if (!urlRecurso) {
      mostrarPanelMensaje('Debe ingresar el link del video o recurso de la lección.', 'error');
      return;
    }

    const datos = {
      titulo: normalizarTitulo(document.getElementById('leccionTitulo').value),
      descripcion: normalizarDescripcion(document.getElementById('leccionDescripcion').value) || null,
      orden: parseInt(document.getElementById('leccionOrden').value, 10),
      duracion_minutos: duracion ? parseInt(duracion, 10) : null,
      url_recurso: urlRecurso
    };

    try {
      if (id) {
        await consumirAPI(`/api/lecciones/${id}`, 'PUT', datos);
        mostrarPanelMensaje('Leccion actualizada correctamente.');
      } else {
        await consumirAPI(`/api/cursos/${cursoSeleccionado.id}/lecciones`, 'POST', datos);
        mostrarPanelMensaje('Leccion creada correctamente.');
      }

      limpiarFormulario('formLeccion', ['leccionIdEdicion']);
      await cargarLeccionesPanel();
    } catch (error) {
      mostrarPanelMensaje(error.message, 'error');
    }
  });

  document.getElementById('btnCancelarLeccion')?.addEventListener('click', () => {
    limpiarFormulario('formLeccion', ['leccionIdEdicion']);
  });
}

function configurarTablas() {
  document.getElementById('tablaCategorias')?.addEventListener('click', async (event) => {
    const boton = event.target.closest('button');
    if (!boton) return;

    if (boton.dataset.editarCategoria) {
      const categoria = JSON.parse(boton.dataset.editarCategoria);
      document.getElementById('categoriaIdEdicion').value = categoria.id_categoria;
      document.getElementById('categoriaNombre').value = categoria.nombre_categoria;
      document.getElementById('categoriaDescripcion').value = categoria.descripcion || '';
      return;
    }

    if (boton.dataset.estadoCategoria) {
      try {
        await consumirAPI(`/api/categorias/${boton.dataset.estadoCategoria}/estado`, 'PATCH', {
          estado: parseInt(boton.dataset.activo, 10)
        });
        mostrarPanelMensaje('Estado de categoría actualizado.');
        await cargarCategoriasPanel();
      } catch (error) {
        mostrarPanelMensaje(error.message, 'error');
      }
    }
  });

  document.getElementById('tablaCursos')?.addEventListener('click', async (event) => {
    const boton = event.target.closest('button');
    if (!boton) return;

    if (boton.dataset.editarCurso) {
      prepararEdicionCurso(JSON.parse(boton.dataset.editarCurso));
      return;
    }

    if (boton.dataset.lecciones) {
      const curso = JSON.parse(boton.dataset.lecciones);
      mostrarSeccionLecciones(curso);
      return;
    }

    if (boton.dataset.estudiantes) {
      const curso = JSON.parse(boton.dataset.estudiantes);
      mostrarSeccionEstudiantes(curso);
      return;
    }

    if (boton.dataset.examen) {
      const curso = JSON.parse(boton.dataset.examen);
      mostrarSeccionExamenes(curso);
      return;
    }

    if (boton.dataset.estadoCurso) {
      try {
        await consumirAPI(`/api/cursos/${boton.dataset.estadoCurso}/estado`, 'PATCH', {
          estado: parseInt(boton.dataset.activo, 10)
        });
        mostrarPanelMensaje('Estado de curso actualizado.');
        await cargarCursosPanel();
      } catch (error) {
        mostrarPanelMensaje(error.message, 'error');
      }
    }
  });

  document.getElementById('tablaLecciones')?.addEventListener('click', async (event) => {
    const boton = event.target.closest('button');
    if (!boton) return;

    if (boton.dataset.editarLeccion) {
      const leccion = JSON.parse(boton.dataset.editarLeccion);
      document.getElementById('leccionIdEdicion').value = leccion.id_leccion;
      document.getElementById('leccionTitulo').value = leccion.titulo;
      document.getElementById('leccionDescripcion').value = leccion.descripcion || '';
      document.getElementById('leccionOrden').value = leccion.orden;
      document.getElementById('leccionDuracion').value = leccion.duracion_minutos || '';
      document.getElementById('leccionUrlRecurso').value = leccion.url_recurso || '';
      return;
    }

    if (boton.dataset.estadoLeccion) {
      try {
        await consumirAPI(`/api/lecciones/${boton.dataset.estadoLeccion}/estado`, 'PATCH', {
          estado: parseInt(boton.dataset.activo, 10)
        });
        mostrarPanelMensaje('Estado de lección actualizado.');
        await cargarLeccionesPanel();
      } catch (error) {
        mostrarPanelMensaje(error.message, 'error');
      }
    }
  });

  document.getElementById('btnCerrarLecciones')?.addEventListener('click', () => {
    cursoSeleccionado = null;
    document.getElementById('seccionLecciones').hidden = true;
    limpiarFormulario('formLeccion', ['leccionIdEdicion']);
    document.querySelector('.panel-seccion-cursos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btnCerrarEstudiantes')?.addEventListener('click', () => {
    cursoSeleccionado = null;
    document.getElementById('seccionEstudiantes').hidden = true;
    document.querySelector('.panel-seccion-cursos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('btnCerrarExamenes')?.addEventListener('click', () => {
    cursoSeleccionado = null;
    document.getElementById('seccionExamenes').hidden = true;
  });
}

async function inicializarPanelInstructor() {
  if (document.body.dataset.pagina !== 'panel-instructor') return;

  try {
    await verificarInstructor();
    configurarFormularios();
    configurarFormulariosExamen();
    configurarTablas();
    configurarTablaPreguntas();
    await cargarCategoriasPanel();
    await cargarCursosPanel();
    actualizarCampoPortada('');
  } catch (error) {
    window.location.href = 'login.html';
  }
}

document.addEventListener('DOMContentLoaded', inicializarPanelInstructor);
