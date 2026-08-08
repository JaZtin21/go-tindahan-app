import { ApolloClient, InMemoryCache, ApolloLink, HttpLink, Observable } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';
import { createUploadLink } from '~/api/graphql';

const GRAPHQL_ENDPOINT = import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:8080/query';
const GRAPHQL_WS_ENDPOINT = GRAPHQL_ENDPOINT.replace(/^http/, 'ws');

let currentToken = '';
let refreshHandler: (() => Promise<string | null>) | null = null;

let currentRestaurantToken = '';
let restaurantRefreshHandler: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string) {
    currentToken = token;
}
export function setRefreshHandler(fn: () => Promise<string | null>) {
    refreshHandler = fn;
}

export function setRestaurantAuthToken(token: string) {
    console.log('============= STATE UPDATE =============');
    console.log('[DEBUG-APOLLO] setRestaurantAuthToken triggered. New token value:', token ? `${token.substring(0, 15)}...` : 'EMPTY');
    currentRestaurantToken = token;
}

export function setRestaurantRefreshHandler(fn: () => Promise<string | null>) {
    restaurantRefreshHandler = fn;
}

export const authLinkClient = new ApolloClient({
    link: new HttpLink({ uri: GRAPHQL_ENDPOINT, credentials: 'include' }),
    cache: new InMemoryCache(),
});

// -------------------------------------------------------------------------
// Original Application Link Chain Configs
// -------------------------------------------------------------------------
const httpUploadLink = createUploadLink({
    uri: GRAPHQL_ENDPOINT,
    credentials: 'include',
});

const authInterceptorLink = new SetContextLink((prevContext) => ({
    headers: {
        ...prevContext.headers,
        Authorization: currentToken ? `Bearer ${currentToken}` : '',
    },
}));

const centralErrorLink = new ErrorLink(({ error, operation, forward }) => {
    let shouldRetry = false;
    if (CombinedGraphQLErrors.is(error)) {
        for (const err of error.errors) {
            if (err.extensions?.code === 'TOKEN_EXPIRED' || err.extensions?.code === 'UNAUTHENTICATED') {
                shouldRetry = true;
            }
        }
    }
    if (!shouldRetry || !refreshHandler) return;
    const hasRetried = operation.getContext().hasRetried || false;
    if (hasRetried) return;

    return new Observable<any>((observer) => {
        refreshHandler!()
            .then((freshToken) => {
                if (!freshToken) { observer.error(error); return; }
                operation.setContext(({ headers = {} }: any) => ({
                    headers: { ...headers, Authorization: `Bearer ${freshToken}` },
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
                Authorization: currentToken ? `Bearer ${currentToken}` : '',
            },
        }),
    })
);

const transportSplitLink = ApolloLink.split(
    ({ query }) => {
        const nodeDefinition = getMainDefinition(query);
        return nodeDefinition.kind === 'OperationDefinition' && nodeDefinition.operation === 'subscription';
    },
    subscriptionWsLink,
    ApolloLink.from([centralErrorLink, authInterceptorLink, httpUploadLink])
);

const client = new ApolloClient({
    link: transportSplitLink,
    cache: new InMemoryCache(),
});

// -------------------------------------------------------------------------
// 2. ISOLATED RESTAURANT CLIENT CONFIGURATION WITH VERBOSE LOGGING
// -------------------------------------------------------------------------
const restaurantAuthInterceptorLink = new SetContextLink((prevContext, operation) => {
    console.log('============= OPERATION EXECUTION =============');
    console.log('[DEBUG-APOLLO] Interceptor processing operation:', operation.operationName);
    console.log('[DEBUG-APOLLO] Reading from global variable string "currentRestaurantToken":', currentRestaurantToken ? `${currentRestaurantToken.substring(0, 15)}...` : 'EMPTY');

    const computedHeaders = {
        ...prevContext.headers,
        Authorization: currentRestaurantToken ? `Bearer ${currentRestaurantToken}` : '',
    };

    console.log('[DEBUG-APOLLO] Compiled outgoing header set:', JSON.stringify({
        ...computedHeaders,
        Authorization: computedHeaders.Authorization ? `Bearer ${computedHeaders.Authorization.substring(7, 22)}...` : 'MISSING_OR_EMPTY'
    }, null, 2));

    return { headers: computedHeaders };
});

const restaurantErrorLink = new ErrorLink(({ error, operation, forward }) => {
    console.log('============= SERVER RESPONSE RECEIVED =============');
    console.log('[DEBUG-APOLLO] Processing incoming result for operation:', operation.operationName);

    if (error) {
        console.error('[DEBUG-APOLLO] Network or execution error detected:', error);
    }

    if (CombinedGraphQLErrors.is(error)) {
        console.error('[DEBUG-APOLLO] GraphQL Specific Errors array returned from Go backend:');
        error.errors.forEach((err, idx) => {
            console.error(`  -> Error [${idx}]: Message="${err.message}" | Code="${err.extensions?.code}" | Path="${err.path}"`);
        });

        let shouldRetry = false;
        for (const err of error.errors) {
            if (err.extensions?.code === 'TOKEN_EXPIRED' || err.extensions?.code === 'UNAUTHENTICATED') {
                shouldRetry = true;
            }
        }

        if (shouldRetry && restaurantRefreshHandler) {
            const hasRetried = operation.getContext().hasRetried || false;
            if (hasRetried) {
                console.warn('[DEBUG-APOLLO] Already attempted token automatic recovery retry loop once. Aborting to avoid cyclical loops.');
                return;
            }

            console.log('[DEBUG-APOLLO] Triggering silent background recovery exchange pipeline via restaurantRefreshHandler...');
            return new Observable<any>((observer) => {
                restaurantRefreshHandler!()
                    .then((freshToken) => {
                        console.log('[DEBUG-APOLLO] Background recovery returned new active token:', freshToken ? `${freshToken.substring(0, 15)}...` : 'EMPTY_FAIL');
                        if (!freshToken) { observer.error(error); return; }

                        operation.setContext(({ headers = {} }: any) => ({
                            headers: { ...headers, Authorization: `Bearer ${freshToken}` },
                            hasRetried: true,
                        }));

                        console.log('[DEBUG-APOLLO] Resubmitting original mutated request with fresh signature parameters...');
                        const retrySubscription = forward(operation).subscribe({
                            next: observer.next.bind(observer),
                            error: observer.error.bind(observer),
                            complete: observer.complete.bind(observer),
                        });
                        return () => retrySubscription.unsubscribe();
                    })
                    .catch((err) => {
                        console.error('[DEBUG-APOLLO] Background token exchange completely failed:', err);
                        observer.error(err);
                    });
            });
        }
    }
});

const restaurantTransportSplitLink = ApolloLink.split(
    ({ query }) => {
        const nodeDefinition = getMainDefinition(query);
        return nodeDefinition.kind === 'OperationDefinition' && nodeDefinition.operation === 'subscription';
    },
    subscriptionWsLink,
    ApolloLink.from([restaurantErrorLink, restaurantAuthInterceptorLink, httpUploadLink])
);

export const restaurantClient = new ApolloClient({
    link: restaurantTransportSplitLink,
    cache: new InMemoryCache(),
    // The restaurant dashboard keeps its own Redux state per page — Apollo
    // should never serve stale cached data or write results to its cache
    // (mutation cache-writes used to re-emit stale query results and clobber
    // the Redux slices). Always hit the network, store nothing.
    defaultOptions: {
        watchQuery: { fetchPolicy: 'no-cache' },
        query: { fetchPolicy: 'no-cache' },
    },
});

export default client;
