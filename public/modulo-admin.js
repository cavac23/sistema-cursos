(function () {
  'use strict';

  const TARJETAS = [
    { clave: 'totalUsuariosActivos', etiqueta: 'Total de usuarios activos' },
    { clave: 'totalCursosActivos', etiqueta: 'Total de cursos activos' },
    { clave: 'totalInscripciones', etiqueta: 'Total de inscripciones' },
    { clave: 'totalCursosCompletados', etiqueta: 'Cursos completados' },
    { clave: 'totalCertificados', etiqueta: 'Certificados emitidos' },
    { clave: 'totalExamenesRendidos', etiqueta: 'Exámenes rendidos' }
  ];

  function mostrarEstado(elemento, texto, tipo) {
    if (!elemento) return;
    elemento.textContent = texto || '';
    elemento.className = `estado-modulo2 ${tipo || ''}`.trim();
    elemento.style.display = texto ? 'block' : 'none';
  }

  function renderizarTarjetas(resumen) {
    return TARJETAS.map((tarjeta) => `
      <article class="item-resumen-reporte tarjeta-dashboard-admin">
        <span class="etiqueta-resumen">${tarjeta.etiqueta}</span>
        <span class="valor-resumen">${resumen[tarjeta.clave] ?? 0}</span>
      </article>
    `).join('');
  }

  async function descargarArchivo(url, nombreArchivo, tipoError) {
    const respuesta = await fetch(url, {
      method: 'GET',
      credentials: 'include'
    });

    if (!respuesta.ok) {
      const data = await respuesta.json().catch(() => ({}));
      throw new Error(data.mensaje || tipoError);
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
  }

  async function cargarDashboard() {
    const contenedor = document.getElementById('tarjetasDashboard');
    const estado = document.getElementById('estadoDashboard');

    try {
      mostrarEstado(estado, 'Cargando resumen...', 'cargando');
      const data = await consumirAPI('/api/dashboard/admin');
      if (contenedor) contenedor.innerHTML = renderizarTarjetas(data);
      mostrarEstado(estado, '', '');
    } catch (error) {
      if (contenedor) contenedor.innerHTML = '';
      mostrarEstado(estado, error.message || 'Error al cargar el dashboard.', 'error');
    }
  }

  function configurarAcciones() {
    const btnPdf = document.getElementById('btnPdfGeneralAdmin');
    if (btnPdf) {
      btnPdf.addEventListener('click', async () => {
        try {
          const hoy = new Date().toISOString().split('T')[0];
          await descargarArchivo(
            '/api/reportes/general/pdf',
            `reporte-general-${hoy}.pdf`,
            'Error al descargar el PDF'
          );
        } catch (error) {
          alert(error.message || 'No se pudo descargar el PDF.');
        }
      });
    }

    const btnExcel = document.getElementById('btnExcelGeneralAdmin');
    if (btnExcel) {
      btnExcel.addEventListener('click', async () => {
        try {
          await descargarArchivo(
            '/api/reportes/cursos/excel',
            'Reporte_Participantes_Vinculacion_2026.xlsx',
            'Error al descargar el Excel'
          );
        } catch (error) {
          alert(error.message || 'No se pudo descargar el Excel.');
        }
      });
    }
  }

  async function inicializarPanelAdmin() {
    if (document.body.dataset.pagina !== 'panel-admin') return;

    try {
      const data = await consumirAPI('/api/perfil');
      const usuario = data.usuario;

      if (usuario.rol !== 'administrador') {
        window.location.href = redirigirPorRol(usuario.rol);
        return;
      }

      const bienvenida = document.getElementById('bienvenidaAdmin');
      if (bienvenida) {
        bienvenida.textContent = `Bienvenido, ${usuario.nombres} ${usuario.apellidos}. Consulta el estado general del sistema.`;
      }

      configurarAcciones();
      await cargarDashboard();
    } catch (error) {
      window.location.href = 'login.html';
    }
  }

  document.addEventListener('DOMContentLoaded', inicializarPanelAdmin);
})();
