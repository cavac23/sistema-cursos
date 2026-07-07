# Auditoría final de preproducción — Plataforma de Cursos Virtuales ITQ

**Fecha:** 5 de julio de 2026  
**Alcance:** Revisión read-only del repositorio completo (frontend, backend, SQL, documentación, despliegue).  
**Restricción cumplida:** No se modificó código, base de datos, `.env`, ni se ejecutaron scripts SQL.

---

## RESUMEN EJECUTIVO

### Estado general del proyecto

La plataforma es **funcional de punta a punta** para el flujo académico principal: registro/login, catálogo, inscripción, lecciones con video por URL, recursos generales del curso, progreso, examen final, certificado en pantalla, encuesta de satisfacción y reportes Excel/PDF institucionales. El backend expone **52 rutas API** con validación parametrizada y control de roles en la mayoría de operaciones sensibles.

Sin embargo, **no está lista para un despliegue público inmediato** sin resolver al menos los hallazgos críticos de seguridad, assets faltantes en `public/img/` y la preparación de hosting (persistencia de `uploads/`, secretos, base `SistemaCursosProduccion`).

### Porcentaje estimado de preparación para producción

| Dimensión | Estimación |
|-----------|------------|
| Funcionalidad core académica | **~92 %** |
| Seguridad y hardening | **~65 %** |
| UX / contenido / assets visuales | **~78 %** |
| Documentación alineada | **~80 %** |
| Infraestructura Render + Azure SQL | **~70 %** |
| **Preparación global para go-live** | **~82 %** |

### Fortalezas

- Arquitectura simple y mantenible: Express monolito + frontend estático + SQL Server.
- Modelo relacional coherente (13 tablas); script `SQL/11_preparar_base_produccion.sql` bien diseñado para limpieza pre-hosting.
- Flujo de encuesta validado automáticamente (`scripts/validar-encuesta-paso2.js`: **19/19 OK**, 4 jul 2026).
- Recursos generales del curso, normalización de portadas Google Drive (`imagen-utils.js`) y retiro de recursos por lección aplicados recientemente.
- Reportes institucionales (Excel 15 columnas, PDF con membretado) operativos para administrador.
- CSS con **8 breakpoints** responsive; panel de curso con layout adaptativo.

### Problemas críticos (bloquean o arriesgan producción)

| # | Hallazgo | Área |
|---|----------|------|
| C1 | **`public/img/` ausente en el repositorio** — favicon, banners, logos y fondo institucional rotos en todas las páginas | Frontend |
| C2 | **Chat de inicio roto:** `responderChat()` no existe → error JS al pulsar Enviar en `index.html` | Frontend |
| C3 | **`GET /api/cursos/:idCurso/examen/estudiante` sin verificar inscripción** — cualquier usuario con rol estudiante puede leer preguntas de cualquier curso con examen activo | Backend / Seguridad |
| C4 | **`/uploads` servido sin autenticación** — archivos accesibles por URL directa si se conoce la ruta | Backend / Seguridad |
| C5 | **`SESSION_SECRET` por defecto** en `.env.example` (`cambia_esta_clave`) — riesgo grave si no se cambia en hosting | Producción |
| C6 | **Persistencia de archivos en Render** — `uploads/` es local; despliegue efímero pierde portadas y recursos subidos | Render / Infra |

### Problemas importantes

