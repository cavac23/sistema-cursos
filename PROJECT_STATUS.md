# 1. Estado General del Proyecto

**Nombre del proyecto:** Plataforma de Cursos Virtuales ITQ — Proyecto de Vinculación con la Sociedad 2026.

**Estado actual:** ~**94 %** completado en funcionalidad core. El sistema es operable de punta a punta. **Flujo de encuesta de satisfacción validado y cerrado** (Paso 2, 4 jul 2026). **Recursos generales del curso eliminados por completo** (5 jul 2026). **Limpieza organizativa de la raíz completada** (5 jul 2026). Pendiente: contenido documental en `DOCUMENTACION/`.

**Módulos terminados:**

| Módulo | Alcance |
|--------|---------|
| Módulo 1 | Usuarios, roles, registro, login, sesión, perfil |
| Módulo 2 | Categorías, cursos, lecciones, portadas, subida de portadas, panel instructor, catálogo y detalle público |
| Módulo 3 | Inscripciones, progreso por lección, panel estudiante |
| Módulo 4 | Exámenes finales, intentos, certificados (emisión y vista previa en pantalla) |
| Administración | Dashboard administrador, reportes Excel/PDF institucionales |
| Encuesta | Registro local de encuesta completada + enlace Google Forms |

**Módulos en desarrollo / cierre:**

- Poblado de entregables en `DOCUMENTACION/` (carpetas creadas, sin contenido aún).
- ~~Auditoría y limpieza del repositorio~~ *(completado 5 jul 2026: archivos movidos a `ARCHIVO_PROYECTO/`, nada eliminado)*.
- Mejora opcional de visibilidad UX del bloque de encuesta en `curso-detalle.html`. *(Resuelto: bloque al inicio del sidebar.)*

**Funcionalidades completadas:**

- Autenticación con sesión (`express-session`) y hash de contraseñas (`bcryptjs`); validación mínima de correo (formato) y contraseña (8+ caracteres) en registro y perfil.
- CRUD completo instructor: categorías, cursos (con portada), lecciones (con URL de video/recurso principal).
- Catálogo público y plataforma de aprendizaje en `curso-detalle.html` (info del curso → lecciones → video → progreso → examen → certificado → encuesta).
- Inscripción, barra de progreso, marcado de lecciones completadas.
- Panel estudiante: las tarjetas de **Mis cursos inscritos** muestran el progreso del estudiante y, cuando aplica, el estado de evaluación aprobada.
- Examen final configurable, intentos, aprobación/reprobación.
- Certificado en pantalla (no PDF descargable individual).
- Encuesta de satisfacción: **única por usuario** en toda la plataforma; bloque en sidebar + `POST /api/cursos/:idCurso/encuesta-completada`; reportes Excel con columna global.
- Reporte Excel institucional de participantes (`Reporte_Participantes_Vinculacion_2026.xlsx`, 15 columnas).
- Reporte Excel por curso (instructor/admin en `reportes.html`).
- Reporte PDF general con membretado ITQ (admin).
- Dashboard administrador con indicadores JSON.
- Fechas unificadas en UI y reportes visibles como `dd/MM/yyyy` (sin hora en fechas de usuario).
- README completo actualizado.
- Estructura `DOCUMENTACION/` preparada con subcarpetas.

**Funcionalidades pendientes:**

- Manuales, diagramas, evidencias, presentación y actas dentro de `DOCUMENTACION/`.
- Certificado PDF descargable individual (explícitamente no implementado; solo vista previa HTML).
- ~~Eliminación autorizada de archivos de auditoría/backups/scripts temporales~~ *(no aplica: archivos respaldados en `ARCHIVO_PROYECTO/`)*.
- Reposicionamiento opcional del bloque de encuesta (banner principal o parte superior del sidebar). *(Implementado: tope del sidebar.)*

**Eliminación de recursos generales del curso (5 jul 2026):**

Funcionalidad retirada por completo del código. El instructor administra solo cursos, lecciones, exámenes y estudiantes inscritos.

- Frontend: eliminadas sección instructor, bloque en `curso-detalle.html`, botón **Recursos**, estilos y JS asociados.
- Backend: eliminados endpoints `/api/cursos/:idCurso/recursos` y `/recursos-publicos`; eliminado `middleware/uploadRecursoCurso.js` y función `puedeGestionarCurso`.
- BD: sin cambios automáticos; nuevo script opcional `SQL/12_eliminar_recursos_generales.sql` para quitar tabla `RecursosCurso` si existía.
- **No afectado:** progreso, certificados, exámenes, encuesta, reportes, login, roles, portadas ni video por lección (`url_recurso`).

