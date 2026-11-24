
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../../contexts/ThemeContext';
import { fontWeight, letterSpacing } from '../../constants/tokens';

type Props = {
  // ISO timestamp the session started at. Never modified here.
  startedAt: string | null | undefined;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

const SECONDS_PER_HOUR = 3600;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

// mm:ss under an hour, h:mm:ss from one hour on.
function formatElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);
  const seconds = totalSeconds % 60;

  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

function describeElapsed(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / 60);

  if (hours === 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  return `${hours} hour${hours === 1 ? '' : 's'} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/**
 * Elapsed-time display for an active parking session.
 * The arc is a visual hourly lap; the centre time is the real duration.
 */
export default function ElapsedRing({
  startedAt,
  size = 200,
  strokeWidth = 8,
  label = 'PARKING DURATION',
}: Props) {
  const { colors } = useTheme();

  const startMs = useMemo(() => {
    if (!startedAt) return null;

    const time = new Date(startedAt).getTime();
    return Number.isNaN(time) ? null : time;
  }, [startedAt]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // No timer for a missing or invalid timestamp.
    if (startMs === null) return;

    setNow(Date.now());

    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [startMs]);

  const isValid = startMs !== null;

  // Recomputed from the timestamp each tick, so it stays correct
  // after the app returns from the background. Future times clamp to 0.
  const elapsedSeconds = isValid
    ? Math.max(0, Math.floor((now - startMs) / 1000))
    : 0;

  const lapProgress =
    (elapsedSeconds % SECONDS_PER_HOUR) / SECONDS_PER_HOUR;

  // After the first hour the track stays softly green, so the next lap
  // continues on a filled ring instead of appearing to reset.
  const hasCompletedHour = elapsedSeconds >= SECONDS_PER_HOUR;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - lapProgress);
  const center = size / 2;

  const timeFontSize = Math.round(size * 0.19);

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={
        isValid
          ? `Parking duration ${describeElapsed(elapsedSeconds)}`
          : 'Parking duration unavailable'
      }
    >
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={hasCompletedHour ? colors.primarySoft : colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {isValid && lapProgress > 0 && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        )}
      </Svg>

      <View style={styles.centre} pointerEvents="none">
        <Text
          style={[
            styles.time,
            {
              color: colors.text,
              fontSize: timeFontSize,
              lineHeight: Math.round(timeFontSize * 1.15),
            },
          ]}
        >
          {isValid ? formatElapsed(elapsedSeconds) : '--:--'}
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {isValid ? label : 'Duration unavailable'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontWeight: fontWeight.bold,
    letterSpacing: letterSpacing.tight,
    fontVariant: ['tabular-nums'],
  },
  label: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: fontWeight.semibold,
    letterSpacing: letterSpacing.overline,
  },
});
