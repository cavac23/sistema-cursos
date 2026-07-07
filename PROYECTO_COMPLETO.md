# Documentación técnica completa — Plataforma de Cursos Virtuales ITQ

**Proyecto:** Vinculación con la Sociedad 2026 — Instituto Tecnológico Quito (ITQ)  
**Versión del documento:** 1.0 — 5 de julio de 2026  
**Propósito:** Describir la plataforma con suficiente detalle para que un desarrollador externo comprenda arquitectura, componentes, datos y flujos sin abrir el repositorio.

---

# 1. Resumen general del proyecto

## 1.1 Objetivo

Desarrollar una plataforma web de cursos virtuales para el ITQ que permita:

- A instructores ITQ crear y administrar cursos, lecciones, materiales, exámenes y consultar el progreso de estudiantes.
- A usuarios externos (y estudiantes institucionales) registrarse, inscribirse en cursos, consumir contenido, rendir exámenes y obtener certificación en pantalla.
- A administradores obtener indicadores del sistema y reportes institucionales (Excel y PDF) para evidencia del proyecto de vinculación.

## 1.2 Alcance

La plataforma cubre el ciclo académico en línea desde el catálogo público hasta la certificación y encuesta de satisfacción. Incluye autenticación, gestión de roles, CRUD académico, progreso por lección, examen final con múltiples intentos, certificado visual (no PDF individual descargable), reportes y dashboard administrativo.

Queda **fuera del alcance implementado**:

- Certificado PDF descargable por estudiante (solo vista previa HTML).
- Integración automática con Google Forms (solo enlace externo + registro local).
- Recuperación de contraseña automatizada (no hay flujo técnico).
- CRUD de usuarios desde panel administrador (asignación de roles vía SQL o registro).
- Recursos adicionales por lección (funcionalidad retirada).
- Recursos Generales del Curso (funcionalidad retirada el 5 jul 2026).

## 1.3 Módulos implementados

| Módulo | Contenido |
|--------|-----------|
| **Módulo 1** | Usuarios, roles, registro, login, sesión, perfil |
| **Módulo 2** | Categorías, cursos, lecciones, portadas, catálogo y panel instructor |
| **Módulo 3** | Inscripciones, progreso por lección, panel estudiante |
| **Módulo 4** | Exámenes finales, preguntas, intentos, certificados en pantalla |
| **Administración** | Dashboard JSON, reporte Excel institucional, reporte PDF general |
| **Encuesta** | Bloque UI + registro local `encuesta_completada` + enlace Google Forms |
| **Producción (SQL)** | Script `11_preparar_base_produccion.sql` para limpieza de datos de prueba en `SistemaCursosProduccion` |

## 1.4 Tecnologías utilizadas

| Capa | Tecnología |
|------|------------|
| **Runtime** | Node.js |
| **Backend** | Express 4.x |
| **Sesión** | express-session (cookie `connect.sid`, 1 hora) |
| **Base de datos** | Microsoft SQL Server (driver `mssql` / Tedious) |
| **Frontend** | HTML5, CSS3, JavaScript vanilla (sin framework, sin build) |
| **Autenticación** | bcryptjs (hash de contraseñas) |
| **Subida de archivos** | multer |
| **Reportes** | xlsx (Excel), pdfkit (PDF) |
| **Configuración** | dotenv |
| **CORS** | cors (credenciales habilitadas) |
| **Contenedor SQL local (opcional)** | Docker Compose — SQL Server 2022 Express |
| **Despliegue previsto** | Render (aplicación Node) + Azure SQL (base de datos) |

No hay bundler (Webpack/Vite), no hay TypeScript, no hay tests automatizados en el pipeline principal (existe script Playwright auxiliar de validación de encuesta).

---

# 2. Arquitectura

