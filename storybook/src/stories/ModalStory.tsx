/**
 * ModalStory — demonstrates the Modal component in native + web mode.
 *
 * Three variants:
 *   Basic Dialog  — title, body text, single close button
 *   Confirmation  — two-button confirm/cancel pattern
 *   Info Panel    — scrollable content, non-dismissible backdrop
 *
 * Escape or backdrop click closes any modal (unless backdropDismiss=false).
 */

import React, { useState } from 'react';
import { Box, Text, Pressable } from '../../../packages/shared/src';
import { Modal } from '../../../packages/shared/src/Modal';

// ── Catppuccin Mocha palette ──────────────────────────────────────────────────

const C = {
  base:    [0.071, 0.071, 0.094, 1] as const,   // #12121f
  surface: [0.118, 0.118, 0.165, 1] as const,   // #1e1e2a
  overlay: [0.157, 0.157, 0.220, 1] as const,   // #282838
  border:  [0.243, 0.243, 0.337, 1] as const,   // #3e3e56
  text:    [0.898, 0.906, 0.961, 1] as const,   // #e5e7f5
  subtext: [0.635, 0.647, 0.725, 1] as const,   // #a2a5b9
  dim:     [0.424, 0.435, 0.502, 1] as const,   // #6c6f80
  blue:    [0.537, 0.706, 0.980, 1] as const,   // #89b4fa
  red:     [0.957, 0.545, 0.659, 1] as const,   // #f48eb1
  green:   [0.651, 0.890, 0.631, 1] as const,   // #a6e3a1
  yellow:  [0.976, 0.871, 0.588, 1] as const,   // #f9de96
  mauve:   [0.792, 0.663, 0.969, 1] as const,   // #cba6f7
};

// ── Shared modal panel shell ──────────────────────────────────────────────────

function ModalPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      style={{
        backgroundColor: C.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.border,
        padding: 24,
        width: 420,
        gap: 16,
      }}
    >
      <Text style={{ color: C.text, fontSize: 17, fontWeight: 'bold' }}>
        {title}
      </Text>
      {children}
    </Box>
  );
}

// ── Reusable button ───────────────────────────────────────────────────────────

function Btn({
  label,
  onPress,
  variant = 'default',
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger';
}) {
  const bg =
    variant === 'primary' ? C.blue :
    variant === 'danger'  ? C.red  :
    C.overlay;
  const fg =
    variant === 'primary' ? C.base :
    variant === 'danger'  ? C.base :
    C.text;

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: bg,
        borderRadius: 6,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 8,
        paddingBottom: 8,
        borderWidth: variant === 'default' ? 1 : 0,
        borderColor: C.border,
      }}
    >
      <Text style={{ color: fg, fontSize: 13, fontWeight: 'bold' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Demo card ─────────────────────────────────────────────────────────────────

function DemoCard({
  title,
  description,
  buttonLabel,
  buttonVariant,
  onOpen,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant?: 'default' | 'primary' | 'danger';
  onOpen: () => void;
}) {
  return (
    <Box
      style={{
        backgroundColor: C.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
        padding: 20,
        gap: 12,
        width: 220,
      }}
    >
      <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold' }}>
        {title}
      </Text>
      <Text style={{ color: C.subtext, fontSize: 12 }}>
        {description}
      </Text>
      <Btn label={buttonLabel} onPress={onOpen} variant={buttonVariant} />
    </Box>
  );
}

// ── Variant: Basic Dialog ─────────────────────────────────────────────────────

function BasicDialog({ onClose }: { onClose: () => void }) {
  return (
    <ModalPanel title="Basic Dialog">
      <Text style={{ color: C.subtext, fontSize: 13 }}>
        This modal renders via the Portal system. The backdrop dims
        the content below and clicking it calls onRequestClose.
        Pressing Escape also dismisses it.
      </Text>
      <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
        <Btn label="Got it" onPress={onClose} variant="primary" />
      </Box>
    </ModalPanel>
  );
}

// ── Variant: Confirmation ─────────────────────────────────────────────────────

function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalPanel title="Delete Item?">
      <Text style={{ color: C.subtext, fontSize: 13 }}>
        This action cannot be undone. The item will be permanently
        removed from your workspace.
      </Text>
      <Box style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
        <Btn label="Cancel" onPress={onCancel} />
        <Btn label="Delete" onPress={onConfirm} variant="danger" />
      </Box>
    </ModalPanel>
  );
}

