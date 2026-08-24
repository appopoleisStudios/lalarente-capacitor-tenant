import { summarizeVendorRatings } from '../profileApi';

jest.mock('@/src/lib/supabase', () => ({
  supabase: {},
}));

jest.mock('expo-file-system/legacy', () => ({}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn(),
}));

describe('summarizeVendorRatings', () => {
  it('returns an honest empty state before the first review', () => {
    expect(summarizeVendorRatings([])).toEqual({
      rating: null,
      total_reviews: 0,
    });
  });

  it('calculates the live average and review count', () => {
    expect(
      summarizeVendorRatings([
        { overall_rating: 5 },
        { overall_rating: 3.5 },
        { overall_rating: 4 },
      ])
    ).toEqual({
      rating: 4.17,
      total_reviews: 3,
    });
  });

  it('ignores null or non-numeric rating values defensively', () => {
    expect(
      summarizeVendorRatings([
        { overall_rating: null },
        { overall_rating: Number.NaN },
        { overall_rating: 4.5 },
      ])
    ).toEqual({
      rating: 4.5,
      total_reviews: 1,
    });
  });
});
