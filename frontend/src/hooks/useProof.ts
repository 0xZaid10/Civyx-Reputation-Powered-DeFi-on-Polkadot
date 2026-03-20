// Civyx — useProof hook
// State machine for ZK proof generation.
// Wraps proof.ts functions with React state for UI feedback.

import { useState, useCallback } from 'react';
import type { ProofProgress, ProofResult, OnProgress } from '@/lib/proof';

export type ProofState = {
  status:   'idle' | 'running' | 'done' | 'error';
  progress: ProofProgress;
  result:   ProofResult | null;
  error:    string | null;
};

const IDLE: ProofState = {
  status:   'idle',
  progress: { step: 'idle', pct: 0, label: '' },
  result:   null,
  error:    null,
};

export function useProof() {
  const [state, setState] = useState<ProofState>(IDLE);

  const onProgress: OnProgress = useCallback((p) => {
    setState(prev => ({ ...prev, status: 'running', progress: p, error: null }));
  }, []);

  const generate = useCallback(async (
    fn: (onProgress: OnProgress) => Promise<ProofResult>
  ) => {
    setState({ status: 'running', progress: { step: 'loading', pct: 5, label: 'Preparing...' }, result: null, error: null });
    try {
      const result = await fn(onProgress);
      setState({ status: 'done', progress: { step: 'done', pct: 100, label: 'Done' }, result, error: null });
      return result;
    } catch (err: any) {
      const msg = err?.message ?? 'Proof generation failed';
      setState({ status: 'error', progress: { step: 'error', pct: 0, label: msg }, result: null, error: msg });
      return null;
    }
  }, [onProgress]);

  const reset = useCallback(() => setState(IDLE), []);

  return { state, generate, reset };
}
