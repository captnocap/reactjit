import React from 'react';
import { Native } from '@reactjit/core';
import type { SensorProps } from './types';

export function Sensor(props: SensorProps) {
  return <Native type="Sensor" {...props} />;
}
