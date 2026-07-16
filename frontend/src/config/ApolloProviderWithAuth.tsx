import React, { useEffect, useMemo, useState, createContext, useContext, useRef, useCallback } from 'react';
import { ApolloClient, InMemoryCache, ApolloLink, HttpLink, gql, Observable } from '@apollo/client';
import { ApolloProvider } from '@apollo/client/react';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { useGoogleLogin } from '@react-oauth/google';
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
const GRAPHQL_WS_ENDPOINT = GRAPHQL_ENDPOINT.replace(/^http/, 'ws');

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

    useEffect(() => {
        jwtRef.current = jwt;
    }, [jwt]);

    const logoutAndClear = useCallback(async () => {
        if (window.location.pathname === '/login') return;

        try {
            await authLinkClient.mutate({ mutation: LOGOUT_MUTATION });
            console.log('[ApolloProvider] Remote session cookie cleared successfully.');
        } catch (error) {
            console.error('[ApolloProvider] Remote logout failed, clearing local state anyway:', error);
        }

        setIsAuthenticated(false);
        setJwt('');
        jwtRef.current = '';
        setUserInfo(null);
    }, []);

    const executeSilentRefreshSession = useCallback(async (): Promise<string | null> => {
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
                console.error('[ApolloProvider] Silent token refresh failed:', err);
                logoutAndClear();
                return null;
            } finally {
                isRefreshingRef.current = false;
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
    }, [logoutAndClear]);

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

    const googleLoginTrigger = useGoogleLogin({
        flow: 'auth-code',
        scope: 'openid profile email',
        onSuccess: async (codeResponse) => {
            if (!codeResponse.code) {
                console.error('[ApolloProvider] Google login aborted: no code returned.');
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
                    throw new Error('Google OAuth exchange returned a malformed response.');
                }
            } catch (err) {
                console.error('[ApolloProvider] Backend OAuth exchange failed:', err);
                logoutAndClear();
            } finally {
                setIsLoading(false);
            }
        },
        onError: (err) => {
            console.error('[ApolloProvider] Google client login failed:', err);
            logoutAndClear();
        }
    });

    const clientInstance = useMemo(() => {
        const httpUploadLink = createUploadLink({
            uri: GRAPHQL_ENDPOINT,
            credentials: 'include'
        });

        // v4: SetContextLink takes (prevContext, operation) — args flipped
        // vs. the old deprecated setContext((operation, prevContext) => ...).
        const authInterceptorLink = new SetContextLink((prevContext) => ({
            headers: {
                ...prevContext.headers,
                Authorization: jwtRef.current ? `Bearer ${jwtRef.current}` : '',
            }
        }));

        // v4: ErrorLink class replaces the deprecated onError() function.
        // Handler still receives { error, operation, forward }; `error` is
        // narrowed via CombinedGraphQLErrors.is(error) to get `.errors`.
        const centralErrorLink = new ErrorLink(({ error, operation, forward }) => {
            let shouldRetry = false;

            if (CombinedGraphQLErrors.is(error)) {
                for (const err of error.errors) {
                    console.log('[ApolloProvider] GraphQLError intercepted:', err);
                    if (
                        err.extensions?.code === 'TOKEN_EXPIRED' ||
                        err.extensions?.code === 'UNAUTHENTICATED'
                    ) {
                        shouldRetry = true;
                    }
                }
            }

            if (!shouldRetry) return;

            const hasRetried = operation.getContext().hasRetried || false;
            if (hasRetried) {
                console.warn('[ApolloProvider] Already retried this operation once, not retrying again.');
                return;
            }

            return new Observable<any>((observer) => {
                executeSilentRefreshSession()
                    .then((freshToken) => {
                        if (!freshToken) {
                            observer.error(error);
                            return;
                        }
                        operation.setContext(({ headers = {} }: any) => ({
                            headers: {
                                ...headers,
                                Authorization: `Bearer ${freshToken}`,
                            },
                            hasRetried: true,
                        }));
                        const retrySubscription = forward(operation).subscribe({
                            next: observer.next.bind(observer),
                            error: observer.error.bind(observer),
                            complete: observer.complete.bind(observer),
                        });
                        return () => retrySubscription.unsubscribe();
                    })
                    .catch((err) => observer.error(err));
            });
        });

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

        // v4: ApolloLink.split(...) and ApolloLink.from([...]) are static
        // methods on ApolloLink, replacing the deprecated standalone
        // `split` and `from` exports.
        const transportSplitLink = ApolloLink.split(
            ({ query }) => {
                const nodeDefinition = getMainDefinition(query);
                return (
                    nodeDefinition.kind === 'OperationDefinition' &&
                    nodeDefinition.operation === 'subscription'
                );
            },
            subscriptionWsLink,
            ApolloLink.from([centralErrorLink, authInterceptorLink, httpUploadLink])
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