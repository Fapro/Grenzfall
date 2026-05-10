import { useState, useCallback } from 'react';
import { playRoar } from '@/utils/audioSynth';

export function useRoar() {
  const [isPlaying, setIsPlaying] = useState(false);

  const play = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    await playRoar(5);
    setIsPlaying(false);
  }, [isPlaying]);

  return { play, isPlaying };
}
