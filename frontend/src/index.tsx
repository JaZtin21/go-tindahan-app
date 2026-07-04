import { createRoot } from 'react-dom/client';
import { App } from './components/App'; // This will now find the App export perfectly!
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ApolloProviderWithAuth } from './config/ApolloProviderWithAuth';
import React from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import './style.css'
import { Provider } from 'react-redux';
import { store } from './store/store';

const container = document.getElementById('root') as HTMLDivElement;
const root = createRoot(container);

root.render(
    <React.StrictMode>
        <GoogleOAuthProvider clientId="451238265730-e68jdrr0840cbjo4utfaf7f12c55hd4q.apps.googleusercontent.com">
            <ThemeProvider>
                <ApolloProviderWithAuth>
                    <Provider store={store}>
                        <App />
                    </Provider>
                </ApolloProviderWithAuth>
            </ThemeProvider>
        </GoogleOAuthProvider>
    </React.StrictMode>
);
