/**
 * Select (dropdown) component for web and native (Love2D) modes.
 *
 * Uses a floating overlay panel (same pattern as inspector tooltips
 * and BarChart interactive tooltips). The trigger button stays in flow,
 * the options panel floats below it via absolute positioning.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, styleToCSS } from './primitives';
import type { Style, LoveEvent, Color } from './types';
import { useRendererMode } from './context';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: Style;
  color?: Color;
}

export function Select({
  value: controlledValue,
  defaultValue,
  onValueChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  style,
  color = '#3b82f6',
}: SelectProps) {
  const mode = useRendererMode();

  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const selectedValue = isControlled ? controlledValue : internalValue;
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const selectedOption = options.find(o => o.value === selectedValue);
  const displayText = selectedOption?.label ?? placeholder;

  const handleSelect = useCallback((optionValue: string) => {
    if (disabled) return;
    if (!isControlled) {
      setInternalValue(optionValue);
    }
    onValueChange?.(optionValue);
    setIsOpen(false);
    setHoveredIndex(null);
  }, [disabled, isControlled, onValueChange]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setIsOpen(prev => !prev);
    setHoveredIndex(null);
  }, [disabled]);

  // Web mode: click-outside detection
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== 'web' || !isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setHoveredIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mode, isOpen]);

  // ── Shared styles ──────────────────────────────────────

  const triggerStyle: Style = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: isOpen ? color : '#334155',
    borderRadius: 6,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    minWidth: 160,
    ...style,
  };

  const panelStyle: Style = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: [0.03, 0.03, 0.05, 0.92],
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#40405a',
    overflow: 'hidden',
    zIndex: 100,
  };

  // ── Web mode ───────────────────────────────────────────

  if (mode === 'web') {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'inline-flex',
          flexDirection: 'column',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Trigger */}
        <div
          onClick={handleToggle}
          style={{
            ...styleToCSS(triggerStyle),
            cursor: disabled ? 'not-allowed' : 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{
            color: selectedOption ? '#e2e8f0' : '#64748b',
            fontSize: 14,
          }}>
            {displayText}
          </span>
          <span style={{ color: '#64748b', fontSize: 8, marginLeft: 8 }}>
            {isOpen ? '\u25B2' : '\u25BC'}
          </span>
        </div>

        {/* Floating panel */}
        {isOpen && (
          <div style={styleToCSS(panelStyle)}>
            {options.map((opt, i) => {
              const isSelected = opt.value === selectedValue;
              const isHovered = hoveredIndex === i;
              return (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: isSelected
                      ? 'rgba(97, 166, 250, 0.15)'
                      : isHovered
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'transparent',
                    borderBottom: i < options.length - 1 ? '1px solid rgba(64, 64, 89, 0.4)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                  }}
                >
                  <span style={{
                    color: isSelected ? '#61a6fa' : isHovered ? '#e1e4f0' : '#94a3b8',
                    fontSize: 14,
                    fontWeight: isSelected ? 600 : 400,
                  }}>
                    {opt.label}
                  </span>
                  {isSelected && (
                    <span style={{ color: '#61a6fa', fontSize: 11 }}>
                      {'*'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Native mode: Lua-owned host element ─────────────────
  // All open/close, hover tracking, keyboard nav handled in lua/select.lua.
  return React.createElement('Select', {
    value: selectedValue,
    options: JSON.stringify(options),
    placeholder,
    disabled,
    color: typeof color === 'string' ? color : '#3b82f6',
    onValueChange: (e: any) => {
      const optionValue = e.value;
      if (!isControlled) {
        setInternalValue(optionValue);
      }
      onValueChange?.(optionValue);
    },
    style: {
      minWidth: 160,
      height: 36 + 4,  // trigger height + margin
      ...style,
    },
  });
}
