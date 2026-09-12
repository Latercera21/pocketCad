# PocketCad / Sparrow Nesting — Contexto de trabajo 2026-09

Este archivo resume TODO el contexto del proyecto para continuar en otra PC.

## Objetivo
- Nesting de PocketCad como réplica fiel de Sparrow Studio (motor WASM real).
- DXF + JSON (patron.json de PocketCad) + instancias JSON de Sparrow + SVG, 30 piezas.
- Publicado como sitio: GitHub Pages + Neocities (con redirección a GitHub).

## Estado actual (últimos cambios aplicados y pusheados)
Commit `63483dc` (rama `main`), pocketcad_modular2 (oficial):
- "Seguir" con arrastre en vivo y snap (se puede reordenar un punto ya puesto).
- Punto seleccionado se pinta grande con anillo blanco (no se pierde entre los demás).
- Menús "Archivo" y "Desdoblar/Copiar/Reflejar" reposicionados por toolbar (clase
  `float-inputs` + `getToolbarHeight()`), para que no queden flotando en móvil.
- Botones MED…/≈ restaurados (habían salido en modular1).
- Ajuste: readout de coordenadas de tallas fuera del input dX/dY, botón "✓" sin texto.
- pocketcad.html con botón "nesting" directo a https://latercera21.github.io/pocketCad/nesting.html.
- Cambian 4 js (draw, events, offset, ui); el resto quedó igual a modular1.

Anterior:
- Commit `75c58a5` (rama `main`), pocketcad_modular:
- Editor (pocketcad.html + js/): botón **"Seguir"** para dibujar una curva NUEVA a
  puntazos (Catmull-Rom + snap), tangentes con lookahead en puntas de curva
  (curvas más redondas, sin el "pico" de antes), recálculo de la cadena Catmull-Rom
  al mover un vértice de lado curvo, ejes X/Y forzados ya no se desvían en offset,
  y botones MED…/≈ eliminados.
- js/ sincronizado con pocketcad_modular: cambian curves, draw, events, offset,
  state, ui (cutclose, export, geometry, main, transform, vertextools eran iguales,
  solo saltos de línea).
- pocketcad.html = versión modular, con botón "nesting" apuntando directo a
  https://latercera21.github.io/pocketCad/nesting.html (commit 75c58a5; enlace
  ajustado en 0808f15).

Anteriores:
- Commit `61d6e2b` (rama `main`), previo `7ac11a3`:
- Ancho de tela por defecto: **100 cm** al cargar cualquier archivo (JSON y DXF).
  - Antes el JSON dejaba 1000 porque sparrow guarda `materialWidthMm` en mm y se volcaba directo al campo en cm.
  - Unidades del editor: **cm** (decisión tomada; sparrow usa mm pero el editor PocketCad vive en cm).
- Tiempo de búsqueda: opciones 10 s, 30 s, 1 m, 2 m, **5 m, 10 m** y **Automático**
  (el optimizador se detiene solo; = `None` en el motor, igual que sparrowstudio).
- Título del SVG exportado: pegado al lienzo (`y=-2`, `font-size=2.6`) y medidas redondeadas a 1 decimal.
- Piezas importadas de DXF ahora se llaman `Pieza N` (antes el importador sintetizaba ids `studio-N`
  y los mostraba como nombre en los resultados). `pieceLabel` muestra el número salvo nombre propio.
- Etiquetas en resultados: negras sin borde ni bold; columna Nº en la lista; separación por defecto 0;
  título del SVG fuera del rectángulo; nombres editables se ven en los resultados.
- Meta description ya NO menciona el "patron.json" (JSON habilitado pero sin anunciarlo).

## Repos y remotos
- App nesting (repo principal): `https://github.com/Latercera21/pocketCad.git` — rama `main`.
  - Carpetas locales: `D:\CLO\OPENCODE\SPARROW\repo_pocketcad\` (app) y `repo_sparrowstudio\` (fuente original).
- GitHub Pages activo: `https://latercera21.github.io/pocketCad/nesting.html`
  (atención: minúscula `pocketcad` da 404).
- NOTA historial: el remoto Pkleo719/Nesting falló; el real es Latercera21/pocketCad.
- Git para Windows: `& "C:\Program Files\Git\cmd\git.exe" ...`
- Node: `& "D:\CLO\NODEJS\node.exe" ...`

