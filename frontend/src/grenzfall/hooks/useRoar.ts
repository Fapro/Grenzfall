import { useState, useCallback, useRef } from 'react';
import { NativeModulesProxy } from 'expo-modules-core';

export function useRoar() {
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<{ unloadAsync: () => Promise<unknown> } | null>(null);
  const isPlayingRef = useRef(false);

  const play = useCallback(async () => {
    if (isPlayingRef.current) return;

    // Some runtimes (especially misconfigured Android builds) don't expose ExponentAV.
    // Skip roar playback instead of throwing a native module error.
    if (!NativeModulesProxy?.ExponentAV) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    setIsPlaying(true);
    try {
      const expoAv = await import('expo-av');
      const Audio = expoAv.Audio;

      if (!Audio?.Sound?.createAsync) {
        throw new Error('expo-av Audio module unavailable');
      }

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
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
