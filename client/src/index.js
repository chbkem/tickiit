import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={process.env.REACT_APP_CLERK_PUBLISHABLE_KEY}
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        variables: {
          colorPrimary: 'hsl(139.6552 52.7273% 43.1373%)',
          colorBackground: 'hsl(240 9.0909% 97.8431%)',
          colorText: 'hsl(0 0% 20%)',
          colorInputBackground: 'hsl(240 9.0909% 97.8431%)',
          colorInputText: 'hsl(0 0% 20%)',
          colorInputBorder: 'hsl(0 0% 83.1373%)',
          borderRadius: '0rem',
        },
      }}
    >
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
          },
        }}
      />
    </ClerkProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
