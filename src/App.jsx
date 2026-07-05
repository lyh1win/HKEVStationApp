import React from 'react';
import { useTranslation } from 'react-i18next';
import { AppBar, Toolbar, Typography, CssBaseline } from '@mui/material';
import MapView from './components/MapView';

function App() {
  const { t } = useTranslation();

  return (
    <>
      <CssBaseline />
      <AppBar position="fixed" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            {t('app.title')}
          </Typography>
        </Toolbar>
      </AppBar>
      <div style={{ width: '100%', height: '100%', paddingTop: 56 }}>
        <MapView />
      </div>
    </>
  );
}

export default App;
