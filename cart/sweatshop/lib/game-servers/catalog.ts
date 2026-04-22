export type GameProtocol = 'udp' | 'tcp';

export type GameDefinition = {
  id: string;
  title: string;
  icon: string;
  protocol: GameProtocol;
  engine: 'source' | 'source2' | 'minecraft' | 'classic';
  description: string;
  tags: string[];
};

export const GAME_DEFS: GameDefinition[] = [
  { id: 'tf2', title: 'TF2', icon: 'TF', protocol: 'udp', engine: 'source', description: 'Team Fortress 2 / Source query', tags: ['Valve', 'casual', 'community'] },
  { id: 'cs2', title: 'CS2', icon: 'CS', protocol: 'udp', engine: 'source2', description: 'Counter-Strike 2 / Source 2 query', tags: ['Valve', 'competitive', 'vac'] },
  { id: 'cstrike', title: 'CS 1.6', icon: 'C1', protocol: 'udp', engine: 'classic', description: 'GoldSrc server browser', tags: ['GoldSrc', 'classic', 'community'] },
  { id: 'css', title: 'CS:S', icon: 'CSS', protocol: 'udp', engine: 'source', description: 'Counter-Strike: Source', tags: ['Valve', 'source', 'servers'] },
  { id: 'gmod', title: 'GMod', icon: 'GM', protocol: 'udp', engine: 'source', description: 'Garry\'s Mod server browser', tags: ['Source', 'sandbox', 'addons'] },
  { id: 'l4d2', title: 'L4D2', icon: 'L4', protocol: 'udp', engine: 'source', description: 'Left 4 Dead 2 co-op and versus', tags: ['Source', 'co-op', 'campaign'] },
  { id: 'minecraft', title: 'Minecraft', icon: 'MC', protocol: 'tcp', engine: 'minecraft', description: 'Java Edition server list ping', tags: ['SLP', 'vanilla', 'modded'] },
  { id: 'terraria', title: 'Terraria', icon: 'TR', protocol: 'tcp', engine: 'classic', description: 'Terraria server browser', tags: ['2D', 'survival', 'bosses'] },
  { id: 'valheim', title: 'Valheim', icon: 'VH', protocol: 'udp', engine: 'classic', description: 'Valheim dedicated servers', tags: ['co-op', 'survival', 'steam'] },
];

export function getGameDefinition(gameId: string): GameDefinition {
  return GAME_DEFS.find((entry) => entry.id === gameId) || GAME_DEFS[0];
}

export function getDefaultGameId(): string {
  return GAME_DEFS[0]?.id || 'tf2';
}
