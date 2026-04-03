import { useCallback, useEffect, useMemo, useState } from 'react';
import { DATA_END, DATA_START } from '../horizonsParser';

const REAL_TIME_TICK_MS = 1000;
const VIRTUAL_MINUTE_MS = 60000;

const REALTIME_START = new Date('2026-04-02T01:48:17Z');
const REALTIME_END = new Date('2026-04-10T23:53:17Z');
const isWithinRealtimeWindow = (date: Date) =>
  date >= REALTIME_START && date <= REALTIME_END;

const clampTime = (value: Date, start: Date, end: Date) => {
  if (value.getTime() < start.getTime()) return new Date(start);
  if (value.getTime() > end.getTime()) return new Date(end);
  return value;
};

export type VirtualClockState = {
  currentTime: Date;
  isPlaying: boolean;
  speed: number;
  speedPresets: number[];
  minTime: Date;
  maxTime: Date;
  isRealTime: boolean;
  isRealtimeAvailable: boolean;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: number) => void;
  seek: (date: Date) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  rewindStep: () => void;
  fastForwardStep: () => void;
  toggleRealTime: () => void;
};

export function useVirtualClock(): VirtualClockState {
  const minTime = DATA_START ?? new Date('2026-04-02T01:48:18Z');
  const maxTime = DATA_END ?? new Date(minTime);
  const initialTime = useMemo(
    () => clampTime(new Date('2026-04-06T20:07:00Z'), minTime, maxTime),
    [maxTime, minTime],
  );
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [isRealTime, setIsRealTime] = useState(() =>
    isWithinRealtimeWindow(new Date()),
  );
  const [nowUtc, setNowUtc] = useState(() => new Date());
  const speedPresets = useMemo(() => [-10, -5, -2, -1, 1, 2, 5, 10, 60], []);

  const isRealtimeAvailable = isWithinRealtimeWindow(nowUtc);

  const seek = useCallback(
    (date: Date) => {
      setCurrentTime(clampTime(date, minTime, maxTime));
    },
    [maxTime, minTime],
  );

  const setSpeed = useCallback((nextSpeed: number) => {
    setSpeedState(nextSpeed);
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggleRealTime = useCallback(() => {
    setIsRealTime((previous) => !previous);
  }, []);

  const jumpToStart = useCallback(() => {
    setCurrentTime(new Date(minTime));
  }, [minTime]);

  const jumpToEnd = useCallback(() => {
    setCurrentTime(new Date(maxTime));
  }, [maxTime]);

  const rewindStep = useCallback(() => {
    setCurrentTime((previous) =>
      clampTime(
        new Date(previous.getTime() - 10 * VIRTUAL_MINUTE_MS),
        minTime,
        maxTime,
      ),
    );
  }, [maxTime, minTime]);

  const fastForwardStep = useCallback(() => {
    setCurrentTime((previous) =>
      clampTime(
        new Date(previous.getTime() + 10 * VIRTUAL_MINUTE_MS),
        minTime,
        maxTime,
      ),
    );
  }, [maxTime, minTime]);

  // Wall clock for real-time availability (mission window)
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowUtc(new Date());
    }, REAL_TIME_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // When real-time mode is on, pause playback and snap to wall time once
  useEffect(() => {
    if (!isRealTime) return;
    setIsPlaying(false);
    setCurrentTime(clampTime(new Date(), minTime, maxTime));
  }, [isRealTime, maxTime, minTime]);

  // While real-time mode is active, advance virtual clock every second
  useEffect(() => {
    if (!isRealTime) return undefined;

    const intervalId = window.setInterval(() => {
      setCurrentTime(clampTime(new Date(), minTime, maxTime));
    }, REAL_TIME_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRealTime, maxTime, minTime]);

  useEffect(() => {
    if (!isRealtimeAvailable && isRealTime) {
      setIsRealTime(false);
    }
  }, [isRealTime, isRealtimeAvailable]);

  useEffect(() => {
    if (!isPlaying || speed === 0) return undefined;

    const intervalId = window.setInterval(() => {
      setCurrentTime((previous) => {
        const next = new Date(previous.getTime() + speed * VIRTUAL_MINUTE_MS);
        const clamped = clampTime(next, minTime, maxTime);

        if (clamped.getTime() === maxTime.getTime() && speed > 0) {
          setIsPlaying(false);
        }
        if (clamped.getTime() === minTime.getTime() && speed < 0) {
          setIsPlaying(false);
        }

        return clamped;
      });
    }, REAL_TIME_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPlaying, maxTime, minTime, speed]);

  return {
    currentTime,
    isPlaying,
    speed,
    speedPresets,
    minTime,
    maxTime,
    isRealTime,
    isRealtimeAvailable,
    play,
    pause,
    setSpeed,
    seek,
    jumpToStart,
    jumpToEnd,
    rewindStep,
    fastForwardStep,
    toggleRealTime,
  };
}
