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
import { StyleStory } from './StyleStory';
import { InputStory } from './InputStory';
import { DemoStory } from './DemoStory';
import { ErrorTestStory } from './ErrorTest';
import { DataStory } from './DataStory';
import { NavigationStory } from './NavigationStory';
import { NetworkingStory } from './NetworkingStory';
import { CryptoStory } from './CryptoStory';
import { FilesStory } from './FilesStory';
import { ImageGalleryStory } from './ImageGalleryStory';
import { ImageVideoStory } from './ImageVideoStory';
import EmulatorStory from './EmulatorStory';
import { Scene3DShowcaseStory } from './Scene3DShowcaseStory';
import { AudioRackStory } from './AudioRackStory';
import { MapBasicStory } from './MapBasicStory';
import { CartridgeInspectorStory } from './CartridgeInspectorStory';
import { EffectsStory } from './EffectsStory';
import { StressTestStory } from './StressTestStory';
import { TslBoidsStory } from './TslBoidsStory';
import { MasksStory } from './MasksStory';
import { IconStory } from './IconStory';
import { MathStory } from './MathStory';
import { LintTestStory } from './LintTestStory';
import { SyntaxStressStory } from './SyntaxStressStory';
import { TimeStory } from './TimeStory';
import { PrivacyStory } from './PrivacyStory';
import { Layout1Story } from './Layout1Story';
import { Layout2Story } from './Layout2Story';
import { Layout3Story } from './Layout3Story';
import { ConversionsStory } from './ConversionsStory';
import { CapabilitiesStory } from './CapabilitiesStory';
import { StorageStory } from './StorageStory';
import { WindowsStory } from './WindowsStory';
import { AudioStory } from './AudioStory';
import { DevToolsStory } from './DevToolsStory';
import { RenderStory } from './RenderStory';
import { CompatibilityStory } from './CompatibilityStory';
import { PhysicsStory } from './PhysicsStory';
import { GeoScene3DStory } from './GeoScene3DStory';
import { ThreeDStory } from './ThreeDStory';
import { OverlayStory } from './OverlayStory';
import { WireGuardStory } from './WireGuardStory';
import { ImagingStory } from './ImagingStory';

export const stories: StoryDef[] = [
  // Core — framework primitives in learning order
  { id: 'box', title: 'Box', section: 'Core', component: BoxStory },
  { id: 'text', title: 'Text', section: 'Core', component: TextStory },
  { id: 'layout', title: 'Layout', section: 'Core', component: LayoutStory },
  { id: 'style', title: 'Style', section: 'Core', component: StyleStory },
  { id: 'image-video', title: 'Image & Video', section: 'Core', component: ImageVideoStory },
  { id: 'image-gallery', title: 'Image Gallery', section: 'Core', component: ImageGalleryStory },
  { id: 'input', title: 'Input', section: 'Core', component: InputStory },
  { id: 'icons', title: 'Icons', section: 'Core', component: IconStory },
  { id: 'navigation', title: 'Navigation', section: 'Core', component: NavigationStory },
  { id: 'data', title: 'Data', section: 'Core', component: DataStory },
  { id: 'windows', title: 'Windows', section: 'Core', component: WindowsStory },

  // Packages
  { id: 'networking', title: 'Networking', section: 'Packages', component: NetworkingStory },
  { id: 'crypto', title: 'Crypto', section: 'Packages', component: CryptoStory },
  { id: 'files', title: 'Files', section: 'Packages', component: FilesStory },
  { id: 'effects', title: 'Effects', section: 'Packages', component: EffectsStory },
  { id: 'masks', title: 'Masks', section: 'Packages', component: MasksStory },
  { id: 'time', title: 'Time', section: 'Packages', component: TimeStory },
  { id: 'math', title: 'Math', section: 'Packages', component: MathStory },
  { id: 'conversions', title: 'Conversions', section: 'Packages', component: ConversionsStory },
  { id: 'privacy', title: 'Privacy', section: 'Packages', component: PrivacyStory },
  { id: 'capabilities', title: 'Capabilities', section: 'Packages', component: CapabilitiesStory },
  { id: 'storage', title: 'Storage', section: 'Packages', component: StorageStory },
  { id: 'audio', title: 'Audio', section: 'Packages', component: AudioStory },
  { id: '3d', title: '3D', section: 'Packages', component: ThreeDStory },
  { id: 'render', title: 'Render', section: 'Core', component: RenderStory },

  // Demos
  { id: 'demo', title: 'Demos', section: 'Demos', component: DemoStory },
  { id: 'emulator', title: 'NES Emulator', section: 'Demos', component: EmulatorStory },
  { id: 'scene-3d-showcase', title: '3D Showcase', section: 'Demos', component: Scene3DShowcaseStory },
  { id: 'map-basic', title: 'Map', section: 'Demos', component: MapBasicStory },
  { id: 'geoscene-3d', title: 'GeoScene3D', section: 'Demos', component: GeoScene3DStory },
  { id: 'audio-rack', title: 'Audio Rack', section: 'Demos', component: AudioRackStory },
  { id: 'physics', title: 'Physics', section: 'Packages', component: PhysicsStory },
  { id: 'wireguard', title: 'WireGuard', section: 'Packages', component: WireGuardStory },
  { id: 'imaging', title: 'Imaging', section: 'Packages', component: ImagingStory },

  // Bad Habits — compatibility layers (Tailwind, HTML elements, merge precedence)
  { id: 'compatibility', title: 'Compatibility', section: 'Bad Habits', component: CompatibilityStory },

  // Stress Test
  { id: 'stress-test', title: 'Stress Test Hub', section: 'Stress Test', component: StressTestStory },
  { id: 'syntax-stress', title: 'Syntax Stress', section: 'Stress Test', component: SyntaxStressStory },

  // Dev
  { id: 'tsl-boids', title: 'TSL Boids', section: 'Dev', component: TslBoidsStory },
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', section: 'Dev', component: CartridgeInspectorStory },
  { id: 'error-test', title: 'Error Test', section: 'Dev', component: ErrorTestStory },
  { id: 'lint-test', title: 'Lint Test', section: 'Dev', component: LintTestStory },
  { id: 'devtools', title: 'DevTools', section: 'Dev', component: DevToolsStory },

  // Layouts — story layout templates
  { id: 'layout-1', title: 'Layout 1', section: 'Layouts', component: Layout1Story },
  { id: 'layout-2', title: 'Layout 2', section: 'Layouts', component: Layout2Story },
  { id: 'layout-3', title: 'Layout 3', section: 'Layouts', component: Layout3Story },
  { id: 'overlay', title: 'Overlay', section: 'Core', component: OverlayStory },
];