**Preparación base de producción (5 jul 2026):**

- Nuevo script `SQL/11_preparar_base_produccion.sql` para limpiar datos de prueba antes del hosting.
- Ejecutar **únicamente** sobre `SistemaCursosProduccion`; **nunca** sobre `SistemaCursos` (desarrollo).
- Flujo A: restaurar `.bak` como `SistemaCursosProduccion` → scripts 01–09 → ejecutar script 11 → verificar conteos → crear usuarios reales → configurar `.env` del hosting.
- Flujo B *(recomendado go-live)*: ejecutar **`SQL/13_crear_base_produccion_limpia.sql`** → base vacía con estructura final, sin `RecursosCurso` ni usuarios demo → registrar usuarios reales → asignar admin por SQL.
- Limpia: inscripciones, progreso, intentos de examen, certificados, encuestas marcadas y usuarios `@test.com` (opcional con `@EliminarUsuariosPrueba = 0` para validación final).
- Conserva: roles, categorías, cursos, lecciones, contenidos (video principal), exámenes/preguntas y usuarios reales.

**Script 13 — base limpia de producción *(6 jul 2026)*:**

- Nuevo `SQL/13_crear_base_produccion_limpia.sql`: crea `SistemaCursosProduccion` vacía con estructura final (scripts 01–07 + 09 consolidados).
- Sin `RecursosCurso`, sin usuarios `@test.com`, sin cursos demo; inserta solo 5 roles y 5 categorías base.
- Alternativa al flujo restaurar `.bak` + script 11; recomendado para go-live sin arrastrar datos de desarrollo.
- **No ejecutar** sobre `SistemaCursos` ni automáticamente desde Node.js.

**Eliminación de recursos por lección (5 jul 2026):**

Se eliminó la funcionalidad de Recursos por Lección como decisión de simplificación del proyecto.

El contenido principal de cada lección es el video/enlace configurado en `url_recurso` de la lección.

- UI instructor: retirado botón y sección de recursos adicionales por lección.
- UI estudiante: retirado bloque «Recursos adicionales de la lección» en `curso-detalle.html`.
- Backend: eliminados endpoints CRUD exclusivos de contenidos por lección (`/api/contenidos`, `/api/lecciones/:id/contenidos`, etc.).
- La tabla `Contenidos` en BD se conserva sin cambios; el servidor sigue usando `sincronizarRecursoPrincipalLeccion()` para el video principal de cada lección.
- **No afectado:** progreso, certificados, exámenes, encuesta, reportes, login, registro ni reproducción de videos.

**Normalización automática de texto (5 jul 2026):**

- Módulo `public/texto-utils.js` con `normalizarTitulo()` y `normalizarDescripcion()`.
- Se aplica en el panel instructor **antes de enviar** POST/PUT (sin cambios en backend, BD ni endpoints).
- **Títulos:** Title Case inteligente (palabras menores, acrónimos IT/HTML/CSS/SQL/etc.) en cursos y lecciones.
- **Descripciones:** primera letra en mayúscula, resto respetado, acrónimos preservados; en cursos, lecciones y enunciados de preguntas de examen.
- **Excluido:** correos, contraseñas, URLs, respuestas de examen, formularios de usuario y demás campos técnicos.
- No hubo cambios en la lógica de negocio del servidor.

**Refinamiento pantalla de inicio (5 jul 2026):**

- Actualizado el contenido textual de `index.html` (tarjeta principal y tres tarjetas inferiores) para comunicar la experiencia de aprendizaje, lecciones y formación continua.
- Sin mencionar exámenes, certificados, encuesta ni funcionalidades opcionales.
- Ajustes visuales mínimos en espaciado y legibilidad de las tarjetas existentes; sin cambios en menú, sesión ni backend.
- Reemplazado el botón **Comentarios** por **Preguntas frecuentes**: modal en la misma página con acordeón de 10 preguntas (registro, inscripción, progreso, recursos, evaluaciones, certificados, encuesta y origen de la plataforma). Sin cambios en backend ni lógica de sesión.

----------------------------------------------------

# 2. Objetivo Actual

**Objetivo activo:** continuar con Paso 3 (`AGENTS.md`) o Paso 5 (poblar `DOCUMENTACION/Evidencias/`).