| # | Hallazgo | Área |
|---|----------|------|
| I1 | Cookie de sesión sin `secure` ni `sameSite` | Seguridad |
| I2 | CORS `origin: true` con credenciales — refleja cualquier origen | Seguridad |
| I3 | Errores 500 exponen `detalle` con mensajes de BD/driver en producción | Seguridad |
| I4 | **`AGENTS.md` desactualizado** (scripts 08–11, encuesta, recursos, admin, producción) | Documentación |
| I5 | **`middleware/uploadContenido.js`** — multer de lección huérfano (sin ruta API) | Backend / deuda |
| I6 | **No existe recuperación de contraseña** (solo FAQ en inicio; login sin enlace) | UX / funcional |
| I7 | **Administrador no gestiona usuarios** desde la UI (solo dashboard + reportes) | Funcional / expectativa |
| I8 | Scripts **05–07** sin `USE SistemaCursos` — riesgo de ejecutar en BD incorrecta | SQL / operaciones |
| I9 | README contradice orden de scripts (tabla 01–11 vs sección evaluadores “01 al 09”) | Documentación |
| I10 | `.env.example` aún documenta autenticación Windows (`msnodesqlv8`) que el servidor rechaza al arrancar | Configuración |

### Problemas menores

| # | Hallazgo |
|---|----------|
| M1 | Asistente virtual duplicado en `index.html` |
| M2 | `#mensajeEstudiante` nunca usado en `estudiante.html` |
| M3 | Bloque `#formRegistro` muerto en `app.js` (registro usa forms separados) |
| M4 | CSS legacy de contenidos por lección (`.lista-contenidos*`) sin uso |
| M5 | Copy desactualizado en `curso-detalle.html` (“documentos” por lección) |
| M6 | “Inscribete” sin tilde; “Leccion” sin tilde en mensajes instructor |
| M7 | Inconsistencia “Instituto Superior” vs “Instituto Tecnológico” en textos |
| M8 | Archivos backup (`*.backup-inicio-original.*`) duplican deuda |
| M9 | No hay `DELETE` de curso — solo desactivar (`PATCH estado`) |
| M10 | Sin índices en tablas M3/M4 (`Inscripciones`, `ProgresoLecciones`, etc.) |
| M11 | Columnas `Contenidos` de subida de archivos sin uso tras retiro de recursos por lección |
| M12 | Guard clause muerta en script 11 (`IF DB_NAME() = 'SistemaCursos'` tras `USE Produccion`) |

### Mejoras opcionales (post go-live)

- Rate limiting en login/registro.
- Certificado PDF descargable individual (explícitamente fuera de alcance actual).
- Poblar `DOCUMENTACION/` con manuales y evidencias.
- Eliminar dependencia `msnodesqlv8` si no se usará Windows auth.
- Servir descargas vía rutas autenticadas en lugar de estático `/uploads`.
- Límite de intentos de examen.
- Etiquetas amigables de rol en `perfil.html`.

---

## RIESGOS PARA PRODUCCIÓN

| Riesgo | Probabilidad | Impacto | Mitigación recomendada (manual) |
|--------|--------------|---------|----------------------------------|
| Secretos débiles en hosting | Alta si no se configura | Crítico | `SESSION_SECRET` fuerte; no commitear `.env` |
| Fuga de preguntas de examen | Media | Alto | Corregir endpoint antes de go-live |
| Pérdida de archivos subidos en Render | Alta en plan sin disco | Alto | Disco persistente, Azure Blob o similar |
| Usuarios `@test.com` en producción | Media si se omite script 11 | Alto | Ejecutar `SQL/11` con `@EliminarUsuariosPrueba = 1` |
| Assets `img/` faltantes | Alta en deploy limpio | Medio | Versionar imágenes o incluir en pipeline |
| BD de desarrollo tocada por error | Baja | Crítico | Nunca ejecutar script 11 en `SistemaCursos` |
| Escalabilidad enrollment/exámenes | Baja inicial | Medio | Índices en FKs M3/M4 cuando crezca carga |
| Exposición de stack en errores 500 | Media | Medio | Ocultar `detalle` con `NODE_ENV=production` |

---

## 1. AUDITORÍA FRONTEND

### Páginas revisadas

`index.html`, `login.html`, `registro.html`, `estudiante.html`, `instructor.html`, `admin.html`, `cursos.html`, `curso-detalle.html`, `perfil.html`, `reportes.html`.

**Recuperación de contraseña:** 🟠 No existe página ni flujo. Solo mención en FAQ de inicio (contactar administrador). Login no enlaza al FAQ.

