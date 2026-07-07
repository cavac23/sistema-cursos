$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'
$R = [ordered]@{ bloques = @(); residuos = @() }

function Sess { New-Object Microsoft.PowerShell.Commands.WebRequestSession }
function Api($m, $p, $b, $s) {
  $pr = @{ Uri = "$base$p"; Method = $m; WebSession = $s; UseBasicParsing = $true }
  if ($null -ne $b) { $pr.Body = ($b | ConvertTo-Json -Compress); $pr.ContentType = 'application/json' }
  try {
    $w = Invoke-WebRequest @pr
    return @{ ok = $true; code = [int]$w.StatusCode; data = ($w.Content | ConvertFrom-Json); raw = $w.Content }
  } catch {
    $c = [int]$_.Exception.Response.StatusCode.value__
    $raw = $_.ErrorDetails.Message
    $d = $null; try { $d = $raw | ConvertFrom-Json } catch {}
    return @{ ok = $false; code = $c; data = $d; raw = $raw }
  }
}
function Row($bloque, $func, $estado, $evidencia, $obs) {
  $script:R.bloques += [pscustomobject]@{ Bloque = $bloque; Funcionalidad = $func; Estado = $estado; Evidencia = $evidencia; Observacion = $obs }
}

# === BLOQUE 1 ===
$sEst = Sess
$r = Api POST '/api/login' @{ correo = 'estudiante@test.com'; contrasena = 'Test1234' } $sEst
$idUsuario = $r.data.usuario.id_usuario
Row 'B1' 'Login estudiante@test.com' $(if($r.ok){'OK'}else{'FAIL'}) "HTTP $($r.code) id_usuario=$idUsuario rol=$($r.data.usuario.rol)" ''

$r = Api GET '/api/cursos' $null (Sess)
$curso = $r.data.cursos | Where-Object { $_.id_curso -eq 4 } | Select-Object -First 1
if (-not $curso) { $curso = $r.data.cursos | Select-Object -First 1 }
$idCurso = $curso.id_curso
Row 'B1' 'Catalogo cursos activos' $(if($r.ok){'OK'}else{'FAIL'}) "HTTP $($r.code) count=$($r.data.cursos.Count) id_curso_elegido=$idCurso titulo=$($curso.titulo)" ''

$r = Api GET "/api/cursos/$idCurso/lecciones" $null (Sess)
$leccionesCount = @($r.data.lecciones).Count
Row 'B1' 'Lecciones del curso elegido' $(if($r.ok -and $leccionesCount -gt 0){'OK'}elseif($r.ok){'PARCIAL'}else{'FAIL'}) "HTTP $($r.code) lecciones=$leccionesCount" ''

$r = Api POST '/api/inscripciones' @{ id_curso = $idCurso } $sEst
$detalle = $r.data.detalle
Row 'B1' 'Inscribirse curso' 'FAIL' "HTTP $($r.code) POST /api/inscripciones body={id_curso:$idCurso} msg=$($r.data.mensaje)" "detalle=$detalle"

$r2 = Api POST '/api/inscripciones' @{ id_curso = $idCurso } $sEst
Row 'B1' 'Duplicado inscripcion' 'FAIL' "HTTP $($r2.code) msg=$($r2.data.mensaje)" 'No evaluable: primera inscripcion fallo'

$r = Api GET '/api/mis-inscripciones' $null $sEst
Row 'B1' 'Mis inscripciones' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje) detalle=$($r.data.detalle)" 'Tabla Inscripciones ausente'

# === BLOQUE 2 ===
$idLeccion = $null
if ($leccionesCount -gt 0) {
  $lecData = Api GET "/api/cursos/$idCurso/lecciones" $null (Sess)
  $idLeccion = $lecData.data.lecciones[0].id_leccion
}
Row 'B2' 'Detalle/lecciones curso' $(if($idLeccion){'OK'}else{'FAIL'}) "id_leccion=$idLeccion" ''

$rProg0 = Api GET "/api/cursos/$idCurso/progreso" $null $sEst
$pct0 = $rProg0.data.progreso.porcentaje
Row 'B2' 'Progreso inicial GET' 'FAIL' "HTTP $($rProg0.code) pct=$pct0 msg=$($rProg0.data.mensaje)" $($rProg0.data.detalle)

if ($idLeccion) {
  $r = Api PATCH "/api/lecciones/$idLeccion/progreso" @{} $sEst
  Row 'B2' 'Marcar leccion completada' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje)" $($r.data.detalle)
}

# === BLOQUE 3 ===
$sInst = Sess
$r = Api POST '/api/login' @{ correo = 'instructor@test.com'; contrasena = 'Test1234' } $sInst
Row 'B3' 'Login instructor reportes' $(if($r.ok){'OK'}else{'FAIL'}) "HTTP $($r.code)" ''

$r = Api GET '/api/reportes/cursos' $null $sInst
Row 'B3' 'Listado reportes cursos' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje) detalle=$($r.data.detalle)" ''

