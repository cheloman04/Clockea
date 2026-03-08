import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { formatDuration } from '../utils/time';

interface TimerProps {
  startTime: string;
  totalBreakSeconds: number;
  breakStart: string | null;
}

function getNetWorkSeconds(startTime: string, totalBreakSeconds: number, breakStart: string | null): number {
  const totalElapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const currentBreak = breakStart
    ? Math.floor((Date.now() - new Date(breakStart).getTime()) / 1000)
    : 0;
  return Math.max(0, totalElapsed - totalBreakSeconds - currentBreak);
}

export default function Timer({ startTime, totalBreakSeconds, breakStart }: TimerProps) {
  const [elapsed, setElapsed] = useState(() =>
    getNetWorkSeconds(startTime, totalBreakSeconds, breakStart)
  );

  useEffect(() => {
    setElapsed(getNetWorkSeconds(startTime, totalBreakSeconds, breakStart));
    const interval = setInterval(() => {
      setElapsed(getNetWorkSeconds(startTime, totalBreakSeconds, breakStart));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, totalBreakSeconds, breakStart]);

  return <Text style={styles.timer}>{formatDuration(elapsed)}</Text>;
}

const styles = StyleSheet.create({
  timer: {
    fontSize: 80,
    fontWeight: '200',
    letterSpacing: 2,
    color: '#ffffff',
  },
});
