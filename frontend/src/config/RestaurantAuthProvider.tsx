import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { ApolloProvider } from '@apollo/client/react';
// Import the new restaurant specific tokens and client instance from apolloClient
import { restaurantClient, authLinkClient, setRestaurantAuthToken, setRestaurantRefreshHandler } from './restaurantApolloClient';
import {
    LOGIN_RESTAURANT_OWNER_MUTATION,
    REGISTER_RESTAURANT_OWNER_MUTATION,
    REFRESH_RESTAURANT_TOKEN_MUTATION,
    LOGOUT_RESTAURANT_OWNER_MUTATION,
} from '~/api/graphql';
import type { RestaurantOwner as RestaurantOwnerInfo, RestaurantStaffRole as RestaurantOwnerRole } from '~/types/restaurant';

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
    const [jwt, setJwt] = useState<string>('');

    const isRefreshingRef = useRef(false);
    const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

    // FIXED: Calls the isolated token sync setter
    useEffect(() => {
        setRestaurantAuthToken(jwt);
    }, [jwt]);

    const logout = useCallback(async () => {
        try {
            await authLinkClient.mutate({ mutation: LOGOUT_RESTAURANT_OWNER_MUTATION });
        } catch (err) {
            console.error('[RestaurantAuth] Remote logout failed, clearing local state anyway:', err);
        }
        setIsAuthenticated(false);
        setOwner(null);
        setJwt('');
        setRestaurantAuthToken('');
    }, []);

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
                    setJwt(refreshed.accessToken);
                    setRestaurantAuthToken(refreshed.accessToken);
                    setOwner(refreshed.owner);
                    setIsAuthenticated(true);
                    return refreshed.accessToken;
                }
                throw new Error('Refresh response was empty');
            } catch (err) {
                setIsAuthenticated(false);
                setOwner(null);
                setJwt('');
                setRestaurantAuthToken('');
                return null;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();
        return refreshPromiseRef.current;
    }, []);

    // FIXED: Register refresh handlers inside the restaurant slot
    useEffect(() => {
        setRestaurantRefreshHandler(executeSilentRefresh);
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
                setJwt(auth.accessToken);
                setRestaurantAuthToken(auth.accessToken);
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
                setJwt(auth.accessToken);
                setRestaurantAuthToken(auth.accessToken);
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

    if (isLoading) {
        return (
            <div className="relative min-h-screen ambient-bg flex items-center justify-center px-4 overflow-hidden">
                <div className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full bg-brand-gold/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-brand-green/20 blur-3xl" />
                <div className="glass-strong rounded-3xl px-10 py-12 text-center">
                    <div className="relative mx-auto mb-6 h-14 w-14">
                        <span className="absolute inset-0 rounded-2xl border-4 border-border-main border-t-brand-gold animate-spin" />
                        <span className="absolute inset-0 flex items-center justify-center text-brand-gold">
                            <UtensilsCrossed size={18} strokeWidth={2.2} />
                        </span>
                    </div>
                    <h3 className="m-0 text-lg font-black text-text-main">Loading Restaurant Session…</h3>
                    <p className="m-0 mt-1.5 text-sm font-bold text-text-muted">Verifying backend tokens</p>
                </div>
            </div>
        );
    }

    return (
        <RestaurantAuthContext.Provider value={{ isAuthenticated, owner, isLoading, loginError, login, register, logout }}>
            {/* Feeds your dedicated link configuration tree map smoothly */}
            <ApolloProvider client={restaurantClient}>
                {children}
            </ApolloProvider>
        </RestaurantAuthContext.Provider>
    );
};