## 2.1 Visión general

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                                │
│  public/*.html + app.js + módulos JS + styles.css               │
└────────────────────────────┬────────────────────────────────────┘
                             │ fetch() JSON + cookies (credentials)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    server.js (Express)                           │
│  • Rutas /api/*  • express-session  • multer  • xlsx/pdfkit     │
└────────────┬───────────────────────────────┬──────────────────┘
             │ mssql (Tedious)                 │ fs + multer
             ▼                                 ▼
┌─────────────────────────┐      ┌──────────────────────────────┐
│   SQL Server            │      │   uploads/ (disco local)      │
│   SistemaCursos         │      │   portadas/                   │
│   (dev) / Produccion    │      │   videos/, documentos/ (legacy) │
└─────────────────────────┘      └──────────────────────────────┘
             ▲
             │ express.static('/uploads')
             └────────────────────────────────────────────────────
```

## 2.2 Frontend

- Carpeta `public/` servida estáticamente por Express en la raíz `/`.
- Cada página HTML carga `styles.css` y uno o más scripts JS según su rol.
- Comunicación con backend exclusivamente vía API REST JSON bajo `/api/`.
- Las cookies de sesión se envían con `credentials: 'include'` en fetch.
- No hay enrutamiento SPA: cada pantalla es un archivo HTML distinto; redirecciones por rol tras login.

## 2.3 Backend

- Monolito en un único archivo `server.js` (~3.640 líneas).
- Agrupa: configuración Express, pool SQL Server, middleware de auth, validadores, lógica de negocio, generación de reportes y definición de todas las rutas API.
- Arranque: `npm start` → `node server.js`; puerto `PORT` (default 3000).

## 2.4 Base de datos

- SQL Server relacional, base por defecto `SistemaCursos` (desarrollo).
- Esquema creado por scripts incrementales `SQL/01` … `SQL/11` (script `10` legacy; `12` opcional).
- Producción prevista: base separada `SistemaCursosProduccion` + script `11` de limpieza.
- Conexión vía variables de entorno (`DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`).
- Autenticación SQL Server recomendada; autenticación Windows opcional en código pero desaconsejada en documentación operativa.

## 2.5 Middleware

| Archivo | Función |
|---------|---------|
| `middleware/uploadPortada.js` | Subida de imágenes de portada de curso (JPG/PNG/WEBP, máx. 5 MB) |
| `middleware/uploadContenido.js` | Infraestructura legacy de subida por lección; solo se usa `UPLOAD_DIR` y `eliminarArchivoSubido` desde `server.js` |

En `server.js` también existen middlewares inline: `requiereSesion`, `requiereRol`, `requiereRolAdministrador`, wrapper de multer para portadas.

## 2.6 Almacenamiento de archivos

- Directorio raíz configurable: `UPLOAD_DIR` (default `uploads/`).
- Express expone `/uploads` como estático (acceso directo por URL).
- Rutas activas:
  - `uploads/portadas/{idCurso}/{uuid}.ext` — portadas subidas.
- Rutas legacy (sin endpoints activos de subida por lección):
  - `uploads/videos/{idLeccion}/`
  - `uploads/documentos/{idLeccion}/`
- URLs externas (YouTube, Google Drive, enlaces directos) se almacenan como texto en BD, no como archivos locales.

## 2.7 Comunicación entre capas

1. El usuario abre una página HTML estática.
2. JavaScript llama `fetch('/api/...', { credentials: 'include' })`.
3. Express valida sesión/rol, ejecuta consultas SQL parametrizadas, opcionalmente escribe/lee archivos.
4. Respuesta JSON `{ ok, mensaje, ... }` o descarga binaria (Excel/PDF).
5. El frontend actualiza DOM o redirige según el resultado.
6. Imágenes de portada se referencian como rutas `/uploads/...` o URLs externas normalizadas en cliente (`imagen-utils.js` para Google Drive).

---

# 3. Estructura completa de carpetas

Árbol del repositorio (excluye `node_modules/` y contenido interno de dependencias):

```
PROYECTO FINAL VINCULACION CON LA SOCIEDAD 2026/
├── server.js                    # Backend monolito Express
├── package.json
├── package-lock.json
├── .env                         # Config local (no versionado)
├── .env.example                 # Plantilla de variables
├── .gitignore
├── docker-compose.yaml          # SQL Server 2022 Express (Docker)
│
├── README.md                    # Manual de instalación y uso
├── PROJECT_STATUS.md            # Estado del proyecto y decisiones
├── AGENTS.md                    # Contexto para agentes de IA
├── AUDITORIA_FINAL_PREPRODUCCION.md
├── PROYECTO_COMPLETO.md         # Este documento
├── ENTREGA_MODULO2.md
├── MODULO2_PLAN.md
├── MODULO3_PLAN.md
├── GUIA_GIT_GITHUB.md
├── estructura.txt
│
├── middleware/
│   ├── uploadContenido.js       # Legacy + UPLOAD_DIR compartido
│   └── uploadPortada.js
│
├── SQL/
│   ├── 01_crear_base_modulo1.sql
│   ├── 02_crear_modulo2.sql
│   ├── 03_agregar_subida_contenidos.sql
│   ├── 04_actualizar_roles_produccion.sql
│   ├── 05_crear_modulo3.sql
│   ├── 06_crear_modulo3_progreso.sql
│   ├── 07_crear_modulo4_examenes.sql
│   ├── 08_asignar_admin_prueba.sql
│   ├── 09_encuesta_satisfaccion.sql
│   ├── 10_crear_recursos_curso.sql   # legacy (Recursos Generales retirados del código)
│   ├── 11_preparar_base_produccion.sql
│   └── 12_eliminar_recursos_generales.sql  # opcional: elimina tabla RecursosCurso si existía
│
├── scripts/
│   ├── validar-encuesta-paso2.js    # Validación Playwright encuesta
│   ├── validar-encuesta-resultado.json
│   ├── setup-admin-user.js
│   └── restart-server.ps1
│
├── DOCUMENTACION/               # Entregables institucionales (estructura vacía)
│   ├── Actas/.gitkeep
│   ├── Diagramas/.gitkeep
│   ├── Evidencias/.gitkeep
│   ├── Manual_Tecnico/.gitkeep
│   ├── Manual_Usuario/.gitkeep
│   └── Presentacion/.gitkeep
│
├── public/
│   ├── index.html               # Landing
│   ├── login.html
│   ├── registro.html
│   ├── perfil.html
│   ├── cursos.html              # Catálogo
│   ├── curso-detalle.html       # Plataforma de aprendizaje
│   ├── estudiante.html
│   ├── instructor.html
│   ├── admin.html
│   ├── reportes.html
│   ├── styles.css
│   ├── app.js                   # Auth, menú, perfil, utilidades compartidas
│   ├── imagen-utils.js          # normalizarUrlImagen (Google Drive)
│   ├── texto-utils.js           # normalizarTitulo / normalizarDescripcion
│   ├── modulo2-publico.js       # Catálogo + detalle curso + plataforma
│   ├── modulo2-instructor.js    # Panel CRUD instructor
│   ├── modulo-admin.js          # Dashboard admin
│   ├── modulo-reportes.js       # Pantalla reportes Excel
│   ├── img/                     # Assets estáticos (logos, banners, membrete)
│   ├── index.backup-inicio-original.html
│   ├── app.backup-inicio-original.js
│   └── styles.backup-inicio-original.css
│
├── uploads/                     # Archivos subidos (no versionados en Git)
│   ├── portadas/{idCurso}/
│   └── documentos/{idLeccion}/    # legacy
│
├── audit-temp-run.ps1           # Scripts auxiliares de auditoría
├── audit-temp-test.ps1
├── audit-mod3-run.ps1
├── audit-temp-results.json
├── test-admin-run.js
├── test-admin-run.ps1
└── cookies-inst.txt
```

---

# 4. Frontend

Todas las páginas activas comparten:

- **CSS:** `public/styles.css` (única hoja de estilos principal).
- **JS compartido:** `public/app.js` (menú dinámico según sesión/rol, login, registro, perfil, utilidades API).
- **Header/footer** institucional ITQ con navegación por `data-nav`.

## 4.1 `index.html` — Página de inicio

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Landing institucional: presentación del proyecto, carrusel, tarjetas informativas, FAQ modal, chat virtual decorativo, redes sociales. |
| **JS** | `app.js` + script inline para modal FAQ (acordeón). |
| **Funcionalidades** | Carrusel de banners; botón «Preguntas frecuentes» (modal 10 preguntas); chat visual abrir/cerrar; enlaces a cursos, login, registro. |

## 4.2 `login.html`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Autenticación de usuarios registrados. |
| **JS** | `app.js` |
| **Funcionalidades** | Formulario correo/contraseña → `POST /api/login`; redirección automática según rol (`instructor.html`, `estudiante.html`, `admin.html`). |

## 4.3 `registro.html`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Alta de nuevos usuarios. |
| **JS** | `app.js` |
| **Funcionalidades** | Selector de rol: **Usuario registrado** (`usuario`) o **Instructor ITQ** (`instructor`, solo correo `@itq.edu.ec`); formularios separados → `POST /api/registro`. |

## 4.4 Recuperación de contraseña

**No existe** página HTML ni endpoint de recuperación. El FAQ de inicio indica contactar al administrador.

## 4.5 `estudiante.html` — Panel estudiante

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Vista de cursos disponibles e inscripciones del usuario. |
| **JS** | `app.js`, `imagen-utils.js` |
| **Funcionalidades** | Lista cursos activos + «Mis inscripciones»; tarjetas con portada; enlace a `curso-detalle.html?id={id}`. |

## 4.6 `instructor.html` — Panel instructor

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | CRUD académico completo del instructor. |
| **JS** | `app.js`, `imagen-utils.js`, `texto-utils.js`, `modulo2-instructor.js` |
| **Funcionalidades** | Secciones: categorías; cursos (formulario + tabla); lecciones por curso; exámenes y preguntas; estudiantes inscritos. Normalización de títulos/descripciones antes de enviar al API. |

## 4.7 `admin.html` — Panel administrador

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Dashboard institucional y descarga de reportes globales. |
| **JS** | `app.js`, `modulo-admin.js` |
| **Funcionalidades** | Tarjetas con indicadores (`GET /api/dashboard/admin`); botón Excel participantes; botón PDF reporte general. |

## 4.8 `cursos.html` — Catálogo público

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Listado de cursos activos con filtros. |
| **JS** | `app.js`, `imagen-utils.js`, `modulo2-publico.js` |
| **Funcionalidades** | Filtro por categoría y búsqueda por texto; tarjetas de curso → detalle. |

## 4.9 `curso-detalle.html` — Detalle y plataforma de aprendizaje

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Vista pública del curso; plataforma completa si hay sesión e inscripción. |
| **JS** | `app.js`, `imagen-utils.js`, `modulo2-publico.js` |
| **Funcionalidades** | Info del curso → lecciones → video → progreso → examen → certificado → encuesta (Google Forms + confirmación local). Overlay si no hay sesión o inscripción. |

## 4.10 `perfil.html`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Edición de datos personales y contraseña. |
| **JS** | `app.js` |
| **Funcionalidades** | `GET/PUT /api/perfil`. |

## 4.11 `reportes.html`

| Aspecto | Detalle |
|---------|---------|
| **Propósito** | Reportes Excel por curso para instructor y administrador. |
| **JS** | `app.js`, `modulo-reportes.js` |
| **Funcionalidades** | Lista de cursos (todos si admin, propios si instructor); detalle estudiantes; descarga Excel por curso; Excel general participantes; PDF general solo visible para administrador. |

## 4.12 Archivos JavaScript auxiliares

| Archivo | Función |
|---------|---------|
| `imagen-utils.js` | `normalizarUrlImagen(url)` — convierte enlaces compartidos Google Drive a URL de vista directa para `<img>`. |
| `texto-utils.js` | `normalizarTitulo()`, `normalizarDescripcion()` — Title Case y capitalización en formularios instructor. |
| `modulo2-publico.js` | Catálogo, detalle, plataforma de curso, inscripción, progreso, examen, certificado, encuesta. |
| `modulo2-instructor.js` | Panel instructor completo. |
| `modulo-admin.js` | Dashboard administrador. |
| `modulo-reportes.js` | UI de reportes Excel/PDF. |

---

# 5. Backend

## 5.1 `server.js` — Organización general

El archivo central concentra:

1. **Configuración inicial:** dotenv, Express, CORS, JSON parser, sesión, estáticos (`public/` y `/uploads`).
2. **Conexión SQL Server:** pool singleton, soporte instancia nombrada, Tedious por defecto.
3. **Autenticación y autorización:** middleware de sesión y roles.
4. **Validadores:** IDs enteros positivos, texto, correo instructor ITQ.
5. **Dominio académico:** CRUD categorías/cursos/lecciones, sincronización recurso principal en tabla `Contenidos`.
6. **Dominio estudiante:** inscripciones, progreso, encuesta.
7. **Dominio evaluación:** exámenes, intentos, certificados.
8. **Reportes:** consultas agregadas, generación Excel/PDF.
9. **Arranque del servidor** en `PORT`.

No hay capa de servicios separada ni routers modulares: toda la lógica vive en handlers de ruta y funciones auxiliares en el mismo archivo.

## 5.2 Funciones principales (helpers)

| Función | Descripción |
|---------|-------------|
| `getPool()` | Obtiene o crea el pool de conexiones SQL Server. |
| `requiereSesion` | Middleware: exige `req.session.usuario`. |
| `requiereRol(rol)` | Middleware: exige rol exacto en sesión. |
| `requiereRolAdministrador` | Middleware: rol `administrador`. |
| `parsearId` / `validarEnteroPositivo` | Validación de IDs en parámetros y body. |
| `cursoPerteneceInstructor` | Verifica ownership de curso. |
| `usuarioTieneEncuestaGlobalCompletada` | Encuesta única por usuario en toda la plataforma (EXISTS en Inscripciones). |
| `sincronizarRecursoPrincipalLeccion` | Escribe/actualiza fila orden 1 en `Contenidos` con URL del video principal de la lección. |
| `inferirTipoRecursoLeccion` | Detecta YouTube/Drive para tipo contenido. |
| `manejarErrorMulter` | Respuestas uniformes para errores de subida. |
| `obtenerParticipantesReporteExcel` | Consulta compleja para Excel institucional (15 columnas). |
| `generarExcelCursos` / `generarExcelEstudiantes` | Construcción buffers xlsx. |
| `generarPdfReporteGeneral` | PDF institucional con pdfkit y membretado. |
| `obtenerResumenDashboard` | Contadores para panel admin. |
| `formatearFechaUsuario` | Formato `dd/MM/yyyy` en reportes. |
| `determinarFechaFinalizacion` | Fecha calculada para Excel (certificado o última lección al 100 %). |

## 5.3 Middleware de subida

**uploadPortada.js:** almacena en `uploads/portadas/{idCurso}/`, valida extensión y MIME, nombre UUID, elimina portada anterior al reemplazar.

**uploadContenido.js:** diseñado para videos/documentos por lección; la capa multer ya no tiene ruta API asociada. El módulo sigue exportando `UPLOAD_DIR` usado globalmente.

---

# 6. API

**Formato de respuesta habitual:** `{ ok: true/false, mensaje: "...", ...datos }`  
**Autenticación:** cookie de sesión salvo rutas públicas explícitas.  
**Total:** 47 endpoints HTTP bajo `/api/`.

## 6.1 Módulo 1 — Usuarios y sesión

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| POST | `/api/registro` | Público | Registra usuario (`usuario`, `instructor` con `@itq.edu.ec`, legacy `estudiante`). Hash bcrypt. |
| POST | `/api/login` | Público | Valida credenciales; crea sesión. |
| GET | `/api/perfil` | Sesión | Devuelve datos del usuario en sesión. |
| PUT | `/api/perfil` | Sesión | Actualiza nombres, apellidos, correo, contraseña. |
| POST | `/api/logout` | Público | Destruye sesión si existe. |
| GET | `/api/test-db` | Público (dev) / Sesión (prod) | Prueba conexión; devuelve filas de `Roles`. |

## 6.2 Módulo 2 — Categorías

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| GET | `/api/categorias` | Público | Lista categorías activas. |
| GET | `/api/categorias/:id` | Público | Detalle de una categoría. |
| POST | `/api/categorias` | Instructor | Crea categoría. |
| PUT | `/api/categorias/:id` | Instructor | Edita categoría. |
| PATCH | `/api/categorias/:id/estado` | Instructor | Activa/desactiva categoría. |

## 6.3 Módulo 2 — Cursos

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| GET | `/api/cursos` | Público | Catálogo activo; query `categoria`, `buscar`. |
| GET | `/api/mis-cursos` | Instructor | Cursos del instructor en sesión. |
| GET | `/api/cursos/:id` | Público | Detalle curso activo. |
| POST | `/api/cursos` | Instructor | Crea curso asignado al instructor en sesión. |
| PUT | `/api/cursos/:id` | Instructor | Edita curso propio. |
| POST | `/api/cursos/:idCurso/portada` | Instructor (dueño) | Sube imagen portada (multipart). |
| PATCH | `/api/cursos/:id/estado` | Instructor | Activa/desactiva curso propio. |

## 6.4 Módulo 2 — Lecciones

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| GET | `/api/cursos/:idCurso/lecciones` | Público | Lecciones activas + `url_recurso` (subquery Contenidos). |
| GET | `/api/cursos/:idCurso/mis-lecciones` | Instructor (dueño) | Todas las lecciones del curso propio. |
| GET | `/api/lecciones/:id` | Público | Detalle lección activa en curso activo. |
| POST | `/api/cursos/:idCurso/lecciones` | Instructor (dueño) | Crea lección; sincroniza recurso principal. |
| PUT | `/api/lecciones/:id` | Instructor (dueño) | Edita lección; sincroniza URL video. |
| PATCH | `/api/lecciones/:id/estado` | Instructor (dueño) | Activa/desactiva lección. |

## 6.5 Recursos Generales del Curso — retirado (5 jul 2026)

La funcionalidad **Recursos Generales del Curso** fue eliminada por completo del código. Ya no existen endpoints `/api/cursos/:idCurso/recursos` ni `/recursos-publicos`, ni UI asociada en instructor o plataforma de aprendizaje. En bases de datos antiguas puede persistir la tabla `RecursosCurso` creada por el script legacy `10_crear_recursos_curso.sql`; usar el script opcional `12_eliminar_recursos_generales.sql` para eliminarla.

## 6.6 Módulo 3 — Inscripciones y progreso

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| POST | `/api/inscripciones` | Sesión; roles `usuario`, `estudiante`, `estudiante_itq` | Inscribe al curso activo. |
| GET | `/api/mis-inscripciones` | Sesión | Cursos inscritos del usuario. |
| GET | `/api/inscripciones/curso/:idCurso` | Sesión | Verifica si está inscrito. |
| PATCH | `/api/lecciones/:idLeccion/progreso` | Sesión; estudiante inscrito | Marca lección completada. |
| GET | `/api/cursos/:idCurso/progreso` | Sesión | Porcentaje y mapa de lecciones completadas. |
| POST | `/api/cursos/:idCurso/encuesta-completada` | Sesión; estudiante inscrito | Marca encuesta global completada. |
| GET | `/api/cursos/:idCurso/estudiantes` | Instructor (dueño) | Lista inscritos con progreso. |

## 6.7 Módulo 4 — Exámenes y certificados

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| POST | `/api/cursos/:idCurso/examen` | Instructor (dueño) | Crea examen del curso. |
| GET | `/api/cursos/:idCurso/examen` | Instructor (dueño) | Obtiene examen con respuestas correctas (gestión). |
| PUT | `/api/cursos/:idCurso/examen` | Instructor (dueño) | Actualiza examen. |
| POST | `/api/cursos/:idCurso/examen/preguntas` | Instructor (dueño) | Agrega pregunta. |
| PUT | `/api/examen/preguntas/:idPregunta` | Instructor (dueño) | Edita pregunta. |
| DELETE | `/api/examen/preguntas/:idPregunta` | Instructor (dueño) | Elimina pregunta. |
| GET | `/api/cursos/:idCurso/examen/estado` | Sesión | Estado: progreso, puede rendir, ya aprobó. |
| GET | `/api/cursos/:idCurso/examen/estudiante` | Sesión; rol estudiante | Preguntas sin respuesta correcta (sin verificar inscripción en código). |
| POST | `/api/cursos/:idCurso/examen/intento` | Sesión; estudiante inscrito al 100 % | Envía respuestas; calcula puntaje; emite certificado si aprueba. |
| GET | `/api/cursos/:idCurso/certificado` | Sesión | Certificado del usuario en el curso si existe. |

## 6.8 Reportes y administración

| Método | Ruta | Rol / Auth | Descripción |
|--------|------|------------|-------------|
| GET | `/api/reportes/cursos` | Instructor o administrador | JSON resumen cursos para pantalla reportes. |
| GET | `/api/reportes/cursos/excel` | Instructor o administrador | Excel institucional participantes (`Reporte_Participantes_Vinculacion_2026.xlsx`). Admin: todos; instructor: solo sus cursos. |
| GET | `/api/reportes/cursos/:idCurso/estudiantes` | Instructor (dueño) o admin | JSON detalle estudiantes del curso. |
| GET | `/api/reportes/cursos/:idCurso/estudiantes/excel` | Instructor (dueño) o admin | Excel por curso. |
| GET | `/api/dashboard/admin` | Administrador | Indicadores JSON del sistema. |
| GET | `/api/reportes/general/pdf` | Administrador | PDF resumen institucional. |

## 6.9 Recursos estáticos (no API)

| Montaje | Descripción |
|---------|-------------|
| `/` | Archivos `public/` |
| `/uploads` | Archivos subidos en disco |

---

# 7. Base de datos

## 7.1 Modelo general

Base relacional SQL Server con **12 tablas** activas en el modelo de aplicación. No hay procedimientos almacenados, funciones SQL, triggers ni vistas definidas en los scripts del repositorio.

## 7.2 Tablas y propósito

| Tabla | Propósito principal |
|-------|---------------------|
| `Roles` | Catálogo de roles (`estudiante`, `instructor`, `usuario`, `estudiante_itq`, `administrador`) |
| `Usuarios` | Cuentas con hash de contraseña y FK a rol |
| `Categorias` | Clasificación de cursos |
| `Cursos` | Curso virtual: título, descripción, instructor, categoría, portada (`imagen_portada`), legacy `url_video` |
| `Lecciones` | Unidades del curso: título, descripción, orden, duración, estado |
| `Contenidos` | Recurso principal de lección (orden 1, URL); tabla legacy con columnas de archivo no usadas por UI actual |
| `Inscripciones` | Relación usuario–curso; columnas encuesta (`encuesta_completada`, `fecha_encuesta_completada`) |
| `ProgresoLecciones` | Lección completada por inscripción |
| `Examenes` | Un examen por curso (porcentaje aprobación, instrucciones) |
| `Preguntas` | Preguntas tipo test A–D con respuesta correcta |
| `IntentosExamen` | Registro de intentos con puntaje y aprobación |
| `Certificados` | Certificado emitido por usuario/curso/intento |

> **Legacy:** la tabla `RecursosCurso` (script `10`) puede existir en instalaciones antiguas; la aplicación ya no la utiliza. Eliminar con `12_eliminar_recursos_generales.sql` si aplica.

## 7.3 Relaciones (FK)

```
Roles (1) ──< Usuarios (N)
Usuarios (1) ──< Cursos (N)          [id_instructor]
Categorias (1) ──< Cursos (N)        [opcional]

Cursos (1) ──< Lecciones (N)
Lecciones (1) ──< Contenidos (N)

Usuarios (N) >──< Cursos (N)         [Inscripciones]
Inscripciones (1) ──< ProgresoLecciones (N) >── Lecciones (1)

Cursos (1) ──< Examenes (1)
Examenes (1) ──< Preguntas (N)
Examenes (1) ──< IntentosExamen (N) >── Usuarios (1)
Certificados ──> Usuarios, Cursos, IntentosExamen
```

## 7.4 Índices (definidos en SQL)

- Módulo 2: `IX_Cursos_id_instructor`, `IX_Cursos_estado`, `IX_Cursos_id_categoria`, `IX_Lecciones_id_curso`, `IX_Contenidos_id_leccion`.
- Módulos 3–4: sin índices adicionales explícitos en scripts.

## 7.5 Scripts SQL — orden de ejecución

| # | Archivo | Acción |
|---|---------|--------|
| 01 | `01_crear_base_modulo1.sql` | Crea BD `SistemaCursos`, tablas `Roles`/`Usuarios`; **DROP destructivo** si re-ejecuta |
| 02 | `02_crear_modulo2.sql` | Categorías, cursos, lecciones, contenidos; categorías semilla |
| 03 | `03_agregar_subida_contenidos.sql` | Columnas archivo en `Contenidos` |
| 04 | `04_actualizar_roles_produccion.sql` | Roles adicionales |
| 05 | `05_crear_modulo3.sql` | `Inscripciones` |
| 06 | `06_crear_modulo3_progreso.sql` | `ProgresoLecciones` |
| 07 | `07_crear_modulo4_examenes.sql` | Exámenes, preguntas, intentos, certificados |
| 08 | `08_asignar_admin_prueba.sql` | Asigna rol admin a `admin@test.com` (desarrollo) |
| 09 | `09_encuesta_satisfaccion.sql` | Columnas encuesta en `Inscripciones` |
| 10 | `10_crear_recursos_curso.sql` | **Legacy** — creaba tabla `RecursosCurso`; no ejecutar en instalaciones nuevas |
| 11 | `11_preparar_base_produccion.sql` | Limpieza transaccional solo en `SistemaCursosProduccion` |
| 12 | `12_eliminar_recursos_generales.sql` | **Opcional** — elimina tabla `RecursosCurso` si existía |

Scripts 05–07 no incluyen `USE SistemaCursos`; el operador debe seleccionar la base correcta en SSMS antes de ejecutarlos.

## 7.6 Decisiones sobre datos legacy

- Tabla `Contenidos` conservada: el backend sincroniza el video principal de cada lección al crear/editar (`url_recurso` → fila orden 1).
- Endpoints CRUD de contenidos adicionales por lección **eliminados** del backend; la UI ya no los expone.
- Recursos Generales del Curso (`RecursosCurso`, endpoints `/recursos*`) **eliminados** del backend y frontend (5 jul 2026).
- Columnas de subida en `Contenidos` (`nombre_archivo`, `mime_type`, etc.) permanecen en esquema sin uso activo en la aplicación actual.

---

# 8. Flujo de usuarios

## 8.1 Visitante (sin sesión)

1. Accede a `index.html`, `cursos.html` o `curso-detalle.html`.
2. Ve catálogo y detalle básico del curso (sin plataforma completa).
3. Puede ir a `registro.html` o `login.html`.

## 8.2 Estudiante / Usuario (`usuario`, `estudiante`, `estudiante_itq`)

1. **Registro** en `registro.html` como Usuario registrado → rol `usuario`.
2. **Login** → redirección a `estudiante.html`.
3. Explora **cursos disponibles** e **inscripciones** en el panel.
4. Entra a **detalle del curso** (`curso-detalle.html?id=X`).
5. Si no está inscrito: botón inscribirse → `POST /api/inscripciones`.
6. Con acceso completo:
   - Navega **lecciones** en sidebar; reproduce **video principal** (YouTube, URL o MP4).
   - Marca lecciones **completadas** → **progreso** actualizado.
7. Al **100 % de lecciones**: puede rendir **examen final** (si existe).
8. Si **aprueba**: ve **certificado** en pantalla (modal HTML).
9. Si cumple condiciones y no completó encuesta global: bloque **encuesta** → enlace Google Forms → botón «Ya llené la encuesta» → `POST encuesta-completada`.
10. Puede editar **perfil** y **cerrar sesión**.

## 8.3 Instructor (`instructor`)

1. **Registro** con correo `@itq.edu.ec` o cuenta preexistente.
2. **Login** → `instructor.html`.
3. **Categorías:** crear, editar, activar/desactivar.
4. **Cursos:** crear (título, descripción, categoría, URL portada o subir archivo); editar; activar/desactivar.
5. Por curso — **Lecciones:** crear con título, descripción, orden, duración, **URL obligatoria** del video principal.
6. Por curso — **Examen:** configurar porcentaje aprobación; agregar/editar/eliminar preguntas.
7. Por curso — **Estudiantes:** ver inscritos y progreso.
8. **Reportes** en `reportes.html`: Excel por curso propio; Excel general si tiene permiso.
9. **Perfil** y cierre de sesión.

## 8.4 Administrador (`administrador`)

1. Cuenta creada por registro + script SQL `08` (desarrollo) o asignación manual de rol en BD.
2. **Login** → `admin.html`.
3. Consulta **dashboard** (usuarios activos, cursos, inscripciones, certificados, etc.).
4. Descarga **Excel institucional** de participantes (todos los cursos).
5. Descarga **PDF reporte general** del sistema.
6. Accede a **reportes.html** con visibilidad de todos los cursos.
7. **No dispone** de panel CRUD de usuarios ni de las rutas `requiereRol('instructor')` del Módulo 2 (no puede crear cursos/lecciones vía API instructor sin rol instructor adicional).

---

# 9. Funcionalidades implementadas

## 9.1 Completas (operativas en código)

| Funcionalidad | Módulo |
|---------------|--------|
| Registro público (usuario / instructor ITQ) | M1 |
| Login / logout / sesión 1 h | M1 |
| Perfil editable | M1 |
| CRUD categorías | M2 |
| CRUD cursos + portada URL/archivo | M2 |
| CRUD lecciones + video por URL | M2 |
| Catálogo y detalle público | M2 |
| Plataforma de aprendizaje en detalle | M2+M3 |
| Inscripción a cursos | M3 |
| Progreso por lección | M3 |
| Panel estudiante | M3 |
| Examen final configurable | M4 |
| Intentos de examen (múltiples) | M4 |
| Certificado en pantalla | M4 |
| Encuesta satisfacción (global por usuario) | Encuesta |
| Reportes Excel instructor/admin | Admin |
| Reporte PDF general | Admin |
| Dashboard administrador | Admin |
| Normalización texto formularios instructor | UX |
| Normalización URLs Google Drive portadas | UX |
| Script preparación BD producción | SQL 11 |

## 9.2 Opcionales o no implementadas

| Funcionalidad | Estado |
|---------------|--------|
| Certificado PDF descargable individual | No implementado (decisión explícita) |
| Recuperación de contraseña | No implementado |
| Gestión usuarios desde UI admin | No implementado |
| Recursos adicionales por lección | Retirado |
| Recursos Generales del Curso | Retirado (5 jul 2026) |
| Integración automática Google Forms | No implementado (solo enlace) |
| Rol `estudiante_itq` en registro público | Reservado asignación manual |
| Eliminación física de cursos | No implementado (solo desactivar) |
| Tests unitarios / CI | No implementado |
| Contenido carpeta `DOCUMENTACION/` | Estructura vacía |

---

# 10. Recursos y archivos

## 10.1 Portadas de curso

- **Campo BD:** `Cursos.imagen_portada` (VARCHAR).
- **Origen URL:** instructor pega enlace (incluye soporte Google Drive vía `normalizarUrlImagen` en frontend).
- **Origen archivo:** `POST /api/cursos/:idCurso/portada` → `uploads/portadas/{idCurso}/{uuid}.jpg|png|webp`.
- **Límite:** 5 MB (`UPLOAD_MAX_PORTADA_MB`).
- **Visualización:** rutas `/uploads/...` o URL externa en tarjetas y detalle.

## 10.2 Videos de lección

- **No se suben archivos MP4 por API** en la versión actual (endpoints de subida por lección retirados).
- El instructor ingresa **URL obligatoria** al crear/editar lección (`url_recurso`).
- El backend persiste en tabla `Contenidos` (tipo video/enlace, orden 1) mediante `sincronizarRecursoPrincipalLeccion`.
- El frontend reproduce: YouTube embebido, enlace externo, o MP4 si la URL apunta a archivo accesible.

## 10.3 Recursos Generales del Curso — retirado

Funcionalidad eliminada el **5 jul 2026**. No hay tabla activa en el modelo de aplicación, ni endpoints ni carpeta `uploads/recursos-curso/`. Ver script opcional `12_eliminar_recursos_generales.sql` para limpiar la tabla legacy `RecursosCurso` en bases antiguas.

## 10.4 Carpeta `uploads/`

- Ignorada por Git (excepto `.gitkeep` en subcarpetas legacy).
- Creada al arrancar el servidor si no existe.
- **Importante para hosting:** requiere persistencia en disco o estrategia externa; Render por defecto puede ser efímero.

## 10.5 Google Drive

- Usado para **portadas por URL** compartidas.
- Frontend convierte `drive.google.com/file/d/ID/view` → `drive.google.com/uc?export=view&id=ID`.
- El archivo en Drive debe estar compartido como «Cualquier persona con el enlace puede ver».
- No hay integración OAuth ni API de Google Drive en backend.

## 10.6 Cloudinary

**No se utiliza** en este proyecto. No hay dependencia ni configuración Cloudinary en código de aplicación.

## 10.7 Assets estáticos `public/img/`

Imágenes institucionales versionadas: logos ITQ, banners, fondos, membrete para PDF (`membrete-itq.png.jpg`), GIF avatar chat, imágenes de registro/login.

---

# 11. Seguridad

## 11.1 Sesiones

- `express-session` con secret `SESSION_SECRET`.
- Cookie `httpOnly`, duración 1 hora.
- No se configuran `secure` ni `sameSite` en código actual.
- Estado de usuario en `req.session.usuario` (id, rol, nombres, correo).

## 11.2 Roles

| Rol | Origen | Capacidades principales |
|-----|--------|-------------------------|
| `usuario` | Registro público | Panel estudiante, inscripción, progreso, examen |
| `instructor` | Registro `@itq.edu.ec` | Panel instructor CRUD académico |
| `estudiante` | Legacy Módulo 1 | Igual que `usuario` en frontend |
| `estudiante_itq` | Asignación manual BD | Igual que `usuario` |
| `administrador` | Asignación manual / script 08 | Dashboard, reportes globales |

## 11.3 Autorización

- Middleware `requiereSesion` y `requiereRol` en rutas sensibles.
- Ownership de curso: `cursoPerteneceInstructor` para operaciones M2 del instructor.
- Reportes: `ROLES_REPORTES = ['instructor', 'administrador']`; instructor limitado a sus cursos.

## 11.4 Validaciones

- IDs parseados con `parsearId` / enteros positivos.
- Correo instructor validado dominio `@itq.edu.ec` en registro.
- Contraseñas hasheadas con bcrypt (10 rounds).
- Consultas SQL parametrizadas (`mssql` inputs).
- Multer: extensión, MIME, tamaño máximo por tipo de archivo.
- Soft delete mediante campo `estado` en entidades académicas.

## 11.5 Subida de archivos

- Nombres UUID para evitar colisiones y path traversal.
- Eliminación de archivo previo al reemplazar portada.
- Rollback de archivo subido si falla escritura en BD.
- `/uploads` servido públicamente sin verificación de sesión en la petición del archivo estático.

---

# 12. Configuración

## 12.1 `package.json`

- **name:** `modulo1-usuarios-sqlserver`
- **scripts:** `start` (node server.js), `dev` (nodemon)
- **dependencies:** express, express-session, cors, dotenv, bcryptjs, mssql, msnodesqlv8, multer, xlsx, pdfkit
- **devDependencies:** nodemon, playwright (vía script validación)

## 12.2 `.env.example`

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto HTTP (default 3000) |
| `SESSION_SECRET` | Clave firma cookie sesión |
| `DB_SERVER` | Instancia SQL Server |
| `DB_DATABASE` | Nombre base (default `SistemaCursos`) |
| `DB_TRUSTED_CONNECTION` | `false` recomendado (SQL auth) |
| `DB_USER` / `DB_PASSWORD` | Credenciales SQL |
| `UPLOAD_DIR` | Carpeta uploads (default `uploads`) |
| `UPLOAD_MAX_VIDEO_MB` | 200 (legacy referencia) |
| `UPLOAD_MAX_DOC_MB` | 50 (legacy referencia; sin subida documentos activa) |
| `UPLOAD_MAX_PORTADA_MB` | 5 |

Producción adicional documentada en README: `DB_DATABASE=SistemaCursosProduccion`, `NODE_ENV=production`.

## 12.3 Render (aplicación)

- Despliegue previsto como Web Service Node.js.
- Comando start: `npm start`.
- Variables de entorno desde panel Render.
- Consideración: persistencia de `uploads/` (disco persistente o almacenamiento externo).

## 12.4 Azure SQL (base de datos)

- SQL Server gestionado en la nube.
- Firewall debe permitir IP saliente de Render.
- Cadena con autenticación SQL (`DB_USER`/`DB_PASSWORD`).
- Base de producción separada: `SistemaCursosProduccion`.

## 12.5 Docker (desarrollo local)

- `docker-compose.yaml` levanta SQL Server 2022 Express.
- Contenedor: `sqlserver-itq`, puerto 1433.
- Contraseña SA definida en compose (distinta de `.env.example` según documentación).
- Scripts SQL 01–11 se ejecutan manualmente contra la instancia Docker o local SSMS; script `12` opcional si existía `RecursosCurso`.

---

# 13. Estado actual del proyecto

## 13.1 Terminado (~94 % funcionalidad core según PROJECT_STATUS)

- Módulos 1–4 operativos de punta a punta.
- Encuesta validada con script Playwright (19/19 verificaciones, jul 2026).
- Recursos Generales del Curso retirados (5 jul 2026).
- Recursos por lección retirados (simplificación jul 2026).
- Script SQL 11 para preparación producción documentado.
- Reportes Excel/PDF institucionales.
- Normalización de texto y URLs Drive en frontend instructor/catálogo.

## 13.2 Pendiente

- Poblar carpetas `DOCUMENTACION/` (manuales, diagramas, evidencias, presentación, actas).
- Actualizar `AGENTS.md` (desactualizado respecto a scripts 08–11 y funcionalidades recientes).
- Certificado PDF individual (fuera de alcance acordado).
- Limpieza autorizada de archivos auxiliares de auditoría y backups en repositorio.

## 13.3 Decisiones de arquitectura relevantes

| Decisión | Motivo |
|----------|--------|
| Monolito Express + frontend estático | Simplicidad, equipo pequeño, entrega académica |
| Sin build frontend | Menor complejidad de despliegue |
| SQL Server | Requisito institucional / entorno ITQ |
| Sesión cookie vs JWT | Simplicidad en SPA-less HTML |
| Video lección solo por URL | Simplificación; evita almacenamiento video pesado |
| Tabla Contenidos conservada | Minimizar riesgo migración BD; sync interno video |
| Encuesta global por usuario | Regla negocio: una sola respuesta en toda la plataforma |
| Certificado solo pantalla | Alcance Módulo 4 acotado |
| Base producción separada + script 11 | Proteger datos desarrollo; limpieza controlada |
| Google Forms externo | Sin API; registro local de cumplimiento |

---

# 14. Observaciones

Esta sección menciona elementos legacy, backups y deuda técnica **sin proponer acciones**. Solo describe lo que existe en el repositorio.

## 14.1 Código legado

- **`middleware/uploadContenido.js`:** multer completo para subida video/documento por lección; sin ruta API activa. Solo `UPLOAD_DIR` y `eliminarArchivoSubido` se importan en `server.js`.
- **Tabla `Contenidos`:** columnas de subida de archivo (`nombre_archivo`, `tamano_bytes`, `mime_type`, `origen_contenido='archivo'`) sin uso en flujos actuales; solo fila URL orden 1.
- **Campo `Cursos.url_video`:** legacy; formularios actuales usan `imagen_portada`; fallback en lectura para datos antiguos.
- **`public/app.js` — bloque `#formRegistro`:** listener para formulario que no existe en `registro.html` actual.
- **Tabla `RecursosCurso` (legacy):** puede existir si se ejecutó script `10`; la aplicación ya no la usa. Eliminar con `12_eliminar_recursos_generales.sql` si aplica.
- **CSS clases `.lista-contenidos*`, `.bloque-contenidos-leccion`:** estilos del modelo anterior de recursos por lección sin markup generado.
- **Rutas filesystem `uploads/videos/`, `uploads/documentos/`:** referenciadas en documentación histórica; sin endpoints de subida activos.

## 14.2 Archivos backup

- `public/index.backup-inicio-original.html`
- `public/app.backup-inicio-original.js`
- `public/styles.backup-inicio-original.css`

Copias manuales de versión anterior de la landing; no son entrypoints activos.

## 14.3 Scripts y archivos auxiliares

- `audit-temp-run.ps1`, `audit-temp-test.ps1`, `audit-mod3-run.ps1`, `audit-temp-results.json` — herramientas de auditoría temporal.
- `test-admin-run.js`, `test-admin-run.ps1` — pruebas administrador.
- `scripts/validar-encuesta-paso2.js` + `validar-encuesta-resultado.json` — validación QA encuesta.
- `scripts/setup-admin-user.js`, `scripts/restart-server.ps1` — utilidades locales.
- `cookies-inst.txt` — archivo de cookies de sesión de prueba.
- `estructura.txt` — listado histórico de estructura.

## 14.4 Documentación desalineada

- **`AGENTS.md`:** describe scripts hasta 07; no refleja 08–12, encuesta global, admin, producción.
- **`ENTREGA_MODULO2.md`:** menciona endpoints de contenidos por lección ya retirados.
- **`README.md`:** secciones internas con rangos de scripts contradictorios (01–09 vs 01–11 en otras partes).
- **`.env.example`:** incluye opción autenticación Windows no operativa según `AGENTS.md` actual.

## 14.5 Deuda técnica objetiva (descripción)

- Un único archivo `server.js` concentra toda la lógica backend (~3.640 líneas).
- Sin tests automatizados en pipeline principal.
- Sin router API modular ni manejador global de errores Express.
- Sin endpoint 404 para rutas `/api/*` desconocidas.
- Dependencia `msnodesqlv8` presente en `package.json` pero flujo principal usa Tedious.
- Índices ausentes en tablas transaccionales M3/M4.
- Chat virtual en `index.html` referencia función `responderChat()` no definida en `app.js`.
- Elemento `#mensajeEstudiante` en HTML sin uso en JavaScript.

---

*Fin del documento. Generado como referencia técnica externa. No modifica el código fuente del proyecto.*
