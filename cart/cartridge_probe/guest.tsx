// Main probe guest. Reads its module-init marker and the React context to
// display whether host's instances are shared or duplicated. Host renders
// this inside its <ProbeCtx.Provider value="from-host">, so if the context
// object is the same one the guest's useContext is keyed against, we read
// "from-host" — otherwise we read the default.

import { getMarker } from './singleton';
import { ProbeCtx } from './ctx';

export default function ProbeGuest() {
  const marker = getMarker();
  const ctxVal = useContext(ProbeCtx);

  return (
    <Col style={{ gap: 4 }}>
      <Text style={{ color: '#cfd8e3', fontSize: 13 }}>guest singleton marker: {marker}</Text>
      <Text style={{ color: '#cfd8e3', fontSize: 13 }}>guest reads ctx: {ctxVal}</Text>
    </Col>
  );
}
