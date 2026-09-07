# PocketCad - Editor de Moldería Digital

Editor de moldes de ropa digital, ligero y accesible desde cualquier dispositivo. Diseñado para talleres pequeños, diseñadores independientes y estudiantes de moda que necesitan herramientas profesionales sin el costo de software industrial.

##  ¿Qué resuelve?

Las herramientas industriales de patronaje (Lectra, Gerber, Optitex) cuestan miles de dólares al año. PocketCad ofrece funcionalidades de edición de moldes de forma gratuita, accesible desde el navegador, sin instalación.

##  Demo en Vivo

**[🔗 Probar PocketCad aquí](https://latercera21.github.io/pocketCad/)**

## Características

- **Editor 2D responsive** - Funciona en móvil y desktop con la misma comodidad
- **Nesting industrial (tizada)** - Optimización de corte de moldes para minimizar desperdicio de tela, con el motor **Sparrow** (WASM real, de [sparrow-studio](https://github.com/JeroenGar/sparrow-studio)) adaptado a pantallas táctiles y celulares
- **Previsualizador 3D** - Vista básica tridimensional de los moldes
- **100% web** - No requiere instalación, corre en cualquier navegador moderno
- **Ligero y rápido** - Arquitectura minimalista enfocada en funcionalidad

## Stack Técnico

- **Frontend:** HTML5, JavaScript vanilla, Canvas API
- **Nesting engine:** Sparrow (Rust) compilado a WebAssembly (WASM), build oficial de sparrow-studio
- **3D:** Three.js
- **Hosting:** GitHub Pages

##  Decisiones Técnicas

### ¿Por qué un solo archivo HTML/JS?
Para un proyecto de demostración y uso personal, la portabilidad y simplicidad son prioritarias. Un solo archivo significa:
- Cero dependencias de build
- Fácil de compartir y desplegar
- Funciona offline sin configuración

### Nesting con Sparrow
El nesting (`nesting.html`) carga un `patron.json` exportado desde el editor o una instancia JSON de Sparrow, elige ancho de tela, rotación permitida y tiempo de búsqueda, y resuelve con el motor Sparrow real (WASM de sparrow-studio) en un web worker. Resultados exportables a SVG, DXF y JSON. Máximo 500 piezas y 5000 vértices por pieza (límites del motor).
### Previsualizador 3D aún en desarrollo

### ¿Por qué responsive desde el inicio?
Los talleres de costura a menudo trabajan en espacios reducidos donde un celular o tablet es más práctico que una laptop. La interfaz se adaptó para ser usable en ambos contextos.

## 📸 Capturas

## 👤 Autor

**Jonathán Villasnánte Coila**  
📧 latercera21@hotmail.com  
🔗 [GitHub](https://github.com/latercera21)

## 🗺️ Roadmap

- [ ] Completar algoritmo de nesting industrial
- [ ] Mejorar algoritmo con heurísticas avanzadas (Bottom-Left-Fill, algoritmos genéticos)
- [ ] Exportar a formatos industriales (DXF, AAMA-ASTM)
- [ ] Simulación de draped 3D más realista
- [ ] Sistema de tallas automático

## 📄 Licencia

MIT

```bash
# Clonar el repositorio
git clone https://github.com/latercera21/pocketCad.git

