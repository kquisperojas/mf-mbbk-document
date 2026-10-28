# mf-mbbk-document

Microfrontend Angular 21 del portal MBBK. Migra la UI de `MBBK-HUB` / `mf-mbbk-documentation`.

## Arranque

Necesitas:

1. PostgreSQL + `ms-mbbk-document` en `http://127.0.0.1:8080` (login y CRUD de usuarios)
2. `ms-mbbk-documentation` en `http://127.0.0.1:8790` (Jira, catálogo, informes)

```bash
cd C:\WORKSPACE\DOCUMENTACION\mf-mbbk-document
npm start
```

Abre http://127.0.0.1:4200/login

El proxy envía:

- `/api/v1/auth`, `/api/v1/usuarios`, `/api/v1/catalogos` → Java `:8080`
- `/api/v1/docs`, `/api/v1/catalog`, `/api/v1/initiatives`, `/api/v1/generate`, `/docs` → Node `:8790`

## Acceso

Crea el usuario con **Crear usuario** (se guarda en PostgreSQL). Luego entra con el mismo GitHub y contraseña.

## Rutas

| Ruta | Pantalla |
|---|---|
| `/login` | Login + modal Guardar usuario |
| `/portal/dashboard` | Hub |
| `/portal/generar` | Generar documentación |
| `/portal/administrar` | Editar informes |
| `/portal/iniciativas` | Listado de informes |
| `/portal/informe/:key` | Visor del informe |
| `/portal/ms-experiencia` | Catálogo experiencia |
| `/portal/perfil` | Perfil GitHub |
