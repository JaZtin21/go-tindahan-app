// tinybase/TinyBaseProvider.tsx
import React, { type ReactNode } from 'react';
import { Provider, useCreateStore, useCreatePersister } from 'tinybase/ui-react';
import { createIndexedDbPersister } from 'tinybase/persisters/persister-indexed-db';
import { createShopStore } from '~/store';

export function TinyBaseProvider({ children }: { children: ReactNode }) {
    const store = useCreateStore(createShopStore);

    useCreatePersister(
        store,
        (store) => createIndexedDbPersister(store, 'shopapp_offline'),
        [],
        async (persister) => {
            await persister.load(); // pull in whatever was saved locally last session
            await persister.startAutoSave(); // every write from here on auto-persists to IndexedDB
        }
    );

    return <Provider store={store}>{children}</Provider>;
}