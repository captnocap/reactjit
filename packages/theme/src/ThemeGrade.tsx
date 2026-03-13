import React from 'react';
import { Box, Native } from '@reactjit/core';
import { useThemeShaders } from './useTheme';
import type { ThemeShaderGrade } from './types';

export interface ThemeGradeProps {
  children: React.ReactNode;
  /** Surface role — picks per-role shader overrides if defined. */
  role?: 'bg' | 'elevated' | 'surface' | 'card';
}

function gradeToMaskProps(grade: ThemeShaderGrade): Record<string, unknown> {
  const props: Record<string, unknown> = { mask: true };
  if (grade.hueShift != null) props.shaderHue = grade.hueShift;
  if (grade.saturation != null) props.shaderSaturation = grade.saturation;
  if (grade.value != null) props.shaderValue = grade.value;
  if (grade.contrast != null) props.shaderContrast = grade.contrast;
  if (grade.posterize != null) props.shaderPosterize = grade.posterize;
  if (grade.grain != null) props.shaderGrain = grade.grain;
  if (grade.tint != null) props.shaderTint = grade.tint;
  if (grade.tintMix != null) props.shaderTintMix = grade.tintMix;
  if (grade.vignette != null) props.shaderVignette = grade.vignette;
  return props;
}

/**
 * Applies the active theme's shader grading to its children as a post-processing mask.
 *
 * @example
 * <ThemeGrade>
 *   <Box style={{ backgroundColor: c.bgElevated }}>
 *     <Text>Graded content</Text>
 *   </Box>
 * </ThemeGrade>
 *
 * @example
 * <ThemeGrade role="elevated">
 *   <Card>...</Card>
 * </ThemeGrade>
 */
export function ThemeGrade({ children, role }: ThemeGradeProps) {
  const shaders = useThemeShaders();
  const grade = (role && shaders.surfaces?.[role]) ?? shaders.grade;

  if (!grade) return <>{children}</>;

  return (
    <Box>
      {children}
      <Native type="ShaderGrade" {...gradeToMaskProps(grade)} />
    </Box>
  );
}
