import { render, screen, waitFor } from '@testing-library/react';
import LandmarksPage from '@/components/layout/LandmarksPage';

// Helper to make a fake fetch response
function mockJsonResponse(
  json: any,
  ok = true,
  status = 200
): Partial<Response> {
  return {
    ok,
    status,
    json: async () => json,
  };
}
// Documentation for jest function used in the file
// jest.restoreAllMocks() https://jestjs.io/docs/jest-object#jestrestoreallmocks
// jest.spyOn() https://jestjs.io/docs/jest-object#jestspyonobject-methodname

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

  test('Stage 2: stays in loading state until NPS fetch resolves', async () => {
    jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(
        mockJsonResponse({
          places: [{ latitude: '40.7506', longitude: '-73.9972' }],
        }) as any
      )
      .mockImplementationOnce(() => new Promise(() => {}));
    render(<LandmarksPage />);
    expect(screen.getByText(/loading landmarks/i)).toBeInTheDocument();
  });

  test('Stage 3: shows landmarks after both fetches succeed', async () => {
    jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(
        mockJsonResponse({
          places: [{ latitude: ' 40.7506', longitude: '-73.9972' }],
        }) as any
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              id: 1,
              properties: {
                RESNAME: 'Lincoln Memorial',
                Address: '2 Lincoln Memorial Cir NW',
                City: 'Washington',
                State: 'DC',
              },
              geometry: { type: 'Point', coordinates: [-77.0502, 38.8893] },
            },
          ],
        }) as any
      );
    render(<LandmarksPage />);

    await waitFor(() => {
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(1);
      expect(items[0]).toHaveTextContent(/lincoln memorial/i);
    });
  });
});