**Contexto — validación Paso 2 (4 jul 2026):**

Prueba automatizada (`scripts/validar-encuesta-paso2.js` + Playwright/Edge) con `estudiante@test.com` en curso 6. **19/19 verificaciones OK.**

| # | Verificación | Resultado |
|---|--------------|-----------|
| 1 | Login estudiante | OK — rol `estudiante` |
| 2 | Detalle curso 6 | OK — progreso 100 %, `encuesta_completada=false` antes de prueba |
| 3 | Posición encuesta | OK — primer hijo del sidebar, visible sin scroll |
| 4 | Diseño integrado | OK — fondo `#fffbeb`, borde izq 4px ITQ |
| 5 | Abrir encuesta | OK — Google Forms en nueva pestaña (`target=_blank`) |
| 6–7 | Ya llené la encuesta | OK — POST, bloque desaparece, alerta de confirmación |
| 7b | API progreso | OK — `encuesta_completada=true`, `fecha_encuesta_completada` registrada |
| 8 | BD (`Inscripciones`) | OK — `encuesta_completada=1`, fecha `2026-07-04T18:23:02` |
| 9 | Excel admin | OK — columna "Encuesta de satisfacción" = **Sí** para `estudiante@test.com` / curso 6 |
| 10 | Sin regresiones | OK — progreso 100 %, examen, certificado y navegación intactos |

**Conclusión:** el flujo de encuesta queda **oficialmente validado y cerrado**.

----------------------------------------------------

# 3. Arquitectura del Proyecto

Stack **realmente utilizado** (verificado en `package.json`, `server.js` y `public/`):

| Capa | Tecnología |
|------|------------|
| Runtime | Node.js 18+ |
| Servidor HTTP / API | Express 4 |
| Base de datos | Microsoft SQL Server |
| Driver BD | `mssql` (Tedious, autenticación SQL) |
| Frontend | HTML5, CSS3, JavaScript vanilla (sin framework, sin build) |
| Sesiones | `express-session` + cookie `connect.sid` |
| Contraseñas | `bcryptjs` |
| Variables de entorno | `dotenv` |
| CORS | `cors` |
| Subida de archivos | `multer` (`middleware/uploadContenido.js`, `middleware/uploadPortada.js`) |
| Reportes Excel | `xlsx` |
| Reportes PDF | `pdfkit` |
| Encuesta externa | Google Forms (enlace estático; **sin** API de Google) |
| Contenedores (opcional) | Docker Compose → SQL Server 2022 Express (`docker-compose.yaml`) |

**No utilizado en este proyecto (no documentar como parte del stack):**

React, Vue, Angular, TypeScript, Webpack/Vite, MongoDB, PostgreSQL, Redis, JWT como mecanismo principal, ExcelJS, integración OAuth Google, tests automatizados oficiales, linter/CI.

**Nota:** `msnodesqlv8` aparece en `package.json` pero el arranque usa Tedious vía `mssql`; `DB_TRUSTED_CONNECTION=true` lanza error. No depender de autenticación Windows.

**Estructura lógica:**

```
Cliente (HTML/CSS/JS en public/)
    ↕ fetch + cookies
Express monolito (server.js, ~3200 líneas)
    ↕ mssql
SQL Server (SistemaCursos)
Archivos locales (uploads/ — fuera de public/, servidos en /uploads)
```

----------------------------------------------------

# 4. Decisiones Técnicas Importantes

### Base de datos y scripts

- Scripts SQL **01–09** en orden estricto; `01` borra usuarios si se re-ejecuta.
- `02_crear_modulo2.sql` es el script oficial incremental del Módulo 2 (no existe `02_crear_modulo_cursos.sql`).
- Script `08_asignar_admin_prueba.sql` asigna rol administrador a `admin@test.com` (debe existir previamente).
- Script `09_encuesta_satisfaccion.sql` agrega `encuesta_completada` y `fecha_encuesta_completada` a `Inscripciones`.
- Script `10_crear_recursos_curso.sql` *(legacy)* creaba tabla `RecursosCurso`; funcionalidad retirada del código (5 jul 2026).
- Script `11_preparar_base_produccion.sql` limpia datos de prueba **solo** en `SistemaCursosProduccion` (nunca en `SistemaCursos` de desarrollo).
- Script `12_eliminar_recursos_generales.sql` *(opcional)* elimina tabla `RecursosCurso` si existía; ejecutar manualmente.

### Roles y acceso

