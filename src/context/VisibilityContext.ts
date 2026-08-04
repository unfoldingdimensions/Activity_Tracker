import { createContext, useContext } from 'react';

export interface VisibilityContextType {
    visible: boolean;
}

export const VisibilityContext = createContext<VisibilityContextType>({ visible: true });

export function useVisibility() {
    return useContext(VisibilityContext);
}
