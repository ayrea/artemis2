import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Paper,
  Slider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import AccessTime from '@mui/icons-material/AccessTime';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUp from '@mui/icons-material/KeyboardArrowUp';

type TimeControlsProps = {
  currentTime: Date;
  minTime: Date;
  maxTime: Date;
  isPlaying: boolean;
  speed: number;
  speedPresets: number[];
  isRealTime: boolean;
  isRealtimeAvailable: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSetSpeed: (speed: number) => void;
  onSeek: (date: Date) => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onRewindStep: () => void;
  onFastForwardStep: () => void;
  onToggleRealTime: () => void;
};

const formatUtc = (date: Date) => date.toUTCString();

export default function TimeControls({
  currentTime,
  minTime,
  maxTime,
  isPlaying,
  speed,
  speedPresets,
  isRealTime,
  isRealtimeAvailable,
  onPlay,
  onPause,
  onStop,
  onSetSpeed,
  onSeek,
  onJumpToStart,
  onJumpToEnd,
  onRewindStep,
  onFastForwardStep,
  onToggleRealTime,
}: TimeControlsProps) {
  const [collapsed, setCollapsed] = useState(false);

  const minMs = minTime.getTime();
  const maxMs = maxTime.getTime();
  const currentMs = currentTime.getTime();
  const rangeMs = Math.max(1, maxMs - minMs);
  const progressPercent = ((currentMs - minMs) / rangeMs) * 100;

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 20,
        width: 500,
        maxWidth: 'calc(100% - 32px)',
        p: 1.5,
        bgcolor: 'rgba(10, 10, 10, 0.75)',
        color: '#ffffff',
        backdropFilter: 'blur(3px)',
      }}
    >
      <Stack spacing={1.25}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="subtitle2">
            Virtual Time: {formatUtc(currentTime)}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip
              title={
                isRealtimeAvailable
                  ? 'Toggle real-time mode'
                  : 'Real-time mode unavailable outside mission window'
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={onToggleRealTime}
                  disabled={!isRealtimeAvailable}
                  sx={{ color: isRealTime ? '#00ff00' : '#404040' }}
                  aria-label={
                    isRealTime
                      ? 'Disable real-time mode'
                      : 'Enable real-time mode'
                  }
                >
                  <AccessTime />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => setCollapsed((prev) => !prev)}
              sx={{ color: '#ffffff' }}
              aria-label={
                collapsed ? 'Expand time controls' : 'Collapse time controls'
              }
            >
              {collapsed ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          </Box>
        </Box>
        {!collapsed && (
          <>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              {progressPercent.toFixed(1)}% of trajectory window
            </Typography>
            <Slider
              min={minMs}
              max={maxMs}
              step={60000}
              value={currentMs}
              size="small"
              disabled={isRealTime}
              onChange={(_, value) => {
                if (typeof value !== 'number') return;
                onSeek(new Date(value));
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={isRealTime}
                onClick={onJumpToStart}
              >
                ⏮
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={isRealTime}
                onClick={onRewindStep}
              >
                «
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={isRealTime}
                onClick={onStop}
              >
                ⏹
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={isRealTime}
                onClick={isPlaying ? onPause : onPlay}
              >
                {isPlaying ? '⏸' : '▶'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={isRealTime}
                onClick={onFastForwardStep}
              >
                »
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={isRealTime}
                onClick={onJumpToEnd}
              >
                ⏭
              </Button>
            </Box>
            <ButtonGroup variant="outlined" size="small">
              {speedPresets.map((preset) => (
                <Button
                  key={preset}
                  disabled={isRealTime}
                  variant={preset === speed ? 'contained' : 'outlined'}
                  onClick={() => onSetSpeed(preset)}
                >
                  {preset > 0 ? `${preset}x` : `${preset}x`}
                </Button>
              ))}
            </ButtonGroup>
          </>
        )}
      </Stack>
    </Paper>
  );
}
