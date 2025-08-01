import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface SearchCriteria {
    zip: string;
    date?: string;
    time: string;
}

interface SchedulesState {
    schedules: any[];
    criteria: SearchCriteria;
}

const initialState: SchedulesState = {
    schedules: [],
    criteria: {
        zip: "",
        date: undefined,
        time: "08:00",
    },
};

const schedulesSlice = createSlice({
    name: "schedules",
    initialState,
    reducers: {
        setSearchCriteria(state, action: PayloadAction<SearchCriteria>) {
            state.criteria = action.payload; 
    },
        setSchedules(state, action: PayloadAction<any[]>) {
            state.schedules = action.payload;
        },
    },
});

export const { setSearchCriteria, setSchedules } = schedulesSlice.actions;
export default schedulesSlice.reducer;