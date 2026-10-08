// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EventFeed } from '.';

afterEach(cleanup);

describe('EventFeed dates', () => {
  it('groups a date-only event under its own day, with no time of day', async () => {
    const immunization = {
      resourceType: 'Immunization',
      id: 'i1',
      status: 'completed',
      vaccineCode: { text: 'Influenza' },
      occurrenceDateTime: '2024-01-01'
    };

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<EventFeed resources={{ Immunization: [immunization] }} defaultRange="All" />));
    });

    // In local time that UTC midnight is 19:00 on Dec 31, which is where the
    // event used to land.
    expect(container.textContent).toContain('Jan 1, 2024');
    expect(container.textContent).not.toContain('Dec 31');
    expect(container.textContent).not.toContain('19:00');
  });
});
