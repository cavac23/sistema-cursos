/**
 * Validación funcional Paso 2 — flujo encuesta de satisfacción.
 * Uso: node scripts/validar-encuesta-paso2.js
 * Requiere servidor en http://localhost:3000
 */
require('dotenv').config();
const { execSync } = require('child_process');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const ESTUDIANTE = { correo: 'estudiante@test.com', contrasena: 'Test1234' };
const ADMIN = { correo: 'admin@test.com', contrasena: 'Test1234' };
const ID_CURSO = 6;

const resultados = [];

function ok(paso, detalle) {
  resultados.push({ paso, ok: true, detalle });
  console.log(`[OK] ${paso}: ${detalle}`);
}

function fail(paso, detalle) {
  resultados.push({ paso, ok: false, detalle });
  console.error(`[FAIL] ${paso}: ${detalle}`);
}

function sqlcmdQuery(queryText) {
  const server = process.env.DB_SERVER;
  const database = process.env.DB_DATABASE || 'SistemaCursos';
  const cmd = `sqlcmd -S "${server}" -E -d "${database}" -Q "${queryText.replace(/"/g, '\\"')}" -W -s "|" -h -1`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return out.trim();
}

async function resetEncuestaEstudiante() {
  sqlcmdQuery(`
    UPDATE i SET encuesta_completada = 0, fecha_encuesta_completada = NULL
    FROM Inscripciones i
    INNER JOIN Usuarios u ON u.id_usuario = i.id_usuario
    WHERE u.correo = '${ESTUDIANTE.correo}' AND i.id_curso = ${ID_CURSO} AND i.estado = 1
  `);
}

function leerInscripcionDb() {
  const out = sqlcmdQuery("SELECT CAST(i.encuesta_completada AS INT), CONVERT(VARCHAR(30), i.fecha_encuesta_completada, 126) FROM Inscripciones i INNER JOIN Usuarios u ON u.id_usuario = i.id_usuario WHERE u.correo = 'estudiante@test.com' AND i.id_curso = 6 AND i.estado = 1");
  const line = out.split(/\r?\n/).map((l) => l.trim()).find((l) => /^\d+\|/.test(l));
  if (!line) return null;
  const [encuesta, fecha] = line.split('|');
  return {
    encuesta_completada: encuesta === '1',
    fecha_encuesta_completada: fecha && fecha !== 'NULL' ? fecha : null
  };
}

function parseCookies(setCookieHeaders) {
  const jar = {};
  for (const h of setCookieHeaders || []) {
    const part = h.split(';')[0];
    const eq = part.indexOf('=');
    if (eq > 0) jar[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return jar;
}

function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function login(credenciales) {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: credenciales.correo, contrasena: credenciales.contrasena }),
    redirect: 'manual'
  });
  const data = await res.json();
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  const jar = parseCookies(raw);
  return { res, data, jar };
}

async function apiFetch(path, jar, options = {}) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Cookie: cookieHeader(jar)
    }
  });
}

