# Plataforma de Cursos Virtuales ITQ

**Proyecto de Vinculación con la Sociedad 2026**  
Instituto Superior Tecnológico Quito (ITQ)

---

## Descripción general

Sistema web para la gestión de cursos virtuales orientado a la vinculación con la sociedad. Permite publicar cursos, inscribir participantes, registrar progreso, aplicar exámenes finales, emitir certificados y generar reportes institucionales de participación.

La plataforma está pensada para que instructores ITQ administren contenidos, los participantes completen cursos en línea y los administradores obtengan evidencia documental del proyecto (Excel y PDF).

---

## Objetivo del sistema

- Ofrecer cursos virtuales accesibles al público y a la comunidad ITQ.
- Registrar la participación de estudiantes/usuarios en cada curso.
- Medir progreso, aprobación y certificación.
- Recopilar encuesta de satisfacción al finalizar cursos.
- Entregar reportes auditables para la presentación institucional del proyecto.

---

## Tecnologías utilizadas

| Capa | Tecnología |
|------|------------|
| Backend | Node.js 18+, Express 4 |
| Base de datos | Microsoft SQL Server |
| Frontend | HTML5, CSS3, JavaScript (vanilla, sin framework) |
| Autenticación | `express-session` + cookies, contraseñas con `bcryptjs` |
| Archivos | `multer` (videos, documentos, portadas) |
| Reportes | `xlsx` (Excel), `pdfkit` (PDF) |
| Control de versiones | Git / GitHub |

---

## Requisitos

### Software

| Componente | Versión / notas |
|------------|-----------------|
| Node.js | 18 o superior (incluye `npm`) |
| SQL Server | Express, Developer o instancia nombrada local |
| SSMS o `sqlcmd` | Para ejecutar scripts SQL |

### Hardware mínimo recomendado

- 4 GB RAM
- 2 GB libres en disco (incluye dependencias y archivos subidos)

---

## Instalación

1. Clonar o descargar el repositorio.
2. Abrir una terminal en la carpeta del proyecto.
3. Instalar dependencias:

```bash
npm install
```

4. Configurar el entorno (ver siguiente sección).
5. Ejecutar los scripts SQL en orden.
6. Iniciar el servidor.

---

## Configuración del entorno

1. Copiar la plantilla:

```bash
copy .env.example .env
```

*(En Linux/macOS: `cp .env.example .env`)*

2. Editar `.env` con los datos de su instancia SQL Server.

Ejemplo con **autenticación SQL** (recomendado en desarrollo):

```env
PORT=3000
SESSION_SECRET=clave_segura_local

DB_SERVER=localhost
DB_DATABASE=SistemaCursos
DB_TRUSTED_CONNECTION=false
DB_USER=sa
DB_PASSWORD=TuClaveSegura123!

UPLOAD_DIR=uploads
UPLOAD_MAX_VIDEO_MB=200
UPLOAD_MAX_DOC_MB=50
UPLOAD_MAX_PORTADA_MB=5
```

> **Importante:** no subir el archivo `.env` a GitHub. Usar solo `.env.example` como referencia para el equipo.

### Conexión a SQL Server

- El driver principal es **`mssql` (Tedious)** con autenticación SQL (`DB_USER` / `DB_PASSWORD`).
- Si la instancia es SQL Express, suele ser `localhost\SQLEXPRESS`.
- Verificar el nombre exacto en SSMS → clic derecho en el servidor → Propiedades.

### Docker (opcional)

Existe `docker-compose.yaml` para levantar SQL Server 2022 Express. Si lo usa, la contraseña de `sa` definida en ese archivo puede diferir de `.env.example`. Ajuste `DB_SERVER`, `DB_USER` y `DB_PASSWORD` en `.env` según corresponda.

### Archivos subidos

Los instructores pueden subir:

- Videos MP4 → `uploads/videos/{idLeccion}/`
- Documentos PDF/DOCX/PPTX → `uploads/documentos/{idLeccion}/`
- Portadas JPG/PNG/WEBP → `uploads/portadas/{idCurso}/`

