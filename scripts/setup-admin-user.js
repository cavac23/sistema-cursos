const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  const registro = await post('/api/registro', {
    nombres: 'Admin',
    apellidos: 'Sistema',
    correo: 'admin@test.com',
    contrasena: 'Test1234',
    rol: 'usuario'
  });
  console.log('Registro:', registro.status, registro.body.mensaje || registro.body);
})();