async function validarUI(jar) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    return { omitido: true, motivo: 'playwright no instalado' };
  }

  const browser = await playwright.chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const cookies = Object.entries(jar).map(([name, value]) => ({
    name, value, domain: 'localhost', path: '/'
  }));
  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.goto(`${BASE}/curso-detalle.html?id=${ID_CURSO}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const ui = await page.evaluate(() => {
    const sidebar = document.querySelector('.plataforma-sidebar');
    const encuesta = document.getElementById('seccionEncuestaCurso');
    const hijos = sidebar ? Array.from(sidebar.children).map((el) => el.id || el.className.split(' ')[0]) : [];
    const encuestaIndex = hijos.indexOf('seccionEncuestaCurso');
    const sidebarRect = sidebar?.getBoundingClientRect();
    const encuestaRect = encuesta?.getBoundingClientRect();
    const link = encuesta?.querySelector('a.boton-encuesta');
    const cs = encuesta ? getComputedStyle(encuesta) : null;
    const visibleSinScroll = encuestaRect && sidebarRect
      ? encuestaRect.top >= sidebarRect.top && encuestaRect.bottom <= sidebarRect.bottom
      : false;
    return {
      sidebarExiste: !!sidebar,
      encuestaExiste: !!encuesta,
      ordenSidebar: hijos,
      encuestaEsPrimerHijo: encuestaIndex === 0,
      visibleSinScroll,
      encuestaStyles: cs ? {
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        background: cs.backgroundColor,
        borderLeft: cs.borderLeftWidth
      } : null,
      urlEncuesta: link?.href || null,
      targetEncuesta: link?.target || null,
      relEncuesta: link?.rel || null,
      bloqueado: !!document.querySelector('.layout-plataforma-bloqueada'),
      barraProgreso: !!document.getElementById('barraProgresoCurso'),
      seccionExamen: !!document.getElementById('seccionExamenCurso'),
      navegacionLecciones: !!document.getElementById('navegacionLecciones')
    };
  });

  let popupUrl = null;
  page.once('popup', async (popup) => {
    await popup.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    popupUrl = popup.url();
  });

  const btnAbrir = page.locator('#seccionEncuestaCurso a.boton-encuesta');
  if (await btnAbrir.count()) {
    await btnAbrir.click();
    await page.waitForTimeout(2500);
  }

  let dialogMsg = null;
  page.once('dialog', async (d) => {
    dialogMsg = d.message();
    await d.accept();
  });

  const btnCompletada = page.locator('#btnEncuestaCompletada');
  if (await btnCompletada.count()) {
    await btnCompletada.click();
    await page.waitForTimeout(2000);
  }

  const postUi = await page.evaluate(() => ({
    encuestaVisible: !!document.getElementById('seccionEncuestaCurso'),
    barraProgreso: !!document.getElementById('barraProgresoCurso'),
    seccionExamen: !!document.getElementById('seccionExamenCurso'),
    navegacionLecciones: !!document.getElementById('navegacionLecciones')
  }));

  await browser.close();
  return { ...ui, popupUrl, dialogMsg, postUi };
}

async function main() {
  console.log('=== Validación Paso 2 — Encuesta de satisfacción ===\n');

  try {
    const health = await fetch(`${BASE}/api/test-db`);
    if (!health.ok) throw new Error(`test-db HTTP ${health.status}`);
    ok('0', 'Servidor activo y BD accesible');
  } catch (e) {
    fail('0', `Servidor no disponible: ${e.message}`);
    process.exit(1);
  }

  await resetEncuestaEstudiante();
  ok('prep', 'encuesta_completada reseteada a false para prueba limpia');

  const loginEst = await login(ESTUDIANTE);
  if (!loginEst.res.ok || !loginEst.data.ok) {
    fail('1', `Login estudiante falló: ${loginEst.data.mensaje || loginEst.res.status}`);
    imprimirResumen();
    process.exit(1);
  }
  ok('1', `Login exitoso — rol ${loginEst.data.usuario?.rol || loginEst.data.rol || 'estudiante'}`);

  const progresoPreRaw = await (await apiFetch(`/api/cursos/${ID_CURSO}/progreso`, loginEst.jar)).json();
  const progresoPre = progresoPreRaw.progreso || progresoPreRaw;
  if (!progresoPreRaw.ok) {
    fail('2', `No se pudo cargar progreso: ${progresoPreRaw.mensaje}`);
  } else {
    ok('2', `Detalle curso ${ID_CURSO} — progreso ${progresoPre.porcentaje}%, encuesta_completada=${progresoPre.encuesta_completada}`);
  }

  const examenPre = await (await apiFetch(`/api/cursos/${ID_CURSO}/examen/estado`, loginEst.jar)).json();
  const certPre = await (await apiFetch(`/api/cursos/${ID_CURSO}/certificado`, loginEst.jar)).json();

  let ui;
  try {
    ui = await validarUI(loginEst.jar);
  } catch (e) {
    ui = { error: e.message };
  }

  if (ui.omitido) {
    fail('3-5', `UI no validada: ${ui.motivo}`);
  } else if (ui.error) {
    fail('3-5', `Error UI: ${ui.error}`);
  } else {
    if (ui.bloqueado) fail('3', 'Plataforma bloqueada — sin acceso completo');
    else if (!ui.encuestaExiste) fail('3', 'Bloque encuesta no renderizado');
    else if (!ui.encuestaEsPrimerHijo) fail('3', `Encuesta no es primer hijo del sidebar. Orden: ${ui.ordenSidebar.join(', ')}`);
    else ok('3', 'Encuesta al inicio del sidebar');

    if (ui.visibleSinScroll) ok('3b', 'Encuesta visible sin scroll en viewport del sidebar');
    else fail('3b', 'Encuesta requiere scroll o está parcialmente fuera del viewport del sidebar');

    if (ui.encuestaStyles?.display === 'block' && ui.encuestaStyles?.visibility === 'visible') {
      ok('4', `Diseño integrado — fondo ${ui.encuestaStyles.background}, borde izq ${ui.encuestaStyles.borderLeft}`);
    } else {
      fail('4', `Estilos inesperados: ${JSON.stringify(ui.encuestaStyles)}`);
    }

    if (ui.urlEncuesta?.includes('docs.google.com/forms') && ui.targetEncuesta === '_blank') {
      ok('5', `Enlace encuesta OK (${ui.urlEncuesta.slice(0, 60)}...) target=_blank`);
    } else {
      fail('5', `Enlace encuesta inválido: href=${ui.urlEncuesta}, target=${ui.targetEncuesta}`);
    }

    if (ui.popupUrl?.includes('docs.google.com/forms')) {
      ok('5b', `Google Forms abrió en nueva pestaña: ${ui.popupUrl.slice(0, 70)}...`);
    } else {
      fail('5b', `Popup no detectado o URL distinta: ${ui.popupUrl}`);
    }

    if (ui.dialogMsg?.includes('registrada')) {
      ok('7d', `Mensaje confirmación: "${ui.dialogMsg}"`);
    } else {
      fail('7d', `Mensaje confirmación inesperado: "${ui.dialogMsg}"`);
    }

    if (!ui.postUi?.encuestaVisible) ok('7c', 'Bloque encuesta desapareció tras confirmar');
    else fail('7c', 'Bloque encuesta sigue visible tras confirmar');

    if (ui.postUi?.barraProgreso && ui.postUi?.seccionExamen && ui.postUi?.navegacionLecciones) {
      ok('10', 'Progreso, examen y navegación de lecciones intactos tras encuesta');
    } else {
      fail('10', `Elementos faltantes post-encuesta: ${JSON.stringify(ui.postUi)}`);
    }
  }

  const postEncuesta = await (await apiFetch(`/api/cursos/${ID_CURSO}/encuesta-completada`, loginEst.jar, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })).json();

  if (postEncuesta.ok && postEncuesta.encuesta_completada) {
    ok('7a', `POST encuesta-completada OK — ${postEncuesta.mensaje}`);
  } else {
    fail('7a', `POST falló o respuesta inesperada: ${JSON.stringify(postEncuesta)}`);
  }

  const progresoPostRaw = await (await apiFetch(`/api/cursos/${ID_CURSO}/progreso`, loginEst.jar)).json();
  const progresoPost = progresoPostRaw.progreso || progresoPostRaw;
  if (progresoPost.encuesta_completada === true) {
    ok('7b', `API progreso confirma encuesta_completada=true, fecha=${progresoPost.fecha_encuesta_completada || 'N/A'}`);
  } else {
    fail('7b', `encuesta_completada en API: ${progresoPost.encuesta_completada}`);
  }

  const filaDb = leerInscripcionDb();
  if (filaDb?.encuesta_completada && filaDb.fecha_encuesta_completada) {
    ok('8', `BD actualizada — encuesta_completada=1, fecha=${filaDb.fecha_encuesta_completada}`);
  } else {
    fail('8', `BD no actualizada: ${JSON.stringify(filaDb)}`);
  }

  const examenPost = await (await apiFetch(`/api/cursos/${ID_CURSO}/examen/estado`, loginEst.jar)).json();
  const certPost = await (await apiFetch(`/api/cursos/${ID_CURSO}/certificado`, loginEst.jar)).json();
  if (examenPre.ok === examenPost.ok) ok('10b', 'Estado examen sin cambios');
  else fail('10b', 'Estado examen cambió inesperadamente');
  if ((certPre.certificado?.codigo || null) === (certPost.certificado?.codigo || null)) ok('10c', 'Certificado sin cambios');
  else fail('10c', 'Certificado cambió inesperadamente');

  if (progresoPre.porcentaje === progresoPost.porcentaje) ok('10d', `Progreso intacto (${progresoPost.porcentaje}%)`);
  else fail('10d', `Progreso cambió: ${progresoPre.porcentaje} → ${progresoPost.porcentaje}`);

  const loginAdmin = await login(ADMIN);
  if (!loginAdmin.res.ok || !loginAdmin.data.ok) {
    fail('9', `Login admin falló: ${loginAdmin.data.mensaje || loginAdmin.res.status}`);
  } else {
    const excelRes = await apiFetch('/api/reportes/cursos/excel', loginAdmin.jar);
    if (!excelRes.ok) {
      fail('9', `Excel admin HTTP ${excelRes.status}`);
    } else {
      const buf = Buffer.from(await excelRes.arrayBuffer());
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const headerRowIdx = rows.findIndex((r) => r.some((c) => String(c).includes('Encuesta')));
      const header = rows[headerRowIdx] || [];
      const colEncuesta = header.findIndex((c) => String(c).toLowerCase().includes('encuesta'));
      const colCorreo = header.findIndex((c) => String(c).toLowerCase().includes('correo'));
      const filaEst = rows.slice(headerRowIdx + 1).find((r) => String(r[colCorreo]).toLowerCase() === ESTUDIANTE.correo && String(r[0]) === String(ID_CURSO));
      const valorEncuesta = filaEst ? filaEst[colEncuesta] : null;
      if (valorEncuesta === 'Sí') {
        ok('9', `Excel admin — fila ${ESTUDIANTE.correo} curso ${ID_CURSO}: Encuesta = "Sí"`);
      } else {
        fail('9', `Excel admin — Encuesta="${valorEncuesta}" para ${ESTUDIANTE.correo} (fila=${JSON.stringify(filaEst)})`);
      }
    }
  }

  const outPath = path.join(__dirname, 'validar-encuesta-resultado.json');
  fs.writeFileSync(outPath, JSON.stringify({ fecha: new Date().toISOString(), resultados, ui }, null, 2));
  console.log(`\nResultado guardado en ${outPath}`);
  imprimirResumen();
  process.exit(resultados.some((r) => !r.ok) ? 1 : 0);
}

function imprimirResumen() {
  const total = resultados.length;
  const passed = resultados.filter((r) => r.ok).length;
  console.log(`\n=== RESUMEN: ${passed}/${total} verificaciones OK ===`);
}

main().catch((e) => {
  console.error('Error fatal:', e);
  process.exit(1);
});
