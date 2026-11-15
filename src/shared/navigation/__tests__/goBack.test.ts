import { goBack } from '../goBack';

const makeRouter = (canGoBack: boolean) => ({
  back: jest.fn(),
  canGoBack: jest.fn(() => canGoBack),
  navigate: jest.fn(),
});

it('returns to the previous screen when there is one', () => {
  const r = makeRouter(true);
  goBack(r as any, '/(owner)/dashboard');
  expect(r.back).toHaveBeenCalled();
  expect(r.navigate).not.toHaveBeenCalled();
});

it('goes to the fallback only when there is no history', () => {
  const r = makeRouter(false);
  goBack(r as any, '/(tenant)/lease');
  expect(r.back).not.toHaveBeenCalled();
  expect(r.navigate).toHaveBeenCalledWith('/(tenant)/lease');
});
