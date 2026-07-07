# Temporary audit script - not part of project
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'

function New-Session {
  return New-Object Microsoft.PowerShell.Commands.WebRequestSession
}

function Api($method, $path, $body, $session) {
  $uri = "$base$path"
  $params = @{
    Uri = $uri
    Method = $method
    WebSession = $session
    UseBasicParsing = $true
  }
  if ($body) {
    $params.Body = ($body | ConvertTo-Json -Depth 6)
    $params.ContentType = 'application/json'
  }
  try {
    $r = Invoke-WebRequest @params
    return @{ ok = $true; status = $r.StatusCode; data = ($r.Content | ConvertFrom-Json) }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $msg = $_.ErrorDetails.Message
    if (-not $msg -and $_.Exception.Response) {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $msg = $reader.ReadToEnd()
    }
    $data = $null
    try { $data = $msg | ConvertFrom-Json } catch {}
    return @{ ok = $false; status = $status; data = $data; raw = $msg }
  }
}

$results = @()

function Log($name, $status, $evidence) {
  $script:results += [pscustomobject]@{ Test = $name; Status = $status; Evidence = $evidence }
  Write-Output "[$status] $name :: $evidence"
}

# --- M1: Register normal user ---
$regEmail = "audit.user.$(Get-Date -Format 'yyyyMMddHHmmss')@gmail.com"
$sReg = New-Session
$r = Api POST '/api/registro' @{
  nombres='Audit'; apellidos='Usuario'; correo=$regEmail; contrasena='Test1234'; rol='usuario'
} $sReg
Log 'M1 Registro usuario' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.status) $($r.data.mensaje)"

# --- M1: Register instructor non-ITQ (should fail) ---
$r = Api POST '/api/registro' @{
  nombres='Bad'; apellidos='Instructor'; correo='bad.instructor@gmail.com'; contrasena='Test1234'; rol='instructor'
} (New-Session)
Log 'M1 Instructor sin @itq.edu.ec rechazado' $(if(-not $r.ok -and $r.status -eq 400){'OK'}else{'FAIL'}) "$($r.status) $($r.data.mensaje)"

# --- M1: Login new user ---
$sUser = New-Session
$r = Api POST '/api/login' @{ correo=$regEmail; contrasena='Test1234' } $sUser
Log 'M1 Login usuario nuevo' $(if($r.ok){'OK'}else{'FAIL'}) "rol=$($r.data.usuario.rol)"

# --- M1: Perfil ---
$r = Api GET '/api/perfil' $null $sUser
Log 'M1 Ver perfil' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.usuario.correo)"

# --- M1: Editar perfil ---
$r = Api PUT '/api/perfil' @{ nombres='AuditEdit'; apellidos='Usuario'; correo=$regEmail; contrasena='' } $sUser
Log 'M1 Editar perfil' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# --- M1: Logout ---
$r = Api POST '/api/logout' @{} $sUser
Log 'M1 Logout' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# --- M1: Perfil tras logout ---
$r = Api GET '/api/perfil' $null $sUser
Log 'M1 Perfil tras logout bloqueado' $(if(-not $r.ok -and $r.status -eq 401){'OK'}else{'FAIL'}) "status=$($r.status)"

# --- Instructor session ---
$sInst = New-Session
$r = Api POST '/api/login' @{ correo='instructor@test.com'; contrasena='Test1234' } $sInst
Log 'M1 Login instructor legacy' $(if($r.ok){'OK'}else{'FAIL'}) "rol=$($r.data.usuario.rol)"

# --- M2: Categorias CRUD ---
$catName = "AuditCat $(Get-Date -Format 'HHmmss')"
$r = Api POST '/api/categorias' @{ nombre_categoria=$catName; descripcion='Cat audit' } $sInst
$catId = $r.data.categoria.id_categoria
Log 'M2 Crear categoria' $(if($r.ok){'OK'}else{'FAIL'}) "id=$catId"

$r = Api PUT "/api/categorias/$catId" @{ nombre_categoria="${catName} Edit"; descripcion='Editada' } $sInst
Log 'M2 Editar categoria' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

$r = Api GET '/api/categorias' $null (New-Session)
Log 'M2 Listar categorias' $(if($r.ok -and ($r.data.categorias | Where-Object { $_.id_categoria -eq $catId })){ 'OK' }else{ 'FAIL' }) "count=$($r.data.categorias.Count)"

# --- M2: Curso CRUD ---
$r = Api POST '/api/cursos' @{
  titulo="Curso Audit $(Get-Date -Format 'HHmmss')"
  descripcion='Curso de auditoria funcional'
  id_categoria=$catId
  url_video=$null
  imagen_portada=$null
} $sInst
$cursoId = $r.data.curso.id_curso
Log 'M2 Crear curso' $(if($r.ok){'OK'}else{'FAIL'}) "id=$cursoId"

