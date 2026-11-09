import { createContext } from 'react';
import type { View } from 'react-native';

// A Field tells the AuthScaffold which view is the WHOLE field (label, box, error, rules) when its input takes focus, so the scaffold
// can keep the error and the rules in view as well as the box (authFieldReveal.ts). Without a scaffold above it (a Field on any other
// screen) the context is null and the Field does nothing.
export const FieldBlockContext = createContext<((block: View | null) => void) | null>(null);
