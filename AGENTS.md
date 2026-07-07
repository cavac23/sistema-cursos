# AGENTS.md — Sistema de Cursos Virtuales ITQ

> Contexto compacto para sesiones de OpenCode. Si un dato es obvio desde los nombres de archivo o el README, no está aquí.

## Arquitectura en una línea

Backend monolito Express (`server.js`) + frontend estático vanilla (`public/`). Base de datos SQL Server. Sin tests, sin build, sin linter, sin monorepo.

## Comandos esenciales

```bash
npm install              # instala dependencias
npm start                # producción: node server.js
npm run dev              # desarrollo: nodemon server.js
```

Verificar conexión a BD una vez levantado:

```bash
curl http://localhost:3000/api/test-db
```

En `NODE_ENV=production`, `/api/test-db` requiere sesión iniciada.

## Configuración local

1. Copiar `.env.example` → `.env`.
2. Ajustar `DB_SERVER` a la instancia real (ej. `localhost`, `localhost\SQLEXPRESS` o `sqlserver-itq` si usas Docker en red de Compose).
3. Usar **autenticación SQL** (`DB_USER` / `DB_PASSWORD`). El driver nativo de `mssql` no soporta autenticación Windows; `DB_TRUSTED_CONNECTION=true` lanza error al arrancar.

La conexión usa `mssql` con su driver nativo (Tedious). Ya no se requiere ODBC Driver ni `msnodesqlv8`.

### Base de datos con Docker (alternativa)

`docker-compose.yaml` levanta SQL Server 2022 Express oficial:

```bash
docker compose up -d
```

**Trampa:** la contraseña del `sa` en `docker-compose.yaml` es `Admin123456789!`, no la de `.env.example`. Usar en `.env`:

```env
DB_SERVER=localhost
DB_DATABASE=SistemaCursos
DB_TRUSTED_CONNECTION=false
DB_USER=sa
DB_PASSWORD=Admin123456789!
```

Los scripts SQL (01–09 obligatorios; 10 legacy; 11 producción; 12 opcional) se ejecutan manualmente en SSMS o `sqlcmd` contra `localhost,1433`.

> Nota menor: `docker-compose.yaml` aparece en `.gitignore` pero ya está trackeado en Git, por lo que `git add .` no lo toca. Si se modifica, agregarlo explícitamente.

## Base de datos: orden y trampas de los scripts SQL

Ejecutar en SSMS **exactamente en este orden** sobre la instancia correcta:

1. `SQL/01_crear_base_modulo1.sql`
2. `SQL/02_crear_modulo2.sql`
3. `SQL/03_agregar_subida_contenidos.sql`
4. `SQL/04_actualizar_roles_produccion.sql`
5. `SQL/05_crear_modulo3.sql` — inscripciones (nuevo)
6. `SQL/06_crear_modulo3_progreso.sql` — progreso de lecciones (nuevo)
7. `SQL/07_crear_modulo4_examenes.sql` — exámenes y certificación (nuevo)
8. `SQL/08_asignar_admin_prueba.sql` — admin de prueba (solo desarrollo)
9. `SQL/09_encuesta_satisfaccion.sql` — columnas de encuesta en inscripciones
10. `SQL/10_crear_recursos_curso.sql` — *(legacy; funcionalidad retirada del código)*
11. `SQL/11_preparar_base_produccion.sql` — limpieza solo en `SistemaCursosProduccion`
12. `SQL/12_eliminar_recursos_generales.sql` — *(opcional)* elimina tabla `RecursosCurso` si existía

### Gotchas

- `SQL/01_crear_base_modulo1.sql` hace `DROP TABLE Usuarios` y `DROP TABLE Roles`. Re-ejecutarlo **borra todos los usuarios registrados**.
- `SQL/02_crear_modulo2.sql` es el script oficial: incremental, no borra datos, crea tablas solo si no existen.
- El README menciona `SQL/02_crear_modulo_cursos.sql` como obsoleto; **no existe en el repo actual**. No recrearlo.
- `SQL/04_actualizar_roles_produccion.sql` es idempotente y no migra usuarios automáticamente.
- Los scripts 05–07 son opcionales mientras no se implementen esos módulos, pero deben correr en orden cuando se usen.
- `SQL/10_crear_recursos_curso.sql` creaba Recursos Generales del Curso; **funcionalidad eliminada del código** (5 jul 2026). No ejecutar en instalaciones nuevas; usar `12` solo si la tabla ya existía.