- Cinco roles en BD; registro público solo crea `usuario` o `instructor` (`@itq.edu.ec`).
- `estudiante` es legacy del Módulo 1; sigue funcionando igual que `usuario` en panel estudiante.
- `administrador` y `estudiante_itq` se asignan manualmente en BD.

### Contenidos y archivos

- **Portada del curso:** una imagen por curso en `uploads/portadas/{idCurso}/`.
- **Recurso principal de lección:** campo `url_recurso` (YouTube, URL externa o MP4) sincronizado vía `sincronizarRecursoPrincipalLeccion()` al crear/editar lección.
- YouTube y URLs externas se reproducen/embeben; MP4 local se sirve desde `/uploads`.
- Límites: video 200 MB, documento 50 MB, portada 5 MB (configurables en `.env`).
- La tabla `Contenidos` permanece en BD por compatibilidad; ya no hay CRUD de recursos adicionales por lección en la UI ni en la API pública.

### Encuesta

- **Regla de negocio:** la encuesta de satisfacción es **única por usuario** en toda la plataforma. Un estudiante solo la responde una vez; después no vuelve a verla en ningún curso.
- URL Google Forms en constante `URL_ENCUESTA_SATISFACCION` en `public/modulo2-publico.js` (ya configurada, no placeholder).
- Sin webhook ni integración con Google; confirmación manual con botón **“Ya llené la encuesta”**.
- Backend: `encuesta_global_completada` en `GET /api/cursos/:idCurso/progreso`; helper `usuarioTieneEncuestaGlobalCompletada()`; POST verifica encuesta global antes de marcar inscripción actual.
- Frontend (`debeMostrarEncuesta()`): rol estudiante, acceso completo, curso terminado según reglas de examen (100 % si no hay examen o si el examen no tiene preguntas activas; certificado/aprobación si hay examen con preguntas), **`encuestaGlobalCompletada === false`**.
- **Decisión encuesta (6 jul 2026):** para la encuesta, un examen sin preguntas activas se considera como no disponible y no bloquea la finalización del curso.
- Bloque renderizado **solo** en `curso-detalle.html` (no en `estudiante.html`).
- **Reportes:** Excel institucional muestra columna **“Encuesta de satisfacción (Global)”** — `Sí` si el usuario tiene alguna inscripción con `encuesta_completada = 1`, en todas las filas de sus cursos. PDF general **no** incluye encuesta (sin cambios).

### Reportes institucionales

- Excel participantes: encabezado institucional ITQ, hoja `Participantes 2026`, archivo `Reporte_Participantes_Vinculacion_2026.xlsx`, 15 columnas incluyendo **encuesta global** y fechas.
- PDF general: membretado con `public/img/membrete-itq.png.jpg`, footer institucional, generado con PDFKit.
- Fechas de usuario en reportes: formato `dd/MM/yyyy` (`formatearFechaUsuario` en backend; `formatearFecha` en frontend).
- Fecha/hora de generación del Excel sí incluye hora (`formatearFechaHoraGeneracion`).

### Frontend

- Sin bundler: cada HTML carga sus JS (`app.js` compartido + módulos específicos).
- Menú dinámico por rol en `app.js` (`ITEMS_MENU_POR_ROL`).
- Plataforma de curso: `modulo2-publico.js` → `#contenedorPlataformaCurso`.

### Documentación del repo

- `README.md` reescrito como fuente principal de instalación y API.
- `DOCUMENTACION/` creada con subcarpetas vacías (`.gitkeep`) para entregables institucionales.
- Documentos históricos (`ENTREGA_MODULO2.md`, `MODULO2_PLAN.md`, `MODULO3_PLAN.md`) permanecen en raíz.

### Certificados

- Certificado **en pantalla** al aprobar examen; **no** hay endpoint de PDF individual de certificado.

### Seguridad / despliegue

- `.env` no se versiona; sesión 1 hora.
- En producción, `/api/test-db` requiere sesión iniciada.

----------------------------------------------------

# 5. Estado del Sistema