Esas carpetas **no se versionan** en Git (ver `.gitignore`).

---

## Scripts SQL — orden de ejecución

Ejecutar en SSMS **exactamente en este orden** sobre la base de datos correcta:

| Orden | Archivo | Descripción |
|-------|---------|-------------|
| 1 | `SQL/01_crear_base_modulo1.sql` | Base `SistemaCursos`, roles y usuarios |
| 2 | `SQL/02_crear_modulo2.sql` | Categorías, cursos, lecciones, contenidos |
| 3 | `SQL/03_agregar_subida_contenidos.sql` | Metadatos para subida de archivos |
| 4 | `SQL/04_actualizar_roles_produccion.sql` | Roles `usuario`, `estudiante_itq`, `administrador` |
| 5 | `SQL/05_crear_modulo3.sql` | Inscripciones |
| 6 | `SQL/06_crear_modulo3_progreso.sql` | Progreso por lección |
| 7 | `SQL/07_crear_modulo4_examenes.sql` | Exámenes, intentos y certificados |
| 8 | `SQL/08_asignar_admin_prueba.sql` | Asigna rol administrador a `admin@test.com` |
| 9 | `SQL/09_encuesta_satisfaccion.sql` | Columnas de encuesta en inscripciones |
| 10 | `SQL/10_crear_recursos_curso.sql` | *(Legacy — funcionalidad retirada)* Tabla `RecursosCurso`; no requerido en instalaciones nuevas |
| 11 | `SQL/11_preparar_base_produccion.sql` | **Solo producción:** limpia datos de prueba en `SistemaCursosProduccion` |
| 12 | `SQL/12_eliminar_recursos_generales.sql` | *(Opcional)* Elimina tabla `RecursosCurso` si existía por script 10 |
| 13 | `SQL/13_crear_base_produccion_limpia.sql` | **Producción limpia:** crea `SistemaCursosProduccion` vacía con estructura final (sin `RecursosCurso`, sin usuarios demo) |

### Advertencias importantes

| Script | Precaución |
|--------|------------|
| `01_crear_base_modulo1.sql` | **Borra y recrea** tablas `Usuarios` y `Roles`. Re-ejecutarlo elimina usuarios registrados. |
| `02_crear_modulo2.sql` | Incremental: no borra datos existentes. Es el script oficial del Módulo 2. |
| `04_actualizar_roles_produccion.sql` | Idempotente. No migra usuarios automáticamente. |
| `08_asignar_admin_prueba.sql` | Requiere que `admin@test.com` ya exista (registrado previamente). Solo desarrollo. |
| `11_preparar_base_produccion.sql` | **Solo** sobre `SistemaCursosProduccion`. **Nunca** sobre `SistemaCursos`. Elimina inscripciones, progreso, exámenes rendidos, certificados, encuestas y usuarios `@test.com`. |
| `13_crear_base_produccion_limpia.sql` | **Solo** en servidor de producción. Crea o recrea `SistemaCursosProduccion` vacía. **Nunca** sobre `SistemaCursos`. Si la base ya tiene tablas, requiere `@ConfirmarRecreacion = 1`. |

> No existe `02_crear_modulo_cursos.sql` en el repositorio actual. Usar únicamente `02_crear_modulo2.sql`.

### Base de datos de producción (`SistemaCursosProduccion`)

Hay **dos caminos** para preparar producción:

#### Opción A — Restaurar respaldo y limpiar (conserva cursos ya cargados)

