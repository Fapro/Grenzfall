import { useState, useCallback, useRef } from 'react';

export function useRoar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<{ unloadAsync: () => Promise<unknown> } | null>(null);
  const isPlayingRef = useRef(false);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;
    isPlayingRef.current = true;
    setIsPlaying(true);
    try {
      const expoAv = await import('expo-av');
      const Audio = expoAv.Audio;

      if (!Audio?.Sound?.createAsync) {
        throw new Error('expo-av Audio module unavailable');
      }

      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/goal-crowd-roaring_F_minor.wav'),
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
  }, []);

  return { play, isPlaying };
}