| Componente | Estado |
|------------|--------|
| Módulo 1 — Usuarios y auth | ✔ Terminado |
| Módulo 2 — Cursos y lecciones | ✔ Terminado |
| Módulo 3 — Inscripciones y progreso | ✔ Terminado |
| Módulo 4 — Exámenes y certificados (pantalla) | ✔ Terminado |
| Dashboard Administrador | ✔ Terminado |
| Dashboard Instructor | ✔ Terminado |
| Dashboard Estudiante | ✔ Terminado |
| PDF institucional (reporte general) | ✔ Terminado |
| Excel institucional (participantes) | ✔ Terminado |
| Excel por curso (reportes.html) | ✔ Terminado |
| Encuesta de satisfacción | ✔ Validada y cerrada (Paso 2 — 4 jul 2026) |
| Portada curso + URL recurso lección | ✔ Terminado |
| Unificación fechas `dd/MM/yyyy` | ✔ Terminado |
| README | ✔ Actualizado |
| DOCUMENTACION/ (contenido) | 🟡 Estructura creada; carpetas vacías |
| AGENTS.md | 🟡 Desactualizado (faltan scripts 08–09 y encuesta) |
| Auditoría / limpieza repo | ✔ Completada (5 jul 2026 — movidos a `ARCHIVO_PROYECTO/`) |
| Certificado PDF descargable | ❌ No implementado (por diseño actual) |
| Tests automatizados | ❌ No existen |

----------------------------------------------------

# 6. Archivos Modificados

Rutas relativas a la raíz del proyecto:  
`C:\Users\TEIKHUN\Desktop\PROYECTO FINAL VINCULACION CON LA SOCIEDAD 2026\`

### Archivos creados

| Ruta |
|------|
| `SQL/09_encuesta_satisfaccion.sql` |
| `DOCUMENTACION/Actas/.gitkeep` |
| `DOCUMENTACION/Diagramas/.gitkeep` |
| `DOCUMENTACION/Evidencias/.gitkeep` |
| `DOCUMENTACION/Manual_Tecnico/.gitkeep` |
| `DOCUMENTACION/Manual_Usuario/.gitkeep` |
| `DOCUMENTACION/Presentacion/.gitkeep` |
| `PROJECT_STATUS.md` *(este documento)* |
| `scripts/validar-encuesta-paso2.js` |
| `scripts/validar-encuesta-resultado.json` |

### Archivos modificados (sesiones recientes de desarrollo)

| Ruta | Cambios principales |
|------|---------------------|
| `server.js` | Encuesta global (`usuarioTieneEncuestaGlobalCompletada`, progreso/POST); Excel: `obtenerParticipantesReporteExcel()` + columna “Encuesta de satisfacción (Global)” en `generarExcelCursos()` |
| `public/modulo2-publico.js` | Encuesta (`debeMostrarEncuesta`, render DOM); URL Google Forms; vista estudiante portada/recurso |
| `public/modulo2-instructor.js` | Formulario portada curso + URL recurso lección |
| `public/modulo-admin.js` | Nombre archivo Excel institucional |
| `public/app.js` | `formatearFecha()` unificado `dd/MM/yyyy` |
| `public/styles.css` | Estilos `.seccion-encuesta-curso` y componentes encuesta |
| `README.md` | Reescritura completa (instalación, SQL 01–09, roles, reportes, encuesta) |

### Limpieza organizativa de la raíz *(5 jul 2026)*

Archivos auxiliares, backups y documentación histórica **movidos** (no eliminados) a `ARCHIVO_PROYECTO/`:

| Origen (raíz o `public/`) | Destino |
|---------------------------|---------|
| `audit-temp-run.ps1` | `ARCHIVO_PROYECTO/Auditorias_Temporales/` |
| `audit-temp-test.ps1` | `ARCHIVO_PROYECTO/Auditorias_Temporales/` |
| `audit-mod3-run.ps1` | `ARCHIVO_PROYECTO/Auditorias_Temporales/` |
| `audit-temp-results.json` | `ARCHIVO_PROYECTO/Auditorias_Temporales/` |
| `test-admin-run.js` | `ARCHIVO_PROYECTO/Pruebas_Locales/` |
| `test-admin-run.ps1` | `ARCHIVO_PROYECTO/Pruebas_Locales/` |
| `cookies-inst.txt` | `ARCHIVO_PROYECTO/Pruebas_Locales/` |
| `estructura.txt` | `ARCHIVO_PROYECTO/Otros/` |
| `public/index.backup-inicio-original.html` | `ARCHIVO_PROYECTO/Backups_Antiguos/` |
| `public/app.backup-inicio-original.js` | `ARCHIVO_PROYECTO/Backups_Antiguos/` |
| `public/styles.backup-inicio-original.css` | `ARCHIVO_PROYECTO/Backups_Antiguos/` |
| `ENTREGA_MODULO2.md` | `ARCHIVO_PROYECTO/Documentacion_Historica/` |
| `MODULO2_PLAN.md` | `ARCHIVO_PROYECTO/Documentacion_Historica/` |
| `MODULO3_PLAN.md` | `ARCHIVO_PROYECTO/Documentacion_Historica/` |
| `GUIA_GIT_GITHUB.md` | `ARCHIVO_PROYECTO/Documentacion_Historica/` |

Sin cambios funcionales en backend, frontend, SQL ni `.env`.

**No versionar nunca:** `.env`, `node_modules/`, `uploads/**/*` (salvo `.gitkeep`).

----------------------------------------------------

# 7. Problemas Activos

### 1. Visibilidad de la encuesta (UX)

- **Estado:** Cerrado — validación funcional completa (Pasos 1 y 2).
- **Nota:** la encuesta solo aparece en `curso-detalle.html`, no en `estudiante.html` (por diseño).

### 2. Carpetas DOCUMENTACION vacías

- **Estado:** Abierto — estructura lista, sin manuales, diagramas ni evidencias.
- **Impacto:** Entregables documentales del proyecto incompletos.

### 3. Limpieza de repositorio

- **Estado:** Cerrado — limpieza organizativa completada el 5 jul 2026.
- **Acción:** 15 archivos movidos a `ARCHIVO_PROYECTO/` (subcarpetas `Auditorias_Temporales/`, `Pruebas_Locales/`, `Backups_Antiguos/`, `Documentacion_Historica/`, `Otros/`). Nada eliminado.

### 4. AGENTS.md desactualizado

- **Estado:** Abierto — no menciona scripts 08–09 ni encuesta.
- **Impacto:** Agentes de IA pueden omitir pasos SQL o funcionalidad reciente.

### 5. Certificado PDF individual no implementado

- **Estado:** Abierto por diseño / alcance — documentado en README.
- **Impacto:** Solo vista previa en pantalla; no descarga PDF de certificado por estudiante.

**Problemas cerrados (no reabrir):**

- Backend encuesta para curso 6 → OK.
- `#seccionEncuestaCurso` ausente del DOM → falso; sí existe.
- CSS ocultando encuesta → falso; estilos normales.
- Flujo completo encuesta (login → sidebar → Google Forms → confirmación → BD → Excel admin) → **validado 4 jul 2026**.