## Publicación en Neocities (sitio: latercera21prueba)
- `nesting.html` en Neocities es solo una REDIRECCIÓN a `https://latercera21.github.io/pocketCad/nesting.html`.
- `pocketcad.html` (Neocities) tiene un solo botón "nesting" -> GitHub Pages. Requiere los archivos `js/*`
  (12: curves, cutclose, draw, events, export, geometry, main, offset, state, transform, ui, vertextools).
  Desde 2026-09-11 incluye el botón "Seguir" (versión modular).
- `index.html` (Neocities) apunta a `https://sparrowstudio.app/` (el original).
- Neocities **free NO permite .wasm** -> por eso se usa redirección en vez de subir el motor.
- Estado del sitio: index.html, pocketcad.html, nesting.html (redirect), optimization_com.html, js/ (12).
- Credenciales Neocities: `usuarioContrasenaNeocities.txt` en la carpeta SPARROW.
- API:
  - list: `https://neocities.org/api/list` (header Basic auth)
  - upload: `https://neocities.org/api/upload` (`curl.exe -s -u user:pass -F "path=@file;type=..."`)
  - delete: `https://neocities.org/api/delete` (`--data-urlencode "filenames[]=..."`)

## Archivos clave en la carpeta D:\CLO\OPENCODE\SPARROW\
- `repo_pocketcad\nesting_app.js` — toda la app (drawResult, exportSVG, pieceLabel, importDXF/PocketCad/Sparrow, applyReview).
- `repo_pocketcad\nesting.html`, `nesting_worker.js`, `pocketcad.html`, `index.html`, `optimizatio_com.html`.
- `repo_pocketcad\wasm\nesting.wasm` (motor Sparrow; 1.4 MB) + `nesting.wasm.js` (glue).
- `repo_pocketcad\neocities-redirect.html` — usado como nesting.html en Neocities.
- `usuarioContrasenaNeocities.txt` — credenciales.
- `extraido\token_github.txt` — token de GitHub (no subir).
- Pruebas locales: `doble444sparrow.json`, `dobledxf.dxf`, `double_ejmplo.svg`.
- Tests en `C:\Users\richa\AppData\Local\Temp\opencode\`:
  `test_visual.mjs`, `test_draw.mjs`, `test_json_30.mjs`, `test_piecelabel.mjs`, `test_dxfnames.mjs`.

## Motor WASM (fidelidad con sparrowstudio)
- `nesting_worker.js` importa `nesting.wasm.js` y llama `init(new URL("./wasm/nesting.wasm", import.meta.url))`.
- El motor acepta `seconds` en {10,30,60,120,300,600} o None ("Automático"); clave de validación en
  `repo_sparrowstudio\web\wasm\src\lib.rs` (línea ~74; "Automatic runs rely on the optimizer's failure-based stopping rules").
- Los resultados llegan como `{"type":"finished"}`, datos en live/candidate; la UI hace throttle de 300 ms.
- El motor NO devuelve el layout al detener (se queda con lo último emitido), por eso "detener" puede
  mostrar un estado peor / con solapamiento hasta el próximo candidato bueno.

## Pendiente / próximas rondas
1. **Detener la búsqueda y resultados malos**: al parar, quedar el último candidato bueno (o el mejor
   visto) en lugar del último recibido; investigar solapamiento visible al detener.
2. Espejar/reflejar piezas (mirror) — dejado para una ronda futura.
3. Duda del usuario: "¿somos tan fieles como el demo? a veces siente que el demo gana" — revisar UI.

## Diferencias conocidas vs sparrowstudio
- Sparrow trabaja en mm y tiene opciones de threads (1-3) en su UI; el editor PocketCad usa cm (decisión propia).
- sparrowstudio exporta dimensión arriba del rect con `.toFixed(2)`; nosotros redondeamos a 1 decimal.

## Cómo continuar en otra PC (mitad del contexto)
- Instalar opencode (misma versión), abrir esta carpeta (SPARROW).
- La conversación/contexto del chat vive en `%USERPROFILE%\.local\share\opencode\opencode.db`
  (SQLite). Llevar ese archivo (o toda la carpeta `%USERPROFILE%\.local\share\opencode\`) a la otra PC
  conserva TODO el historial. Si falta, este CONTEXTO.md + `git push/pull` restituye el proyecto.
- Recordar ejecutar: primero `git pull` del repo, y aplicar cambios vía git (commit+push).