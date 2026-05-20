/**
 * La Frontera Azul - Mission System (v2)
 * Redesigned for large lake world with boat-centric viewport.
 * Scanner is relative to heading. Ports are fixed landmarks.
 */

import type { BoatState, GameWorld } from './game';

export interface Objective {
    id: string;
    text: string;
    check: (boat: BoatState, start: { x: number; y: number }, code: string, world: GameWorld) => boolean;
}

export interface Mission {
    id: number;
    title: string;
    subtitle: string;
    briefing: string;
    hint: string;
    startPos: { x: number; y: number };
    startDir: number;
    fuel: number;
    fog: boolean;
    randomReefs: number;
    randomFish: number;
    fixedReefs?: { x: number; y: number }[];
    objectives: Objective[];
    starterCode: string;
    successMsg: string;
    unlocks: number[];
}

export const MISSIONS: Mission[] = [
    {
        id: 1,
        title: "Arranque del Motor",
        subtitle: "Primeros pasos con El Camarón",
        briefing: `Bienvenido a bordo de "El Camarón", ingeniero. Tu primera tarea: enciende el motor y demuestra que puedes moverlo.<br><br><code>avanzar(n)</code> mueve el barco n casillas <strong>hacia donde apunta</strong>. El mundo se desplaza alrededor del barco (el barco siempre está en el centro de la pantalla).`,
        hint: "El barco empieza mirando al norte. Usa avanzar(5) para avanzar 5 casillas.",
        startPos: { x: 30, y: 35 },
        startDir: 0,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "move_5", text: "Avanza al menos 5 casillas", check: (boat) => boat.trail.length >= 5 }
        ],
        starterCode: `# MISIÓN 1: Arranque del Motor
# El barco mira al norte (↑).
# avanzar(n) lo mueve n casillas hacia donde apunta.
# Observa cómo el mundo se desplaza alrededor del barco.

avanzar(5)
`,
        successMsg: "¡Excelente! El motor responde. El Camarón vuelve a navegar.",
        unlocks: [2]
    },
    {
        id: 2,
        title: "Aprender a Girar",
        subtitle: "Domina el rumbo del barco",
        briefing: `Navegar en línea recta no basta. <code>girar_derecha()</code> gira 90° a estribor. <code>girar_izquierda()</code> gira a babor.<br><br>Después de girar, <code>avanzar(n)</code> moverá en la nueva dirección. Traza una ruta en L: al norte y luego al este.`,
        hint: "avanzar(5), girar_derecha(), avanzar(5) — forma una L.",
        startPos: { x: 28, y: 38 },
        startDir: 0,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_turn", text: "Usa girar_derecha() o girar_izquierda()", check: (_boat, _start, code) => /girar_(derecha|izquierda)\s*\(\)/.test(code) },
            { id: "move_10", text: "Recorre al menos 10 casillas en total", check: (boat) => boat.trail.length >= 10 }
        ],
        starterCode: `# MISIÓN 2: Aprender a Girar
# Empieza mirando al norte.
# Traza una ruta en forma de L.

avanzar(5)
girar_derecha()
avanzar(5)
`,
        successMsg: "¡Ruta en L completada! Ya controlas el rumbo.",
        unlocks: [3]
    },
    {
        id: 3,
        title: "Patrón de Búsqueda",
        subtitle: "Usa bucles para cubrir área",
        briefing: `Señal de emergencia recibida. Cubre una zona amplia con un patrón de búsqueda.<br><br>Usa <code>repetir(n):</code> para no repetir código. El barco debe recorrer al menos 20 casillas.`,
        hint: "Un zigzag: avanzar, girar, avanzar 1, girar de vuelta, avanzar. Repítelo con un bucle.",
        startPos: { x: 25, y: 35 },
        startDir: 1,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_loop", text: "Usa un bucle (repetir o for)", check: (_boat, _start, code) => /repetir|for\s+\w+\s+in\s+range/.test(code) },
            { id: "cover_20", text: "Recorre al menos 20 casillas", check: (boat) => boat.trail.length >= 20 }
        ],
        starterCode: `# MISIÓN 3: Patrón de Búsqueda
# Empieza mirando al ESTE.
# Programa un zigzag con bucles.

repetir(5):
    avanzar(3)
    girar_izquierda()
    avanzar(1)
    girar_izquierda()
    avanzar(3)
    girar_derecha()
    avanzar(1)
    girar_derecha()
`,
        successMsg: "¡Patrón completado! Has cubierto la zona eficientemente.",
        unlocks: [4]
    },
    {
        id: 4,
        title: "Sensor y Reacción",
        subtitle: "Aprende a leer sensores y tomar decisiones",
        briefing: `Hay arrecifes en tu camino y necesitas esquivarlos. El barco tiene un sensor: <code>sensor_adelante()</code> devuelve lo que hay una casilla adelante (<code>"agua"</code>, <code>"arrecife"</code>, <code>"tierra"</code>, <code>"puerto"</code>).<br><br>Usa <code>if</code> para tomar decisiones:<br><pre style="background:#0a1929;padding:8px;border-radius:4px;font-size:0.8rem">if sensor_adelante() == "arrecife":
    girar_derecha()
else:
    avanzar(1)</pre>Combínalo con <code>repetir mientras</code> para avanzar hasta el final del camino.`,
        hint: "Con 'repetir mientras combustible() > 0:' puedes repetir. Dentro, comprueba si hay arrecife adelante: si sí, gira; si no, avanza.",
        startPos: { x: 20, y: 35 },
        startDir: 1,
        fuel: 60,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        fixedReefs: [
            { x: 23, y: 35 }, { x: 24, y: 35 },
            { x: 26, y: 34 }, { x: 26, y: 35 },
            { x: 29, y: 35 }, { x: 29, y: 34 }, { x: 29, y: 33 },
            { x: 32, y: 35 }, { x: 32, y: 34 },
            { x: 34, y: 33 }, { x: 34, y: 34 }, { x: 34, y: 35 }
        ],
        objectives: [
            { id: "use_if", text: "Usa un condicional (if)", check: (_boat, _start, code) => /^\s*if\s+/m.test(code) },
            { id: "use_sensor", text: "Usa sensor_adelante()", check: (_boat, _start, code) => /sensor_adelante\s*\(/.test(code) },
            { id: "move_15", text: "Recorre al menos 15 casillas sin chocar", check: (boat) => boat.trail.length >= 15 }
        ],
        starterCode: `# MISIÓN 4: Sensor y Reacción
# sensor_adelante() devuelve lo que hay delante.
# Si hay arrecife, debemos girar para esquivarlo.
# Puedes ver el mapa: los arrecifes son visibles.

repetir mientras combustible() > 0:
    if sensor_adelante() == "arrecife" or sensor_adelante() == "tierra":
        girar_derecha()
        if sensor_adelante() == "arrecife" or sensor_adelante() == "tierra":
            girar_izquierda()
            girar_izquierda()
    else:
        avanzar(1)
`,
        successMsg: "¡Bien hecho! Ya sabes reaccionar a los sensores. El barco toma decisiones solo.",
        unlocks: [5]
    },
    {
        id: 5,
        title: "Navegar por Coordenadas",
        subtitle: "Usa variables y lógica para llegar a puerto",
        briefing: `Aguas abiertas, sin obstáculos. Tu objetivo: navegar hasta el Puerto Sur usando coordenadas.<br><br>Funciones disponibles:<br>
        • <code>posicion_x()</code>, <code>posicion_y()</code> — tu posición actual<br>
        • <code>puerto_x(2)</code>, <code>puerto_y(2)</code> — coordenadas del Puerto Sur<br>
        • <code>rumbo_num()</code> — rumbo actual (0=Norte, 1=Este, 2=Sur, 3=Oeste)<br><br>
        Calcula <code>dx</code> y <code>dy</code> para saber en qué dirección girar. Usa un bucle <code>repetir mientras</code> para repetir hasta llegar.`,
        hint: "Alinea primero en X (si dx > 0, ve al Este; si dx < 0, al Oeste). Cuando dx == 0, alinea en Y (si dy > 0, ve al Sur; si dy < 0, al Norte).",
        startPos: { x: 20, y: 30 },
        startDir: 1,
        fuel: 120,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_while", text: "Usa repetir mientras o while", check: (_boat, _start, code) => /repetir\s+mientras|while\s+/.test(code) },
            { id: "use_vars", text: "Usa variables (dx o dy)", check: (_boat, _start, code) => /\b(dx|dy)\s*=/.test(code) },
            { id: "reach_port2", text: "Llega al Puerto Sur (pisa la casilla)", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISIÓN 5: Navegar por Coordenadas
# Aguas abiertas. Llega al Puerto Sur.
# puerto_x(2), puerto_y(2) = coordenadas del puerto.
# posicion_x(), posicion_y() = posición actual.
# rumbo_num() = 0:Norte, 1:Este, 2:Sur, 3:Oeste
#
# Estrategia: alinear primero en X, luego en Y.

repetir mientras combustible() > 0:
    dx = puerto_x(2) - posicion_x()
    dy = puerto_y(2) - posicion_y()

    # Primero cerrar la distancia en X, luego en Y
    if dx > 0:
        deseado = 1
    else:
        if dx < 0:
            deseado = 3
        else:
            if dy > 0:
                deseado = 2
            else:
                deseado = 0

    # Girar hacia el rumbo deseado, o avanzar si ya apunta
    if rumbo_num() == deseado:
        avanzar(1)
    else:
        diff = (deseado - rumbo_num() + 4) % 4
        if diff == 1:
            girar_derecha()
        else:
            girar_izquierda()
`,
        successMsg: "¡Navegación por coordenadas lograda! Ya puedes programar rutas a cualquier punto.",
        unlocks: [6]
    },
    {
        id: 6,
        title: "Ruta al Puerto en la Niebla",
        subtitle: "Sensores relativos + navegación a puerto",
        briefing: `⚠️ <strong>¡Niebla densa!</strong> Solo ves las casillas cercanas. Hay arrecifes aleatorios entre tú y el puerto.<br><br>El sonar <code>escanear()</code> devuelve una <strong>matriz 5×5 relativa a tu rumbo</strong>:
        <table style="font-size:0.7rem;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:2px 5px;border:1px solid #345">[0][0]</td><td style="padding:2px 5px;border:1px solid #345">[0][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[0][2]↑2</b></td><td style="padding:2px 5px;border:1px solid #345">[0][3]</td><td style="padding:2px 5px;border:1px solid #345">[0][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[1][0]</td><td style="padding:2px 5px;border:1px solid #345">[1][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[1][2]↑1</b></td><td style="padding:2px 5px;border:1px solid #345">[1][3]</td><td style="padding:2px 5px;border:1px solid #345">[1][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">←babor</td><td style="padding:2px 5px;border:1px solid #345">[2][1]</td><td style="padding:2px 5px;border:1px solid #345;background:#1a3d5c"><b>🚢</b></td><td style="padding:2px 5px;border:1px solid #345">[2][3]</td><td style="padding:2px 5px;border:1px solid #345">estrib→</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[3][0]</td><td style="padding:2px 5px;border:1px solid #345">[3][1]</td><td style="padding:2px 5px;border:1px solid #345">[3][2]↓1</td><td style="padding:2px 5px;border:1px solid #345">[3][3]</td><td style="padding:2px 5px;border:1px solid #345">[3][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[4][0]</td><td style="padding:2px 5px;border:1px solid #345">[4][1]</td><td style="padding:2px 5px;border:1px solid #345">[4][2]↓2</td><td style="padding:2px 5px;border:1px solid #345">[4][3]</td><td style="padding:2px 5px;border:1px solid #345">[4][4]</td></tr>
        </table>
        <code>mapa[1][2]</code> = 1 casilla <b>adelante</b>. <code>mapa[2][3]</code> = 1 casilla a <b>estribor</b>.<br>
        También puedes usar <code>sensor_adelante()</code> como atajo.<br><br>
        Funciones de navegación: <code>puerto_x(1)</code>, <code>puerto_y(1)</code> dan las coordenadas del Puerto Norte. <code>distancia_puerto(1)</code> la distancia restante.<br><br>
        <strong>Algoritmo Bug-0:</strong> ve directo al objetivo. Si hay obstáculo, sigue la pared con la <em>regla de la mano derecha</em> hasta poder retomar el rumbo.<br><br>
        <strong>Objetivo:</strong> llega al Puerto Norte sin chocar.`,
        hint: "El código usa dos modos: 0=directo (avanza al puerto), 1=pared (sigue obstáculo con mano derecha). Cuando el camino se despeja en la dirección del puerto, vuelve a modo directo.",
        startPos: { x: 30, y: 35 },
        startDir: 0,
        fuel: 150,
        fog: true,
        randomReefs: 20,
        randomFish: 0,
        objectives: [
            { id: "use_sensor", text: "Usa sensor_adelante() o escanear()", check: (_boat, _start, code) => /sensor_adelante\s*\(|escanear\s*\(/.test(code) },
            { id: "use_if", text: "Usa un condicional (if)", check: (_boat, _start, code) => /^\s*if\s+/m.test(code) },
            { id: "use_port_fn", text: "Usa puerto_x(), puerto_y() o distancia_puerto()", check: (_boat, _start, code) => /puerto_(x|y|cercano)|distancia_puerto/.test(code) },
            { id: "reach_port1", text: "Llega al Puerto Norte (pisa la casilla)", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISIÓN 6: Ruta al Puerto en la Niebla
# Algoritmo Bug-0: ir directo al objetivo y,
# si hay obstáculo, seguir la pared (mano derecha)
# hasta poder retomar el rumbo.
#
# Modos: 0 = directo al objetivo
#         1 = siguiendo pared

modo = 0
pasos_pared = 0

def navegar():
    dx = puerto_x(1) - posicion_x()
    dy = puerto_y(1) - posicion_y()

    # Rumbo deseado hacia el puerto
    deseado = 0
    if dy < 0:
        deseado = 0
        if dx > 0:
            if dx > 0 - dy:
                deseado = 1
        else:
            if 0 - dx > 0 - dy:
                deseado = 3
    else:
        deseado = 2
        if dx > 0:
            if dx > dy:
                deseado = 1
        else:
            if 0 - dx > dy:
                deseado = 3

    # Sonar: comprobar adelante y derecha
    mapa = escanear()
    libre_adelante = mapa[1][2] != "arrecife" and mapa[1][2] != "tierra"
    libre_derecha = mapa[2][3] != "arrecife" and mapa[2][3] != "tierra"

    if modo == 0:
        # Modo directo: avanzar si alineado y libre
        if rumbo_num() == deseado and libre_adelante:
            avanzar(1)
        else:
            if rumbo_num() == deseado and not libre_adelante:
                # ¡Obstáculo! Cambiar a seguir pared
                modo = 1
                pasos_pared = 0
                girar_izquierda()
            else:
                # Girar hacia el rumbo deseado
                diff = (deseado - rumbo_num() + 4) % 4
                if diff == 1:
                    girar_derecha()
                else:
                    girar_izquierda()
    else:
        # Modo pared: regla de la mano derecha
        pasos_pared = pasos_pared + 1
        # ¿Puedo retomar rumbo directo?
        if libre_adelante and rumbo_num() == deseado and pasos_pared > 2:
            modo = 0
            avanzar(1)
        else:
            if libre_derecha:
                girar_derecha()
                avanzar(1)
            else:
                if libre_adelante:
                    avanzar(1)
                else:
                    girar_izquierda()

repetir mientras combustible() > 0:
    navegar()
`,
        successMsg: "¡Increíble! Has navegado a ciegas hasta el puerto esquivando arrecifes.",
        unlocks: [7]
    },
    {
        id: 7,
        title: "Recolección Autónoma",
        subtitle: "Recoge pesca y vuelve a puerto",
        briefing: `Última misión: recoge al menos 3 pescas dispersas en el lago y <strong>vuelve a puerto</strong> para descargar.<br><br>Hay zonas de pesca aleatorias (marcadas 🐟). Usa <code>recoger()</code> cuando estés sobre una. El sonar relativo muestra <code>"pesca"</code> en las celdas con peces.<br><br>Define funciones reutilizables para navegar y buscar pesca.`,
        hint: "Usa escanear() para detectar 'pesca' en la matriz. Navega hacia ella, recoge, y repite. Luego cambia objetivo al puerto.",
        startPos: { x: 30, y: 30 },
        startDir: 0,
        fuel: 200,
        fog: true,
        randomReefs: 10,
        randomFish: 15,
        objectives: [
            { id: "use_func", text: "Define al menos una función", check: (_boat, _start, code) => /^\s*def\s+\w+\s*\(/m.test(code) },
            { id: "use_scan", text: "Usa escanear() o sensor_adelante()", check: (_boat, _start, code) => /escanear\s*\(|sensor_adelante\s*\(/.test(code) },
            { id: "collect_3", text: "Recoge al menos 3 cargas", check: (boat) => boat.cargo >= 3 },
            { id: "return_port", text: "Vuelve a un puerto (pisa la casilla)", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISIÓN 7: Recolección Autónoma
# Recoge >=3 pescas y vuelve a puerto.
# Combina: búsqueda por sonar + Bug-0 para volver.
#
# recoger() recoge la carga bajo el barco.
# escanear() devuelve matriz 5x5 relativa al rumbo.

modo = 0
pasos_pared = 0

def ir_a_puerto():
    p = puerto_cercano()
    dx = puerto_x(p) - posicion_x()
    dy = puerto_y(p) - posicion_y()

    deseado = 0
    if dy < 0:
        deseado = 0
        if dx > 0:
            if dx > 0 - dy:
                deseado = 1
        else:
            if 0 - dx > 0 - dy:
                deseado = 3
    else:
        deseado = 2
        if dx > 0:
            if dx > dy:
                deseado = 1
        else:
            if 0 - dx > dy:
                deseado = 3

    mapa = escanear()
    libre_adelante = mapa[1][2] != "arrecife" and mapa[1][2] != "tierra"
    libre_derecha = mapa[2][3] != "arrecife" and mapa[2][3] != "tierra"

    if modo == 0:
        if rumbo_num() == deseado and libre_adelante:
            avanzar(1)
        else:
            if rumbo_num() == deseado and not libre_adelante:
                modo = 1
                pasos_pared = 0
                girar_izquierda()
            else:
                diff = (deseado - rumbo_num() + 4) % 4
                if diff == 1:
                    girar_derecha()
                else:
                    girar_izquierda()
    else:
        pasos_pared = pasos_pared + 1
        if libre_adelante and rumbo_num() == deseado and pasos_pared > 2:
            modo = 0
            avanzar(1)
        else:
            if libre_derecha:
                girar_derecha()
                avanzar(1)
            else:
                if libre_adelante:
                    avanzar(1)
                else:
                    girar_izquierda()

pasos_rectos = 0
tramo = 4
giros_tramo = 0

def buscar_pesca():
    mapa = escanear()
    # Buscar pesca en celdas adyacentes
    if mapa[1][2] == "pesca":
        avanzar(1)
        recoger()
        pasos_rectos = 0
    else:
        if mapa[2][3] == "pesca":
            girar_derecha()
            avanzar(1)
            recoger()
            pasos_rectos = 0
        else:
            if mapa[2][1] == "pesca":
                girar_izquierda()
                avanzar(1)
                recoger()
                pasos_rectos = 0
            else:
                # Patrón espiral: avanzar tramo, girar, crecer
                if pasos_rectos >= tramo:
                    girar_derecha()
                    pasos_rectos = 0
                    giros_tramo = giros_tramo + 1
                    if giros_tramo >= 2:
                        tramo = tramo + 2
                        giros_tramo = 0
                else:
                    if mapa[1][2] != "arrecife" and mapa[1][2] != "tierra":
                        avanzar(1)
                        pasos_rectos = pasos_rectos + 1
                    else:
                        girar_derecha()
                        pasos_rectos = 0

repetir mientras combustible() > 0:
    if carga() < 3:
        buscar_pesca()
    else:
        ir_a_puerto()
`,
        successMsg: "¡Misión completada! Has programado un barco autónomo: explora, recoge y vuelve a base.",
        unlocks: []
    }
];
