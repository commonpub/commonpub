import type { FormField } from '@commonpub/schema';

/**
 * The default registration form for contests with no operator-defined
 * `registrationTemplate` (i.e. every legacy contest). Re-expresses the historical
 * fixed three fields (building / experience / team) as `FormField[]` so the
 * template-driven `ContestRegistrationForm` renders them identically and the
 * collected answers still satisfy the server's legacy closed-shape validation
 * (`contestRegistrationFieldsSchema` — the empty-template path). The option values
 * MUST match that schema's enums exactly.
 */
export const DEFAULT_REGISTRATION_TEMPLATE: FormField[] = [
  {
    key: 'building',
    label: 'What are you thinking of building?',
    type: 'textarea',
    required: false,
    // Matches the server's legacy contestRegistrationFieldsSchema cap (building
    // max 280) so the input can't exceed what the empty-template path accepts.
    maxLength: 280,
    help: 'A rough idea is fine — it helps the organizers plan.',
  },
  {
    key: 'experience',
    label: 'Your experience',
    type: 'radio',
    required: false,
    options: [
      { value: 'first', label: 'First time' },
      { value: 'some', label: 'Some experience' },
      { value: 'experienced', label: 'Experienced' },
    ],
  },
  {
    key: 'team',
    label: 'Team status',
    type: 'radio',
    required: false,
    options: [
      { value: 'solo', label: 'Solo' },
      { value: 'have', label: 'Have a team' },
      { value: 'looking', label: 'Looking for teammates' },
    ],
  },
];

/** The effective registration template for a contest: the operator's when set,
 *  else the default legacy three fields. */
export function effectiveRegistrationTemplate(template: FormField[] | null | undefined): FormField[] {
  return template && template.length > 0 ? template : DEFAULT_REGISTRATION_TEMPLATE;
}
