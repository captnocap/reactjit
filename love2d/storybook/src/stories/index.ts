import type { ComponentType } from 'react';

export type StorySection =
  | 'Primitives'
  | 'Core Hooks'
  | 'Packages'
  | 'Effects & Masks'
  | 'Galleries'
  | 'Dev'
  | 'Demos'
  | 'Stress Test'
  | 'Layouts';

export interface StoryDef {
  id: string;
  title: string;
  section: StorySection;
  component: ComponentType;
}

// ── Primitives (Layout1) ────────────────────────────────
import { BoxStory } from './BoxStory';
import { ClassifierStory } from './ClassifierStory';
import { ImageVideoStory } from './ImageVideoStory';
import { InputStory } from './InputStory';
import { LayoutStory } from './LayoutStory';
import { StyleStory } from './StyleStory';
import { TextStory } from './TextStory';

// ── Core Hooks (Layout2) ────────────────────────────────
import { AnimationStory } from './AnimationStory';
import { DataStory } from './DataStory';
import { MonacoMirrorStory } from './MonacoMirrorStory';
import { NavigationStory } from './NavigationStory';
import { OverlayStory } from './OverlayStory';
import { RenderStory } from './RenderStory';
import { WindowsStory } from './WindowsStory';

// ── Packages (Layout2) ──────────────────────────────────
import { AIStory } from './AIStory';
import { AudioStory } from './AudioStory';
import { CapabilitiesStory } from './CapabilitiesStory';
import { CaptureStory } from './CaptureStory';
import { ChemistryStory } from './ChemistryStory';
import { ChemistryTslxStory } from './ChemistryTslxStory';
import { TslxCompareStory } from './TslxCompareStory';
import { ConversionsStory } from './ConversionsStory';
import { CryptoStory } from './CryptoStory';
import { FilesStory } from './FilesStory';
import { FinanceStory } from './FinanceStory';
import { GeoStory } from './GeoStory';
import { ImagingStory } from './ImagingStory';
import { ObjectDetectStory } from './ObjectDetectStory';
import { MathStory } from './MathStory';
import { NetworkingStory } from './NetworkingStory';
import { PhysicsStory } from './PhysicsStory';
import { PresentationStory } from './PresentationStory';
import { PrivacyStory } from './PrivacyStory';
import { ProcessesStory } from './ProcessesStory';
import { DataSpreadsheetStory } from './DataSpreadsheetStory';
import { StorageStory } from './StorageStory';
import { ThreeDStory } from './ThreeDStory';
import { TimeStory } from './TimeStory';

// ── Effects & Masks (Layout3) ───────────────────────────
import { EffectsStory } from './EffectsStory';
import { MasksStory } from './MasksStory';

// ── Galleries (Layout3) ─────────────────────────────────
import { GalleryStory } from './GalleryStory';
import { HookGalleryStory } from './HookGalleryStory';
import { IconStory } from './IconStory';

// ── Dev Tooling (Layout2) ───────────────────────────────
import { CartridgeInspectorStory } from './CartridgeInspectorStory';
import { CompatibilityStory } from './CompatibilityStory';
import { DevToolsStory } from './DevToolsStory';
import { ErrorTestStory } from './ErrorTest';
import { LoveReconcilerStory } from './LoveReconcilerStory';
import { TslBoidsStory } from './TslBoidsStory';

// ── Demos (hub layout) ─────────────────────────────────
import { A11yMirrorStory } from './A11yMirrorStory';
import { AudioRackStory } from './AudioRackStory';
import { CreativeConceptsStory } from './CreativeConceptsStory';
import { DemoStory } from './DemoStory';
import { SleepySyntaxStory } from './SleepySyntaxStory';
import { VesperStory } from './VesperStory';

// ── Stress Test ─────────────────────────────────────────
import RecordingStressStory from './RecordingStressStory';
import { StressTestStory } from './StressTestStory';
import { SyntaxStressStory } from './SyntaxStressStory';

// ── Layouts (templates) ─────────────────────────────────
import { Layout1Story } from './Layout1Story';
import { Layout2Story } from './Layout2Story';
import { Layout3Story } from './Layout3Story';
import { AutomationStory } from './AutomationStory';
import { GamepadStory } from './GamepadStory';
import { GPIOStory } from './GPIOStory';

