# Guía rápida para usar Git y GitHub en equipo

## ¿Qué se usa?

Se usan los dos:

- Git: guarda el historial de cambios en la computadora.
- GitHub: permite subir el proyecto a internet y trabajar con otras personas.

## Subir el proyecto por primera vez

1. Abrir la carpeta del proyecto en Visual Studio Code.
2. Abrir la terminal.
3. Ejecutar:

```bash
git init
git add .
git commit -m "Primer avance del proyecto"
git branch -M main
git remote add origin URL_DEL_REPOSITORIO
git push -u origin main
```

La URL_DEL_REPOSITORIO se copia desde GitHub cuando se crea el repositorio.

## Descargar el proyecto en otra computadora

```bash
git clone URL_DEL_REPOSITORIO
cd PROYECTO_VINCULACION
npm install
```

Después se debe crear el archivo `.env` copiando el contenido de `.env.example`.

## Antes de empezar a trabajar

Siempre ejecutar:

```bash
git pull
```

Esto trae los últimos cambios que hayan subido los compañeros.

## Después de hacer cambios

```bash
git add .
git commit -m "Explicar aqui el cambio realizado"
git push
```

## Recomendación para trabajar entre varias personas

Cada integrante debe encargarse de una parte diferente para evitar conflictos. Por ejemplo:

- Persona 1: pantallas HTML y diseño CSS.
- Persona 2: conexión con base de datos y servidor.
- Persona 3: validaciones en JavaScript.
- Persona 4: documentación, README y pruebas.

## Archivos que no se deben subir

No se debe subir el archivo `.env`, porque contiene datos privados de conexión. Ese archivo ya está protegido por `.gitignore`.
