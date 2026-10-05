import type { ChoiceOption } from './choice-option';

export function filterChoices(
  options: readonly ChoiceOption[],
  query: string,
): readonly ChoiceOption[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return options.filter((option) => {
    const text = `${option.label} ${option.detail ?? ''}`.toLocaleLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
