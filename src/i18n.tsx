import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type Locale = 'en' | 'es';

type Translations = Record<string, string>;

const es: Translations = {
  // Header
  'app.title': 'La Frontera Azul',
  'app.subtitle': 'Terminal de Navegación',
  'header.missions': 'Misiones',

  // WorldPanel
  'world.chart': 'Carta Náutica',
  'world.cargo': 'Bodega:',
  'world.objectives': 'Objetivos',
  'world.atPort': 'En puerto',
  'world.fishZone': 'Zona de pesca',

  // Executor
  'executor.loading': 'Cargando Python (primera vez, ~10s)...',
  'executor.running': '▶ Ejecutando programa...',
  'executor.operationLimit': 'El programa excede el límite de operaciones',
  'executor.pythonReady': '✓ Python listo.',
  'executor.stopped': '⏹ Ejecución detenida.',
  'executor.completed': '✓ Completado. {actions} acciones, Pos: ({x}, {y})',
  'executor.alreadyCollected': 'Ya recogiste aquí.',
  'executor.directions': 'Norte,Este,Sur,Oeste',

  // EditorPanel
  'editor.title': 'Terminal de Programación',
  'editor.run': 'Probar',
  'editor.running': 'Ejecutando...',
  'editor.validate': 'Validar',
  'editor.stop': 'Parar',
  'editor.reset': 'Reiniciar',
  'editor.tab.console': 'Consola',
  'editor.tab.sensor': 'Sensor',
  'editor.tab.variables': 'Variables',
  'editor.tab.reference': 'Referencia',
  'editor.noVars': 'Las variables aparecerán aquí al ejecutar tu código.',

  // Reference panel
  'ref.control': 'control — Movimiento',
  'ref.control.forward': 'Avanza n casillas (1 fuel/casilla)',
  'ref.control.back': 'Gira 180°, avanza n, gira 180° (2+n fuel)',
  'ref.control.turnRight': 'Gira 90° a estribor (1 fuel)',
  'ref.control.turnLeft': 'Gira 90° a babor (1 fuel)',
  'ref.control.collect': 'Recoge carga en esta posición',
  'ref.sensor': 'sensor — Percepción',
  'ref.sensor.scan': 'Matriz 5×5 relativa al rumbo',
  'ref.sensor.forward': 'Lo que hay adelante',
  'ref.sensor.right': 'Lo que hay a estribor',
  'ref.sensor.left': 'Lo que hay a babor',
  'ref.sensor.back': 'Lo que hay detrás',
  'ref.nav': 'nav — Información de Navegación',
  'ref.nav.pos': 'Posición actual',
  'ref.nav.heading': 'Dirección como texto',
  'ref.nav.headingNum': '0=N, 1=E, 2=S, 3=O',
  'ref.nav.fuel': 'Combustible restante',
  'ref.nav.cargo': 'Cantidad de carga',
  'ref.nav.nearestPort': 'ID del puerto más cercano',
  'ref.nav.portCoords': 'Coordenadas del puerto',
  'ref.nav.portDistance': 'Distancia Manhattan',
  'ref.python': 'Python — Control de Flujo',
  'ref.python.for': 'Bucle con contador',
  'ref.python.while': 'Bucle condicional',
  'ref.python.if': 'Condicional',
  'ref.python.def': 'Definir función',
  'ref.python.print': 'Imprimir en consola',

  // MissionModal
  'modal.objectives': 'Objetivos:',
  'modal.hint': 'Pista:',
  'modal.accept': 'Aceptar Misión',

  // SuccessModal
  'success.close': 'Cerrar',
  'success.next': 'Siguiente Misión',
  'success.title': '¡Misión {id} Completada!',

  // MissionsSidebar
  'sidebar.title': 'Misiones Disponibles',
  'sidebar.completed': 'Completada',
  'sidebar.available': 'Disponible',
  'sidebar.locked': 'Bloqueada',

  // App logs
  'log.noCode': '[!] Escribe código primero.',
  'log.allObjectives': '[OK] ¡Todos los objetivos cumplidos! Usa "Validar" para completar.',
  'log.validating': '[~] Validando solución ({runs} ejecuciones)...',
  'log.stopped': '[x] Validación detenida.',
  'log.validated': '[OK] ¡{runs}/{runs} ejecuciones exitosas! Misión completada.',
  'log.failed': '[ERR] {failures}/{runs} ejecuciones fallidas. Ajusta tu algoritmo.',
  'log.replayingFailure': '[~] Reproduciendo primer escenario fallido...',
  'log.reset': '[~] Barco reiniciado.',

  // Sensor info
  'sensor.ahead': 'Adelante',
  'sensor.behind': 'Atrás',
  'sensor.starboard': 'Estribor',
  'sensor.port': 'Babor',

  // Mission label
  'mission.label': 'Misión {id}: {title}',

  // Missions
  'mission.1.title': 'Arranque del Motor',
  'mission.1.subtitle': 'Primeros pasos con El Camarón',
  'mission.1.briefing': 'Bienvenido a bordo de "El Camarón", ingeniero. Tu primera tarea: enciende el motor y demuestra que puedes moverlo.<br><br><code>control.forward(n)</code> mueve el barco n casillas <strong>hacia donde apunta</strong>. El mundo se desplaza alrededor del barco (el barco siempre está en el centro de la pantalla).',
  'mission.1.hint': 'El barco empieza mirando al norte. Usa control.forward(5) para avanzar 5 casillas.',
  'mission.1.obj.move_5': 'Avanza al menos 5 casillas',
  'mission.1.success': '¡Excelente! El motor responde. El Camarón vuelve a navegar.',

  'mission.2.title': 'Aprender a Girar',
  'mission.2.subtitle': 'Domina el rumbo del barco',
  'mission.2.briefing': 'Navegar en línea recta no basta. <code>control.turn_right()</code> gira 90° a estribor. <code>control.turn_left()</code> gira a babor.<br><br>Después de girar, <code>control.forward(n)</code> moverá en la nueva dirección. Traza una ruta en L: al norte y luego al este.',
  'mission.2.hint': 'control.forward(5), control.turn_right(), control.forward(5) — forma una L.',
  'mission.2.obj.use_turn': 'Usa control.turn_right() o control.turn_left()',
  'mission.2.obj.move_10': 'Recorre al menos 10 casillas en total',
  'mission.2.success': '¡Ruta en L completada! Ya controlas el rumbo.',

  'mission.3.title': 'Patrón de Búsqueda',
  'mission.3.subtitle': 'Usa bucles para cubrir área',
  'mission.3.briefing': 'Señal de emergencia recibida. Cubre una zona amplia con un patrón de búsqueda.<br><br>Usa <code>for i in range(n):</code> para no repetir código. El barco debe recorrer al menos 20 casillas.',
  'mission.3.hint': 'Un zigzag: forward, turn, forward 1, turn again, forward. Repítelo con un bucle for.',
  'mission.3.obj.use_loop': 'Usa un bucle (for o while)',
  'mission.3.obj.cover_20': 'Recorre al menos 20 casillas',
  'mission.3.success': '¡Patrón completado! Has cubierto la zona eficientemente.',

  'mission.4.title': 'Sensor y Reacción',
  'mission.4.subtitle': 'Aprende a leer sensores y tomar decisiones',
  'mission.4.briefing': `Hay arrecifes en tu camino y necesitas esquivarlos. El barco tiene un sensor: <code>sensor.forward()</code> devuelve lo que hay una casilla adelante (<code>"water"</code>, <code>"reef"</code>, <code>"land"</code>, <code>"port"</code>, <code>"fish"</code>).<br><br>Usa <code>if</code> para tomar decisiones:<br><pre style="background:#0a1929;padding:8px;border-radius:4px;font-size:0.8rem">if sensor.forward() == "reef":
    control.turn_right()
else:
    control.forward(1)</pre>Combínalo con <code>while nav.fuel() > 0:</code> para avanzar hasta el final del camino.`,
  'mission.4.hint': 'Con \'while nav.fuel() > 0:\' puedes repetir. Dentro, comprueba si hay \'reef\' adelante: si sí, gira; si no, avanza.',
  'mission.4.obj.use_if': 'Usa un condicional (if)',
  'mission.4.obj.use_sensor': 'Usa sensor.forward()',
  'mission.4.obj.move_15': 'Recorre al menos 15 casillas sin chocar',
  'mission.4.success': '¡Bien hecho! Ya sabes reaccionar a los sensores. El barco toma decisiones solo.',

  'mission.5.title': 'Navegar por Coordenadas',
  'mission.5.subtitle': 'Usa variables y lógica para llegar a puerto',
  'mission.5.briefing': `Aguas abiertas, sin obstáculos. Tu objetivo: navegar hasta el Puerto Sur usando coordenadas.<br><br>Funciones disponibles:<br>
        • <code>nav.x()</code>, <code>nav.y()</code> — tu posición actual<br>
        • <code>nav.port_x(2)</code>, <code>nav.port_y(2)</code> — coordenadas del Puerto Sur<br>
        • <code>nav.heading_num()</code> — rumbo actual (0=Norte, 1=Este, 2=Sur, 3=Oeste)<br><br>
        Calcula <code>dx</code> y <code>dy</code> para saber en qué dirección girar. Usa un bucle <code>while</code> para repetir hasta llegar.`,
  'mission.5.hint': 'Alinea primero en X (si dx > 0, ve al Este; si dx < 0, al Oeste). Cuando dx == 0, alinea en Y (si dy > 0, ve al Sur; si dy < 0, al Norte).',
  'mission.5.obj.use_while': 'Usa while para navegar',
  'mission.5.obj.use_vars': 'Usa variables (dx o dy)',
  'mission.5.obj.reach_port2': 'Llega al Puerto Sur (pisa la casilla)',
  'mission.5.success': '¡Navegación por coordenadas lograda! Ya puedes programar rutas a cualquier punto.',

  'mission.6.title': 'Ruta al Puerto en la Niebla',
  'mission.6.subtitle': 'Sensores relativos + navegación a puerto',
  'mission.6.briefing': `<strong>¡Niebla densa!</strong> Solo ves las casillas cercanas. Hay arrecifes aleatorios entre tú y el puerto.<br><br>El sonar <code>sensor.scan()</code> devuelve una <strong>matriz 5×5 relativa a tu rumbo</strong>:
        <table style="font-size:0.7rem;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:2px 5px;border:1px solid #345">[0][0]</td><td style="padding:2px 5px;border:1px solid #345">[0][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[0][2]↑2</b></td><td style="padding:2px 5px;border:1px solid #345">[0][3]</td><td style="padding:2px 5px;border:1px solid #345">[0][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[1][0]</td><td style="padding:2px 5px;border:1px solid #345">[1][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[1][2]↑1</b></td><td style="padding:2px 5px;border:1px solid #345">[1][3]</td><td style="padding:2px 5px;border:1px solid #345">[1][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">←port</td><td style="padding:2px 5px;border:1px solid #345">[2][1]</td><td style="padding:2px 5px;border:1px solid #345;background:#1a3d5c"><b>BOAT</b></td><td style="padding:2px 5px;border:1px solid #345">[2][3]</td><td style="padding:2px 5px;border:1px solid #345">starb→</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[3][0]</td><td style="padding:2px 5px;border:1px solid #345">[3][1]</td><td style="padding:2px 5px;border:1px solid #345">[3][2]↓1</td><td style="padding:2px 5px;border:1px solid #345">[3][3]</td><td style="padding:2px 5px;border:1px solid #345">[3][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[4][0]</td><td style="padding:2px 5px;border:1px solid #345">[4][1]</td><td style="padding:2px 5px;border:1px solid #345">[4][2]↓2</td><td style="padding:2px 5px;border:1px solid #345">[4][3]</td><td style="padding:2px 5px;border:1px solid #345">[4][4]</td></tr>
        </table>
        <code>m[1][2]</code> = 1 cell <b>ahead</b>. <code>m[2][3]</code> = 1 cell <b>starboard</b>.<br>
        También puedes usar <code>sensor.forward()</code> como atajo.<br><br>
        Funciones de navegación: <code>nav.port_x(1)</code>, <code>nav.port_y(1)</code> dan las coordenadas del Puerto Norte. <code>nav.port_distance(1)</code> la distancia restante.<br><br>
        <strong>Algoritmo Bug-0:</strong> ve directo al objetivo. Si hay obstáculo, sigue la pared con la <em>regla de la mano derecha</em> hasta poder retomar el rumbo.<br><br>
        <strong>Objetivo:</strong> llega al Puerto Norte sin chocar.`,
  'mission.6.hint': 'El código usa dos modos: 0=directo (avanza al puerto), 1=pared (sigue obstáculo con mano derecha). Cuando el camino se despeja en la dirección del puerto, vuelve a modo directo.',
  'mission.6.obj.use_sensor': 'Usa sensor.forward() o sensor.scan()',
  'mission.6.obj.use_if': 'Usa un condicional (if)',
  'mission.6.obj.use_port_fn': 'Usa nav.port_x(), nav.port_y() o nav.port_distance()',
  'mission.6.obj.reach_port1': 'Llega al Puerto Norte (pisa la casilla)',
  'mission.6.success': '¡Increíble! Has navegado a ciegas hasta el puerto esquivando arrecifes.',

  'mission.7.title': 'Recolección Autónoma',
  'mission.7.subtitle': 'Recoge pesca y vuelve a puerto',
  'mission.7.briefing': 'Última misión: recoge al menos 3 peces dispersos en el lago y <strong>vuelve a puerto</strong> para descargar.<br><br>Hay zonas de pesca aleatorias (marcadas con pez). Usa <code>control.collect()</code> cuando estés sobre una. El sonar relativo muestra <code>"fish"</code> en las celdas con peces.<br><br>Define funciones reutilizables para navegar y buscar pesca.',
  'mission.7.hint': 'Usa sensor.scan() para detectar \'fish\' en la matriz. Navega hacia ella, recoge, y repite. Luego cambia objetivo al puerto.',
  'mission.7.obj.use_func': 'Define al menos una función',
  'mission.7.obj.use_scan': 'Usa sensor.scan() o sensor.forward()',
  'mission.7.obj.collect_3': 'Recoge al menos 3 cargas',
  'mission.7.obj.return_port': 'Vuelve a un puerto (pisa la casilla)',
  'mission.7.success': '¡Misión completada! Has programado un barco autónomo: explora, recoge y vuelve a base.',
};

