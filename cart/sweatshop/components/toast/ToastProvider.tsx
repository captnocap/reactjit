const React: any = require('react');

import { Box } from '../../../../runtime/primitives';
import { ToastQueue } from './ToastQueue';
import { ToastContext, useToastStore } from './useToast';

export function ToastProvider(props: { children: any }) {
  const api = useToastStore();

  return (
    <ToastContext.Provider value={api}>
      <Box style={{ position: 'relative', width: '100%', height: '100%', overflow: 'visible' }}>
        {props.children}
        <ToastQueue />
      </Box>
    </ToastContext.Provider>
  );
}
