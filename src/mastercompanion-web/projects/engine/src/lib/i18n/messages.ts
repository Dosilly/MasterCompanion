import english from './en.json';
import polish from './pl.json';

export type UiMessages = typeof english;

// Keep presentation text separate from technical errors and persisted campaign content.
export const uiMessages: UiMessages = polish;
export const uiLocale = 'pl';