## Roles: qué permite cada uno

La app maneja cinco roles en BD, pero solo dos son alcanzables desde el registro público:

- `usuario` → registro público con cualquier correo; nuevo default para externos.
- `instructor` → registro público **solo** con correo `@itq.edu.ec`; validado en frontend y backend.
- `estudiante` → legacy del Módulo 1; se mantiene compatible, pero no se ofrece en registro nuevo.
- `estudiante_itq` y `administrador` → reservados para asignación manual futura.

Redirección post-login (frontend):

- `instructor` → `instructor.html`
- `usuario`, `estudiante`, `estudiante_itq` → `estudiante.html`
- `administrador` → `admin.html`

## Archivos subidos

- Destino: `uploads/videos/{idLeccion}/`, `uploads/documentos/{idLeccion}/`, `uploads/portadas/{idCurso}/` (fuera de `public/`).
- El servidor expone `/uploads` como estático y crea la carpeta raíz al inicio; las subcarpetas se crean bajo demanda al subir.
- `.gitignore` ignora `uploads/**/*` pero tiene reglas para preservar `.gitkeep` en `videos/`, `documentos/` y `portadas/`. Esas carpetas no existen por defecto; el servidor las genera, por lo que no hay que crearlas a mano.
- Límites por defecto: videos MP4 200 MB, documentos PDF/DOCX/PPTX 50 MB, portadas JPG/PNG/WEBP 5 MB.

## Entrypoints del frontend

- `public/index.html` — landing.
- `public/cursos.html` + `public/modulo2-publico.js` — catálogo y detalle público.
- `public/curso-detalle.html?id={id}` — plataforma de aprendizaje (info → lecciones → video → progreso → examen → certificado → encuesta).
- `public/instructor.html` + `public/modulo2-instructor.js` — panel CRUD del instructor.
- `public/estudiante.html` — panel de cursos para estudiantes/usuarios.
- `public/app.js` — menú dinámico, avatar, utilidades API compartidas.

## Convenciones del backend

- Todas las rutas API bajo `/api/`, respuestas JSON con `{ ok, mensaje, ... }`.
- IDs siempre enteros positivos; `parsearId()` y `validarEnteroPositivo()` centralizan la validación.
- Las operaciones de escritura de Módulo 2 requieren rol `instructor` **y** que el recurso pertenezca al instructor en sesión.
- Sesión de 1 hora vía `express-session` + cookie `connect.sid`.

## Documentos de referencia

### Activos (raíz del proyecto)

- `README.md` — instalación completa, endpoints, usuarios de prueba.
- `PROJECT_STATUS.md` — estado del proyecto, historial de cambios y tareas pendientes.
- `PROYECTO_COMPLETO.md` — documentación técnica consolidada del sistema.
- `AUDITORIA_FINAL_PREPRODUCCION.md` — auditoría preproducción (solo lectura).

### Históricos (`ARCHIVO_PROYECTO/Documentacion_Historica/`)

Documentación de módulos y guías auxiliares **movida desde la raíz** (5 jul 2026); conservada por referencia, no es la fuente de verdad del código actual:

- `ARCHIVO_PROYECTO/Documentacion_Historica/ENTREGA_MODULO2.md` — resumen de cambios y decisiones del cierre del Módulo 2.
- `ARCHIVO_PROYECTO/Documentacion_Historica/MODULO2_PLAN.md` — plan original del Módulo 2 (ideas futuras; no confiar ciegamente, el código real está en `server.js`).
- `ARCHIVO_PROYECTO/Documentacion_Historica/MODULO3_PLAN.md` — plan original del Módulo 3.
- `ARCHIVO_PROYECTO/Documentacion_Historica/GUIA_GIT_GITHUB.md` — guía Git/GitHub del proyecto.

### Respaldo organizativo (`ARCHIVO_PROYECTO/`)

Carpeta de archivo sin eliminar nada. Subcarpetas: `Auditorias_Temporales/`, `Backups_Antiguos/`, `Documentacion_Historica/`, `Pruebas_Locales/`, `Otros/`. No afecta el funcionamiento del servidor.