# Leccion
$r = Api POST "/api/cursos/$cursoId/lecciones" @{
  titulo='Leccion Audit 1'; descripcion='Desc'; orden=1; duracion_minutos=10
} $sInst
$leccionId = $r.data.leccion.id_leccion
Log 'M2 Crear leccion' $(if($r.ok){'OK'}else{'FAIL'}) "id=$leccionId"

# Contenido texto
$r = Api POST "/api/lecciones/$leccionId/contenidos" @{
  titulo='Texto audit'; tipo_contenido='texto'; texto_contenido='Contenido de prueba audit'
  url_contenido=$null; orden=1; duracion_minutos=$null
} $sInst
Log 'M2 Contenido texto' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# Contenido video URL
$r = Api POST "/api/lecciones/$leccionId/contenidos" @{
  titulo='Video URL'; tipo_contenido='video'; url_contenido='https://www.w3schools.com/html/mov_bbb.mp4'
  texto_contenido=$null; orden=2; duracion_minutos=5
} $sInst
Log 'M2 Contenido video URL' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# Editar curso
$r = Api PUT "/api/cursos/$cursoId" @{
  titulo="Curso Audit Edit"; descripcion='Editado'; id_categoria=$catId; url_video=$null; imagen_portada=$null
} $sInst
Log 'M2 Editar curso' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# Desactivar curso
$r = Api PATCH "/api/cursos/$cursoId/estado" @{ estado=0 } $sInst
Log 'M2 Desactivar curso' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# Activar curso
$r = Api PATCH "/api/cursos/$cursoId/estado" @{ estado=1 } $sInst
Log 'M2 Activar curso' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

# Mis cursos
$r = Api GET '/api/mis-cursos' $null $sInst
Log 'M2 Mis cursos instructor' $(if($r.ok -and ($r.data.cursos | Where-Object { $_.id_curso -eq $cursoId })){ 'OK' }else{ 'FAIL' }) "count=$($r.data.cursos.Count)"

# --- Visitante: catalogo y filtros ---
$r = Api GET '/api/cursos?categoria=3' $null (New-Session)
Log 'M2 Filtro categoria catalogo' $(if($r.ok){'OK'}else{'FAIL'}) "count=$($r.data.cursos.Count)"

$r = Api GET '/api/cursos?buscar=HTML' $null (New-Session)
Log 'M2 Filtro buscar catalogo' $(if($r.ok -and $r.data.cursos.Count -ge 1){'OK'}else{'FAIL'}) "count=$($r.data.cursos.Count)"

$r = Api GET "/api/cursos/$cursoId" $null (New-Session)
Log 'M2 Detalle curso publico' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.curso.titulo)"

$r = Api GET "/api/cursos/$cursoId/lecciones" $null (New-Session)
Log 'M2 Lecciones API publica (sin auth)' $(if($r.ok){'OK'}else{'FAIL'}) "count=$($r.data.lecciones.Count) - API expone sin sesion"

# --- Estudiante ---
$sEst = New-Session
$r = Api POST '/api/login' @{ correo='estudiante@test.com'; contrasena='Test1234' } $sEst
Log 'M1 Login estudiante legacy' $(if($r.ok){'OK'}else{'FAIL'}) "rol=$($r.data.usuario.rol)"

# Inscripcion
$r = Api POST '/api/inscripciones' @{ id_curso=$cursoId } $sEst
Log 'M3 Inscribirse curso' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

$r = Api POST '/api/inscripciones' @{ id_curso=$cursoId } $sEst
Log 'M3 Duplicado inscripcion rechazado' $(if(-not $r.ok -and $r.status -eq 409){'OK'}else{'FAIL'}) "$($r.status) $($r.data.mensaje)"

$r = Api GET '/api/mis-inscripciones' $null $sEst
Log 'M3 Mis inscripciones' $(if($r.ok -and ($r.data.inscripciones | Where-Object { $_.id_curso -eq $cursoId })){ 'OK' }else{ 'FAIL' }) "count=$($r.data.inscripciones.Count)"

$r = Api GET "/api/inscripciones/curso/$cursoId" $null $sEst
Log 'M3 Verificar inscrito' $(if($r.ok -and $r.data.inscrito){'OK'}else{'FAIL'}) "inscrito=$($r.data.inscrito)"

# Progreso - marcar
$r = Api PATCH "/api/lecciones/$leccionId/progreso" @{} $sEst
$pct1 = $r.data.porcentaje
Log 'M3 Marcar leccion completada' $(if($r.ok -and $r.data.completada){'OK'}else{'FAIL'}) "pct=$pct1 completada=$($r.data.completada)"

# Progreso - desmarcar (toggle)
$r = Api PATCH "/api/lecciones/$leccionId/progreso" @{} $sEst
$pct2 = $r.data.porcentaje
Log 'M3 Desmarcar leccion (toggle)' $(if($r.ok -and -not $r.data.completada){'OK'}else{'FAIL'}) "pct=$pct2 completada=$($r.data.completada)"

# Marcar de nuevo
$r = Api PATCH "/api/lecciones/$leccionId/progreso" @{} $sEst
Log 'M3 Marcar leccion otra vez' $(if($r.ok -and $r.data.completada){'OK'}else{'FAIL'}) "pct=$($r.data.porcentaje)"

