import { inject, provide, type InjectionKey, type Ref } from 'vue';

/**
 * Where a signed-in person's dashboard lives. The app provides it once near the root (from the
 * session); <UiSystemState> reads it so every error and dead-end screen sends a signed-in person
 * back to their own dashboard instead of leaving them stuck. State travels through provide/inject,
 * never a module-level variable (R-WEB-04). Absent or null means nobody is signed in.
 */
const key: InjectionKey<Readonly<Ref<string | null>>> = Symbol.for('ui-home-route');

export const provideHomeRoute = (home: Readonly<Ref<string | null>>) => provide(key, home);
export const useHomeRoute = (): Readonly<Ref<string | null>> | null => inject(key, null);
