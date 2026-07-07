# Entrega — Cierre del Módulo 2

**Proyecto:** Sistema de Cursos Virtuales ITQ  
**Fecha de cierre:** Junio 2026  
**Alcance:** Módulo 1 (Usuarios) + Módulo 2 (Categorías, Cursos, Lecciones, Contenidos)

---

## 1. Objetivo del Módulo 2

Implementar la gestión académica básica del catálogo de cursos: categorías, cursos virtuales, lecciones por curso y contenidos por lección, con panel de instructor, vistas públicas y panel de estudiante.

---

## 2. Resumen de cambios realizados

### Base de datos

| Cambio | Detalle |
|--------|---------|
| Script oficial Módulo 2 | `SQL/02_crear_modulo2.sql` — creación incremental de tablas e índices |
| Tablas nuevas | `Categorias`, `Cursos`, `Lecciones`, `Contenidos` |
| Datos semilla | 3 categorías: Programación, Bases de datos, Desarrollo web |
| Script subida archivos | `SQL/03_agregar_subida_contenidos.sql` — metadatos de videos y documentos locales |
| Script roles producción | `SQL/04_actualizar_roles_produccion.sql` — roles `usuario`, `estudiante_itq`, `administrador` |
| Script obsoleto | `SQL/02_crear_modulo_cursos.sql` marcado como no usar (DROP TABLE destructivo) |

### Backend (`server.js`)

| Cambio | Detalle |
|--------|---------|
| Conexión SQL | Driver nativo `mssql` (Tedious) con autenticación SQL; ya no requiere ODBC ni `msnodesqlv8` |
| Pool singleton | Reutilización de conexión con reinicio ante fallo |
| Módulo 2 — Categorías | 5 endpoints (listar, obtener, crear, editar, cambiar estado) |
| Módulo 2 — Cursos | 6 endpoints (catálogo, mis-cursos, detalle, crear, editar, estado) |
| Módulo 2 — Lecciones | 6 endpoints (públicas, mis-lecciones, detalle, crear, editar, estado) |
| Módulo 2 — Contenidos | 6 endpoints (públicos, mis-contenidos, detalle, crear, editar, estado) |
| Validaciones | `parsearId()`, `validarTexto()`, `mensajeError()` en respuestas de error |
| Seguridad parcial | `/api/test-db` protegido en producción |
| Autorización | Operaciones de escritura restringidas a rol `instructor`; dueño del curso verificado en lecciones y contenidos |
| Roles producción | Registro público: `usuario` e `instructor`; validación `@itq.edu.ec`; compatibilidad legacy `estudiante` |

### Frontend y roles (cierre producción)

| Archivo | Función |
|---------|---------|
| `public/cursos.html` + `modulo2-publico.js` | Catálogo público con filtros |
| `public/curso-detalle.html` + `modulo2-publico.js` | Detalle con lecciones, contenidos y bloqueo visitante |
| `public/instructor.html` + `modulo2-instructor.js` | Panel CRUD instructor y subida de archivos |
| `public/estudiante.html` + `app.js` | Panel de cursos (usuario, estudiante_itq, estudiante legacy) |
| `public/registro.html` + `app.js` | Registro como Usuario registrado o Instructor ITQ |
| `public/app.js` | Menú dinámico por rol, avatar, redirección post-login ampliada |
| `public/styles.css` | Estilos del catálogo, detalle, paneles y barra de sesión |

### Configuración

| Archivo | Cambio |
|---------|--------|
| `.env` / `.env.example` | Variables `DB_SERVER`, `DB_DATABASE`, `DB_TRUSTED_CONNECTION`, `PORT`, `SESSION_SECRET` |
| `README.md` | Documentación completa de instalación, SQL, usuarios, rutas y API |

---

## 3. Endpoints entregados (Módulo 2)

23 endpoints REST agrupados en:

- **Categorías:** GET listado, GET por id, POST, PUT, PATCH estado
- **Cursos:** GET catálogo, GET mis-cursos, GET detalle, POST, PUT, PATCH estado
- **Lecciones:** GET por curso, GET mis-lecciones, GET detalle, POST, PUT, PATCH estado
- **Contenidos:** GET por lección, GET mis-contenidos, GET detalle, POST, PUT, PATCH estado