1. Mantener `SistemaCursos` intacta como entorno de desarrollo (ya respaldada en `.bak`).
2. Restaurar el respaldo como nueva base **`SistemaCursosProduccion`** (SSMS: Restaurar con nombre distinto, o `RESTORE DATABASE ... WITH MOVE ...`).
3. Confirmar que los scripts **01–09** ya están aplicados en `SistemaCursosProduccion` (no ejecutar **08**, **10** en producción nueva).
4. Si existía `RecursosCurso` por script 10, ejecutar **`SQL/12_eliminar_recursos_generales.sql`**.
5. Revisar qué cursos, lecciones y exámenes reales deben conservarse.
6. Si algún curso sigue asignado a `instructor@test.com`, reasignarlo a un instructor real antes del paso 7.
7. Ejecutar **`SQL/11_preparar_base_produccion.sql`** conectado a `SistemaCursosProduccion`.
8. Revisar las consultas de verificación al final del script (inscripciones, certificados y progreso deben quedar en **0**).
9. Crear usuarios reales (registro web; administrador vía `UPDATE` de rol si aplica).
10. En el hosting, configurar `.env` con `DB_DATABASE=SistemaCursosProduccion`.

#### Opción B — Base limpia desde cero *(recomendada para go-live sin datos demo)*

1. Mantener `SistemaCursos` intacta (desarrollo).
2. En SSMS, abrir y revisar **`SQL/13_crear_base_produccion_limpia.sql`**.
3. Dejar `@ConfirmarRecreacion = 0` si es la primera ejecución; usar `1` solo si debe borrar y recrear tablas existentes.
4. Ejecutar el script completo sobre el servidor de producción.
5. Verificar al final: **5 roles**, **5 categorías**, **0 usuarios**, **0 cursos**, **RecursosCurso no existe**.
6. Registrar usuarios reales desde la plataforma.
7. Asignar rol `administrador` al correo real por SQL (consulta comentada al final del script 13).
8. Configurar `.env` del hosting con `DB_DATABASE=SistemaCursosProduccion` cuando corresponda.

**Scripts de producción — qué SÍ y qué NO ejecutar**

| Ejecutar en producción | NO ejecutar en producción |
|------------------------|---------------------------|
| 01, 02, 03, 04, 05, 06, 07, 09 *(o usar script 13 que los consolida)* | 08 — admin de prueba |
| 13 — base limpia desde cero | 10 — crea `RecursosCurso` (legacy) |
| 11 — solo si restauró .bak y quiere limpiar datos | Datos demo / auditorías |
| 12 — solo si `RecursosCurso` existía por error | |

**No ejecutar el script 11 ni el 13 sobre la base de desarrollo `SistemaCursos`.** Si aún necesita validar con `admin@test.com` / `instructor@test.com` / `estudiante@test.com`, use `@EliminarUsuariosPrueba = 0` en el script 11 hasta terminar esas pruebas.

---

## Cómo iniciar el servidor

**Producción / prueba:**

```bash
npm start
```

**Desarrollo (recarga automática):**

```bash
npm run dev
```

Salida esperada:

```txt
Servidor activo en http://localhost:3000
```

Abrir en el navegador: **http://localhost:3000**

Verificar conexión a base de datos:

```bash
curl http://localhost:3000/api/test-db
```

---

## Credenciales de prueba

| Rol | Correo | Contraseña |
|-----|--------|------------|
| **Administrador** | `admin@test.com` | `Test1234` |
| **Instructor** | `instructor@test.com` | `Test1234` |
| **Estudiante** | `estudiante@test.com` | `Test1234` |

### Crear el administrador de prueba

1. Registrar `admin@test.com` en `/registro.html` como **Usuario registrado** con contraseña `Test1234`.
2. Ejecutar `SQL/08_asignar_admin_prueba.sql` en SSMS.
3. Iniciar sesión: el sistema redirige a `admin.html`.

> Las cuentas de instructor y estudiante deben existir previamente en la base de datos (registro manual o datos de desarrollo). El rol `estudiante` es legacy del Módulo 1; los nuevos registros públicos usan el rol `usuario`.

---

## Funcionalidades por rol

### Visitante (sin sesión)

- Ver página de inicio (`index.html`).
- Explorar catálogo de cursos (`cursos.html`).
- Ver detalle básico de un curso (`curso-detalle.html`).
- Registrarse e iniciar sesión.

### Estudiante / Usuario (`usuario`, `estudiante`, `estudiante_itq`)

