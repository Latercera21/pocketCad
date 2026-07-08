# PocketCad - Editor de Moldería Digital

Editor de moldes de ropa digital, ligero y accesible desde cualquier dispositivo. Diseñado para talleres pequeños, diseñadores independientes y estudiantes de moda que necesitan herramientas profesionales sin el costo de software industrial.

##  ¿Qué resuelve?

Las herramientas industriales de patronaje (Lectra, Gerber, Optitex) cuestan miles de dólares al año. PocketCad ofrece funcionalidades de edición de moldes de forma gratuita, accesible desde el navegador, sin instalación.

##  Demo en Vivo

**[🔗 Probar PocketCad aquí](https://latercera21.github.io/pocketCad/)**

## ✨ Características

- **Editor 2D responsive** - Funciona en móvil y desktop con la misma comodidad
- **Nesting industrial (tizada) en desarrollo** - Optimización de corte de moldes para minimizar desperdicio de tela, implementado en C++ para máximo rendimiento
- **Previsualizador 3D** - Vista básica tridimensional de los moldes
- **100% web** - No requiere instalación, corre en cualquier navegador moderno
- **Ligero y rápido** - Arquitectura minimalista enfocada en funcionalidad

## 🛠️ Stack Técnico

- **Frontend:** HTML5, JavaScript vanilla, Canvas API
- **Nesting engine:** C++ compilado a WebAssembly (WASM) (en desarrollo)
- **3D:** Three.js
- **Hosting:** GitHub Pages

##  Decisiones Técnicas

### ¿Por qué un solo archivo HTML/JS?
Para un proyecto de demostración y uso personal, la portabilidad y simplicidad son prioritarias. Un solo archivo significa:
- Cero dependencias de build
- Fácil de compartir y desplegar
- Funciona offline sin configuración

### Nesting aún en desarrollo
### Previsualizador 3D aún en desarrollo

### ¿Por qué responsive desde el inicio?
Los talleres de costura a menudo trabajan en espacios reducidos donde un celular o tablet es más práctico que una laptop. La interfaz se adaptó para ser usable en ambos contextos.

## 📸 Capturas

```bash
# Clonar el repositorio
git clone https://github.com/latercera21/pocketCad.git