----------------------------------------------------

# 8. Próximos Pasos

1. ~~**Decidir UX encuesta**~~ — **Hecho.**

2. ~~**Probar flujo completo manualmente**~~ — **Hecho** (`scripts/validar-encuesta-paso2.js`, 19/19 OK, 4 jul 2026).

3. **Verificar script SQL 09 en BD de desarrollo:** en SSMS, confirmar columnas `encuesta_completada` y `fecha_encuesta_completada` en `Inscripciones`.

4. **Actualizar `AGENTS.md`:** agregar scripts 08–09, encuesta, Excel/PDF institucional y nota de visibilidad sidebar.

5. **Poblar `DOCUMENTACION/`:** exportar capturas del flujo (catálogo, curso, examen, encuesta, admin Excel/PDF) a `DOCUMENTACION/Evidencias/`.

6. **Redactar `Manual_Usuario/`:** guía breve por rol (estudiante, instructor, admin) apoyándose en `README.md`.

7. ~~**Autorizar y ejecutar limpieza**~~ *(hecho 5 jul 2026 — ver sección 6, carpeta `ARCHIVO_PROYECTO/`)*.

8. **Sincronizar `docker-compose.yaml` con `.env`:** si se usa Docker, alinear `DB_PASSWORD` y puerto 1433 antes de levantar contenedor.

9. **Preparar sustentación:** generar PDF y Excel desde `admin.html` con `admin@test.com` (tras ejecutar script 08) y guardar en `DOCUMENTACION/Presentacion/` o `Evidencias/`.

10. **Evaluar certificado PDF (opcional):** solo si el instituto lo exige; requeriría nuevo endpoint PDFKit — fuera del alcance actual.

----------------------------------------------------

# 9. Historial de Cambios

### Versión 1.0 — Módulo 1

- Usuarios, roles, registro, login, perfil, sesión.

### Versión 2.0 — Módulo 2

- Categorías, cursos, lecciones, panel instructor, catálogo público, subida de archivos.

### Versión 3.0 — Módulo 3

- Inscripciones, progreso por lección, panel estudiante.

### Versión 3.1 — Módulo 4