### Matriz de hallazgos frontend

| ID | Severidad | Hallazgo | Ubicación |
|----|-----------|----------|-----------|
| F-01 | 🔴 | Carpeta `public/img/` **vacía/ausente** — favicon, logos, banners, GIF, fondo | Todas las páginas + `styles.css` `.fondo-estudiantil` |
| F-02 | 🔴 | `responderChat()` **no definida** — botón Enviar del chat virtual | `index.html` L71 |
| F-03 | 🟠 | Subtítulo curso-detalle menciona “documentos” por lección (modelo actual: URL + recursos generales) | `curso-detalle.html` |
| F-04 | 🟠 | Sin enlace registro↔login en cuerpo de formularios (solo menú superior) | `login.html`, `registro.html` |
| F-05 | 🟡 | Asistente `.asistente-ayuda` duplicado | `index.html` |
| F-06 | 🟡 | `#mensajeEstudiante` huérfano | `estudiante.html` |
| F-07 | 🟡 | `#formRegistro` en JS sin HTML correspondiente | `app.js` |
| F-08 | 🟡 | “Inscribete” sin tilde | `modulo2-publico.js` |
| F-09 | 🟡 | Rol crudo de BD en perfil (`usuario`, `instructor`) | `perfil.html` + `app.js` |
| F-10 | 🟡 | Inconsistencia nombre institucional / marca TRANSFORMATEC vs TransformaTec | `index.html` |
| F-11 | 🟢 | Navegación interna entre `.html` coherente | Todas |
| F-12 | 🟢 | Recursos por lección eliminados de HTML instructor | `instructor.html` |
| F-13 | 🟢 | Orden scripts correcto (`imagen-utils.js` antes de módulos) | `cursos`, `curso-detalle`, `instructor`, `estudiante` |
| F-14 | 🟢 | FAQ modal operativo | `index.html` |

### Formularios y validaciones

| Formulario | Handler | Validación cliente | Observación |
|------------|---------|-------------------|-------------|
| Login | 🟢 `app.js` | Campos required | OK |
| Registro estudiante/instructor | 🟢 `app.js` | Email `@itq.edu.ec` instructor | OK |
| Perfil | 🟢 `app.js` | Básica | OK |
| Curso/lección/recursos/examen instructor | 🟢 `modulo2-instructor.js` + `texto-utils.js` | Título obligatorio, URL lección | OK |
| Inscripción / progreso / examen estudiante | 🟢 `modulo2-publico.js` | Por API | OK |

### Responsive y diseño

- 🟢 **8 media queries** en `styles.css` (480px, 600px, 768px, 769px).
- 🟢 Paleta institucional (azul `#003366`, acentos) consistente en header/footer.
- 🟡 Layout plataforma curso en móvil revisado en CSS; **validación visual manual en dispositivos reales pendiente** (no ejecutada en esta auditoría automatizada).

### Consola del navegador (análisis estático)

| Error esperado | Página |
|----------------|--------|
| `ReferenceError: responderChat is not defined` | `index.html` al usar chat |
| 404 en imágenes `img/*` | Todas las páginas |

---

## 2. AUDITORÍA BACKEND

**Archivo principal:** `server.js` (~3.640 líneas)  
**Middleware:** `uploadContenido.js`, `uploadPortada.js`, `uploadRecursoCurso.js`

### Rutas API (52 endpoints)

Agrupadas en: auth, categorías, cursos, lecciones, inscripciones/progreso/encuesta, exámenes, certificados, recursos curso, reportes, dashboard admin.

Endpoints de **contenidos por lección eliminados** correctamente (`/api/contenidos`, `/api/lecciones/:id/contenidos`).  
Tabla `Contenidos` sigue usada internamente vía `sincronizarRecursoPrincipalLeccion()`.

### Hallazgos backend

