import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', 
    },
    secondary: {
      main: '#9c27b0', 
    },
    background: {
      default: '#f4f6f8', 
      paper: '#ffffff',  
    },
  },
  typography: {
    fontFamily: 'Roboto, sans-serif',
    h4: {
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        contained: {
          boxShadow: '0 3px 5px 2px rgba(0, 0, 0, .1)',
        },
      },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                borderRadius: '8px',
                boxShadow: '0px 4px 12px rgba(0,0,0,0.08)',
            }
        }
    }
  },
});

export default theme;