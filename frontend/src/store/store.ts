import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';
import myShopsSlice from './myShopsSlice';
import inventorySlice from './inventorySlice';
import appSubscriptionReducer from './appSubscription';
import restaurantReducer from './restaurantSlice';
import bookingsReducer from './bookingsSlice';
import tablesReducer from './tablesSlice';
import settingsReducer from './settingsSlice';
import waitlistReducer from './waitlistSlice';
import callLogsReducer from './callLogsSlice';
import menuReducer from './menuSlice';

export const store = configureStore({
    reducer: {
        ui: uiReducer,
        myShops: myShopsSlice,
        inventory: inventorySlice,
        appSubscription: appSubscriptionReducer,
        restaurant: restaurantReducer,
        bookings: bookingsReducer,
        tables: tablesReducer,
        settings: settingsReducer,
        waitlist: waitlistReducer,
        callLogs: callLogsReducer,
        menu: menuReducer
    },
});

// Clean type safety exports for your components
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
