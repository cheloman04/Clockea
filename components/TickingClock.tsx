import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface TickingClockProps {
  visible: boolean;
  onDone: () => void;
}

export default function TickingClock({ visible, onDone }: TickingClockProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const minuteHand = useRef(new Animated.Value(0)).current;
  const hourHand = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Pulse loop: scale 1 → 1.15 → 1
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );

    // Clock hand rotation (minute: 360° in 2s, hour: 30° in 2s)
    const minuteRotate = Animated.timing(minuteHand, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    });
    const hourRotate = Animated.timing(hourHand, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    });

    pulseLoop.start();
    minuteRotate.start();
    hourRotate.start();

    // Fade out after 2.5s then call onDone
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        pulseLoop.stop();
        onDone();
      });
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      pulseLoop.stop();
    };
  }, [visible]);

  if (!visible) return null;

  const minuteDeg = minuteHand.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const hourDeg = hourHand.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '30deg'] });

  return (
    <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
      <Animated.View style={[styles.outerCircle, { transform: [{ scale: pulse }] }]}>
        <View style={styles.clockFace}>
          {/* Hour hand */}
          <Animated.View style={[styles.hand, styles.hourHand, { transform: [{ rotate: hourDeg }] }]} />
          {/* Minute hand */}
          <Animated.View style={[styles.hand, styles.minuteHand, { transform: [{ rotate: minuteDeg }] }]} />
          {/* Center dot */}
          <View style={styles.centerDot} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 53, 69, 0.75)',
    zIndex: 100,
  },
  outerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(254, 127, 45, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(254, 127, 45, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockFace: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e3545',
    borderWidth: 2,
    borderColor: '#fe7f2d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hand: {
    position: 'absolute',
    bottom: '50%',
    left: '50%',
    transformOrigin: 'bottom center',
    borderRadius: 2,
    backgroundColor: '#fe7f2d',
  },
  hourHand: {
    width: 3,
    height: 22,
    marginLeft: -1.5,
  },
  minuteHand: {
    width: 2,
    height: 30,
    marginLeft: -1,
    backgroundColor: '#ffffff',
  },
  centerDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fe7f2d',
  },
});
