import { InfoOutlined, NightlightRound, Public, RocketLaunch } from '@mui/icons-material'
import { Box, Button, ButtonGroup, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, Tooltip } from '@mui/material'
import { useState } from 'react'

export type FocusTarget = 'earth' | 'moon' | 'spacecraft'

type FocusControlsProps = {
  onFocus: (target: FocusTarget) => void
}

export default function FocusControls({ onFocus }: FocusControlsProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false)

  return (
    <>
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          p: 0.5,
          bgcolor: 'rgba(10, 10, 10, 0.75)',
          color: '#ffffff',
          backdropFilter: 'blur(3px)',
          border: '1px solid rgba(232, 237, 242, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ButtonGroup
            size="small"
            aria-label="Focus target controls"
            sx={{
              '& .MuiButton-root': {
                color: '#e8edf2',
                borderColor: 'rgba(232, 237, 242, 0.35)',
                minWidth: 40,
              },
              '& .MuiButton-root:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.08)',
              },
            }}
          >
            <Tooltip title="Centre on Earth" arrow>
              <Button aria-label="Centre on Earth" onClick={() => onFocus('earth')}>
                <Public fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Centre on Moon" arrow>
              <Button aria-label="Centre on Moon" onClick={() => onFocus('moon')}>
                <NightlightRound fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Centre on Artemis II" arrow>
              <Button aria-label="Centre on Artemis II" onClick={() => onFocus('spacecraft')}>
                <RocketLaunch fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>
          <Tooltip title="About" arrow>
            <IconButton
              size="small"
              aria-label="About Artemis II tracker"
              onClick={() => setIsInfoOpen(true)}
              sx={{
                color: '#e8edf2',
                border: '1px solid rgba(232, 237, 242, 0.35)',
                borderRadius: 1,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              <InfoOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>
      <Dialog open={isInfoOpen} onClose={() => setIsInfoOpen(false)}>
        <DialogTitle>About</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <p>Real-time position of NASA's <b>Artemis II</b> based on data from <a href="https://ssd.jpl.nasa.gov/horizons" target="_blank">JPL Horizons system</a>.</p>
            <p>This simulation assumes a launch date on 1-APR-2026 at 22:24:00 UTC.</p>
            <p>Controls:</p>
            <ul>
              <li>
                Left-click & drag to rotate.
              </li>
              <li>
                Right-click & drag to pan.
              </li>
            </ul>
            <p>Source code: <a href="https://github.com/ayrea/artemis2" target="_blank">https://github.com/ayrea/artemis2</a></p>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsInfoOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog >
    </>
  )
}
