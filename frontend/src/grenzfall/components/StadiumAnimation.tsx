import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated, Easing } from 'react-native';

const { width } = Dimensions.get('window');
const BASE = Math.min(width, 400) * 0.25;
const NUM_RINGS = 6;

interface RingProps {
  index: number;
  isPlaying: boolean;
}

function Ring({ index, isPlaying }: RingProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const delay = index * 300;
      const duration = 1400 + index * 80;
      const startOpacity = Math.max(0.1, 0.65 - index * 0.08);

      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1 + 0.3 * (index + 1),
              duration,
              easing: Easing.out(Easing.exp),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(opacity, {
                toValue: startOpacity,
                duration: 0,
                useNativeDriver: true,
              }),
              Animated.timing(opacity, {
                toValue: 0,
                duration,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }

    return () => loopRef.current?.stop();
  }, [isPlaying]);

  const size = BASE + index * BASE * 0.6;

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: index % 2 === 0 ? '#4caf50' : '#8bc34a',
          borderWidth: Math.max(0.5, 2 - index * 0.2),
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

interface StadiumAnimationProps {
  isPlaying: boolean;
}

export function StadiumAnimation({ isPlaying }: StadiumAnimationProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: NUM_RINGS }, (_, i) => (
        <Ring key={i} index={i} isPlaying={isPlaying} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    aspectRatio: 1,
  },
  ring: {
    position: 'absolute',
  },
});
