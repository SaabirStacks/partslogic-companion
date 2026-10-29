import { refusalText } from '../start-refusal';

describe('refusalText', () => {
  it('names who is counting a bin someone else has', () => {
    expect(refusalText('Sam is counting that bin')).toEqual({
      title: 'Sam is counting that bin',
      body: 'Choose another bin. It frees up once they finish, or after 2 hours without a scan.',
      holder: 'Sam',
    });
  });

  it('explains a finished run, and a bin that isn’t on the list', () => {
    expect(refusalText('That stock take was finished')).toMatchObject({ body: 'Nobody can start another bin of it.', holder: null });
    expect(refusalText('That opening stock was finished').holder).toBeNull();
    expect(refusalText('That bin isn’t on this stock take’s list'.replace(/’/g, "'")).body).toBe('Count it as a Stock count instead.');
  });

  it('passes anything else on as it is', () => {
    expect(refusalText('A stock take is in progress for this location')).toEqual({
      title: 'A stock take is in progress for this location',
      body: 'Nothing was started. Choose another bin, or try again.',
      holder: null,
    });
    expect(refusalText('  ').title).toBe('PartsLogic didn’t open the count');
  });
});
