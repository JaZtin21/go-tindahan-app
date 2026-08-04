import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { authLinkClient, setAuthToken, setRefreshHandler } from './apolloClient'; // 👈 same singleton client your diner auth uses
import {
    LOGIN_RESTAURANT_OWNER_MUTATION,
    REGISTER_RESTAURANT_OWNER_MUTATION,
    REFRESH_RESTAURANT_TOKEN_MUTATION,
    LOGOUT_RESTAURANT_OWNER_MUTATION,
} from '~/api/graphql';

// =========================================================================
// NOTE: this assumes setAuthToken/setRefreshHandler/authLinkClient can be
// reused for the restaurant dashboard the same way they're used for diner
// auth (both attach a Bearer token to the same Apollo Link). If your
// restaurant dashboard is a genuinely separate app/bundle from the diner
// app, that's fine — they never run at the same time so there's no
// collision. If they DO run in the same app simultaneously, you'll want a
// second client instance with its own token state instead of sharing this
// one, since the backend keys these sessions completely separately
// (restaurant_auth: vs auth: in Redis) and mixing tokens on one header
// would send the wrong one to the wrong flow.
// =========================================================================

export interface RestaurantOwnerRole {
    role: 'OWNER' | 'MANAGER' | 'STAFF';
    restaurant: {
        id: string;
        name: string;
        suburb?: string;
        state?: string;
    };
}

export interface RestaurantOwnerInfo {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: string;
    restaurants: RestaurantOwnerRole[];
}

interface RestaurantAuthContextType {
    isAuthenticated: boolean;
    owner: RestaurantOwnerInfo | null;
    isLoading: boolean;
    loginError: string | null;
    login: (email: string, password: string) => Promise<void>;
    register: (firstName: string, lastName: string, email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
}

const RestaurantAuthContext = createContext<RestaurantAuthContextType | undefined>(undefined);

export const useRestaurantAuth = () => {
    const context = useContext(RestaurantAuthContext);
    if (!context) {
        throw new Error('useRestaurantAuth must be used within a RestaurantAuthProvider');
    }
    return context;
};

export const RestaurantAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [owner, setOwner] = useState<RestaurantOwnerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [loginError, setLoginError] = useState<string | null>(null);

    const isRefreshingRef = useRef(false);
    const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

    const logout = useCallback(async () => {
        try {
            await authLinkClient.mutate({ mutation: LOGOUT_RESTAURANT_OWNER_MUTATION });
        } catch (err) {
            console.error('[RestaurantAuth] Remote logout failed, clearing local state anyway:', err);
        }
        setIsAuthenticated(false);
        setOwner(null);
        setAuthToken('');
    }, []);

    // Same silent-refresh-on-mount pattern as ApolloProviderWithAuth — swaps
    // the HttpOnly refresh cookie for a fresh access token without the owner
    // needing to log in again on every page load.
    const executeSilentRefresh = useCallback(async (): Promise<string | null> => {
        if (isRefreshingRef.current && refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        isRefreshingRef.current = true;
        refreshPromiseRef.current = (async () => {
            try {
                const { data }: { data: any } = await authLinkClient.mutate({
                    mutation: REFRESH_RESTAURANT_TOKEN_MUTATION,
                });

                const refreshed = data?.refreshRestaurantToken;
                if (refreshed?.accessToken && refreshed?.owner) {
                    setAuthToken(refreshed.accessToken);
                    setOwner(refreshed.owner);
                    setIsAuthenticated(true);
                    return refreshed.accessToken;
                }
                throw new Error('Refresh response was empty');
            } catch (err) {
                // Expected on first visit / logged-out state — not an error worth logging loudly.
                setIsAuthenticated(false);
                setOwner(null);
                return null;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
    }, []);

    useEffect(() => {
        setRefreshHandler(executeSilentRefresh);
    }, [executeSilentRefresh]);

    useEffect(() => {
        (async () => {
            await executeSilentRefresh();
            setIsLoading(false);
        })();
    }, [executeSilentRefresh]);

    const login = useCallback(async (email: string, password: string) => {
        setLoginError(null);
        setIsLoading(true);
        try {
            const { data }: { data: any } = await authLinkClient.mutate({
                mutation: LOGIN_RESTAURANT_OWNER_MUTATION,
                variables: { input: { email, password } },
            });

            const auth = data?.loginRestaurantOwner;
            if (auth?.accessToken && auth?.owner) {
                setAuthToken(auth.accessToken);
                setOwner(auth.owner);
                setIsAuthenticated(true);
            } else {
                throw new Error('Login response was empty');
            }
        } catch (err: any) {
            setLoginError(err?.message ?? 'Invalid email or password');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const register = useCallback(async (firstName: string, lastName: string, email: string, password: string) => {
        setLoginError(null);
        setIsLoading(true);
        try {
            const { data }: { data: any } = await authLinkClient.mutate({
                mutation: REGISTER_RESTAURANT_OWNER_MUTATION,
                variables: { input: { firstName, lastName, email, password } },
            });

            const auth = data?.registerRestaurantOwner;
            if (auth?.accessToken && auth?.owner) {
                setAuthToken(auth.accessToken);
                setOwner(auth.owner);
                setIsAuthenticated(true);
            } else {
                throw new Error('Registration response was empty');
            }
        } catch (err: any) {
            setLoginError(err?.message ?? 'Could not create account');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, []);

    return (
        <RestaurantAuthContext.Provider value={{ isAuthenticated, owner, isLoading, loginError, login, register, logout }}>
            {children}
        </RestaurantAuthContext.Provider>
    );
};