| ID | Severidad | Hallazgo |
|----|-----------|----------|
| B-01 | 🔴 | Examen estudiante expuesto sin inscripción (`GET .../examen/estudiante`) |
| B-02 | 🔴 | `/uploads` estático sin auth |
| B-03 | 🔴 | `SESSION_SECRET` débil por defecto |
| B-04 | 🟠 | Cookie sin `secure` / `sameSite` |
| B-05 | 🟠 | CORS permisivo con credenciales |
| B-06 | 🟠 | `detalle` en respuestas 500 |
| B-07 | 🟠 | `uploadContenido.js` multer sin ruta (código muerto) |
| B-08 | 🟠 | `/api/test-db` en producción accesible a cualquier sesión |
| B-09 | 🟡 | `GET /api/categorias/:id`, `GET /api/lecciones/:id` sin uso en frontend |
| B-10 | 🟡 | Categorías: cualquier instructor modifica categorías globales |
| B-11 | 🟡 | Sin límite de reintentos de examen |
| B-12 | 🟢 | SQL parametrizado consistentemente |
| B-13 | 🟢 | Multer portada y recursos con validación y rollback |
| B-14 | 🟢 | Roles y ownership en CRUD instructor |

### Imports / funciones huérfanas

- `server.js` importa de `uploadContenido.js` solo `UPLOAD_DIR` y `eliminarArchivoSubido`.
- Exportaciones no usadas: `uploadContenido`, `rutaRelativaArchivo`, `validarTamanoArchivo`, etc.

---

## 3. AUDITORÍA BASE DE DATOS

### Scripts 01–11 — orden y contenido

| # | Script | Tablas / cambios |
|---|--------|------------------|
| 01 | `01_crear_base_modulo1.sql` | `Roles`, `Usuarios` — **DROP destructivo** si re-ejecuta |
| 02 | `02_crear_modulo2.sql` | `Categorias`, `Cursos`, `Lecciones`, `Contenidos` + semillas |
| 03 | `03_agregar_subida_contenidos.sql` | Columnas archivo en `Contenidos` |
| 04 | `04_actualizar_roles_produccion.sql` | Roles adicionales |
| 05 | `05_crear_modulo3.sql` | `Inscripciones` |
| 06 | `06_crear_modulo3_progreso.sql` | `ProgresoLecciones` |
| 07 | `07_crear_modulo4_examenes.sql` | `Examenes`, `Preguntas`, `IntentosExamen`, `Certificados` |
| 08 | `08_asignar_admin_prueba.sql` | Rol admin → `admin@test.com` |
| 09 | `09_encuesta_satisfaccion.sql` | Columnas encuesta en `Inscripciones` |
| 10 | `10_crear_recursos_curso.sql` | `RecursosCurso` |
| 11 | `11_preparar_base_produccion.sql` | Limpieza transaccional (solo `SistemaCursosProduccion`) |

**Procedimientos, funciones, triggers, vistas:** 🟢 Ninguno definido en scripts del proyecto (solo tablas, índices, constraints).

### Modelo relacional

```
Roles ← Usuarios ← Cursos ← Lecciones ← Contenidos
                    ↑              ↑
              Inscripciones → ProgresoLecciones
                    ↑
              (encuesta en Inscripciones)
Cursos ← Examenes ← Preguntas
Cursos ← RecursosCurso
Usuarios ← IntentosExamen → Certificados
```

### Hallazgos BD

| ID | Severidad | Hallazgo |
|----|-----------|----------|
| D-01 | 🟠 | Scripts 05–07 sin `USE SistemaCursos` |
| D-02 | 🟡 | Sin índices en FKs M3/M4 |
| D-03 | 🟡 | Columnas `Contenidos` de archivo (`nombre_archivo`, `mime_type`, etc.) sin uso en app |
| D-04 | 🟡 | `Cursos.url_video` legacy; UI envía null |
| D-05 | 🟡 | App bind `VarChar(255)` vs columna `url_contenido` VARCHAR(500) |
| D-06 | 🟢 | 13 tablas — todas referenciadas en `server.js` |
| D-07 | 🟢 | Script 11: orden FK correcto, transacción, protección de BD |
| D-08 | 🟢 | Sin DROP TABLE en scripts incrementales 02–11 |