| Funcionalidad | Descripción |
|---------------|-------------|
| Panel de cursos | `estudiante.html` — cursos disponibles e inscripciones |
| Inscripción | Desde el detalle del curso |
| Progreso | Marcar lecciones como completadas |
| Video de lección | Reproducción del recurso principal (YouTube, MP4 o enlace) |
| Examen final | Disponible al completar todas las lecciones |
| Certificado | Vista previa al aprobar el examen |
| Encuesta | Aviso al completar/aprobar curso (Google Forms + confirmación local) |
| Perfil | Editar datos personales |

### Instructor (`instructor`)

| Funcionalidad | Descripción |
|---------------|-------------|
| Panel instructor | `instructor.html` — CRUD completo |
| Categorías | Crear, editar, activar/desactivar |
| Cursos | Crear, editar, portada, activar/desactivar |
| Lecciones | CRUD por curso (video/recurso principal obligatorio por URL) |
| Exámenes | Configurar examen final y preguntas |
| Estudiantes | Ver inscritos y progreso por curso |
| Reportes | `reportes.html` — Excel por curso y general |

> Registro como instructor: solo correos **`@itq.edu.ec`**.

### Administrador (`administrador`)

| Funcionalidad | Descripción |
|---------------|-------------|
| Dashboard | `admin.html` — indicadores generales del sistema |
| Reporte Excel | Participantes con datos de auditoría |
| Reporte PDF | Resumen institucional del sistema |
| Acceso a cursos y reportes | Igual que instructor, pero sobre **todos** los cursos |

---

## Reportes disponibles

| Reporte | Ruta / acceso | Rol | Formato | Descripción |
|---------|---------------|-----|---------|-------------|
| Excel participantes | `GET /api/reportes/cursos/excel` — botón en `admin.html` | instructor, administrador | `.xlsx` | Una fila por participante inscrito. Archivo: `Reporte_Participantes_Vinculacion_2026.xlsx` |
| Excel por curso | `GET /api/reportes/cursos/:id/estudiantes/excel` — `reportes.html` | instructor, administrador | `.xlsx` | Estudiantes e intentos de examen de un curso |
| PDF general | `GET /api/reportes/general/pdf` — botón en `admin.html` | administrador | `.pdf` | Resumen institucional con membretado ITQ |
| Dashboard JSON | `GET /api/dashboard/admin` | administrador | JSON | Datos para tarjetas del panel admin |

### Contenido del Excel de participantes (administrador)

Incluye, entre otros: ID curso, título, instructor, estado del curso, nombre completo, correo, progreso, certificado, encuesta de satisfacción, fechas de inscripción y finalización.

---

## Encuesta de satisfacción

Al completar o aprobar un curso, el estudiante inscrito ve un aviso para completar una encuesta externa (Google Forms).

- **No hay integración automática** con Google Forms.
- El botón **“Ya llené la encuesta”** registra localmente que el participante cumplió (`Inscripciones.encuesta_completada`).
- Requiere el script `SQL/09_encuesta_satisfaccion.sql`.
- Configurar el enlace en `public/modulo2-publico.js`:

```javascript
const URL_ENCUESTA_SATISFACCION = 'https://docs.google.com/forms/...';
```

---

## Estructura del proyecto

```txt
PROYECTO_VINCULACION/
├── server.js                 # Backend Express (API + archivos estáticos)
├── package.json
├── .env.example              # Plantilla de configuración
├── docker-compose.yaml       # SQL Server opcional (Docker)
├── README.md
├── AGENTS.md                 # Contexto para agentes de IA / desarrollo
├── DOCUMENTACION/            # Entregables y material institucional (ver abajo)
├── middleware/
│   ├── uploadContenido.js    # Carpeta uploads y utilidades de archivos
│   └── uploadPortada.js      # Subida de portadas de curso
├── SQL/                      # Scripts 01–13 (ejecutar en orden según necesidad)
├── scripts/                  # Utilidades locales de desarrollo
├── uploads/                  # Archivos subidos (no versionados)
└── public/                   # Frontend estático
    ├── index.html            # Inicio
    ├── login.html / registro.html / perfil.html
    ├── cursos.html / curso-detalle.html
    ├── estudiante.html       # Panel estudiante
    ├── instructor.html       # Panel instructor
    ├── admin.html            # Dashboard administrador
    ├── reportes.html         # Reportes instructor/admin
    ├── app.js                # Utilidades compartidas, auth, menú
    ├── modulo2-publico.js    # Catálogo y vista de curso
    ├── modulo2-instructor.js # Panel CRUD instructor
    ├── modulo-admin.js       # Dashboard admin
    ├── modulo-reportes.js    # Pantalla de reportes
    ├── styles.css
    └── img/                  # Recursos gráficos ITQ
```