$r = Api GET "/api/cursos/$cursoId/progreso" $null $sEst
Log 'M3 GET progreso curso' $(if($r.ok -and $r.data.progreso.porcentaje -eq 100){'OK'}else{'FAIL'}) "pct=$($r.data.progreso.porcentaje) $($r.data.progreso.completadas)/$($r.data.progreso.total)"

# --- Reportes instructor ---
$r = Api GET '/api/reportes/cursos' $null $sInst
Log 'Reportes listado cursos' $(if($r.ok){'OK'}else{'FAIL'}) "count=$($r.data.cursos.Count)"

# Excel general
try {
  $excelS = New-Session
  Api POST '/api/login' @{ correo='instructor@test.com'; contrasena='Test1234' } $excelS | Out-Null
  $er = Invoke-WebRequest -Uri "$base/api/reportes/cursos/excel" -WebSession $excelS -UseBasicParsing
  $isXlsx = $er.Headers['Content-Type'] -like '*spreadsheet*' -and $er.Content.Length -gt 100
  Log 'Reportes Excel general' $(if($isXlsx){'OK'}else{'FAIL'}) "bytes=$($er.Content.Length) type=$($er.Headers['Content-Type'])"
} catch { Log 'Reportes Excel general' 'FAIL' $_.Exception.Message }

# Excel por curso
try {
  $er2 = Invoke-WebRequest -Uri "$base/api/reportes/cursos/$cursoId/estudiantes/excel" -WebSession $excelS -UseBasicParsing
  $isXlsx2 = $er2.Headers['Content-Type'] -like '*spreadsheet*' -and $er2.Content.Length -gt 100
  Log 'Reportes Excel por curso' $(if($isXlsx2){'OK'}else{'FAIL'}) "bytes=$($er2.Content.Length)"
} catch { Log 'Reportes Excel por curso' 'FAIL' $_.Exception.Message }

# PDF endpoint check
try {
  Invoke-WebRequest -Uri "$base/api/reportes/cursos/pdf" -WebSession $excelS -UseBasicParsing -ErrorAction Stop | Out-Null
  Log 'Reportes PDF' 'FAIL' 'Endpoint existe inesperadamente'
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Log 'Reportes PDF' $(if($code -eq 404){'OK-NO'}else{'?'} ) "No implementado (HTTP $code)"
}

# --- Examenes ---
$r = Api POST "/api/cursos/$cursoId/examen" @{ porcentaje_aprobacion=70; instrucciones='Examen audit' } $sInst
$examenOk = $r.ok -or ($r.status -eq 409)
Log 'M4 Crear examen' $(if($examenOk){'OK'}else{'FAIL'}) "$($r.status) $($r.data.mensaje)"

$r = Api POST "/api/cursos/$cursoId/examen/preguntas" @{
  enunciado='Pregunta audit?'; opcion_a='A'; opcion_b='B'; opcion_c='C'; opcion_d='D'
  respuesta_correcta='A'; orden=1
} $sInst
Log 'M4 Crear pregunta' $(if($r.ok -or $r.status -eq 409){'OK'}else{'FAIL'}) "$($r.status) $($r.data.mensaje)"

$r = Api GET "/api/cursos/$cursoId/examen/estado" $null $sEst
Log 'M4 Estado examen estudiante' $(if($r.ok){'OK'}else{'FAIL'}) "puedeRendir=$($r.data.puedeRendir) progreso=$($r.data.progreso)"

# Rendir examen si puede
$rEstado = Api GET "/api/cursos/$cursoId/examen/estudiante" $null $sEst
if ($rEstado.ok) {
  $pregs = $rEstado.data.preguntas
  $resp = @{}
  foreach ($p in $pregs) { $resp[[string]$p.id_pregunta] = 'A' }
  $r = Api POST "/api/cursos/$cursoId/examen/intento" @{ respuestas = $resp } $sEst
  Log 'M4 Rendir examen' $(if($r.ok){'OK'}else{'FAIL'}) "puntaje=$($r.data.puntaje) aprobado=$($r.data.aprobado)"
} else {
  Log 'M4 Rendir examen' 'SKIP' "$($rEstado.status) $($rEstado.data.mensaje)"
}

$r = Api GET "/api/cursos/$cursoId/certificado" $null $sEst
Log 'M4 Certificado consulta' $(if($r.ok){'OK'}else{'FAIL'}) "cert=$($r.data.certificado -ne $null)"

# Desactivar categoria
$r = Api PATCH "/api/categorias/$catId/estado" @{ estado=0 } $sInst
Log 'M2 Desactivar categoria' $(if($r.ok){'OK'}else{'FAIL'}) "$($r.data.mensaje)"

Write-Output "`n=== SUMMARY ==="
$results | Format-Table -AutoSize
$results | ConvertTo-Json -Depth 3 | Out-File "$PSScriptRoot\audit-temp-results.json"