---

## 4. AUDITORÍA FUNCIONAL

**Método:** Revisión de código + evidencia `scripts/validar-encuesta-resultado.json` (19/19 OK, 4 jul 2026). **No se ejecutaron pruebas manuales en vivo** en esta sesión (servidor no verificado en auditoría).

### Administrador

| Flujo | Estado | Notas |
|-------|--------|-------|
| Login | 🟢 | Rol `administrador` vía script 08 + registro previo |
| Dashboard indicadores | 🟢 | `GET /api/dashboard/admin` |
| Reporte Excel participantes | 🟢 | 15 columnas, encuesta global |
| Reporte PDF general | 🟢 | Solo admin; botón oculto para instructor en reportes |
| **Gestión de usuarios (CRUD)** | 🔴 **No implementada** | Solo asignación manual SQL / registro |
| Acceso CRUD cursos como instructor | 🟠 | Admin **no** pasa `requiereRol('instructor')` en rutas M2 |

### Instructor

| Flujo | Estado | Notas |
|-------|--------|-------|
| Crear / editar curso | 🟢 | POST/PUT `/api/cursos` |
| Desactivar curso | 🟢 | PATCH estado |
| Eliminar curso (hard delete) | 🟡 | No existe — solo desactivar |
| Crear / editar lección | 🟢 | URL recurso obligatoria |
| Subir portada | 🟢 | POST portada + URL (Drive normalizado) |
| Recursos generales | 🟢 | CRUD + archivos |
| Crear / editar examen y preguntas | 🟢 | Endpoints M4 |
| Ver estudiantes inscritos | 🟢 | `/api/cursos/:id/estudiantes` |
| Reportes Excel por curso | 🟢 | `reportes.html` |

### Estudiante / usuario

| Flujo | Estado | Notas |
|-------|--------|-------|
| Registro | 🟢 | Rol `usuario` o `instructor` (@itq.edu.ec) |
| Login / logout | 🟢 | Sesión 1 h |
| Inscripción | 🟢 | POST inscripciones |
| Acceso curso / lecciones | 🟢 | Plataforma en `curso-detalle.html` |
| Reproducción video (YouTube/URL) | 🟢 | `url_recurso` vía subquery Contenidos |
| Recursos generales | 🟢 | Si inscrito |
| Progreso lecciones | 🟢 | PATCH progreso |
| Examen final | 🟢 | Tras 100 % lecciones |
| Certificado pantalla | 🟢 | Tras aprobar |
| Encuesta satisfacción | 🟢 | Validación automatizada 19/19 |
| Perfil | 🟢 | GET/PUT perfil |

---

## 5. AUDITORÍA UX

| ID | Severidad | Recomendación |
|----|-----------|---------------|
| UX-01 | 🟠 | Añadir en login enlace a registro y nota de contraseña olvidada |
| UX-02 | 🟠 | Unificar textos institucionales y ortografía (tildes) |
| UX-03 | 🟡 | Quitar o reparar chat virtual de inicio |
| UX-04 | 🟡 | Eliminar asistente duplicado en landing |
| UX-05 | 🟡 | Etiquetas de rol legibles en perfil |
| UX-06 | 🟢 | Flujo curso: info → recursos generales → lecciones → video (claro) |
| UX-07 | 🟢 | Encuesta visible al inicio del sidebar (validado) |

---

## 6. AUDITORÍA CSS

**Archivo:** `public/styles.css` (~2.550 líneas)

