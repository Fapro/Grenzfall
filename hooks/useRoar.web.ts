import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';

export function useRoar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  const play = useCallback(async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('@/assets/sounds/goal-crowd-roaring_F_minor.wav'),
        { shouldPlay: true }
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying]);

  return { play, isPlaying };
}
