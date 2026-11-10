import { createContext } from 'react';
import type { View } from 'react-native';

// A Field tells the AuthScaffold which view is the WHOLE field (label, box, error, rules) when its input takes focus, so the scaffold
// can keep the error and the rules in view as well as the box (authFieldReveal.ts). Without a scaffold above it (a Field on any other
// screen) the context is null and the Field does nothing.
export const FieldBlockContext = createContext<((block: View | null) => void) | null>(null);

// A form-level message (FormMessage) tells the scaffold where it is and that it has appeared, so a reveal can count it: when it shows up while a field
// is focused the minimum scroll includes the message (it clears the docked button the way the rules do), and with no field focused the page goes to it.
// Without a scaffold above it the context is null and the message does nothing extra.
export interface RevealTail {
  register(view: View | null): void;
  appeared(): void;
}
export const RevealTailContext = createContext<RevealTail | null>(null);
