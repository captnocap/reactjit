import type { ComponentType } from 'react';

export type StorySection = 'Core' | 'Packages' | 'Demos' | 'Stress Test' | 'Dev' | 'Bad Habits' | 'Layouts';

export interface StoryDef {
  id: string;
  title: string;
  section: StorySection;
  component: ComponentType;
}

import { BoxStory } from './BoxStory';
import { TextStory } from './TextStory';
import { LayoutStory } from './LayoutStory';
import { GridStory } from './GridStory';
import { StyleStory } from './StyleStory';
import { InputStory } from './InputStory';
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
import { StressTestStory } from './StressTestStory';
import { CompositionStory } from './CompositionStory';
import { MultiWindowStory } from './MultiWindowStory';
import { TslBoidsStory } from './TslBoidsStory';
import { MasksStory } from './MasksStory';
import { APIsStory } from './APIsStory';
import { LayoutsStory } from './LayoutsStory';
import { TerminalStory } from './TerminalStory';
import { SemanticTerminalStory } from './SemanticTerminalStory';
import { NoclipMazeStory } from './NoclipMazeStory';
import { FleetStory } from './FleetStory';
import { OriginStory } from './OriginStory';
import { IconStory } from './IconStory';
import { MathStory } from './MathStory';
import { TailwindStory } from './TailwindStory';
import { HtmlCompatStory } from './HtmlCompatStory';
import { MergePrecedenceStory } from './MergePrecedenceStory';
import { LintTestStory } from './LintTestStory';
import { SyntaxStressStory } from './SyntaxStressStory';
import { IFTTTStory } from './IFTTTStory';
import { TimeStory } from './TimeStory';
import { ConvertStory } from './ConvertStory';
import { ScrapeStory } from './ScrapeStory';
import { EventsStory } from './EventsStory';
import { PrivacyStory } from './PrivacyStory';
import { Layout1Story } from './Layout1Story';
import { Layout2Story } from './Layout2Story';
import { Layout3Story } from './Layout3Story';


export const stories: StoryDef[] = [
  // Core — framework primitives in learning order
  { id: 'box', title: 'Box', section: 'Core', component: BoxStory },
  { id: 'text', title: 'Text', section: 'Core', component: TextStory },
  { id: 'layout', title: 'Layout', section: 'Core', component: LayoutStory },
  { id: 'grid', title: 'Grid', section: 'Core', component: GridStory },
  { id: 'style', title: 'Style', section: 'Core', component: StyleStory },
  { id: 'image', title: 'Image', section: 'Core', component: ImageBasicStory },
  { id: 'image-gallery', title: 'Image Gallery', section: 'Core', component: ImageGalleryStory },
  { id: 'video', title: 'Video', section: 'Core', component: VideoStory },
  { id: 'composition', title: 'Composition', section: 'Core', component: CompositionStory },
  { id: 'input', title: 'Input', section: 'Core', component: InputStory },
  { id: 'icons', title: 'Icons', section: 'Core', component: IconStory },
  { id: 'navigation', title: 'Navigation', section: 'Core', component: NavigationStory },
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
  { id: 'ifttt', title: 'IFTTT', section: 'Packages', component: IFTTTStory },
  { id: 'time', title: 'Time', section: 'Packages', component: TimeStory },
  { id: 'scrape', title: 'Scrape', section: 'Packages', component: ScrapeStory },
  { id: 'events', title: 'Events', section: 'Packages', component: EventsStory },
  { id: 'apis', title: 'APIs', section: 'Packages', component: APIsStory },
  { id: 'layouts', title: 'Layouts', section: 'Packages', component: LayoutsStory },
  { id: 'terminal', title: 'Terminal (PTY)', section: 'Packages', component: TerminalStory },
  { id: 'semantic-terminal', title: 'Semantic Terminal', section: 'Packages', component: SemanticTerminalStory },
  { id: 'fleet', title: 'Fleet', section: 'Packages', component: FleetStory },
  { id: 'math', title: 'Math', section: 'Packages', component: MathStory },
  { id: 'convert', title: 'Convert', section: 'Packages', component: ConvertStory },
  { id: 'privacy', title: 'Privacy', section: 'Packages', component: PrivacyStory },

  // Demos
  { id: 'demo', title: 'Demos', section: 'Demos', component: DemoStory },
  { id: 'emulator', title: 'NES Emulator', section: 'Demos', component: EmulatorStory },
  { id: 'scene-3d-showcase', title: '3D Showcase', section: 'Demos', component: Scene3DShowcaseStory },
  { id: 'map-basic', title: 'Map', section: 'Demos', component: MapBasicStory },
  { id: 'audio-rack', title: 'Audio Rack', section: 'Demos', component: AudioRackStory },
  { id: 'poly-pizza', title: 'Poly Pizza', section: 'Demos', component: PolyPizzaStory },
  { id: 'noclip-maze', title: 'Noclip Maze', section: 'Demos', component: NoclipMazeStory },
  { id: 'origin', title: 'Origin', section: 'Demos', component: OriginStory },

  // Bad Habits — Tailwind, HTML elements, merge precedence
  { id: 'tailwind', title: 'Tailwind', section: 'Bad Habits', component: TailwindStory },
  { id: 'html-compat', title: 'HTML Elements', section: 'Bad Habits', component: HtmlCompatStory },
  { id: 'merge-precedence', title: 'Merge Precedence', section: 'Bad Habits', component: MergePrecedenceStory },

  // Stress Test
  { id: 'stress-test', title: 'Stress Test Hub', section: 'Stress Test', component: StressTestStory },
  { id: 'syntax-stress', title: 'Syntax Stress', section: 'Stress Test', component: SyntaxStressStory },

  // Dev
  { id: 'tsl-boids', title: 'TSL Boids', section: 'Dev', component: TslBoidsStory },
  { id: 'multi-window', title: 'Multi-Window', section: 'Dev', component: MultiWindowStory },
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', section: 'Dev', component: CartridgeInspectorStory },
  { id: 'error-test', title: 'Error Test', section: 'Dev', component: ErrorTestStory },
  { id: 'lint-test', title: 'Lint Test', section: 'Dev', component: LintTestStory },

  // Layouts — story layout templates
  { id: 'layout-1', title: 'Layout 1', section: 'Layouts', component: Layout1Story },
  { id: 'layout-2', title: 'Layout 2', section: 'Layouts', component: Layout2Story },
  { id: 'layout-3', title: 'Layout 3', section: 'Layouts', component: Layout3Story },
];
