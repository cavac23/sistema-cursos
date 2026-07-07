(function () {
  'use strict';

  const ROLES_REPORTES = ['instructor', 'administrador'];
  let rolUsuario = null;
  let idCursoActual = null;

  function escaparHtml(valor) {
    return String(valor ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatearFechaCorta(valor) {
    if (typeof formatearFecha === 'function') {
      return formatearFecha(valor) || '—';
    }
    if (!valor) return '—';
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
  }

  function mostrarEstado(elemento, texto, tipo) {
    if (!elemento) return;
    elemento.textContent = texto || '';
    elemento.className = `estado-modulo2 ${tipo || ''}`.trim();
    elemento.style.display = texto ? 'block' : 'none';
  }

  async function inicializarReportes() {
    if (document.body.dataset.pagina !== 'reportes') return;

    try {
      const data = await consumirAPI('/api/perfil');
      const usuario = data.usuario;

      if (!ROLES_REPORTES.includes(usuario.rol)) {
        window.location.href = redirigirPorRol(usuario.rol);
        return;
      }

      rolUsuario = usuario.rol;

      const bienvenida = document.getElementById('bienvenidaReportes');
      if (bienvenida) {
        const textoBienvenida = usuario.rol === 'administrador'
          ? `Bienvenido, ${usuario.nombres} ${usuario.apellidos}. Consulta reportes globales del sistema.`
          : `Bienvenido, ${usuario.nombres} ${usuario.apellidos}. Consulta el rendimiento de tus cursos.`;
        bienvenida.textContent = textoBienvenida;
      }

      const btnPdfGeneral = document.getElementById('btnDescargarPdfGeneral');
      if (btnPdfGeneral) {
        btnPdfGeneral.hidden = usuario.rol !== 'administrador';
      }

      await cargarCursosReporte();
      configurarEventosGlobales();
    } catch (error) {
      window.location.href = 'login.html';
    }
  }

  async function cargarCursosReporte() {
    const lista = document.getElementById('listaCursosReportes');
    const estado = document.getElementById('estadoListaCursos');

    if (!lista || !estado) return;

    try {
      mostrarEstado(estado, 'Cargando cursos...', 'cargando');

      const data = await consumirAPI('/api/reportes/cursos');
      const cursos = data.cursos || [];

      if (cursos.length === 0) {
        lista.innerHTML = '';
        mostrarEstado(estado, 'No tienes cursos para reportar.', 'vacio');
        return;
      }

      mostrarEstado(estado, '', '');
      lista.innerHTML = cursos.map(renderizarTarjetaCurso).join('');
      configurarEventosCursos();
    } catch (error) {
      mostrarEstado(estado, error.message || 'Error al cargar cursos.', 'error');
    }
  }

  function renderizarTarjetaCurso(curso) {
    const esAdmin = rolUsuario === 'administrador';
    const infoInstructor = esAdmin
      ? `<p class="meta-curso-reporte">Instructor: ${escaparHtml(curso.instructor_nombre)}</p>`
      : '';
    const estadoTexto = curso.curso_estado ? 'Activo' : 'Inactivo';

    return `
      <article class="tarjeta-curso catalogo-tarjeta curso-reporte" data-curso-id="${curso.id_curso}">
        <div class="contenido-tarjeta-curso">
          <h3>${escaparHtml(curso.titulo)}</h3>
          ${infoInstructor}
          <p class="meta-curso-reporte">Estado: ${estadoTexto}</p>
          <p class="meta-curso-reporte">Estudiantes inscritos: <strong>${curso.total_estudiantes}</strong></p>
          <p class="meta-curso-reporte">Lecciones: ${curso.total_lecciones}</p>
          <button type="button" class="boton boton-catalogo" data-ver-reporte="${curso.id_curso}">Ver reporte</button>
        </div>
      </article>
    `;
  }

  function configurarEventosCursos() {
    document.querySelectorAll('[data-ver-reporte]').forEach((boton) => {
      boton.addEventListener('click', () => {
        const id = parseInt(boton.dataset.verReporte, 10);
        if (!Number.isNaN(id)) cargarDetalleCurso(id);
      });
    });
  }

  async function cargarDetalleCurso(idCurso) {
    const seccionLista = document.getElementById('seccionListaCursos');
    const seccionDetalle = document.getElementById('seccionDetalleCurso');
    const titulo = document.getElementById('tituloDetalleCurso');
    const resumen = document.getElementById('resumenCursoReporte');
    const estado = document.getElementById('estadoDetalleCurso');
    const tabla = document.getElementById('tablaEstudiantesReporte');

    if (!seccionLista || !seccionDetalle) return;

    idCursoActual = idCurso;
    seccionLista.hidden = true;
    seccionDetalle.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      mostrarEstado(estado, 'Cargando estudiantes...', 'cargando');
      if (tabla) tabla.innerHTML = '';

      const data = await consumirAPI(`/api/reportes/cursos/${encodeURIComponent(idCurso)}/estudiantes`);
      const curso = data.curso;
      const estudiantes = data.estudiantes || [];

      if (titulo) titulo.textContent = escaparHtml(curso.titulo);
      if (resumen) {
        resumen.innerHTML = `
          <div class="item-resumen-reporte">
            <span class="etiqueta-resumen">Total de estudiantes inscritos</span>
            <span class="valor-resumen">${curso.total_estudiantes}</span>
          </div>
          <div class="item-resumen-reporte">
            <span class="etiqueta-resumen">Lecciones del curso</span>
            <span class="valor-resumen">${curso.total_lecciones}</span>
          </div>
        `;
      }

      if (estudiantes.length === 0) {
        mostrarEstado(estado, 'Este curso no tiene estudiantes inscritos.', 'vacio');
        return;
      }

      mostrarEstado(estado, '', '');
      if (tabla) tabla.innerHTML = renderizarTablaEstudiantes(estudiantes);
      configurarEventosTabla();
    } catch (error) {
      mostrarEstado(estado, error.message || 'Error al cargar el reporte.', 'error');
    }
  }

  function renderizarTablaEstudiantes(estudiantes) {
    const filas = estudiantes.map((est) => {
      const badgeEstado = est.estado === 'finalizado'
        ? '<span class="badge badge-finalizado">Finalizado</span>'
        : '<span class="badge badge-en-curso">En curso</span>';
      const badgeAprobacion = est.aprobo_examen
        ? '<span class="badge badge-aprobado">Aprobado</span>'
        : '<span class="badge badge-pendiente">Pendiente</span>';
      const mejorNota = est.mejor_nota !== null ? `${est.mejor_nota}%` : '—';
      const tieneIntentos = est.intentos.length > 0;

      return `
        <tr>
          <td>${escaparHtml(est.apellidos)} ${escaparHtml(est.nombres)}</td>
          <td>${escaparHtml(est.correo)}</td>
          <td>
            <div class="progreso-celda">
              <span>${est.porcentaje}%</span>
              <small>(${est.completadas}/${est.total_lecciones})</small>
            </div>
          </td>
          <td>${badgeEstado}</td>
          <td>${mejorNota}</td>
          <td>${badgeAprobacion}</td>
          <td>
            ${tieneIntentos
              ? `<button type="button" class="boton boton-mini" data-toggle-intentos="${est.id_usuario}" data-intentos-count="${est.intentos.length}">${est.intentos.length} intento(s)</button>`
              : '<span class="sin-intentos">Sin intentos</span>'}
          </td>
        </tr>
        ${tieneIntentos ? renderizarFilaIntentos(est) : ''}
      `;
    }).join('');

    return `
      <div class="tabla-contenedor">
        <table class="tabla-panel tabla-reportes">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Correo</th>
              <th>Progreso</th>
              <th>Estado</th>
              <th>Mejor nota</th>
              <th>Examen</th>
              <th>Intentos</th>
            </tr>
          </thead>
          <tbody>
            ${filas}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderizarFilaIntentos(est) {
    const filasIntentos = est.intentos.map((intento, index) => `
      <tr>
        <td>#${est.intentos.length - index}</td>
        <td>${intento.puntaje}%</td>
        <td>${intento.aprobado ? 'Aprobado' : 'No aprobado'}</td>
        <td>${formatearFechaCorta(intento.fecha_fin)}</td>
      </tr>
    `).join('');

    return `
      <tr class="fila-intentos" data-fila-intentos="${est.id_usuario}" hidden>
        <td colspan="7">
          <div class="tabla-intentos-contenedor">
            <table class="tabla-panel tabla-intentos">
              <thead>
                <tr>
                  <th>Intento</th>
                  <th>Calificación</th>
                  <th>Resultado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                ${filasIntentos}
              </tbody>
            </table>
          </div>
        </td>
      </tr>
    `;
  }

  function configurarEventosTabla() {
    document.querySelectorAll('[data-toggle-intentos]').forEach((boton) => {
      boton.addEventListener('click', () => {
        const id = boton.dataset.toggleIntentos;
        const fila = document.querySelector(`[data-fila-intentos="${id}"]`);
        if (!fila) return;
        fila.hidden = !fila.hidden;
        boton.textContent = fila.hidden ? `${boton.dataset.intentosCount || 'Ver'} intento(s)` : 'Ocultar intentos';
      });
    });
  }

  async function descargarExcel(url, nombreArchivo) {
    try {
      const respuesta = await fetch(url, {
        method: 'GET',
        credentials: 'include'
      });

      if (!respuesta.ok) {
        const data = await respuesta.json().catch(() => ({}));
        throw new Error(data.mensaje || 'Error al descargar el Excel');
      }

      const blob = await respuesta.blob();
      const urlBlob = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = urlBlob;
      enlace.download = nombreArchivo;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (error) {
      alert(error.message || 'No se pudo descargar el Excel.');
    }
  }

  function configurarEventosGlobales() {
    const btnVolver = document.getElementById('btnVolverCursos');
    if (btnVolver) {
      btnVolver.addEventListener('click', volverAListaCursos);
    }

    const btnDescargarTodos = document.getElementById('btnDescargarTodosCursos');
    if (btnDescargarTodos) {
      btnDescargarTodos.addEventListener('click', () => {
        const hoy = new Date().toISOString().split('T')[0];
        descargarExcel('/api/reportes/cursos/excel', `reporte-cursos-${hoy}.xlsx`);
      });
    }

    const btnDescargarPdfGeneral = document.getElementById('btnDescargarPdfGeneral');
    if (btnDescargarPdfGeneral) {
      btnDescargarPdfGeneral.addEventListener('click', async () => {
        try {
          const hoy = new Date().toISOString().split('T')[0];
          const respuesta = await fetch('/api/reportes/general/pdf', {
            method: 'GET',
            credentials: 'include'
          });

          if (!respuesta.ok) {
            const data = await respuesta.json().catch(() => ({}));
            throw new Error(data.mensaje || 'Error al descargar el PDF');
          }

          const blob = await respuesta.blob();
          const urlBlob = window.URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = urlBlob;
          enlace.download = `reporte-general-${hoy}.pdf`;
          document.body.appendChild(enlace);
          enlace.click();
          enlace.remove();
          window.URL.revokeObjectURL(urlBlob);
        } catch (error) {
          alert(error.message || 'No se pudo descargar el PDF.');
        }
      });
    }

    const btnDescargarCurso = document.getElementById('btnDescargarCursoActual');
    if (btnDescargarCurso) {
      btnDescargarCurso.addEventListener('click', () => {
        if (!idCursoActual) return;
        const hoy = new Date().toISOString().split('T')[0];
        descargarExcel(
          `/api/reportes/cursos/${encodeURIComponent(idCursoActual)}/estudiantes/excel`,
          `reporte-curso-${idCursoActual}-${hoy}.xlsx`
        );
      });
    }
  }

  function volverAListaCursos() {
    const seccionLista = document.getElementById('seccionListaCursos');
    const seccionDetalle = document.getElementById('seccionDetalleCurso');
    if (seccionLista) seccionLista.hidden = false;
    if (seccionDetalle) seccionDetalle.hidden = true;
    idCursoActual = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', inicializarReportes);
})();