export const stories: StoryDef[] = [
  // ── Primitives (Layout1) ──────────────────────────────
  { id: 'box', title: 'Box', section: 'Primitives', component: BoxStory },
  { id: 'classifier', title: 'Classifier', section: 'Primitives', component: ClassifierStory },
  { id: 'image-video', title: 'Image & Video', section: 'Primitives', component: ImageVideoStory },
  { id: 'gamepad', title: 'Gamepad', section: 'Primitives', component: GamepadStory },
  { id: 'input', title: 'Input', section: 'Primitives', component: InputStory },
  { id: 'layout', title: 'Layout', section: 'Primitives', component: LayoutStory },
  { id: 'style', title: 'Style', section: 'Primitives', component: StyleStory },
  { id: 'text', title: 'Text', section: 'Primitives', component: TextStory },

  // ── Core Hooks (Layout2) ──────────────────────────────
  { id: 'animation', title: 'Animation', section: 'Core Hooks', component: AnimationStory },
  { id: 'data', title: 'Data', section: 'Core Hooks', component: DataStory },
  { id: 'monaco-mirror', title: 'Monaco Mirror', section: 'Core Hooks', component: MonacoMirrorStory },
  { id: 'navigation', title: 'Navigation', section: 'Core Hooks', component: NavigationStory },
  { id: 'overlay', title: 'Overlay', section: 'Core Hooks', component: OverlayStory },
  { id: 'render', title: 'Render', section: 'Core Hooks', component: RenderStory },
  { id: 'windows', title: 'Windows', section: 'Core Hooks', component: WindowsStory },

  // ── Packages (Layout2) ────────────────────────────────
  { id: '3d', title: '3D', section: 'Packages', component: ThreeDStory },
  { id: 'ai', title: 'AI', section: 'Packages', component: AIStory },
  { id: 'audio', title: 'Audio', section: 'Packages', component: AudioStory },
  { id: 'capabilities', title: 'Capabilities', section: 'Packages', component: CapabilitiesStory },
  { id: 'capture', title: 'Capture', section: 'Packages', component: CaptureStory },
  { id: 'chemistry', title: 'Chemistry', section: 'Packages', component: ChemistryStory },
  { id: 'chemistry-tslx', title: 'Chemistry (TSLX)', section: 'Packages', component: ChemistryTslxStory },
  { id: 'tslx-compare', title: 'TSLX Compare', section: 'Dev', component: TslxCompareStory },
  { id: 'conversions', title: 'Conversions', section: 'Packages', component: ConversionsStory },
  { id: 'crypto', title: 'Crypto', section: 'Packages', component: CryptoStory },
  { id: 'files', title: 'Files', section: 'Packages', component: FilesStory },
  { id: 'finance', title: 'Finance', section: 'Packages', component: FinanceStory },
  { id: 'geo', title: 'Geo', section: 'Packages', component: GeoStory },
  { id: 'imaging', title: 'Imaging', section: 'Packages', component: ImagingStory },
  { id: 'object-detect', title: 'Object Detect', section: 'Packages', component: ObjectDetectStory },
  { id: 'math', title: 'Math', section: 'Packages', component: MathStory },
  { id: 'networking', title: 'Networking', section: 'Packages', component: NetworkingStory },
  { id: 'physics', title: 'Physics', section: 'Packages', component: PhysicsStory },
  { id: 'presentation', title: 'Presentation', section: 'Packages', component: PresentationStory },
  { id: 'privacy', title: 'Privacy', section: 'Packages', component: PrivacyStory },
  { id: 'processes', title: 'Processes', section: 'Packages', component: ProcessesStory },
  { id: 'spreadsheet', title: 'Spreadsheet', section: 'Packages', component: DataSpreadsheetStory },
  { id: 'storage', title: 'Storage', section: 'Packages', component: StorageStory },
  { id: 'time', title: 'Time', section: 'Packages', component: TimeStory },

  // ── Effects & Masks (Layout3) ─────────────────────────
  { id: 'effects', title: 'Effects', section: 'Effects & Masks', component: EffectsStory },
  { id: 'masks', title: 'Masks', section: 'Effects & Masks', component: MasksStory },

  // ── Galleries (Layout3) ───────────────────────────────
  { id: 'gallery', title: 'Component Gallery', section: 'Galleries', component: GalleryStory },
  { id: 'hook-gallery', title: 'Hook Gallery', section: 'Galleries', component: HookGalleryStory },
  { id: 'icons', title: 'Icons', section: 'Galleries', component: IconStory },

  // ── Dev Tooling (Layout2) ─────────────────────────────
  { id: 'cartridge-inspector', title: 'Cartridge Inspector', section: 'Dev', component: CartridgeInspectorStory },
  { id: 'compatibility', title: 'Compatibility', section: 'Dev', component: CompatibilityStory },
  { id: 'devtools', title: 'DevTools', section: 'Dev', component: DevToolsStory },
  { id: 'error-test', title: 'Error Test', section: 'Dev', component: ErrorTestStory },
  { id: 'love-reconciler', title: 'Love Reconciler', section: 'Dev', component: LoveReconcilerStory },
  { id: 'tsl-boids', title: 'TSL Boids', section: 'Dev', component: TslBoidsStory },

  // ── Demos (hub layout) ────────────────────────────────
  { id: 'a11y-mirror', title: 'A11y Mirror', section: 'Demos', component: A11yMirrorStory },
  { id: 'audio-rack', title: 'Audio Rack', section: 'Demos', component: AudioRackStory },
  { id: 'creative-concepts', title: 'Creative Concepts', section: 'Demos', component: CreativeConceptsStory },
  { id: 'demo', title: 'Demos', section: 'Demos', component: DemoStory },
  { id: 'sleepy-syntax', title: 'SleepySyntax', section: 'Demos', component: SleepySyntaxStory },
  { id: 'vesper', title: 'Vesper', section: 'Demos', component: VesperStory },

  // ── Stress Test ───────────────────────────────────────
  { id: 'recording-stress', title: 'Recording Stress', section: 'Stress Test', component: RecordingStressStory },
  { id: 'stress-test', title: 'Stress Test Hub', section: 'Stress Test', component: StressTestStory },
  { id: 'syntax-stress', title: 'Syntax Stress', section: 'Stress Test', component: SyntaxStressStory },

  // ── Layouts (templates) ───────────────────────────────
  { id: 'layout-1', title: 'Layout 1', section: 'Layouts', component: Layout1Story },
  { id: 'layout-2', title: 'Layout 2', section: 'Layouts', component: Layout2Story },
  { id: 'layout-3', title: 'Layout 3', section: 'Layouts', component: Layout3Story },
  { id: 'automation', title: 'Automation', section: 'Dev', component: AutomationStory },
  { id: 'gpio', title: 'GPIO', section: 'Packages', component: GPIOStory },
];
