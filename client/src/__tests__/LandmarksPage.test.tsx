import { render, screen } from '@testing-library/react';
import LandmarksPage from '@/components/layout/LandmarksPage';

// Helper to make a fake fetch response
// function mockJsonResponse(
//   json: any,
//   ok = true,
//   status = 200
// ): Partial<Response> {
//   return {
//     ok,
//     status,
//     json: async () => json,
//   };
// }

describe('LandmarksPage', () => {
  afterEach(() => {
    jest.restoreAllMocks(); // reset fetch mocks after each test
  });
  test('Stage 1: shows loading state immediately after render', () => {
    jest
      .spyOn(global, 'fetch' as any)
      .mockImplementation(() => new Promise(() => {}));

    render(<LandmarksPage />);
    expect(screen.getByText(/loading landmarks/i)).toBeInTheDocument();
  });
});
