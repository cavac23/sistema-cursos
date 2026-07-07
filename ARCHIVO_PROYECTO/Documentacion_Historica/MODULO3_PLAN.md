# Cambios del último commit — `add reporte de curso`

**Hash:** `4b625c2f0c30764831fb1397801f52acc05d5a57`  
**Autor:** 
**Fecha:** 2026-06-26 20:29:35  

---

## Archivos modificados (25 archivos, +3310/−451 líneas)

### Backend

| Archivo | Cambio |
|---|---|
| `server.js` | +1256 líneas — Migración de `msnodesqlv8` a `mssql` (Tedious). Nuevos endpoints para Módulo 3 (inscripciones, progreso), Módulo 4 (exámenes, certificados) y reportes con exportación a Excel (`xlsx`). |
| `package.json` | Se agregó dependencia `xlsx`. |
| `package-lock.json` | Actualizado con `xlsx` y sus dependencias. |

### Base de datos

| Archivo | Cambio |
|---|---|
| `SQL/05_crear_modulo3.sql` | +23 líneas — Tabla `Inscripciones`. |
| `SQL/06_crear_modulo3_progreso.sql` | +22 líneas — Tabla `ProgresoLecciones`. |
| `SQL/07_crear_modulo4_examenes.sql` | +82 líneas — Tablas `Examenes`, `Preguntas`, `IntentosExamen`, `Certificados`. |

### Frontend

| Archivo | Cambio |
|---|---|
| `public/modulo-reportes.js` | +335 líneas — **Nuevo.** Dashboard de reportes con gráficos y exportación Excel. |
| `public/reportes.html` | +60 líneas — **Nuevo.** Página de reportes. |
| `public/instructor.html` | +83 líneas — Panel de instructor con reportes y exámenes. |
| `public/estudiante.html` | Vista de cursos con progreso, exámenes y certificados. |
| `public/modulo2-instructor.js` | +230 líneas — Gestión de exámenes desde el panel instructor. |
| `public/modulo2-publico.js` | +491 líneas — Inscripción, progreso, renderizado de examen y certificado. |
| `public/app.js` | +115 líneas — Menú dinámico mejorado, enlaces a reportes. |
| `public/styles.css` | +513 líneas — Estilos nuevos para progreso, exámenes, certificados y reportes. |
| `public/cursos.html` | Enlace a módulo reportes en el menú. |
| `public/curso-detalle.html` | Ajuste menor. |
| `public/index.html`, `public/login.html`, `public/perfil.html`, `public/registro.html` | Enlaces al módulo de reportes en el menú. |

### Documentación y configuración

| Archivo | Cambio |
|---|---|
| `.env.example` | Actualizado con nuevos defaults (`DB_TRUSTED_CONNECTION=false`, `DB_SERVER=localhost`). |
| `.gitignore` | Reglas para `uploads/` preservando `.gitkeep`. |
| `AGENTS.md` | Documentación actualizada sobre Módulos 3–4, roles y scripts SQL. |
| `ENTREGA_MODULO2.md` | Ajuste menor. |
| `README.md` | Documentación de nuevos endpoints y roles actualizados. |

---

## Resumen funcional

- **Módulo 3:** Inscripciones a cursos y progreso de lecciones por estudiante.
- **Módulo 4:** Exámenes por curso (CRUD instructor + respuesta estudiante), certificados automáticos al aprobar.
- **Reportes:** Dashboard con exportación a Excel (XLSX) para instructores y administradores.
- **Infraestructura:** Migración del driver de BD de `msnodesqlv8` a `mssql` (Tedious nativo), eliminando dependencia de ODBC.
