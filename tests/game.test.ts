/**
 * Unit tests for GameWorld logic.
 * Uses a mock canvas since we only test game mechanics, not rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameWorld } from '../src/game';

function createMockCanvas(): HTMLCanvasElement {
    return {
        width: 630,
        height: 630,
        getContext: () => ({
            clearRect: () => {},
            fillRect: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            fill: () => {},
            arc: () => {},
            closePath: () => {},
            fillText: () => {},
            strokeRect: () => {},
            save: () => {},
            restore: () => {},
            translate: () => {},
            rotate: () => {},
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 0,
            font: '',
            textAlign: '',
            globalAlpha: 1,
        }),
    } as unknown as HTMLCanvasElement;
}

describe('GameWorld', () => {
    let world: GameWorld;

    beforeEach(() => {
        world = new GameWorld(createMockCanvas());
    });

    describe('generateLake', () => {
        it('creates a 60x60 map', () => {
            expect(world.map.length).toBe(60);
            expect(world.map[0].length).toBe(60);
        });

        it('has land at edges and water in center', () => {
            // Corners should be land
            expect(world.map[0][0]).toBe(world.LAND);
            expect(world.map[59][59]).toBe(world.LAND);
            // Center should be water
            expect(world.map[30][30]).toBe(world.WATER);
        });

        it('has two ports', () => {
            let portCount = 0;
            for (let y = 0; y < 60; y++)
                for (let x = 0; x < 60; x++)
                    if (world.map[y][x] === world.PORT) portCount++;
            expect(portCount).toBeGreaterThanOrEqual(2);
        });
    });

    describe('reset', () => {
        it('sets boat position and direction', () => {
            world.reset({ x: 25, y: 35 }, 2, 80);
            expect(world.boat.x).toBe(25);
            expect(world.boat.y).toBe(35);
            expect(world.boat.direction).toBe(2);
            expect(world.boat.fuel).toBe(80);
            expect(world.boat.maxFuel).toBe(80);
            expect(world.boat.cargo).toBe(0);
            expect(world.boat.trail).toEqual([]);
        });
    });

    describe('getDirectionDelta', () => {
        it('returns [0,-1] for North (0)', () => {
            expect(world.getDirectionDelta(0)).toEqual([0, -1]);
        });
        it('returns [1,0] for East (1)', () => {
            expect(world.getDirectionDelta(1)).toEqual([1, 0]);
        });
        it('returns [0,1] for South (2)', () => {
            expect(world.getDirectionDelta(2)).toEqual([0, 1]);
        });
        it('returns [-1,0] for West (3)', () => {
            expect(world.getDirectionDelta(3)).toEqual([-1, 0]);
        });
    });

    describe('canMoveTo', () => {
        it('allows move to water cell', () => {
            // Center is water
            expect(world.canMoveTo(30, 30)).toEqual({ ok: true });
        });

        it('blocks move to land cell', () => {
            // Corner is land
            const result = world.canMoveTo(0, 0);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('Tierra');
        });

        it('blocks move out of bounds', () => {
            const result = world.canMoveTo(-1, 30);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('Fuera');
        });

        it('blocks move to reef', () => {
            // Place a reef
            world.map[30][31] = world.REEF;
            const result = world.canMoveTo(31, 30);
            expect(result.ok).toBe(false);
            expect(result.reason).toContain('Arrecife');
        });
    });

    describe('getCellType', () => {
        it('returns "tierra" for land', () => {
            expect(world.getCellType(0, 0)).toBe('tierra');
        });
        it('returns "agua" for water', () => {
            expect(world.getCellType(30, 30)).toBe('agua');
        });
        it('returns "tierra" for out of bounds', () => {
            expect(world.getCellType(-1, 0)).toBe('tierra');
            expect(world.getCellType(100, 100)).toBe('tierra');
        });
        it('returns "arrecife" for reef', () => {
            world.map[30][31] = world.REEF;
            expect(world.getCellType(31, 30)).toBe('arrecife');
        });
        it('returns "pesca" for fish', () => {
            world.map[30][31] = world.FISH;
            expect(world.getCellType(31, 30)).toBe('pesca');
        });
        it('returns "puerto" for port', () => {
            const port = world.ports[0];
            expect(world.getCellType(port.x, port.y)).toBe('puerto');
        });
    });

    describe('relativeToWorld', () => {
        beforeEach(() => {
            world.boat.x = 30;
            world.boat.y = 30;
        });

        it('facing North: forward is -y', () => {
            world.boat.direction = 0;
            expect(world.relativeToWorld(1, 0)).toEqual([30, 29]); // 1 forward
            expect(world.relativeToWorld(0, 1)).toEqual([31, 30]); // 1 right
            expect(world.relativeToWorld(0, -1)).toEqual([29, 30]); // 1 left
        });

        it('facing East: forward is +x', () => {
            world.boat.direction = 1;
            expect(world.relativeToWorld(1, 0)).toEqual([31, 30]); // 1 forward
            expect(world.relativeToWorld(0, 1)).toEqual([30, 31]); // 1 right
        });

        it('facing South: forward is +y', () => {
            world.boat.direction = 2;
            expect(world.relativeToWorld(1, 0)).toEqual([30, 31]); // 1 forward
            expect(world.relativeToWorld(0, 1)).toEqual([29, 30]); // 1 right
        });

        it('facing West: forward is -x', () => {
            world.boat.direction = 3;
            expect(world.relativeToWorld(1, 0)).toEqual([29, 30]); // 1 forward
            expect(world.relativeToWorld(0, 1)).toEqual([30, 29]); // 1 right
        });
    });

    describe('scan', () => {
        it('returns 5x5 matrix', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.boat.direction = 0;
            const matrix = world.scan();
            expect(matrix.length).toBe(5);
            expect(matrix[0].length).toBe(5);
        });

        it('center is agua (boat position)', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.boat.direction = 0;
            const matrix = world.scan();
            expect(matrix[2][2]).toBe('agua');
        });

        it('detects reef at relative position', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.boat.direction = 0; // facing North
            // Place reef 1 cell ahead (north = y-1)
            world.map[29][30] = world.REEF;
            const matrix = world.scan();
            // [1][2] is 1 cell ahead
            expect(matrix[1][2]).toBe('arrecife');
        });
    });

    describe('sensors', () => {
        beforeEach(() => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.boat.direction = 1; // East
        });

        it('sensorForward detects cell ahead', () => {
            world.map[30][31] = world.REEF;
            expect(world.sensorForward()).toBe('arrecife');
        });

        it('sensorRight detects cell to starboard', () => {
            world.map[31][30] = world.FISH;
            expect(world.sensorRight()).toBe('pesca');
        });

        it('sensorLeft detects cell to port', () => {
            world.map[29][30] = world.REEF;
            expect(world.sensorLeft()).toBe('arrecife');
        });

        it('sensorBack detects cell behind', () => {
            world.map[30][29] = world.REEF;
            expect(world.sensorBack()).toBe('arrecife');
        });
    });

    describe('port utilities', () => {
        it('nearestPort returns closest port', () => {
            world.boat.x = world.ports[0].x;
            world.boat.y = world.ports[0].y;
            expect(world.nearestPort()).toBe(1);

            world.boat.x = world.ports[1].x;
            world.boat.y = world.ports[1].y;
            expect(world.nearestPort()).toBe(2);
        });

        it('distanceToPort returns Manhattan distance', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            const p1 = world.ports[0];
            const expected = Math.abs(p1.x - 30) + Math.abs(p1.y - 30);
            expect(world.distanceToPort(1)).toBe(expected);
        });

        it('portX/portY return port coordinates', () => {
            expect(world.portX(1)).toBe(world.ports[0].x);
            expect(world.portY(1)).toBe(world.ports[0].y);
            expect(world.portX(2)).toBe(world.ports[1].x);
            expect(world.portY(2)).toBe(world.ports[1].y);
        });
    });

    describe('collectCargo', () => {
        it('succeeds on fish cell', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.map[30][30] = world.FISH;
            const result = world.collectCargo();
            expect(result.ok).toBe(true);
            expect(world.boat.cargo).toBe(1);
            expect(world.map[30][30]).toBe(world.WATER); // Fish removed
        });

        it('fails on water cell', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.map[30][30] = world.WATER;
            const result = world.collectCargo();
            expect(result.ok).toBe(false);
        });

        it('fails when cargo is full', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.map[30][30] = world.FISH;
            world.boat.cargo = world.boat.maxCargo;
            const result = world.collectCargo();
            expect(result.ok).toBe(false);
        });

        it('fails when already collected at position', () => {
            world.boat.x = 30;
            world.boat.y = 30;
            world.map[30][30] = world.FISH;
            world.boat.collectedZones.add('30,30');
            const result = world.collectCargo();
            expect(result.ok).toBe(false);
        });
    });

    describe('addFixedReefs', () => {
        it('places reefs at specified coordinates', () => {
            world.resetMap();
            world.addFixedReefs([{ x: 25, y: 30 }, { x: 26, y: 30 }]);
            expect(world.map[30][25]).toBe(world.REEF);
            expect(world.map[30][26]).toBe(world.REEF);
        });
    });

    describe('fog of war', () => {
        it('setFog enables fog', () => {
            world.setFog(true);
            expect(world.fog).toBe(true);
        });

        it('revealAround reveals cells in radius 5', () => {
            world.fog = true;
            world.revealed = new Set();
            world.revealAround(30, 30);
            expect(world.isRevealed(30, 30)).toBe(true);
            expect(world.isRevealed(35, 35)).toBe(true);
            expect(world.isRevealed(36, 36)).toBe(false);
        });

        it('isRevealed returns true when fog is off', () => {
            world.fog = false;
            expect(world.isRevealed(0, 0)).toBe(true);
        });
    });
});
