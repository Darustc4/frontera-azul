/**
 * La Frontera Azul - Mission System (v2)
 * Redesigned for large lake world with boat-centric viewport.
 * Scanner is relative to heading. Ports are fixed landmarks.
 */

import type { BoatState, GameWorld } from './game';

export interface Objective {
    id: string;
    check: (boat: BoatState, start: { x: number; y: number }, code: string, world: GameWorld) => boolean;
}

export interface Mission {
    id: number;
    startPos: { x: number; y: number };
    startDir: number;
    fuel: number;
    fog: boolean;
    randomReefs: number;
    randomFish: number;
    fixedReefs?: { x: number; y: number }[];
    objectives: Objective[];
    starterCode: string;
    unlocks: number[];
}

export const MISSIONS: Mission[] = [
    {
        id: 1,
        startPos: { x: 30, y: 35 },
        startDir: 0,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "move_5", check: (boat) => boat.trail.length >= 5 }
        ],
        starterCode: `# MISSION 1: Engine Start
# The boat faces north (up).
# control.forward(n) moves n cells in the current heading.
# Watch how the world scrolls around the boat.

control.forward(5)
`,
        unlocks: [2]
    },
    {
        id: 2,
        startPos: { x: 28, y: 38 },
        startDir: 0,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_turn", check: (_boat, _start, code) => /control\.turn_(right|left)\s*\(\)/.test(code) },
            { id: "move_10", check: (boat) => boat.trail.length >= 10 }
        ],
        starterCode: `# MISSION 2: Learning to Turn
# Starts facing north.
# Trace an L-shaped route.

control.forward(5)
control.turn_right()
control.forward(5)
`,
        unlocks: [3]
    },
    {
        id: 3,
        startPos: { x: 25, y: 35 },
        startDir: 1,
        fuel: 100,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_loop", check: (_boat, _start, code) => /for\s+\w+\s+in\s+range|while\s+/.test(code) },
            { id: "cover_20", check: (boat) => boat.trail.length >= 20 }
        ],
        starterCode: `# MISSION 3: Search Pattern
# Starts facing EAST.
# Program a zigzag pattern with loops.

for i in range(5):
    control.forward(3)
    control.turn_left()
    control.forward(1)
    control.turn_left()
    control.forward(3)
    control.turn_right()
    control.forward(1)
    control.turn_right()
`,
        unlocks: [4]
    },
    {
        id: 4,
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
            { id: "use_if", check: (_boat, _start, code) => /^\s*if\s+/m.test(code) },
            { id: "use_sensor", check: (_boat, _start, code) => /sensor\.forward\s*\(/.test(code) },
            { id: "move_15", check: (boat) => boat.trail.length >= 15 }
        ],
        starterCode: `# MISSION 4: Sensor & Reaction
# sensor.forward() returns what's ahead.
# If there's a reef, we must turn to avoid it.
# You can see the map: reefs are visible.

while nav.fuel() > 0:
    if sensor.forward() == "reef" or sensor.forward() == "land":
        control.turn_right()
        if sensor.forward() == "reef" or sensor.forward() == "land":
            control.turn_left()
            control.turn_left()
    else:
        control.forward(1)
`,
        unlocks: [5]
    },
    {
        id: 5,
        startPos: { x: 20, y: 30 },
        startDir: 1,
        fuel: 120,
        fog: false,
        randomReefs: 0,
        randomFish: 0,
        objectives: [
            { id: "use_while", check: (_boat, _start, code) => /while\s+/.test(code) },
            { id: "use_vars", check: (_boat, _start, code) => /\b(dx|dy)\s*=/.test(code) },
            { id: "reach_port2", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISSION 5: Navigate by Coordinates
# Open waters. Reach the South Port.
# nav.port_x(2), nav.port_y(2) = port coordinates.
# nav.x(), nav.y() = current position.
# nav.heading_num() = 0:North, 1:East, 2:South, 3:West
#
# Strategy: align X first, then Y.

while nav.fuel() > 0:
    dx = nav.port_x(2) - nav.x()
    dy = nav.port_y(2) - nav.y()

    # Close X distance first, then Y
    if dx > 0:
        desired = 1
    else:
        if dx < 0:
            desired = 3
        else:
            if dy > 0:
                desired = 2
            else:
                desired = 0

    # Turn toward desired heading, or advance if aligned
    if nav.heading_num() == desired:
        control.forward(1)
    else:
        diff = (desired - nav.heading_num() + 4) % 4
        if diff == 1:
            control.turn_right()
        else:
            control.turn_left()
`,
        unlocks: [6]
    },
    {
        id: 6,
        startPos: { x: 30, y: 35 },
        startDir: 0,
        fuel: 150,
        fog: true,
        randomReefs: 20,
        randomFish: 0,
        objectives: [
            { id: "use_sensor", check: (_boat, _start, code) => /sensor\.forward\s*\(|sensor\.scan\s*\(/.test(code) },
            { id: "use_if", check: (_boat, _start, code) => /^\s*if\s+/m.test(code) },
            { id: "use_port_fn", check: (_boat, _start, code) => /nav\.port_(x|y|distance)|nav\.nearest_port/.test(code) },
            { id: "reach_port1", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISSION 6: Route to Port in Fog
# Bug-0 algorithm: go straight to target,
# if obstacle, follow wall (right-hand rule)
# until you can resume direct heading.
#
# Modes: 0 = direct to target
#         1 = wall following

mode = 0
wall_steps = 0

def navigate():
    global mode, wall_steps
    dx = nav.port_x(1) - nav.x()
    dy = nav.port_y(1) - nav.y()

    # Desired heading toward port
    desired = 0
    if dy < 0:
        desired = 0
        if dx > 0:
            if dx > 0 - dy:
                desired = 1
        else:
            if 0 - dx > 0 - dy:
                desired = 3
    else:
        desired = 2
        if dx > 0:
            if dx > dy:
                desired = 1
        else:
            if 0 - dx > dy:
                desired = 3

    # Sonar: check ahead and starboard
    m = sensor.scan()
    clear_ahead = m[1][2] != "reef" and m[1][2] != "land"
    clear_right = m[2][3] != "reef" and m[2][3] != "land"

    if mode == 0:
        # Direct mode: advance if aligned and clear
        if nav.heading_num() == desired and clear_ahead:
            control.forward(1)
        else:
            if nav.heading_num() == desired and not clear_ahead:
                # Obstacle! Switch to wall following
                mode = 1
                wall_steps = 0
                control.turn_left()
            else:
                # Turn toward desired heading
                diff = (desired - nav.heading_num() + 4) % 4
                if diff == 1:
                    control.turn_right()
                else:
                    control.turn_left()
    else:
        # Wall mode: right-hand rule
        wall_steps = wall_steps + 1
        # Can we resume direct heading?
        if clear_ahead and nav.heading_num() == desired and wall_steps > 2:
            mode = 0
            control.forward(1)
        else:
            if clear_right:
                control.turn_right()
                control.forward(1)
            else:
                if clear_ahead:
                    control.forward(1)
                else:
                    control.turn_left()

while nav.fuel() > 0:
    navigate()
`,
        unlocks: [7]
    },
    {
        id: 7,
        startPos: { x: 30, y: 30 },
        startDir: 0,
        fuel: 200,
        fog: true,
        randomReefs: 10,
        randomFish: 15,
        objectives: [
            { id: "use_func", check: (_boat, _start, code) => /^\s*def\s+\w+\s*\(/m.test(code) },
            { id: "use_scan", check: (_boat, _start, code) => /sensor\.scan\s*\(|sensor\.forward\s*\(/.test(code) },
            { id: "collect_3", check: (boat) => boat.cargo >= 3 },
            { id: "return_port", check: (boat, _start, _code, world) => {
                if (!world) return false;
                return world.map[boat.y][boat.x] === world.PORT;
            }}
        ],
        starterCode: `# MISSION 7: Autonomous Collection
# Collect >=3 fish and return to port.
# Combine: sonar search + Bug-0 to return.
#
# control.collect() picks up cargo under the boat.
# sensor.scan() returns 5x5 matrix relative to heading.

mode = 0
wall_steps = 0

def go_to_port():
    global mode, wall_steps
    p = nav.nearest_port()
    dx = nav.port_x(p) - nav.x()
    dy = nav.port_y(p) - nav.y()

    desired = 0
    if dy < 0:
        desired = 0
        if dx > 0:
            if dx > 0 - dy:
                desired = 1
        else:
            if 0 - dx > 0 - dy:
                desired = 3
    else:
        desired = 2
        if dx > 0:
            if dx > dy:
                desired = 1
        else:
            if 0 - dx > dy:
                desired = 3

    m = sensor.scan()
    clear_ahead = m[1][2] != "reef" and m[1][2] != "land"
    clear_right = m[2][3] != "reef" and m[2][3] != "land"

    if mode == 0:
        if nav.heading_num() == desired and clear_ahead:
            control.forward(1)
        else:
            if nav.heading_num() == desired and not clear_ahead:
                mode = 1
                wall_steps = 0
                control.turn_left()
            else:
                diff = (desired - nav.heading_num() + 4) % 4
                if diff == 1:
                    control.turn_right()
                else:
                    control.turn_left()
    else:
        wall_steps = wall_steps + 1
        if clear_ahead and nav.heading_num() == desired and wall_steps > 2:
            mode = 0
            control.forward(1)
        else:
            if clear_right:
                control.turn_right()
                control.forward(1)
            else:
                if clear_ahead:
                    control.forward(1)
                else:
                    control.turn_left()

straight_steps = 0
leg = 4
leg_turns = 0

def search_fish():
    global straight_steps, leg, leg_turns
    m = sensor.scan()
    # Check adjacent cells for fish
    if m[1][2] == "fish":
        control.forward(1)
        control.collect()
        straight_steps = 0
    else:
        if m[2][3] == "fish":
            control.turn_right()
            control.forward(1)
            control.collect()
            straight_steps = 0
        else:
            if m[2][1] == "fish":
                control.turn_left()
                control.forward(1)
                control.collect()
                straight_steps = 0
            else:
                # Spiral pattern: advance leg, turn, grow
                if straight_steps >= leg:
                    control.turn_right()
                    straight_steps = 0
                    leg_turns = leg_turns + 1
                    if leg_turns >= 2:
                        leg = leg + 2
                        leg_turns = 0
                else:
                    if m[1][2] != "reef" and m[1][2] != "land":
                        control.forward(1)
                        straight_steps = straight_steps + 1
                    else:
                        control.turn_right()
                        straight_steps = 0

while nav.fuel() > 0:
    if nav.cargo() < 3:
        search_fish()
    else:
        go_to_port()
`,
        unlocks: []
    }
];
