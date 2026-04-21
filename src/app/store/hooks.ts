import {type TypedUseSelectorHook, useDispatch, useSelector} from "react-redux";
import type { RootState, AppDispatch } from "@app/store/store.ts";

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