Listado completo en `README.md`.

---

## 4. Rutas web entregadas (Módulo 2)

| Tipo | Ruta |
|------|------|
| Pública | `/cursos.html` |
| Pública | `/curso-detalle.html?id={id}` |
| Instructor | `/instructor.html` |
| Estudiante | `/estudiante.html` |

---

## 5. Verificación realizada

### Flujo académico base (Módulo 2)

1. Login instructor → CRUD categoría, curso, lección y contenido
2. Catálogo público y detalle de curso con lecciones/contenidos visibles
3. Login estudiante legacy → cursos visibles en panel y enlace a detalle
4. Redirección post-login: instructor → `instructor.html`; roles de panel de cursos → `estudiante.html`

### Cierre de fase — roles y producción (Junio 2026)

| Escenario | Resultado |
|-----------|-----------|
| Visitante sin sesión | Catálogo visible; contenido completo bloqueado en detalle |
| Usuario registrado (`usuario`) | Registro con correo externo; acceso a contenidos y panel |
| Estudiante legacy (`estudiante@test.com`) | Login y panel operativos sin migración |
| Instructor | Registro Gmail rechazado; acceso a panel con cuenta instructor |
| Administrador | Rol en BD; registro público rechazado; sin panel especial (solo `perfil.html`) |
| Subidas | Endpoints de videos, documentos y portadas activos para instructor |
| Menú dinámico | Avatar e indicador de sesión muestran el rol correcto |

**Resultado:** sin errores de API en el flujo principal ni en la verificación de roles.

---

## 6. Decisiones técnicas relevantes

| Tema | Decisión |
|------|----------|
| Script SQL Módulo 2 | Conservar `02_crear_modulo2.sql` (incremental, seguro en equipo) |
| Script alternativo | `02_crear_modulo_cursos.sql` obsoleto (destructivo) |
| Instancia SQL | En desarrollo local: `localhost\MSSQLSERVER_2022` (ajustar según máquina) |
| Contenidos inactivos | No aparecen en vistas públicas ni en listados filtrados por `estado = 1` |
| Categorías inactivas | No aparecen en `GET /api/categorias` ni en selectores del panel |

---

## 7. Mejoras para producción (cierre de fase roles)

| Mejora | Detalle |
|--------|---------|
| Roles ampliados | Cinco roles en BD: `estudiante` (legacy), `usuario`, `estudiante_itq`, `instructor`, `administrador` |
| Usuario registrado | Nuevo rol por defecto en registro público; reemplaza la opción visible "Estudiante" sin romper cuentas legacy |
| Validación ITQ | Instructores solo con correo `@itq.edu.ec` (frontend + backend) |
| Compatibilidad legacy | Rol `estudiante` conservado; sin migración automática; `estudiante.html` sin renombrar |
| Script SQL/04 | `SQL/04_actualizar_roles_produccion.sql` — inserción incremental de roles nuevos |
| Roles reservados | `estudiante_itq` y `administrador` preparados en BD para fases futuras |
| UX de sesión | Menú dinámico por rol, avatar con iniciales, etiqueta de rol y cierre de sesión integrado |

---

## 8. Pendiente para módulos futuros

- Asignación institucional del rol `estudiante_itq`
- Panel y permisos del rol `administrador`
- Módulo 3: inscripciones de estudiantes a cursos
- Progreso, evaluaciones, reportes
- Mejoras de UI en `index.html` y `perfil.html` (fuera de alcance Módulo 2)

---

## 9. Archivos de referencia para revisión

```
SQL/01_crear_base_modulo1.sql
SQL/02_crear_modulo2.sql
SQL/03_agregar_subida_contenidos.sql
SQL/04_actualizar_roles_produccion.sql
server.js
public/cursos.html
public/curso-detalle.html
public/registro.html
public/instructor.html
public/estudiante.html
public/app.js
public/modulo2-publico.js
public/modulo2-instructor.js
README.md
ENTREGA_MODULO2.md
```
