import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

const PARTICLES = [
  { color: '#fe7f2d', angle: 0,   dist: 58 },
  { color: '#4ade80', angle: 40,  dist: 70 },
  { color: '#60a5fa', angle: 85,  dist: 54 },
  { color: '#c084fc', angle: 130, dist: 66 },
  { color: '#fbbf24', angle: 175, dist: 60 },
  { color: '#4ade80', angle: 220, dist: 72 },
  { color: '#fe7f2d', angle: 265, dist: 56 },
  { color: '#60a5fa', angle: 310, dist: 64 },
];

interface MilestoneConfettiProps {
  visible: boolean;
}

export default function MilestoneConfetti({ visible }: MilestoneConfettiProps) {
  const anims = useRef(
    PARTICLES.map(() => ({
      pos: new Animated.ValueXY({ x: 0, y: 0 }),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Reset to origin
    anims.forEach((a) => {
      a.pos.setValue({ x: 0, y: 0 });
      a.opacity.setValue(1);
      a.scale.setValue(1);
    });

    const all = anims.map((a, i) => {
      const rad = (PARTICLES[i].angle * Math.PI) / 180;
      const d = PARTICLES[i].dist;
      return Animated.parallel([
        Animated.timing(a.pos, {
          toValue: { x: Math.cos(rad) * d, y: Math.sin(rad) * d },
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(a.opacity, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(a.opacity, { toValue: 0, duration: 570, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(a.scale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
          Animated.timing(a.scale, { toValue: 0.3, duration: 530, useNativeDriver: true }),
        ]),
      ]);
    });

    Animated.parallel(all).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {PARTICLES.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            { backgroundColor: p.color },
            {
              opacity: anims[i].opacity,
              transform: [
                { translateX: anims[i].pos.x },
                { translateY: anims[i].pos.y },
                { scale: anims[i].scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  particle: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});