### Carpeta `DOCUMENTACION/`

Espacio reservado para las entregas documentales del proyecto de Vinculación con la Sociedad. Las subcarpetas están preparadas para recibir material en fases posteriores; por ahora pueden permanecer vacías.

```txt
DOCUMENTACION/
├── Manual_Usuario/     # Guía para usuarios finales
├── Manual_Tecnico/     # Documentación técnica del sistema
├── Evidencias/         # Capturas, reportes y material de respaldo
├── Diagramas/          # Modelo de BD, UML y diagramas de arquitectura
├── Presentacion/       # Diapositivas de sustentación
└── Actas/              # Actas de pruebas, validación y seguimiento
```

| Subcarpeta | Propósito |
|------------|-----------|
| `Manual_Usuario` | Guía para los usuarios finales (estudiante, instructor, administrador). |
| `Manual_Tecnico` | Documentación técnica: instalación, configuración, API y mantenimiento. |
| `Evidencias` | Capturas de pantalla, reportes Excel/PDF exportados y respaldo del proyecto. |
| `Diagramas` | Modelo de base de datos, diagramas UML, flujos y arquitectura del sistema. |
| `Presentacion` | Diapositivas utilizadas para la sustentación ante el instituto. |
| `Actas` | Actas de pruebas, validación, reuniones y documentación formal del proyecto. |

> Los documentos históricos del desarrollo (`ENTREGA_MODULO2.md`, `MODULO2_PLAN.md`, etc.) permanecen en la raíz por ahora. Pueden moverse a `DOCUMENTACION/` cuando el equipo lo decida.

---

## Librerías utilizadas (npm)

| Paquete | Uso |
|---------|-----|
| `express` | Servidor HTTP y API REST |
| `express-session` | Sesiones de usuario |
| `bcryptjs` | Hash de contraseñas |
| `mssql` | Conexión a SQL Server (Tedious) |
| `msnodesqlv8` | Opcional: autenticación Windows (`DB_TRUSTED_CONNECTION=true`) |
| `dotenv` | Variables de entorno |
| `cors` | Peticiones cross-origin con credenciales |
| `multer` | Subida de archivos |
| `xlsx` | Exportación Excel |
| `pdfkit` | Reporte PDF institucional |
| `nodemon` | Recarga en desarrollo (devDependency) |

---

## Formato de fechas en la interfaz

Todas las fechas visibles para el usuario se muestran como **`dd/MM/yyyy`** (ejemplo: `04/07/2026`), sin hora.

Excepción: la **fecha y hora de generación** en reportes Excel/PDF conserva hora por ser metadato de auditoría del documento.

La hora completa se mantiene almacenada en la base de datos.

---

## Observaciones importantes para evaluadores

1. **Reiniciar el servidor** después de cambios en `server.js` (`Ctrl+C` y `npm start` de nuevo).
2. **Puerto:** verificar que `.env` tenga `PORT=3000` y que no quede otra instancia de Node ocupando el puerto.
3. **Scripts SQL:** ejecutar del 01 al 09 en orden en una base limpia o conocer las advertencias de re-ejecución.
4. **Administrador:** registrar `admin@test.com` antes de ejecutar el script 08.
5. **Encuesta:** ejecutar script 09 y pegar URL real de Google Forms en `modulo2-publico.js`.
6. **Membrete PDF:** requiere `public/img/membrete-itq.png.jpg` presente en el proyecto.
7. **Certificado PDF individual:** no implementado; la vista previa del certificado es en pantalla.
8. **Sin tests automatizados oficiales:** la carpeta puede contener scripts manuales de auditoría (ver listado de limpieza).
9. **Roles legacy:** `estudiante@test.com` usa rol `estudiante`; nuevos usuarios externos usan rol `usuario`. Ambos acceden al panel estudiante.
10. **No commitear:** `.env`, `node_modules/`, `uploads/**/*` (salvo `.gitkeep`).

