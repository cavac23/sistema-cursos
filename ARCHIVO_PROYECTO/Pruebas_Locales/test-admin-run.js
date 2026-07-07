const http = require('http');
const { URL } = require('url');

const BASE = process.env.TEST_BASE || 'http://localhost:3001';
const results = [];

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const setCookie = res.headers['set-cookie'];
        let cookieHeader = cookie || '';
        if (setCookie) {
          cookieHeader = setCookie.map((c) => c.split(';')[0]).join('; ');
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buffer,
          cookie: cookieHeader
        });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(correo, contrasena) {
  const res = await request('POST', '/api/login', { correo, contrasena });
  const data = JSON.parse(res.body.toString());
  if (res.status !== 200 || !data.ok) {
    throw new Error(data.mensaje || `Login falló (${res.status})`);
  }
  return { cookie: res.cookie, usuario: data.usuario };
}

async function test(name, fn) {
  try {
    await fn();
    results.push({ prueba: name, resultado: 'OK', detalle: '' });
  } catch (error) {
    results.push({ prueba: name, resultado: 'FAIL', detalle: error.message });
  }
}

(async () => {
  let adminCookie = null;

  await test('Login instructor', async () => {
    const { usuario } = await login('instructor@test.com', 'Test1234');
    if (usuario.rol !== 'instructor') throw new Error(`Rol ${usuario.rol}`);
  });

  await test('Dashboard 403 instructor', async () => {
    const { cookie } = await login('instructor@test.com', 'Test1234');
    const res = await request('GET', '/api/dashboard/admin', null, cookie);
    if (res.status !== 403) throw new Error(`Status ${res.status}`);
  });

  await test('PDF 403 instructor', async () => {
    const { cookie } = await login('instructor@test.com', 'Test1234');
    const res = await request('GET', '/api/reportes/general/pdf', null, cookie);
    if (res.status !== 403) throw new Error(`Status ${res.status}`);
  });

  await test('Reportes instructor', async () => {
    const { cookie } = await login('instructor@test.com', 'Test1234');
    const res = await request('GET', '/api/reportes/cursos', null, cookie);
    const data = JSON.parse(res.body.toString());
    if (res.status !== 200 || !data.ok) throw new Error('No ok');
  });

  await test('Excel instructor', async () => {
    const { cookie } = await login('instructor@test.com', 'Test1234');
    const res = await request('GET', '/api/reportes/cursos/excel', null, cookie);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!String(res.headers['content-type'] || '').includes('spreadsheet')) {
      throw new Error('Content-Type incorrecto');
    }
    if (res.body.length < 1000) throw new Error('Archivo pequeño');
  });

  await test('Login estudiante', async () => {
    const { usuario } = await login('estudiante@test.com', 'Test1234');
    if (usuario.rol !== 'estudiante') throw new Error(`Rol ${usuario.rol}`);
  });

  await test('Reportes 403 estudiante', async () => {
    const { cookie } = await login('estudiante@test.com', 'Test1234');
    const res = await request('GET', '/api/reportes/cursos', null, cookie);
    if (res.status !== 403) throw new Error(`Status ${res.status}`);
  });

  await test('Login administrador', async () => {
    const { cookie, usuario } = await login('admin@test.com', 'Test1234');
    if (usuario.rol !== 'administrador') throw new Error(`Rol ${usuario.rol}`);
    adminCookie = cookie;
  });

  if (adminCookie) {
    await test('Dashboard administrador', async () => {
      const res = await request('GET', '/api/dashboard/admin', null, adminCookie);
      const data = JSON.parse(res.body.toString());
      if (res.status !== 200 || !data.ok) throw new Error(data.mensaje || `Status ${res.status}`);
      if (data.totalUsuariosActivos === undefined) throw new Error('Falta totalUsuariosActivos');
    });

    await test('PDF administrador', async () => {
      const res = await request('GET', '/api/reportes/general/pdf', null, adminCookie);
      if (res.status !== 200) throw new Error(`Status ${res.status}`);
      if (!String(res.headers['content-type'] || '').includes('pdf')) {
        throw new Error('Content-Type incorrecto');
      }
      if (res.body.slice(0, 4).toString() !== '%PDF') throw new Error('No es PDF válido');
    });

    await test('Admin ve >= cursos que instructor', async () => {
      const inst = await login('instructor@test.com', 'Test1234');
      const resInst = await request('GET', '/api/reportes/cursos', null, inst.cookie);
      const resAdmin = await request('GET', '/api/reportes/cursos', null, adminCookie);
      const instData = JSON.parse(resInst.body.toString());
      const adminData = JSON.parse(resAdmin.body.toString());
      if (adminData.cursos.length < instData.cursos.length) {
        throw new Error(`${adminData.cursos.length} < ${instData.cursos.length}`);
      }
    });
  }

  console.table(results);
  const failed = results.filter((r) => r.resultado === 'FAIL');
  process.exit(failed.length ? 1 : 0);
})();
