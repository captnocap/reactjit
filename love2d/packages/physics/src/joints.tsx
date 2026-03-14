import React from 'react';
import { Native } from '@reactjit/core';
import type {
  RevoluteJointProps,
  DistanceJointProps,
  PrismaticJointProps,
  WeldJointProps,
  RopeJointProps,
  MouseJointProps,
} from './types';

export function RevoluteJoint(props: RevoluteJointProps) {
  return <Native type="RevoluteJoint" {...props} />;
}

export function DistanceJoint(props: DistanceJointProps) {
  return <Native type="DistanceJoint" {...props} />;
}

export function PrismaticJoint(props: PrismaticJointProps) {
  return <Native type="PrismaticJoint" {...props} />;
}

export function WeldJoint(props: WeldJointProps) {
  return <Native type="WeldJoint" {...props} />;
}

export function RopeJoint(props: RopeJointProps) {
  return <Native type="RopeJoint" {...props} />;
}

export function MouseJoint(props: MouseJointProps) {
  return <Native type="MouseJoint" {...props} />;
}
