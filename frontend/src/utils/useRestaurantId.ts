import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '~/store';
import { setActiveRestaurant } from '~/store';

// Reads the active restaurant id from the URL (/ac5e.../bookings) so pages
// work on deep-link/refresh without first visiting the dashboard, and keeps
// the Redux slice in sync for anything that still reads it. Falls back to the
// Redux value (set from the restaurant picker) when no URL param exists.
export const useRestaurantId = (): string | null => {
    const { restaurantId } = useParams<{ restaurantId: string }>();
    const reduxId = useAppSelector((s) => s.restaurant.activeRestaurantId);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (restaurantId) {
            dispatch(setActiveRestaurant(restaurantId));
        }
    }, [restaurantId, dispatch]);

    return restaurantId ?? reduxId;
};