- Exámenes finales, intentos, certificados en pantalla.

### Versión 3.2 — Administración

- Dashboard admin, reportes JSON, Excel por curso.

### Versión 3.3 — PDF institucional

- Reporte general PDF con membretado ITQ (`pdfkit`).

### Versión 3.4 — Encuesta de satisfacción

- Script SQL 09, endpoint `encuesta-completada`, bloque frontend en `curso-detalle.html`, URL Google Forms configurada.

### Versión 3.5 — Excel institucional ampliado

- `Reporte_Participantes_Vinculacion_2026.xlsx`, 15 columnas, encabezado institucional, columna encuesta.

### Versión 3.6 — Unificación de fechas

- Formato `dd/MM/yyyy` en backend (`formatearFechaUsuario`) y frontend (`formatearFecha`).

### Versión 3.7 — Portada y recurso por lección

- Sincronización `url_recurso` en backend; formularios instructor y vista estudiante actualizados.

### Versión 3.8 — Documentación y README

- README reescrito; carpeta `DOCUMENTACION/` creada; auditoría de archivos obsoletos (sin eliminar).

### Versión 3.23 — Validaciones correo y contraseña *(7 jul 2026)*

- Se reforzaron validaciones mínimas de correo y contraseña para producción: formato de correo, mínimo 8 caracteres en registro/perfil, e instructores deben conservar `@itq.edu.ec` al actualizar perfil.

### Versión 3.22 — Script 13 base producción limpia *(6 jul 2026)*

- `SQL/13_crear_base_produccion_limpia.sql`: creación segura de `SistemaCursosProduccion` vacía (estructura 01–07 + 09, sin RecursosCurso, sin usuarios demo).
- README y PROJECT_STATUS documentan Opción A (restaurar .bak + script 11) y Opción B (script 13 desde cero).

### Versión 3.21 — Progreso en Mis cursos inscritos *(6 jul 2026)*

- Las tarjetas de **Mis cursos inscritos** ahora muestran el progreso del estudiante y, cuando aplica, el estado de evaluación aprobada.
- `GET /api/mis-inscripciones` incluye `porcentaje`, `lecciones_completadas`, `total_lecciones` y `evaluacion_aprobada` (examen con preguntas activas + certificado), sin duplicar la lógica de progreso existente.
- Corrección: refresco al volver al panel (`pageshow` + `cache: no-store`) y bloque visual más compacto (barra → porcentaje → detalle).

### Versión 3.20 — Encuesta con examen vacío *(6 jul 2026)*

- `cursoTerminadoParaEncuesta()`: si `examenExiste` pero `preguntasDisponibles === false`, la encuesta se habilita al 100 % de lecciones (mismo criterio que curso sin examen).
- Decisión: *“Para la encuesta, un examen sin preguntas activas se considera como no disponible y no bloquea la finalización del curso.”*

### Versión 3.19 — Corrección encuesta tras aprobar examen *(6 jul 2026)*

- Tras aprobar el examen, el sidebar actualiza de inmediato la sección de encuesta (`actualizarSeccionEncuestaDOM` en `enviarExamen`).
- Al abrir certificado desde el modal de resultado también se refresca examen/encuesta (`refrescarSeccionExamen`).

### Versión 3.18 — Ajustes lógica del examen *(5 jul 2026)*

- **`GET /api/cursos/:idCurso/examen/estudiante`:** exige inscripción activa, progreso 100 % y preguntas activas; no expone `respuesta_correcta`.
- **Encuesta:** si el curso tiene examen **con preguntas activas**, la encuesta solo aparece tras aprobar (certificado); sin examen o con examen vacío, al 100 % de lecciones.
- **`POST /api/cursos/:idCurso/examen/intento`:** bloquea nuevos intentos si ya existe certificado (409).
- **`GET /api/cursos/:idCurso/examen/estado`:** devuelve `preguntasDisponibles` y `totalPreguntas`; `puedeRendir=false` si el examen no tiene preguntas; UI muestra aviso discreto en lugar de botón vacío.

### Versión 3.17 — Eliminación recursos generales del curso *(5 jul 2026)*

- Retirada por completo la funcionalidad Recursos Generales del Curso (UI instructor/estudiante, endpoints, middleware, estilos).
- Flujo estudiante: info del curso → lecciones → video → progreso → examen → certificado → encuesta.
- Script opcional `SQL/12_eliminar_recursos_generales.sql` para eliminar tabla `RecursosCurso` en BD.