---

## Rutas web principales

| Ruta | Descripción |
|------|-------------|
| `/` | Página de inicio |
| `/login.html` | Inicio de sesión |
| `/registro.html` | Registro de usuario o instructor ITQ |
| `/cursos.html` | Catálogo de cursos |
| `/curso-detalle.html?id={id}` | Detalle y plataforma de aprendizaje |
| `/estudiante.html` | Panel del participante |
| `/instructor.html` | Panel del instructor |
| `/admin.html` | Dashboard administrador |
| `/reportes.html` | Reportes Excel |
| `/perfil.html` | Perfil de usuario |

---

## API REST — resumen por módulo

### Módulo 1 — Usuarios

`POST /api/registro`, `POST /api/login`, `GET/PUT /api/perfil`, `POST /api/logout`, `GET /api/test-db`

### Módulo 2 — Cursos

Categorías, cursos, lecciones, portadas y archivos bajo `/api/categorias`, `/api/cursos` y `/api/lecciones`.

### Módulo 3 — Inscripciones y progreso

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/inscripciones` | Inscribirse a un curso |
| `GET` | `/api/mis-inscripciones` | Cursos del estudiante |
| `GET` | `/api/inscripciones/curso/:idCurso` | Verificar inscripción |
| `PATCH` | `/api/lecciones/:idLeccion/progreso` | Marcar lección completada |
| `GET` | `/api/cursos/:idCurso/progreso` | Progreso del curso |
| `POST` | `/api/cursos/:idCurso/encuesta-completada` | Registrar encuesta completada |

### Módulo 4 — Exámenes y certificados

Examen final, intentos, estado, certificado bajo `/api/cursos/:idCurso/examen/*` y `/api/cursos/:idCurso/certificado`.

### Reportes y administración

| Método | Ruta | Rol |
|--------|------|-----|
| `GET` | `/api/dashboard/admin` | administrador |
| `GET` | `/api/reportes/cursos` | instructor, administrador |
| `GET` | `/api/reportes/cursos/excel` | instructor, administrador |
| `GET` | `/api/reportes/cursos/:id/estudiantes` | instructor, administrador |
| `GET` | `/api/reportes/cursos/:id/estudiantes/excel` | instructor, administrador |
| `GET` | `/api/reportes/general/pdf` | administrador |

---

## Problemas frecuentes

| Problema | Solución |
|----------|----------|
| Puerto ocupado | Cerrar otras instancias de Node o cambiar `PORT` en `.env` |
| Error de conexión SQL | Verificar `DB_SERVER`, usuario, contraseña y que SQL Server esté activo |
| Excel sin columna encuesta | Ejecutar `SQL/09_encuesta_satisfaccion.sql` |
| PDF sin membretado | Verificar que exista `public/img/membrete-itq.png.jpg` |
| Cambios no visibles | Reiniciar `node server.js` |

---

## Documentación adicional

| Archivo | Contenido |
|---------|-----------|
| `AGENTS.md` | Contexto técnico compacto para sesiones de desarrollo |
| `ENTREGA_MODULO2.md` | Resumen histórico del cierre del Módulo 2 |
| `MODULO2_PLAN.md` / `MODULO3_PLAN.md` | Planes originales del equipo (pueden estar parcialmente desactualizados) |

---

## Licencia y autoría

Proyecto académico de **Vinculación con la Sociedad 2026** — Instituto Superior Tecnológico Quito.  
Desarrollado por estudiantes de Segundo Nivel · Desarrollo de Software · Modalidad Virtual Nocturna.
