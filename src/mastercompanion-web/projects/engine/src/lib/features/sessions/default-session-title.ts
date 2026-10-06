/** Session names use the user's local calendar date, independently of game time. */
export function defaultSessionTitle(date: Date, template: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return template.replace('{date}', `${year}-${month}-${day}`);
}