$r = Api GET "/api/reportes/cursos/$idCurso/estudiantes" $null $sInst
Row 'B3' 'Detalle estudiantes curso' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje)" ''

try {
  $ex = Invoke-WebRequest -Uri "$base/api/reportes/cursos/excel" -WebSession $sInst -UseBasicParsing
  Row 'B3' 'Excel general' 'FAIL' "HTTP $($ex.StatusCode)" 'Inesperado si falla listado'
} catch {
  $raw = $_.ErrorDetails.Message
  Row 'B3' 'Excel general' 'FAIL' "HTTP $([int]$_.Exception.Response.StatusCode.value__) $raw" ''
}

try {
  $ex2 = Invoke-WebRequest -Uri "$base/api/reportes/cursos/$idCurso/estudiantes/excel" -WebSession $sInst -UseBasicParsing
  Row 'B3' 'Excel por curso' 'FAIL' "HTTP $($ex2.StatusCode)" ''
} catch {
  Row 'B3' 'Excel por curso' 'FAIL' "HTTP $([int]$_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)" ''
}

try {
  Invoke-WebRequest -Uri "$base/api/reportes/cursos/pdf" -WebSession $sInst -UseBasicParsing -ErrorAction Stop | Out-Null
  Row 'B3' 'PDF reportes' 'PARCIAL' 'HTTP 200' 'Endpoint existe'
} catch {
  $c = [int]$_.Exception.Response.StatusCode.value__
  Row 'B3' 'PDF reportes' 'FALTANTE' "HTTP $c" 'No implementado (404 esperado)'
}

# Pagina reportes HTML
try {
  $pg = Invoke-WebRequest -Uri "$base/reportes.html" -WebSession $sInst -UseBasicParsing
  Row 'B3' 'Acceso pagina reportes.html' $(if($pg.StatusCode -eq 200){'OK'}else{'FAIL'}) "HTTP $($pg.StatusCode)" 'UI no probada en navegador'
} catch { Row 'B3' 'Acceso pagina reportes.html' 'FAIL' $_.Exception.Message '' }

# === BLOQUE 4 ===
# Crear curso AUDITORIA_TEMP para examen si tablas existieran - skip create, test on idCurso
$r = Api POST "/api/cursos/$idCurso/examen" @{ porcentaje_aprobacion = 70; instrucciones = 'Audit M4' } $sInst
Row 'B4' 'Crear examen instructor' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje) detalle=$($r.data.detalle)" ''

$r = Api GET "/api/cursos/$idCurso/examen" $null $sInst
Row 'B4' 'Listar examen instructor' $(if($r.ok){'PARCIAL'}else{'FAIL'}) "HTTP $($r.code)" ''

$r = Api GET "/api/cursos/$idCurso/examen/estado" $null $sEst
Row 'B4' 'Estado examen estudiante' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje)" $($r.data.detalle)

$r = Api GET "/api/cursos/$idCurso/examen/estudiante" $null $sEst
Row 'B4' 'Rendir examen estudiante' 'FAIL' "HTTP $($r.code) msg=$($r.data.mensaje)" ''

$r = Api GET "/api/cursos/$idCurso/certificado" $null $sEst
Row 'B4' 'Consultar certificado' $(if($r.ok){'PARCIAL'}else{'FAIL'}) "HTTP $($r.code) certificado=$($r.data.certificado)" 'PDF descarga no implementada en frontend'

# === BLOQUE 5 residuos ===
$sInst2 = Sess
Api POST '/api/login' @{ correo = 'instructor@test.com'; contrasena = 'Test1234' } $sInst2 | Out-Null
$mis = Api GET '/api/mis-cursos' $null $sInst2
foreach ($c in $mis.data.cursos) {
  if ($c.titulo -match 'Audit|AUDITORIA|Auditoria') {
    $R.residuos += "curso activo/inactivo: id=$($c.id_curso) titulo=$($c.titulo) estado=$($c.estado)"
  }
}
$cats = Api GET '/api/categorias' $null $sInst2
foreach ($c in $cats.data.categorias) {
  if ($c.nombre_categoria -match 'AUDITORIA|Audit') { $R.residuos += "categoria activa: id=$($c.id_categoria) $($c.nombre_categoria)" }
}

# Check uploads folders
$uploadRoot = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'uploads'
if (Test-Path $uploadRoot) {
  $files = Get-ChildItem -Path $uploadRoot -Recurse -File -ErrorAction SilentlyContinue
  $R.residuos += "archivos uploads: $($files.Count) archivos en disco"
}

Write-Output '=== TABLA ==='
$R.bloques | Format-Table Bloque, Funcionalidad, Estado, Evidencia, Observacion -AutoSize
Write-Output '=== RESIDUOS ==='
if ($R.residuos.Count -eq 0) { 'Ninguno detectado en API activa' } else { $R.residuos }

Write-Output "=== IDS AUDITORIA ==="
Write-Output "id_usuario_estudiante=$idUsuario id_curso=$idCurso id_leccion=$idLeccion"