| ID | Severidad | Hallazgo |
|----|-----------|----------|
| CSS-01 | 🟡 | Reglas huérfanas contenidos lección: `.bloque-contenidos-leccion`, `.lista-contenidos*`, `.lista-contenidos-fantasma` |
| CSS-02 | 🟡 | Estilos `#formRegistro` sin formulario |
| CSS-03 | 🟡 | Archivo `styles.backup-inicio-original.css` duplicado (~1.300 líneas) |
| CSS-04 | 🟢 | Media queries presentes para móvil/tablet |
| CSS-05 | 🟢 | Variables de color institucional reutilizadas |

**No se ejecutó análisis automatizado de cobertura CSS** (PurgedCSS); hallazgos por búsqueda de clases vs HTML/JS.

---

## 7. AUDITORÍA JAVASCRIPT

| Archivo | Líneas aprox. | Hallazgos |
|---------|---------------|-----------|
| `app.js` | ~550 | `#formRegistro` muerto; `mostrarSlides()` en todas las páginas |
| `modulo2-publico.js` | ~1.240 | 🟢 Sin refs a contenidos por lección |
| `modulo2-instructor.js` | ~980 | 🟢 Limpio post-retiro recursos lección |
| `modulo-admin.js` | ~120 | 🟢 Enfocado dashboard |
| `modulo-reportes.js` | ~370 | 🟢 PDF general oculto para no-admin |
| `imagen-utils.js` | ~25 | 🟢 `normalizarUrlImagen` Drive |
| `texto-utils.js` | ~130 | 🟢 Normalización títulos |

| ID | Severidad | Hallazgo |
|----|-----------|----------|
| JS-01 | 🔴 | `responderChat` ausente (`index.html`) |
| JS-02 | 🟡 | `formRegistro` listener nunca activo |
| JS-03 | 🟡 | Backups `app.backup-inicio-original.js` |
| JS-04 | 🟢 | Sin listeners duplicados detectados en módulos activos |

---

## 8. AUDITORÍA DOCUMENTACIÓN

| Documento | Estado | Problemas |
|-----------|--------|-----------|
| `README.md` | 🟠 Mayormente actualizado | Contradicción 01–09 vs 01–11; falta encuesta global; admin CRUD sobredimensionado |
| `PROJECT_STATUS.md` | 🟢 Más completo | Referencia AGENTS desactualizado |
| `AGENTS.md` | 🔴 Desactualizado | Solo scripts 01–07; sin 08–11, encuesta, recursos, admin, producción |
| `ENTREGA_MODULO2.md` | 🟡 Legacy | Aún menciona endpoints contenidos |
| `.env.example` | 🟠 | Server machine-specific; Windows auth obsoleta; sin `NODE_ENV` / producción |

---

## 9. AUDITORÍA PRODUCCIÓN (Render + Azure SQL)

### Configuración revisada

| Elemento | Estado | Riesgo |
|----------|--------|--------|
| `package.json` `npm start` | 🟢 | `node server.js` — compatible Render |
| `.env` / `.env.example` | 🟠 | Secretos y BD a configurar manualmente |
| `DB_DATABASE=SistemaCursosProduccion` | 🟠 | Documentado en README; no en `.env.example` |
| Azure SQL firewall | 🟠 | Debe permitir IP de Render |
| `uploads/` en `.gitignore` | 🟢 | Correcto no versionar |
| Persistencia uploads Render | 🔴 | Sin volumen persistente se pierden archivos |
| `msnodesqlv8` en dependencies | 🟡 | No usado con Tedious; confusión operativa |
| Script SQL 11 | 🟢 | Listo para pre-limpieza producción |
| Docker Compose SQL local | 🟢 | Alternativa dev; producción = Azure |

### Checklist Render

- [ ] Variable `PORT` (Render la inyecta)
- [ ] `SESSION_SECRET` fuerte
- [ ] `NODE_ENV=production`
- [ ] `DB_SERVER` apuntando a Azure SQL
- [ ] Disco persistente o almacenamiento externo para `uploads/`
- [ ] Health check (no hay ruta dedicada; usar `/` o `/api/test-db` con precaución)

