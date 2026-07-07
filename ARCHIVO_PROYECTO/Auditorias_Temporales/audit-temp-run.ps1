$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3000'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$report = [ordered]@{ ids = @{}; steps = @(); routes = @(); errors = @() }

function Log($step, $ok, $detail) {
  $script:report.steps += [pscustomobject]@{ step = $step; ok = $ok; detail = $detail }
  Write-Output ("[{0}] {1} :: {2}" -f ($(if ($ok) { 'OK' } else { 'FAIL' }), $step, $detail))
}

function Api($method, $path, $bodyObj) {
  $params = @{ Uri = "$base$path"; Method = $method; WebSession = $session; UseBasicParsing = $true }
  if ($null -ne $bodyObj) {
    $params.Body = ($bodyObj | ConvertTo-Json -Depth 8 -Compress)
    $params.ContentType = 'application/json'
  }
  try {
    $r = Invoke-WebRequest @params
    $data = $r.Content | ConvertFrom-Json
    return @{ ok = $true; code = [int]$r.StatusCode; data = $data; raw = $r.Content }
  } catch {
    $code = [int]$_.Exception.Response.StatusCode.value__
    $raw = $_.ErrorDetails.Message
    $data = $null
    try { $data = $raw | ConvertFrom-Json } catch {}
    return @{ ok = $false; code = $code; data = $data; raw = $raw }
  }
}

function CurlUpload($path, $formArgs) {
  $cookieFile = Join-Path $env:TEMP 'audit-upload-cookies.txt'
  $hostName = ([Uri]$base).Host
  $lines = @('# Netscape HTTP Cookie File')
  $session.Cookies.GetCookies([Uri]$base) | ForEach-Object {
    $lines += ("{0}`tFALSE`t/`tFALSE`t0`t{1}`t{2}" -f $hostName, $_.Name, $_.Value)
  }
  $lines | Set-Content $cookieFile -Encoding ASCII
  $tmpOut = [System.IO.Path]::GetTempFileName()
  $args = @('-s', '-o', $tmpOut, '-w', '%{http_code}', '-b', $cookieFile, '-X', 'POST', "$base$path") + $formArgs
  $codeStr = & curl.exe @args
  $body = Get-Content $tmpOut -Raw -ErrorAction SilentlyContinue
  Remove-Item $tmpOut -ErrorAction SilentlyContinue
  $data = $null
  try { if ($body) { $data = $body | ConvertFrom-Json } } catch {}
  return @{ code = [int]$codeStr; data = $data; raw = $body }
}

$png = Join-Path $env:TEMP 'audit-portada-temp.png'
$pdf = Join-Path $env:TEMP 'audit-doc-temp.pdf'
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 12, 12
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
@('%PDF-1.4','1 0 obj<<>>endobj','trailer<<>>','%%EOF') | Set-Content -Path $pdf -Encoding ASCII

$r = Api POST '/api/login' @{ correo = 'instructor@test.com'; contrasena = 'Test1234' }
Log 'Login instructor' ($r.ok -and $r.data.ok) "HTTP $($r.code) $($r.raw)"

$r = Api POST '/api/categorias' @{ nombre_categoria = 'AUDITORIA_TEMP'; descripcion = 'Categoria temporal de auditoria funcional' }
if ($r.code -eq 409) {
  $cats = Api GET '/api/categorias' $null
  $existing = $cats.data.categorias | Where-Object { $_.nombre_categoria -eq 'AUDITORIA_TEMP' } | Select-Object -First 1
  if (-not $existing) {
    Log 'Crear categoria AUDITORIA_TEMP' $false 'HTTP 409 y no aparece en listado activo'
    exit 1
  }
  $report.ids.categoria = $existing.id_categoria
  Log 'Reutilizar categoria AUDITORIA_TEMP existente' $true "HTTP 409 al crear; id=$($report.ids.categoria) (sesion previa incompleta)"
} else {
  $report.ids.categoria = $r.data.categoria.id_categoria
  Log 'Crear categoria AUDITORIA_TEMP' ($r.ok -and $r.data.ok) "HTTP $($r.code) id=$($report.ids.categoria) $($r.data.mensaje)"
}

$mis = Api GET '/api/mis-cursos' $null
$cursoExist = $mis.data.cursos | Where-Object { $_.titulo -eq 'Curso Auditoria Temporal' } | Select-Object -First 1
if ($cursoExist) {
  $report.ids.curso = $cursoExist.id_curso
  Log 'Reutilizar curso temporal existente' $true "id=$($report.ids.curso) (sesion previa incompleta)"
} else {
  $r = Api POST '/api/cursos' @{
    titulo = 'Curso Auditoria Temporal'
    descripcion = 'Curso temporal solo para pruebas de subida'
    id_categoria = $report.ids.categoria
  }
  $report.ids.curso = $r.data.curso.id_curso
  Log 'Crear curso temporal' ($r.ok -and $r.data.ok) "HTTP $($r.code) id=$($report.ids.curso) $($r.data.mensaje)"
}