// ── Variant: Info Panel (backdropDismiss=false) ───────────────────────────────

function InfoPanel({ onClose }: { onClose: () => void }) {
  const items = [
    'PortalHost wraps the root -- portals teleport content to the top of the tree',
    'The backdrop is a Pressable covering 100% of the viewport',
    'Content sits above the backdrop via zIndex: 1',
    'Clicks inside the content are consumed by a no-op Pressable wrapper',
    'Escape fires via onKeyDown broadcast to all nodes',
    'In native mode animations are skipped (setInterval is unreliable in QuickJS)',
    'Web mode uses CSS transitions for fade and slide',
  ];

  return (
    <ModalPanel title="How Modal Works">
      <Box style={{ gap: 8 }}>
        {items.map((item, i) => (
          <Box key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Text style={{ color: C.mauve, fontSize: 12, fontWeight: 'bold' }}>
              {`${i + 1}.`}
            </Text>
            <Text style={{ color: C.subtext, fontSize: 12 }}>
              {item}
            </Text>
          </Box>
        ))}
      </Box>
      <Text style={{ color: C.dim, fontSize: 11 }}>
        Backdrop dismiss is disabled for this modal — you must use the button.
      </Text>
      <Box style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
        <Btn label="Close" onPress={onClose} variant="primary" />
      </Box>
    </ModalPanel>
  );
}

// ── Main story ────────────────────────────────────────────────────────────────

export function ModalStory() {
  const [activeModal, setActiveModal] = useState<
    'none' | 'basic' | 'confirm' | 'info'
  >('none');
  const [lastAction, setLastAction] = useState<string | null>(null);

  const close = (action?: string) => {
    setActiveModal('none');
    if (action) setLastAction(action);
  };

  return (
    <Box
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: C.base,
        padding: 32,
        gap: 32,
      }}
    >
      {/* Header */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: C.text, fontSize: 20, fontWeight: 'bold' }}>
          Modal
        </Text>
        <Text style={{ color: C.subtext, fontSize: 13 }}>
          Full-screen overlay with backdrop. Dismiss via backdrop click or Escape.
        </Text>
      </Box>

      {/* Demo cards */}
      <Box style={{ flexDirection: 'row', gap: 16 }}>
        <DemoCard
          title="Basic Dialog"
          description="Simple informational modal with a single action button."
          buttonLabel="Open"
          buttonVariant="primary"
          onOpen={() => setActiveModal('basic')}
        />
        <DemoCard
          title="Confirmation"
          description="Two-button confirm/cancel pattern for destructive actions."
          buttonLabel="Delete Item"
          buttonVariant="danger"
          onOpen={() => setActiveModal('confirm')}
        />
        <DemoCard
          title="Info Panel"
          description="Non-dismissible backdrop. Must close via the button."
          buttonLabel="View Details"
          onOpen={() => setActiveModal('info')}
        />
      </Box>

      {/* Last action feedback */}
      {lastAction && (
        <Box
          style={{
            backgroundColor: C.overlay,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: C.border,
            padding: 12,
          }}
        >
          <Text style={{ color: C.green, fontSize: 12 }}>
            {lastAction}
          </Text>
        </Box>
      )}

      {/* Hint */}
      <Text style={{ color: C.dim, fontSize: 11 }}>
        Press Escape or click the backdrop to dismiss (where enabled).
      </Text>

      {/* ── Modals ── */}

      <Modal
        visible={activeModal === 'basic'}
        onRequestClose={() => close('Dialog dismissed.')}
      >
        <BasicDialog onClose={() => close('Dialog acknowledged.')} />
      </Modal>

      <Modal
        visible={activeModal === 'confirm'}
        onRequestClose={() => close('Confirmation cancelled.')}
      >
        <ConfirmDialog
          onConfirm={() => close('Item deleted.')}
          onCancel={() => close('Deletion cancelled.')}
        />
      </Modal>

      <Modal
        visible={activeModal === 'info'}
        onRequestClose={() => close()}
        backdropDismiss={false}
      >
        <InfoPanel onClose={() => close('Info panel closed.')} />
      </Modal>
    </Box>
  );
}
