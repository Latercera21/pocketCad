============================================================
 SPARROW NESTING - PAGINA WEB (WebAssembly)
============================================================
Esta carpeta tiene la pagina lista para usar. Corre el motor de
cortado 2D Sparrow compilado a WebAssembly. No necesita internet:
el motor ya viene dentro de wasm_b64.js.

------------------------------------------------------------
 COMO ABRIRLA EN TU PC (lo MAS IMPORTANTE)
------------------------------------------------------------
NO se abre arrastrando el index.html a Chrome (ahi el programa
no arranca). Haz DOBLE CLIC en este archivo:

        Iniciar.bat

Se abrira una ventana negra y luego el navegador solo.
No cierres la ventana negra mientras la uses; al terminar,
cierrala para detener todo.

(Si no funcionara Iniciar.bat, alternativas:
  - Abre una terminal en esta carpeta y escribe:   python -m http.server 8080
  - O escribe:   npx serve
  y luego abre http://localhost:8080 )
------------------------------------------------------------
 CARGAR TUS PROPIAS FIGURAS (archivo JSON)
------------------------------------------------------------
La pagina viene con una pieza de ejemplo (DAMA-TM-SIEMPRE-W-CIERRE)
ya cargada. Para usar OTRAS figuras:

  1. Arrastra TU archivo .json o toca "Cargar otras piezas (JSON)".
  2. Elige el archivo (el mismo formato: "figures", "vertices",
     "edges", "pxPerCm").
  3. Veras el nombre del archivo y "listo".
  4. Pulsa Resolver.

Para volver a la pieza incluida, toca "Volver a la pieza incluida".

El formato es el mismo que usa el motor:
   { "pxPerCm": 37.795, "figures": [ { "closed": true,
       "vertices": [ {"x":..., "y":...}, ... ],
       "edges": [ {"start":0,"end":1,"curved":false}, ... ] } ] }
Acepta tambien xCm/yCm (coordenadas ya en centimetros) y curvas
(curved:true con controlX/controlY).

------------------------------------------------------------
 INDICADOR DE TRABAJO
------------------------------------------------------------
Al pulsar Resolver veras un circulito girando y un contador de
segundos junto a "Calculando... N s". Eso confirma que el motor
esta trabajando en segundo plano. Cuando termina, dibuja las
piezas y muestra la ALTURA final en cm: cuanto MENOR, MEJOR.

------------------------------------------------------------
 COMO USARLA
------------------------------------------------------------
  - "Ancho tela (cm)"  : ancho de la tela (ej. 160).
  - "Semilla"          : cambia el "sabor" del calculo (prueba
                        1, 2, 3, ...).
  - "Seg. exploracion" : segundos buscando la disposicion inicial.
  - "Seg. compresion"  : segundos juntando las piezas.
  - Resolver. Espera (puede tardar 1-2 min). Si dice "INFACTIBLE",
    pon tiempos mas grandes o cambia semilla.

 PRO TIP: prueba semillas 1-10 con tiempos altos (120 y 60) y
 guarda la mejor altura.

------------------------------------------------------------
 SUBIRLA A INTERNET (Neocities)
------------------------------------------------------------
  1. Crea cuenta gratis en https://neocities.org
  2. Dashboard -> Upload.
  3. Sube estos 4 archivos a la raiz (sin carpetas):
        index.html
        worker.js
        sparrow_wasm.js
        wasm_b64.js
  4. Quedara en https://tucuenta.neocities.org   (funciona en
     PC y celular).
  (El archivo sparrow_wasm.wasm no hace falta subirlo.)
============================================================