### Checklist Azure SQL

- [ ] Base `SistemaCursosProduccion` restaurada
- [ ] Scripts 01–10 aplicados
- [ ] Script 11 ejecutado (cuando autorizado)
- [ ] Firewall + autenticación SQL (`DB_TRUSTED_CONNECTION=false`)

---

## 10. LISTA DE VERIFICACIÓN FINAL

| Ítem | Estado | Severidad si pendiente |
|------|--------|------------------------|
| ☐ Login | 🟢 Funcional | — |
| ☐ Registro | 🟢 Funcional | — |
| ☐ Roles | 🟢 5 roles BD; registro público 2 roles | — |
| ☐ Cursos | 🟢 CRUD + desactivar | — |
| ☐ Lecciones | 🟢 CRUD + URL video | — |
| ☐ Videos | 🟢 YouTube/URL/MP4 vía `url_recurso` | — |
| ☐ Recursos generales | 🟢 CRUD + vista estudiante | — |
| ☐ Exámenes | 🟠 Funcional; **fuga preguntas** pre-inscripción | 🔴 |
| ☐ Encuesta | 🟢 Validado 19/19 | — |
| ☐ Certificados | 🟢 Vista pantalla (no PDF individual) | — |
| ☐ Reportes | 🟢 Excel/PDF admin + Excel instructor | — |
| ☐ Responsive | 🟡 CSS preparado; prueba manual pendiente | 🟡 |
| ☐ Render | 🟠 Requiere config secretos + persistencia uploads | 🔴 |
| ☐ Azure | 🟠 Requiere BD producción + firewall | 🟠 |
| ☐ SQL | 🟢 Scripts 01–11; script 11 no ejecutado (correcto) | — |
| ☐ Documentación | 🟠 AGENTS y README parcialmente desalineados | 🟠 |
| ☐ Assets `img/` | 🔴 Faltantes en repo | 🔴 |
| ☐ Chat inicio | 🔴 Roto | 🔴 |
| ☐ Gestión usuarios admin | 🔴 No existe UI | 🟠 |
| ☐ Seguridad sesión/uploads | 🔴 Endurecer antes de público | 🔴 |

---

## ARCHIVOS AUXILIARES / DEUDA (sin eliminar — solo reporte)

| Archivo | Motivo |
|---------|--------|
| `public/index.backup-inicio-original.html` | Backup manual |
| `public/app.backup-inicio-original.js` | Backup manual |
| `public/styles.backup-inicio-original.css` | Backup manual |
| `scripts/validar-encuesta-paso2.js` | Validación QA |
| `scripts/validar-encuesta-resultado.json` | Evidencia QA |
| `audit-temp-run.ps1` (si existe) | Referencias API contenidos obsoletas |

---

## CONCLUSIÓN Y RECOMENDACIÓN DE GO-LIVE

**Veredicto:** La plataforma está **lista para preproducción controlada** (piloto interno ITQ con usuarios reales y BD `SistemaCursosProduccion` tras script 11), pero **no recomendada para exposición pública amplia** hasta corregir:

1. Assets `public/img/` (C1)  
2. Endpoint examen estudiante + `/uploads` + `SESSION_SECRET` (C3–C5)  
3. Estrategia de persistencia de archivos en Render (C6)  
4. Chat roto en landing (C2) — impacto imagen institucional  

**Orden sugerido antes del hosting (decisión manual del equipo):**

1. Restaurar `.bak` → `SistemaCursosProduccion`  
2. Ejecutar `SQL/11` (cuando autorice)  
3. Corregir hallazgos 🔴 críticos  
4. Configurar `.env` producción + Azure firewall  
5. Desplegar Render con disco persistente para `uploads/`  
6. Smoke test manual con usuarios reales (no `@test.com`)  
7. Actualizar `AGENTS.md` y README  

---

*Documento generado por auditoría read-only. Ningún archivo del proyecto fue modificado excepto la creación de este informe.*