$lecs = Api GET "/api/cursos/$($report.ids.curso)/mis-lecciones" $null
$lecExist = $lecs.data.lecciones | Where-Object { $_.titulo -eq 'Leccion Auditoria Temporal' } | Select-Object -First 1
if ($lecExist) {
  $report.ids.leccion = $lecExist.id_leccion
  Log 'Reutilizar leccion temporal existente' $true "id=$($report.ids.leccion) (sesion previa incompleta)"
} else {
  $r = Api POST "/api/cursos/$($report.ids.curso)/lecciones" @{
    titulo = 'Leccion Auditoria Temporal'
    descripcion = 'Leccion temporal'
    orden = 1
    duracion_minutos = 5
  }
  $report.ids.leccion = $r.data.leccion.id_leccion
  Log 'Crear leccion temporal' ($r.ok -and $r.data.ok) "HTTP $($r.code) id=$($report.ids.leccion) $($r.data.mensaje)"
}

$r = CurlUpload "/api/cursos/$($report.ids.curso)/portada" @("-F", "archivo=@$png")
$portadaRuta = $r.data.imagen_portada
if (-not $portadaRuta -and $r.data.curso) { $portadaRuta = $r.data.curso.imagen_portada }
if ($portadaRuta) { $report.routes += "portada=$portadaRuta" }
Log 'Subir portada' ($r.code -eq 200 -and $r.data.ok) "HTTP $($r.code) ruta=$portadaRuta $($r.data.mensaje)"

if ($portadaRuta) {
  $url = if ($portadaRuta.StartsWith('/')) { "$base$portadaRuta" } else { "$base/$portadaRuta" }
  try {
    $img = Invoke-WebRequest -Uri $url -UseBasicParsing
    Log 'Verificar portada accesible' ($img.StatusCode -eq 200) "GET $url HTTP $($img.StatusCode) bytes=$($img.Content.Length)"
  } catch {
    Log 'Verificar portada accesible' $false $_.Exception.Message
    $report.errors += 'Portada no accesible por HTTP'
  }
} else {
  Log 'Verificar portada accesible' $false 'Sin ruta devuelta'
  $report.errors += 'Portada sin ruta'
}

$r = CurlUpload "/api/lecciones/$($report.ids.leccion)/contenidos/archivo" @(
  '-F', 'titulo=Documento auditoria temporal',
  '-F', 'tipo_contenido=documento',
  '-F', 'orden=1',
  '-F', "archivo=@$pdf;type=application/pdf"
)
$report.ids.contenido_documento = $r.data.contenido.id_contenido
$docRuta = $r.data.contenido.url_contenido
if ($docRuta) { $report.routes += "documento=$docRuta" }
Log 'Subir documento' ($r.code -eq 200 -and $r.data.ok) "HTTP $($r.code) id=$($report.ids.contenido_documento) ruta=$docRuta $($r.data.mensaje)"

$r = Api POST "/api/lecciones/$($report.ids.leccion)/contenidos" @{
  titulo = 'Video auditoria URL'
  tipo_contenido = 'video'
  url_contenido = 'https://www.w3schools.com/html/mov_bbb.mp4'
  texto_contenido = $null
  orden = 2
  duracion_minutos = 1
}
$report.ids.contenido_video_url = $r.data.contenido.id_contenido
Log 'Contenido video por URL' ($r.ok -and $r.data.ok) "HTTP $($r.code) id=$($report.ids.contenido_video_url) url=$($r.data.contenido.url_contenido)"

$r = Api GET "/api/lecciones/$($report.ids.leccion)/mis-contenidos" $null
Log 'Listar contenidos instructor' ($r.ok) "HTTP $($r.code) count=$($r.data.contenidos.Count) tipos=$($r.data.contenidos.tipo_contenido -join ',')"

if ($docRuta) {
  $url = if ($docRuta.StartsWith('/')) { "$base$docRuta" } else { "$base/$docRuta" }
  try {
    $f = Invoke-WebRequest -Uri $url -UseBasicParsing
    Log 'Verificar documento accesible' ($f.StatusCode -eq 200) "GET $url HTTP $($f.StatusCode) bytes=$($f.Content.Length)"
  } catch {
    Log 'Verificar documento accesible' $false $_.Exception.Message
  }
}

foreach ($item in @(
  @{ n = 'Desactivar contenido documento'; p = "/api/contenidos/$($report.ids.contenido_documento)/estado" },
  @{ n = 'Desactivar contenido video URL'; p = "/api/contenidos/$($report.ids.contenido_video_url)/estado" },
  @{ n = 'Desactivar leccion'; p = "/api/lecciones/$($report.ids.leccion)/estado" },
  @{ n = 'Desactivar curso'; p = "/api/cursos/$($report.ids.curso)/estado" },
  @{ n = 'Desactivar categoria'; p = "/api/categorias/$($report.ids.categoria)/estado" }
)) {
  $r = Api PATCH $item.p @{ estado = 0 }
  Log $item.n ($r.ok -and $r.data.ok) "HTTP $($r.code) $($r.data.mensaje)"
}

$pub = Api GET '/api/cursos' $null
$vis = $pub.data.cursos | Where-Object { $_.id_curso -eq $report.ids.curso }
Log 'Curso fuera de catalogo publico' (-not $vis) "id_curso=$($report.ids.curso) visible=$([bool]$vis)"

Write-Output "`n=== RESUMEN IDS ==="
$report.ids.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Key) = $($_.Value)" }
Write-Output "`n=== RUTAS GENERADAS ==="
$report.routes
Write-Output "`n=== ERRORES ==="
if ($report.errors.Count -eq 0) { 'Ninguno' } else { $report.errors -join '; ' }
