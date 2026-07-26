# Storage

Un solo bucket en uso.

## Bucket `product-images`

| Propiedad | Valor |
|---|---|
| ID / nombre | `product-images` |
| Público | Sí (lectura por URL sin auth) |
| Límite de tamaño | 5 MB (`5242880` bytes) |
| MIME permitidos | `image/jpeg`, `image/png`, `image/webp` |

### Uso

- Guarda las imágenes de producto. La tabla `products.images` (text[]) almacena las **rutas** dentro del bucket; el frontend construye la URL pública: `https://jcugmeuvwqjvrlrdlyyh.supabase.co/storage/v1/object/public/product-images/<ruta>`.
- El pipeline de scraping sube imágenes con nombres UUID en formato WebP (ver commit `9114129`).

### Políticas (sobre `storage.objects`)

| Operación | Quién |
|---|---|
| SELECT | Público (cualquiera, incluso `anon`) |
| INSERT / UPDATE / DELETE | `authenticated` + `is_admin()` |

> Recordatorio Supabase: un **upsert** de archivo necesita las tres políticas (INSERT + SELECT + UPDATE) — aquí los admins las tienen todas.

### Observación de los advisors

La política pública de SELECT permite **listar** el contenido completo del bucket vía API, no solo leer objetos por URL. Para un catálogo de imágenes públicas es aceptable, pero si se quiere cerrar: eliminar la política SELECT pública (los buckets públicos no la necesitan para servir URLs) — [lint 0025](https://supabase.com/docs/guides/database/database-linter?lint=0025_public_bucket_allows_listing).
