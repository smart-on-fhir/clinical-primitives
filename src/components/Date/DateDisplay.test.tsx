// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DateDisplay } from './DateDisplay';

afterEach(cleanup);

// DateDisplay is what the condition, immunization and medication lists use.
describe('DateDisplay', () => {
  it.each([
    ['2024-01-01', 'Jan 1, 2024'],
    ['2024-03',    'Mar 2024'],
    ['2019',       '2019']
  ])('shows %s as %s', (date, text) => {
    expect(render(<DateDisplay date={date} />).container.textContent).toBe(text);
  });
});
