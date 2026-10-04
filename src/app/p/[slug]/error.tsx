'use client';

import { GameError } from '@/components/game/RouteStates';

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <GameError error={error} retry={retry} />;
}
