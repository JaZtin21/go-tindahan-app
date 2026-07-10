import React, { useEffect, useMemo, useState, createContext, useContext, useRef, useCallback } from 'react';
import { ApolloClient, InMemoryCache, from, split, HttpLink, gql } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { useGoogleLogin } from '@react-oauth/google';
import { Observable } from '@apollo/client/utilities';
import { createUploadLink } from '~/api/graphql';

// =========================================================================
// 1. EMBEDDED GRAPHQL SCHEMAS & QUERIES (Ground-Truth Contracts)
// =========================================================================

export const GOOGLE_LOGIN_MUTATION = gql`
  mutation LoginWithGoogle($input: GoogleLoginInput!) {
    loginWithGoogle(input: $input) {
      accessToken
      user {
        id
        firstName
        lastName
        email
        profilePhoto
      }
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken {
    refreshToken {
      accessToken
      user {
        id
        firstName
        lastName
        email
        profilePhoto
      }
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

// =========================================================================
// 2. CONFIGURATIONS & NETWORK ENDPOINTS
// =========================================================================

const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:8080/query';
// Dynamically converts http:// or https:// endpoints into valid ws:// or wss:// link streams
const GRAPHQL_WS_ENDPOINT = GRAPHQL_ENDPOINT.replace(/^http/, 'ws');

// Independent client layout isolated from auth headers to execute silent token swaps safely
const authLinkClient = new ApolloClient({
    link: new HttpLink({ uri: GRAPHQL_ENDPOINT, credentials: 'include' }),
    cache: new InMemoryCache(),
});

// =========================================================================
// 3. CORE STRUCTURAL TYPE DEFINITIONS
// =========================================================================

export interface UserInfo {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePhoto?: string;
}

export interface AuthContextType {
    isAuthenticated: boolean;
    userInfo: UserInfo | null;
    jwt: string;
    googleLoginTrigger: () => void;
    logoutAndClear: () => Promise<void>;
    isLoading: boolean;
}

// =========================================================================
// 4. REACT CONTEXT HOOK ENTRY LAYER
// =========================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be executed within an ApolloProviderWithAuth provider tree.');
    }
    return context;
};

// =========================================================================
// 5. PROVIDER WRAPPER ENGINE
// =========================================================================

export const ApolloProviderWithAuth = ({ children }: { children: React.ReactNode }) => {
    const [jwt, setJwt] = useState<string>('');
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const jwtRef = useRef<string>('');
    const isRefreshingRef = useRef<boolean>(false);
    const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

    // Sync state to memory pointer reference to feed instant values into closures without re-renders
    useEffect(() => {
        jwtRef.current = jwt;
    }, [jwt]);

    // Wipe local cache memories and clean browser cookie states completely
    const logoutAndClear = useCallback(async () => {
        // Prevent recursive redirection loops if already on the login screen
        if (window.location.pathname === '/login') return;

        try {
            // 📡 Fires the mutation up to your Go Backend resolver above!
            // Because Apollo includes credentials, it sends the cookie, and our interceptors attach the Bearer token header
            await authLinkClient.mutate({ mutation: LOGOUT_MUTATION });
            console.log('[ApolloProvider] Remote database cookie flush completed successfully.');
        } catch (error) {
            console.error('Remote database cookie flush failed, cleaning local memory state anyway:', error);
        }

        // 🧼 Wipes local state instantly so the UI locks up, regardless of network success
        setIsAuthenticated(false);
        setJwt('');
        jwtRef.current = '';
        setUserInfo(null);
    }, []);

    // Atomic session refresh logic loop
    const executeSilentRefreshSession = useCallback(async (): Promise<string | null> => {
        // If an active network call is already traveling down the wire, hook into that existing Promise
        if (isRefreshingRef.current && refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        isRefreshingRef.current = true;
        refreshPromiseRef.current = (async () => {
            try {
                const { data }: { data: any } = await authLinkClient.mutate({
                    mutation: REFRESH_TOKEN_MUTATION,
                });

                const refreshedData = data?.refreshToken;
                if (refreshedData?.accessToken && refreshedData?.user) {
                    setJwt(refreshedData.accessToken);
                    jwtRef.current = refreshedData.accessToken;
                    setUserInfo(refreshedData.user);
                    setIsAuthenticated(true);
                    return refreshedData.accessToken;
                }
                throw new Error('Refresh response payload returned empty identifiers.');
            } catch (err) {
                console.error('Silent token credentials validation failed:', err);
                logoutAndClear();
                return null;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
    }, [logoutAndClear]);

    // Initial hook to silently re-verify returning users on mount via HttpOnly credentials
    useEffect(() => {
        const initializeSessionState = async () => {
            try {
                await executeSilentRefreshSession();
            } catch {
                logoutAndClear();
            } finally {
                setIsLoading(false);
            }
        };
        initializeSessionState();
    }, [executeSilentRefreshSession, logoutAndClear]);

    // Configure Google Client Authentication Parameters (Authorization Code Flow)
    const googleLoginTrigger = useGoogleLogin({
        flow: 'auth-code', // 🌟 Tells Google client library to output code strings, not raw implicit profiles
        scope: 'openid profile email',
        onSuccess: async (codeResponse) => {
            if (!codeResponse.code) {
                console.error('Aborted handshake initialization: Code missing in Google context.');
                return;
            }
            setIsLoading(true);
            try {
                const { data }: { data: any } = await authLinkClient.mutate({
                    mutation: GOOGLE_LOGIN_MUTATION,
                    variables: {
                        input: {
                            code: codeResponse.code,
                        }
                    }
                });

                const authResponse = data?.loginWithGoogle;
                if (authResponse?.accessToken && authResponse?.user) {
                    setJwt(authResponse.accessToken);
                    jwtRef.current = authResponse.accessToken;
                    setUserInfo(authResponse.user);
                    setIsAuthenticated(true);
                } else {
                    throw new Error('Google OAuth exchange parameters returned malformed schemas.');
                }
            } catch (err) {
                console.error('Backend OAuth synchronization failed:', err);
                logoutAndClear();
            } finally {
                setIsLoading(false);
            }
        },
        onError: (err) => {
            console.error('Google Client verification terminated by interface:', err);
            logoutAndClear();
        }
    });

    // Memoize the compiled multi-link Apollo pipeline to survive re-renders
    const clientInstance = useMemo(() => {
        const httpUploadLink = createUploadLink({
            uri: GRAPHQL_ENDPOINT,
            credentials: 'include'
        });

        const authInterceptorLink = setContext((_, { headers }) => {
            return {
                headers: {
                    ...headers,
                    Authorization: jwtRef.current ? `Bearer ${jwtRef.current}` : '',
                }
            };
        });

        // ERROR INTERCEPTOR: Automatically refreshes token and replays requests when token expires
        // ERROR INTERCEPTOR: Automatically refreshes token and replays requests when token expires
        const centralErrorLink = onError((errorHandler: any) => {
            const { graphQLErrors, operation, forward } = errorHandler;

            if (graphQLErrors) {
                for (const err of graphQLErrors) {
                    // Catches the exact machine-readable code thrown by your Go directive middleware!
                    if (err.extensions?.code === 'TOKEN_EXPIRED') {
                        return new Observable<any>((observer) => {
                            executeSilentRefreshSession()
                                .then((freshToken) => {
                                    if (!freshToken) {
                                        observer.error(err);
                                        return;
                                    }
                                    // Overwrite the context headers on the flying request in real time
                                    operation.setContext(({ headers = {} }) => ({
                                        headers: {
                                            ...headers,
                                            Authorization: `Bearer ${freshToken}`,
                                        }
                                    }));
                                    // Re-forward and play the stalled query payload back to the Go server
                                    const retrySubscription = forward(operation).subscribe({
                                        next: observer.next.bind(observer),
                                        error: observer.error.bind(observer),
                                        complete: observer.complete.bind(observer),
                                    });
                                    return () => retrySubscription.unsubscribe();
                                })
                                .catch((error) => observer.error(error));
                        });
                    }
                }
            }
        });

        // WEBSOCKET LINK: For real-time subscriptions with full auth header parsing support
        const subscriptionWsLink = new GraphQLWsLink(
            createClient({
                url: GRAPHQL_WS_ENDPOINT,
                connectionParams: () => ({
                    headers: {
                        Authorization: jwtRef.current ? `Bearer ${jwtRef.current}` : '',
                    }
                }),
            })
        );

        // SPLIT ROUTER LINK: Directs Subscriptions to WS, Queries/Mutations to HTTP Link
        const transportSplitLink = split(
            ({ query }) => {
                const nodeDefinition = getMainDefinition(query);
                return (
                    nodeDefinition.kind === 'OperationDefinition' &&
                    nodeDefinition.operation === 'subscription'
                );
            },
            subscriptionWsLink,
            from([authInterceptorLink, centralErrorLink, httpUploadLink])
        );

        return new ApolloClient({
            link: transportSplitLink,
            cache: new InMemoryCache(),
        });
    }, [executeSilentRefreshSession]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', background: '#fafafa' }}>
                <div style={{ textAlign: 'center', color: '#555' }}>
                    <h3>Loading Secure Session...</h3>
                    <p style={{ fontSize: '14px', color: '#888' }}>Checking credentials with your Go backend and Redis server</p>
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ isAuthenticated, userInfo, jwt, googleLoginTrigger, logoutAndClear, isLoading }}>
            <ApolloProvider client={clientInstance}>
                {children}
            </ApolloProvider>
        </AuthContext.Provider>
    );
};
