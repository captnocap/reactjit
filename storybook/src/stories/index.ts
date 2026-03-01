import type { ComponentType } from 'react';

export type StorySection = 'Core' | 'Packages' | 'Demos' | 'Stress Test' | 'Dev';

export interface StoryDef {
  id: string;
  title: string;
  section: StorySection;
  component: ComponentType;
}

import { BoxBasicStory } from './BoxBasic';
import { TextStory } from './TextStory';
import { FlexRowStory } from './FlexRow';
import { InputStory } from './InputStory';
import { GradientStory } from './Gradient';
import { DemoStory } from './DemoStory';
import { ErrorTestStory } from './ErrorTest';
import { DataStory } from './DataStory';
import { NavigationStory } from './NavigationStory';
import { NetworkingStory } from './NetworkingStory';
import { CryptoStory } from './CryptoStory';
import { MediaStory } from './MediaStory';
import { ImageBasicStory } from './ImageBasic';
import { ImageGalleryStory } from './ImageGalleryStory';
import { VideoStory } from './VideoStory';
import EmulatorStory from './EmulatorStory';
import { Scene3DShowcaseStory } from './Scene3DShowcaseStory';
import { AudioRackStory } from './AudioRackStory';
import { ControlsStory } from './ControlsStory';
import { ThemeStory } from './ThemeStory';
import { CapabilitiesStory } from './CapabilitiesStory';
import { MapBasicStory } from './MapBasicStory';
import { CartridgeInspectorStory } from './CartridgeInspectorStory';
import { LocalStoreStory } from './LocalStoreStory';
import { EffectsStory } from './EffectsStory';
import { PolyPizzaStory } from './PolyPizzaStory';
import { GamesStory } from './GamesStory';
import { StressTestStory } from './StressTestStory';
import { CompositionStory } from './CompositionStory';
import { MultiWindowStory } from './MultiWindowStory';
import { TslBoidsStory } from './TslBoidsStory';
import { MasksStory } from './MasksStory';
import { APIsStory } from './APIsStory';
import { LayoutsStory } from './LayoutsStory';
import { SearchStory } from './SearchStory';
import { TerminalStory } from './TerminalStory';
import { SemanticTerminalStory } from './SemanticTerminalStory';
import { NoclipMazeStory } from './NoclipMazeStory';
import { GridStory } from './GridStory';
import { TailwindStory } from './TailwindStory';
import { HtmlCompatStory } from './HtmlCompatStory';
import { FleetStory } from './FleetStory';
import { OriginStory } from './OriginStory';


export const stories: StoryDef[] = [
  // Core
  { id: 'box-basic', title: 'Box', section: 'Core', component: BoxBasicStory },
  { id: 'text', title: 'Text', section: 'Core', component: TextStory },
  { id: 'layout', title: 'Layout', section: 'Core', component: FlexRowStory },
  { id: 'style', title: 'Style', section: 'Core', component: GradientStory },
  { id: 'image', title: 'Image', section: 'Core', component: ImageBasicStory },
  { id: 'image-gallery', title: 'Image Gallery', section: 'Core', component: ImageGalleryStory },
  { id: 'video', title: 'Video', section: 'Core', component: VideoStory },
  { id: 'composition', title: 'Composition', section: 'Core', component: CompositionStory },
  { id: 'input', title: 'Input', section: 'Core', component: InputStory },
  { id: 'search', title: 'Search', section: 'Core', component: SearchStory },
  { id: 'navigation', title: 'Navigation', section: 'Core', component: NavigationStory },
  { id: 'grid', title: 'Grid System', section: 'Core', component: GridStory },
  { id: 'tailwind', title: 'Tailwind', section: 'Core', component: TailwindStory },
  { id: 'html-compat', title: 'HTML Compat', section: 'Core', component: HtmlCompatStory },
  { id: 'data', title: 'Data', section: 'Core', component: DataStory },

  // Packages
  { id: 'networking', title: 'Networking', section: 'Packages', component: NetworkingStory },
  { id: 'crypto', title: 'Crypto', section: 'Packages', component: CryptoStory },
  { id: 'media', title: 'Media Library', section: 'Packages', component: MediaStory },
  { id: 'controls', title: 'Controls', section: 'Packages', component: ControlsStory },
  { id: 'theme', title: 'Theme System', section: 'Packages', component: ThemeStory },
  { id: 'effects', title: 'Effects', section: 'Packages', component: EffectsStory },
  { id: 'masks', title: 'Masks', section: 'Packages', component: MasksStory },
  { id: 'local-store', title: 'Local Store', section: 'Packages', component: LocalStoreStory },
  { id: 'capabilities', title: 'Capabilities', section: 'Packages', component: CapabilitiesStory },
  { id: 'apis', title: 'APIs', section: 'Packages', component: APIsStory },
  { id: 'layouts', title: 'Layouts', section: 'Packages', component: LayoutsStory },
  { id: 'terminal', title: 'Terminal (PTY)', section: 'Packages', component: TerminalStory },
  { id: 'semantic-terminal', title: 'Semantic Terminal', section: 'Packages', component: SemanticTerminalStory },
  { id: 'fleet', title: 'Fleet', section: 'Packages', component: FleetStory },

  // Demos
  { id: 'demo', title: 'Demos', section: 'Demos', component: DemoStory },
  { id: 'games', title: 'Games', section: 'Demos', component: GamesStory },
  { id: 'emulator', title: 'NES Emulator', section: 'Demos', component: EmulatorStory },
  { id: 'scene-3d-showcase', title: '3D Showcase', section: 'Demos', component: Scene3DShowcaseStory },
  { id: 'map-basic', title: 'Map', section: 'Demos', component: MapBasicStory },
  { id: 'audio-rack', title: 'Audio Rack', section: 'Demos', component: AudioRackStory },
  { id: 'poly-pizza', title: 'Poly Pizza', section: 'Demos', component: PolyPizzaStory },
  { id: 'noclip-maze', title: 'Noclip Maze', section: 'Demos', component: NoclipMazeStory },
  { id: 'origin', title: 'Origin', section: 'Demos', component: OriginStory },

  // Stress Test
  { id: 'stress-test', title: 'Stress Test Hub', section: 'Stress Test', component: StressTestStory },

  // Dev
  { id: 'tsl-boids', title: 'TSL Boids', section: 'Dev', component: TslBoidsStory },
  { id: 'multi-window', title: 'Multi-Window', section: 'Dev', component: MultiWindowStory },
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', section: 'Dev', component: CartridgeInspectorStory },
  { id: 'error-test', title: 'Error Test', section: 'Dev', component: ErrorTestStory },
];
