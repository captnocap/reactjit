/**
 * MockBridge: IBridge implementation that simulates a Love2D game.
 *
 * Runs a space station simulation at 20 ticks/sec, emitting state
 * changes through the standard bridge interface. Responds to power
 * allocation and action commands from the React UI.
 *
 * Canvas reads state directly via public properties for rendering.
 */

import type { IBridge, Listener, Unsubscribe } from '../../../packages/shared/src/bridge';

interface SpaceObject {
  id: string;
  type: 'asteroid' | 'ship' | 'station' | 'debris' | 'signal';
  name: string;
  distance: number;
  angle: number;
  speed: number;
  threat: boolean;
}

interface Alert {
  id: number;
  text: string;
  level: 'info' | 'warning' | 'danger';
  time: number;
}

const NAMES = {
  asteroid: ['Ceres-IV', 'Vesta-R', 'Pallas-3', 'Juno-K', 'Hygiea-7', 'Eris-XI'],
  ship: ['ISV Kepler', 'UCS Hawking', 'Freighter 9', 'Scout Mk-II', 'Patrol Sigma'],
  station: ['Relay-07', 'Depot Alpha', 'Beacon-3F'],
  debris: ['Wreckage', 'Fragment', 'Hull Shard', 'Debris Cloud'],
  signal: ['Signal Src', 'Pulse Origin', 'Anomaly', 'Beacon'],
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export class MockBridge implements IBridge {
  private listeners = new Map<string, Set<Listener>>();
  private queue: Array<{ type: string; payload: any }> = [];
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private alertCounter = 0;

  // Public simulation state (canvas reads these directly)
  hull = 87;
  shields = 65;
  power = 78;
  oxygen = 92;
  speed = 0.3;
  stardate = 2847.3;
  alertLevel: 'green' | 'yellow' | 'red' = 'green';

  shieldAlloc = 2;
  engineAlloc = 1;
  lifeSupAlloc = 2;
  weaponAlloc = 1;

  objects: SpaceObject[] = [];
  alerts: Alert[] = [];

  constructor() {
    this.objects = this.generateInitialObjects();
    this.addAlert('All systems nominal', 'info');
    this.addAlert('Bridge connection established', 'info');
    this.intervalId = setInterval(() => this.simulate(), 50);
  }

  // === IBridge Implementation ===

  send(type: string, payload?: any): void {
    this.queue.push({ type, payload: payload ?? null });
  }

  flush(): void {
    for (const cmd of this.queue) {
      this.processCommand(cmd.type, cmd.payload);
    }
    this.queue = [];
  }

  subscribe(type: string, fn: Listener): Unsubscribe {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
    return () => { this.listeners.get(type)?.delete(fn); };
  }

  async rpc<T = any>(): Promise<T> {
    return {} as T;
  }

  setState(key: string, value: any): void {
    this.send('state:update', { key, value });
  }

  isReady(): boolean { return true; }
  onReady(cb: () => void): void { cb(); }

  destroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.listeners.clear();
  }

  // === Internal ===

  private emit(type: string, payload: any): void {
    this.listeners.get(type)?.forEach(fn => { try { fn(payload); } catch {} });
    this.listeners.get('*')?.forEach(fn => { try { fn({ type, payload }); } catch {} });
  }

  private simulate(): void {
    this.tick++;
    this.flush();

    this.stardate += 0.001;

    // Power: reactor output fluctuates, systems draw proportional to allocation
    const powerGen = 60 + 15 * Math.sin(this.tick * 0.015);
    const totalAlloc = this.shieldAlloc + this.engineAlloc + this.lifeSupAlloc + this.weaponAlloc;
    const powerDraw = totalAlloc * 10;
    this.power = clamp(this.power + (powerGen - powerDraw) * 0.008, 0, 100);

    // Shields recharge proportional to allocation
    if (this.power > 5) {
      this.shields = Math.min(100, this.shields + this.shieldAlloc * 0.08);
    }

    // Oxygen: constant drain, life support counters it
    this.oxygen = clamp(this.oxygen + this.lifeSupAlloc * 0.015 - 0.025, 0, 100);

    // Speed: proportional to engine allocation
    this.speed = this.engineAlloc * 0.25;

    // Random asteroid impact
    if (Math.random() < 0.008) {
      const damage = 10 + Math.random() * 10;
      if (this.shields > 15) {
        this.shields = Math.max(0, this.shields - damage);
        this.addAlert('Impact absorbed by shields', 'warning');
      } else {
        this.hull = Math.max(0, this.hull - damage * 0.6);
        this.addAlert('Hull breach! Direct impact!', 'danger');
      }
    }

    // Random new contact
    if (Math.random() < 0.004 && this.objects.length < 12) {
      const obj = this.randomObject();
      this.objects.push(obj);
      this.addAlert(`New contact: ${obj.name}`, 'info');
    }

    // Update object positions
    for (const obj of this.objects) {
      obj.angle += obj.speed * 0.015;
      obj.distance += (Math.random() - 0.48) * 0.4;
    }
    this.objects = this.objects.filter(o => o.distance > 15 && o.distance < 300);

    // Alert level
    this.alertLevel =
      this.hull < 30 || this.shields < 10 ? 'red' :
      this.hull < 60 || this.shields < 30 ? 'yellow' :
      'green';

    this.hull = clamp(this.hull, 0, 100);

    // Emit all state to subscribers
    this.emit('state:hull', this.hull);
    this.emit('state:shields', this.shields);
    this.emit('state:power', this.power);
    this.emit('state:oxygen', this.oxygen);
    this.emit('state:speed', this.speed);
    this.emit('state:stardate', this.stardate);
    this.emit('state:alertLevel', this.alertLevel);
    this.emit('state:shieldAlloc', this.shieldAlloc);
    this.emit('state:engineAlloc', this.engineAlloc);
    this.emit('state:lifeSupAlloc', this.lifeSupAlloc);
    this.emit('state:weaponAlloc', this.weaponAlloc);
    this.emit('state:objects', [...this.objects]);
    this.emit('state:alerts', [...this.alerts.slice(-12)]);
  }

  private processCommand(type: string, payload: any): void {
    switch (type) {
      case 'power:set': {
        const { system, delta } = payload;
        const key = (system + 'Alloc') as keyof this;
        const current = this[key] as number;
        const total = this.shieldAlloc + this.engineAlloc + this.lifeSupAlloc + this.weaponAlloc;
        if (delta > 0 && total >= 8) return;
        if (delta < 0 && current <= 0) return;
        (this as any)[key] = clamp(current + delta, 0, 4);
        break;
      }
      case 'action:repair':
        if (this.hull < 100) {
          this.hull = Math.min(100, this.hull + 20);
          this.addAlert('Emergency repairs initiated', 'info');
        }
        break;
      case 'action:boost':
        this.shields = Math.min(100, this.shields + 30);
        this.addAlert('Shield boost activated!', 'info');
        break;
      case 'action:distress':
        this.addAlert('Distress signal transmitted on all frequencies', 'warning');
        break;
    }
  }

  private addAlert(text: string, level: Alert['level']): void {
    this.alerts.push({ id: ++this.alertCounter, text, level, time: Date.now() });
    if (this.alerts.length > 30) this.alerts = this.alerts.slice(-30);
  }

  private generateInitialObjects(): SpaceObject[] {
    const types: SpaceObject['type'][] = ['asteroid', 'ship', 'debris', 'signal', 'station'];
    return Array.from({ length: 7 }, (_, i) => {
      const type = types[i % types.length];
      return this.makeObject(type, 60 + Math.random() * 180);
    });
  }

  private randomObject(): SpaceObject {
    const types: SpaceObject['type'][] = ['asteroid', 'asteroid', 'debris', 'ship', 'signal'];
    const type = types[Math.floor(Math.random() * types.length)];
    return this.makeObject(type, 200 + Math.random() * 80);
  }

  private makeObject(type: SpaceObject['type'], distance: number): SpaceObject {
    const names = NAMES[type];
    return {
      id: Math.random().toString(36).substr(2, 6),
      type,
      name: names[Math.floor(Math.random() * names.length)],
      distance,
      angle: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 1.5,
      threat: type === 'asteroid' && Math.random() < 0.3,
    };
  }
}