const en: Translations = {
  // Header
  'app.title': 'The Blue Frontier',
  'app.subtitle': 'Navigation Terminal',
  'header.missions': 'Missions',

  // WorldPanel
  'world.chart': 'Nautical Chart',
  'world.cargo': 'Cargo:',
  'world.objectives': 'Objectives',
  'world.atPort': 'At port',
  'world.fishZone': 'Fishing zone',

  // Executor
  'executor.loading': 'Loading Python (first time, ~10s)...',
  'executor.running': '▶ Running program...',
  'executor.operationLimit': 'Program exceeds operation limit',
  'executor.pythonReady': '✓ Python ready.',
  'executor.stopped': '⏹ Execution stopped.',
  'executor.completed': '✓ Completed. {actions} actions, Pos: ({x}, {y})',
  'executor.alreadyCollected': 'Already collected here.',
  'executor.directions': 'North,East,South,West',

  // EditorPanel
  'editor.title': 'Programming Terminal',
  'editor.run': 'Run',
  'editor.running': 'Running...',
  'editor.validate': 'Validate',
  'editor.stop': 'Stop',
  'editor.reset': 'Reset',
  'editor.tab.console': 'Console',
  'editor.tab.sensor': 'Sensor',
  'editor.tab.variables': 'Variables',
  'editor.tab.reference': 'Reference',
  'editor.noVars': 'Variables will appear here when you run your code.',

  // Reference panel
  'ref.control': 'control — Movement',
  'ref.control.forward': 'Move forward n cells (1 fuel/cell)',
  'ref.control.back': 'Turn 180°, move n, turn 180° (2+n fuel)',
  'ref.control.turnRight': 'Turn 90° starboard (1 fuel)',
  'ref.control.turnLeft': 'Turn 90° port (1 fuel)',
  'ref.control.collect': 'Collect cargo at position',
  'ref.sensor': 'sensor — Perception',
  'ref.sensor.scan': '5×5 matrix relative to heading',
  'ref.sensor.forward': 'What\'s ahead',
  'ref.sensor.right': 'What\'s to starboard',
  'ref.sensor.left': 'What\'s to port',
  'ref.sensor.back': 'What\'s behind',
  'ref.nav': 'nav — Navigation Info',
  'ref.nav.pos': 'Current position',
  'ref.nav.heading': 'Direction as string',
  'ref.nav.headingNum': '0=N, 1=E, 2=S, 3=W',
  'ref.nav.fuel': 'Remaining fuel',
  'ref.nav.cargo': 'Cargo count',
  'ref.nav.nearestPort': 'ID of closest port',
  'ref.nav.portCoords': 'Port coordinates',
  'ref.nav.portDistance': 'Manhattan distance',
  'ref.python': 'Python — Control Flow',
  'ref.python.for': 'Counter loop',
  'ref.python.while': 'Conditional loop',
  'ref.python.if': 'Conditional',
  'ref.python.def': 'Define function',
  'ref.python.print': 'Print to console',

  // MissionModal
  'modal.objectives': 'Objectives:',
  'modal.hint': 'Hint:',
  'modal.accept': 'Accept Mission',

  // SuccessModal
  'success.close': 'Close',
  'success.next': 'Next Mission',
  'success.title': 'Mission {id} Completed!',

  // MissionsSidebar
  'sidebar.title': 'Available Missions',
  'sidebar.completed': 'Completed',
  'sidebar.available': 'Available',
  'sidebar.locked': 'Locked',

  // App logs
  'log.noCode': '[!] Write some code first.',
  'log.allObjectives': '[OK] All objectives met! Use "Validate" to complete.',
  'log.validating': '[~] Validating solution ({runs} runs)...',
  'log.stopped': '[x] Validation stopped.',
  'log.validated': '[OK] {runs}/{runs} successful runs! Mission completed.',
  'log.failed': '[ERR] {failures}/{runs} runs failed. Adjust your algorithm.',
  'log.replayingFailure': '[~] Replaying first failed scenario...',
  'log.reset': '[~] Boat reset.',

  // Sensor info
  'sensor.ahead': 'Ahead',
  'sensor.behind': 'Behind',
  'sensor.starboard': 'Starboard',
  'sensor.port': 'Port',

  // Mission label
  'mission.label': 'Mission {id}: {title}',

  // Missions
  'mission.1.title': 'Engine Start',
  'mission.1.subtitle': 'First steps with El Camarón',
  'mission.1.briefing': 'Welcome aboard "El Camarón", engineer. Your first task: start the engine and prove you can move it.<br><br><code>control.forward(n)</code> moves the boat n cells in the <strong>current heading direction</strong>. The world scrolls around the boat (the boat is always at the center of the screen).',
  'mission.1.hint': 'The boat starts facing north. Use control.forward(5) to move 5 cells.',
  'mission.1.obj.move_5': 'Move at least 5 cells',
  'mission.1.success': 'Excellent! The engine responds. El Camarón is back in action.',

  'mission.2.title': 'Learning to Turn',
  'mission.2.subtitle': 'Master the boat heading',
  'mission.2.briefing': 'Going straight isn\'t enough. <code>control.turn_right()</code> turns 90° starboard. <code>control.turn_left()</code> turns port.<br><br>After turning, <code>control.forward(n)</code> moves in the new direction. Trace an L-shaped route: north then east.',
  'mission.2.hint': 'control.forward(5), control.turn_right(), control.forward(5) — makes an L.',
  'mission.2.obj.use_turn': 'Use control.turn_right() or control.turn_left()',
  'mission.2.obj.move_10': 'Travel at least 10 cells total',
  'mission.2.success': 'L-route completed! You now control the heading.',

  'mission.3.title': 'Search Pattern',
  'mission.3.subtitle': 'Use loops to cover area',
  'mission.3.briefing': 'Emergency signal received. Cover a wide zone with a search pattern.<br><br>Use <code>for i in range(n):</code> to avoid repeating code. The boat must travel at least 20 cells.',
  'mission.3.hint': 'A zigzag: forward, turn, forward 1, turn again, forward. Repeat with a for loop.',
  'mission.3.obj.use_loop': 'Use a loop (for or while)',
  'mission.3.obj.cover_20': 'Travel at least 20 cells',
  'mission.3.success': 'Pattern completed! You covered the area efficiently.',

  'mission.4.title': 'Sensor & Reaction',
  'mission.4.subtitle': 'Learn to read sensors and make decisions',
  'mission.4.briefing': `There are reefs in your path and you need to avoid them. The boat has a sensor: <code>sensor.forward()</code> returns what's one cell ahead (<code>"water"</code>, <code>"reef"</code>, <code>"land"</code>, <code>"port"</code>, <code>"fish"</code>).<br><br>Use <code>if</code> for decisions:<br><pre style="background:#0a1929;padding:8px;border-radius:4px;font-size:0.8rem">if sensor.forward() == "reef":
    control.turn_right()
else:
    control.forward(1)</pre>Combine with <code>while nav.fuel() > 0:</code> to keep moving until the path ends.`,
  'mission.4.hint': 'With \'while nav.fuel() > 0:\' you repeat. Inside, check if \'reef\' ahead: if yes, turn; if no, advance.',
  'mission.4.obj.use_if': 'Use a conditional (if)',
  'mission.4.obj.use_sensor': 'Use sensor.forward()',
  'mission.4.obj.move_15': 'Travel at least 15 cells without crashing',
  'mission.4.success': 'Well done! You can now react to sensors. The boat makes decisions on its own.',

  'mission.5.title': 'Navigate by Coordinates',
  'mission.5.subtitle': 'Use variables and logic to reach port',
  'mission.5.briefing': `Open waters, no obstacles. Your goal: navigate to the South Port using coordinates.<br><br>Available functions:<br>
        • <code>nav.x()</code>, <code>nav.y()</code> — your current position<br>
        • <code>nav.port_x(2)</code>, <code>nav.port_y(2)</code> — South Port coordinates<br>
        • <code>nav.heading_num()</code> — current heading (0=North, 1=East, 2=South, 3=West)<br><br>
        Calculate <code>dx</code> and <code>dy</code> to determine which direction to turn. Use a <code>while</code> loop to repeat until you arrive.`,
  'mission.5.hint': 'Align X first (if dx > 0, go East; if dx < 0, go West). When dx == 0, align Y (if dy > 0, go South; if dy < 0, go North).',
  'mission.5.obj.use_while': 'Use while to navigate',
  'mission.5.obj.use_vars': 'Use variables (dx or dy)',
  'mission.5.obj.reach_port2': 'Reach the South Port (step on the cell)',
  'mission.5.success': 'Coordinate navigation achieved! You can now program routes to any point.',

  'mission.6.title': 'Route to Port in Fog',
  'mission.6.subtitle': 'Relative sensors + port navigation',
  'mission.6.briefing': `<strong>Dense fog!</strong> You can only see nearby cells. Random reefs lie between you and the port.<br><br>The sonar <code>sensor.scan()</code> returns a <strong>5×5 matrix relative to your heading</strong>:
        <table style="font-size:0.7rem;border-collapse:collapse;margin:8px 0">
        <tr><td style="padding:2px 5px;border:1px solid #345">[0][0]</td><td style="padding:2px 5px;border:1px solid #345">[0][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[0][2]↑2</b></td><td style="padding:2px 5px;border:1px solid #345">[0][3]</td><td style="padding:2px 5px;border:1px solid #345">[0][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[1][0]</td><td style="padding:2px 5px;border:1px solid #345">[1][1]</td><td style="padding:2px 5px;border:1px solid #345"><b>[1][2]↑1</b></td><td style="padding:2px 5px;border:1px solid #345">[1][3]</td><td style="padding:2px 5px;border:1px solid #345">[1][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">←port</td><td style="padding:2px 5px;border:1px solid #345">[2][1]</td><td style="padding:2px 5px;border:1px solid #345;background:#1a3d5c"><b>BOAT</b></td><td style="padding:2px 5px;border:1px solid #345">[2][3]</td><td style="padding:2px 5px;border:1px solid #345">starb→</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[3][0]</td><td style="padding:2px 5px;border:1px solid #345">[3][1]</td><td style="padding:2px 5px;border:1px solid #345">[3][2]↓1</td><td style="padding:2px 5px;border:1px solid #345">[3][3]</td><td style="padding:2px 5px;border:1px solid #345">[3][4]</td></tr>
        <tr><td style="padding:2px 5px;border:1px solid #345">[4][0]</td><td style="padding:2px 5px;border:1px solid #345">[4][1]</td><td style="padding:2px 5px;border:1px solid #345">[4][2]↓2</td><td style="padding:2px 5px;border:1px solid #345">[4][3]</td><td style="padding:2px 5px;border:1px solid #345">[4][4]</td></tr>
        </table>
        <code>m[1][2]</code> = 1 cell <b>ahead</b>. <code>m[2][3]</code> = 1 cell <b>starboard</b>.<br>
        You can also use <code>sensor.forward()</code> as a shortcut.<br><br>
        Navigation functions: <code>nav.port_x(1)</code>, <code>nav.port_y(1)</code> give the North Port coordinates. <code>nav.port_distance(1)</code> the remaining distance.<br><br>
        <strong>Bug-0 Algorithm:</strong> go straight to goal. If obstacle, follow wall with <em>right-hand rule</em> until you can resume direct heading.<br><br>
        <strong>Objective:</strong> reach the North Port without crashing.`,
  'mission.6.hint': 'The code uses two modes: 0=direct (advance to port), 1=wall (follow obstacle with right-hand rule). When the path clears in the port direction, switch back to direct.',
  'mission.6.obj.use_sensor': 'Use sensor.forward() or sensor.scan()',
  'mission.6.obj.use_if': 'Use a conditional (if)',
  'mission.6.obj.use_port_fn': 'Use nav.port_x(), nav.port_y() or nav.port_distance()',
  'mission.6.obj.reach_port1': 'Reach the North Port (step on the cell)',
  'mission.6.success': 'Incredible! You navigated blind to the port dodging reefs.',

  'mission.7.title': 'Autonomous Collection',
  'mission.7.subtitle': 'Collect fish and return to port',
  'mission.7.briefing': 'Final mission: collect at least 3 fish scattered in the lake and <strong>return to port</strong> to unload.<br><br>Random fishing zones exist (marked with fish icon). Use <code>control.collect()</code> when over one. The relative sonar shows <code>"fish"</code> in cells with fish.<br><br>Define reusable functions to navigate and search for fish.',
  'mission.7.hint': 'Use sensor.scan() to detect \'fish\' in the matrix. Navigate to it, collect, and repeat. Then switch target to port.',
  'mission.7.obj.use_func': 'Define at least one function',
  'mission.7.obj.use_scan': 'Use sensor.scan() or sensor.forward()',
  'mission.7.obj.collect_3': 'Collect at least 3 cargo',
  'mission.7.obj.return_port': 'Return to a port (step on the cell)',
  'mission.7.success': 'Mission completed! You programmed an autonomous boat: explore, collect, and return to base.',
};

const allTranslations: Record<Locale, Translations> = { en, es };

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('frontera_azul_locale');
      if (saved === 'en' || saved === 'es') return saved;
    } catch (_e) { /* ignore */ }
    return 'es';
  });

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l);
    try { localStorage.setItem('frontera_azul_locale', l); } catch (_e) { /* ignore */ }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let text = allTranslations[locale][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.split(`{${k}}`).join(String(v));
      }
    }
    return text;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