### Versión 3.16 — Limpieza organizativa de la raíz *(5 jul 2026)*

- Carpeta `ARCHIVO_PROYECTO/` creada con subcarpetas `Auditorias_Temporales/`, `Backups_Antiguos/`, `Documentacion_Historica/`, `Pruebas_Locales/` y `Otros/`.
- 15 archivos auxiliares, backups y documentación histórica movidos desde la raíz y `public/`; **ningún archivo eliminado**.
- Sin cambios en `server.js`, frontend activo, SQL, `.env` ni código funcional.

### Versión 3.15 — Script producción BD *(5 jul 2026)*

- `SQL/11_preparar_base_produccion.sql`: limpieza segura de datos transaccionales y usuarios `@test.com` en `SistemaCursosProduccion`.

### Versión 3.14 — Eliminación recursos por lección *(5 jul 2026)*

- Retirada la funcionalidad de recursos adicionales por lección (UI instructor/estudiante y endpoints CRUD).
- Tabla `Contenidos` conservada; `sincronizarRecursoPrincipalLeccion()` intacto para video principal.
- *(Nota: Recursos Generales del Curso existieron temporalmente y fueron retirados en v3.17.)*

### Versión 3.13 — Encuesta global en reportes Excel *(5 jul 2026)*

- Columna renombrada a **“Encuesta de satisfacción (Global)”**; consulta `obtenerParticipantesReporteExcel()` usa `EXISTS` sobre cualquier inscripción del usuario con `encuesta_completada = 1`.
- PDF general sin cambios (no incluye encuesta).

### Versión 3.12 — Encuesta única por usuario

- Regla global: `encuesta_global_completada` en progreso y POST; frontend oculta encuesta en todos los cursos tras marcarla una vez.

### Versión 3.11 — Validación funcional encuesta

- Paso 2 ejecutado: flujo completo validado con `estudiante@test.com` / curso 6; Excel admin confirma encuesta "Sí"; sin regresiones en progreso, examen ni certificado.

### Versión 3.10 — UX encuesta en sidebar

- Bloque de encuesta movido al inicio del sidebar; estilo destacado para mayor visibilidad sin scroll.

### Versión 3.9 — Diagnóstico encuesta frontend

- Inspección DOM real: encuesta renderiza correctamente en curso 6; issue identificado como posición/scroll en sidebar, no fallo de backend ni de generación HTML.
- Creación de `PROJECT_STATUS.md` como documento de transferencia de contexto.

----------------------------------------------------

# 10. Recomendaciones para la Próxima Sesión

### Qué revisar primero

1. Este archivo (`PROJECT_STATUS.md`) y `README.md`.
2. `AGENTS.md` (compacto pero parcialmente desactualizado).
3. Si el tema es encuesta: abrir `curso-detalle.html?id=6` con `estudiante@test.com` y **hacer scroll en el sidebar derecho** antes de concluir que no aparece.

### Qué no modificar sin necesidad

- `server.js` completo — monolito estable; cambios quirúrgicos solo si hay bug confirmado.
- Flujos de login, registro y roles — sensibles y ya probados.
- Scripts SQL 01–07 en BD con datos reales — evitar re-ejecutar `01` (borra usuarios).
- Lógica de examen/certificado salvo requerimiento explícito del instituto.

### Archivos clave antes de programar

| Tarea | Archivos |
|-------|----------|
| Encuesta / plataforma curso | `public/modulo2-publico.js`, `public/curso-detalle.html`, `public/styles.css` |
| Instructor CRUD | `public/modulo2-instructor.js`, `middleware/uploadPortada.js`, `middleware/uploadContenido.js` |
| API / reportes | `server.js` (buscar por ruta `/api/...`) |
| Admin | `public/admin.html`, `public/modulo-admin.js` |
| Estudiante panel | `public/app.js`, `public/estudiante.html` |
| BD | `SQL/01` … `SQL/09` |
| Config local | `.env`, `.env.example`, `docker-compose.yaml` |

### Comandos de arranque rápido

```bash
npm install
npm run dev
# Verificar BD:
curl http://localhost:3000/api/test-db
```

### Credenciales de prueba

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Estudiante | `estudiante@test.com` | `Test1234` |
| Instructor | `instructor@test.com` | `Test1234` |
| Admin | `admin@test.com` | `Test1234` *(requiere script 08)* |

---

*Última actualización: 5 de julio de 2026 — reportes Excel alineados con encuesta global por usuario.*
