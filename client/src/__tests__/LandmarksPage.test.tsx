// src/__tests__/LandmarksPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Adjust if your path differs:
import LandmarksPage from '@/components/layout/LandmarksPage';

/**
 * Minimal Feature factory for our tests
 */
function makeFeature(
  id: string | number,
  props: Partial<{
    RESNAME: string;
    Address: string;
    City: string;
    State: string;
  }>
) {
  return {
    type: 'Feature',
    id,
    geometry: null,
    properties: {
      RESNAME: '',
      Address: '',
      City: '',
      State: '',
      ...props,
    },
  } as any;
}

/**
 * Create a Response-like object for mocking fetch results
 */
function mockResponse(
  body: any,
  {
    ok = true,
    status = 200,
    contentType = 'application/json',
  }: { ok?: boolean; status?: number; contentType?: string } = {}
): Response {
  const res: Partial<Response> = {
    ok,
    status,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'content-type' ? contentType : null,
    } as any,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
  return res as Response;
}

/**
 * Deferred/pending promise helper to control async timing
 */
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LandmarksPage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  test('Stage 1: shows a loading state immediately after render, then replaces it with data', async () => {
    const d = deferred<Response>();

    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      .mockReturnValueOnce(d.promise as any);

    render(<LandmarksPage />);

    // Loading appears immediately
    expect(screen.getByText(/loading landmarks/i)).toBeInTheDocument();

    // Resolve with valid FeatureCollection
    const fc = {
      type: 'FeatureCollection',
      features: [
        makeFeature(1, {
          RESNAME: 'Old Post Office',
          Address: '110 Market St',
          City: 'Philadelphia',
          State: 'PA',
        }),
      ],
    };
    d.resolve(mockResponse(fc));

    // Item renders, loading disappears
    expect(await screen.findByText('Old Post Office')).toBeInTheDocument();
    expect(screen.queryByText(/loading landmarks/i)).not.toBeInTheDocument();

    // Sanity-check URL uses default ZIP 10001
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/landmarks\/by-zip\?zip=10001/)
    );
  });

  test('Stage 2: generate a helpful error when the server returns non-JSON content', async () => {
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(
      mockResponse('<html>oops</html>', {
        ok: true,
        status: 200,
        contentType: 'text/html',
      })
    );

    render(<LandmarksPage />);

    // Expect our custom parsing error
    const msg = await screen.findByText(
      /expected json but got 200 text\/html/i
    );
    expect(msg).toBeInTheDocument();
    expect(screen.queryByText(/loading landmarks/i)).not.toBeInTheDocument();
  });

  test('Stage 3: shows API-provided error messages when status is not ok', async () => {
    jest
      .spyOn(global as any, 'fetch')
      .mockResolvedValueOnce(
        mockResponse({ error: 'Something broke' }, { ok: false, status: 500 })
      );

    render(<LandmarksPage />);

    expect(
      await screen.findByText(/error: something broke/i)
    ).toBeInTheDocument();
  });

  test('Stage 4: renders a FeatureCollection payload', async () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        makeFeature(1, {
          RESNAME: 'Grand Museum',
          Address: '123 Main St',
          City: 'Metropolis',
          State: 'NY',
        }),
        makeFeature(2, {
          RESNAME: 'Historic Theater',
          Address: '456 Elm St',
          City: 'Metropolis',
          State: 'NY',
        }),
      ],
    };

    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(fc));

    render(<LandmarksPage />);

    expect(await screen.findByText('Grand Museum')).toBeInTheDocument();
    expect(screen.getByText('Historic Theater')).toBeInTheDocument();
    expect(screen.getByText(/showing 2 of 2/i)).toBeInTheDocument();
  });

  test('Stage 5: also accepts a raw array of Feature items', async () => {
    const arr = [
      makeFeature(1, {
        RESNAME: 'City Hall',
        Address: '1 Plaza',
        City: 'Gotham',
        State: 'NJ',
      }),
    ];

    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(arr));

    render(<LandmarksPage />);

    expect(await screen.findByText('City Hall')).toBeInTheDocument();
    expect(screen.getByText(/showing 1 of 1/i)).toBeInTheDocument();
  });

  test('Stage 6: client-side filtering by name or address updates the visible count', async () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        makeFeature(1, {
          RESNAME: 'Railway Museum',
          Address: '10 Track Ave',
          City: 'Albany',
          State: 'NY',
        }),
        makeFeature(2, {
          RESNAME: 'Liberty Monument',
          Address: '1 Harbor Way',
          City: 'New York',
          State: 'NY',
        }),
        makeFeature(3, {
          RESNAME: 'Central Library',
          Address: '5 Book St',
          City: 'Albany',
          State: 'NY',
        }),
      ],
    };

    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(fc));

    render(<LandmarksPage />);

    expect(await screen.findByText('Railway Museum')).toBeInTheDocument();
    expect(screen.getByText('Liberty Monument')).toBeInTheDocument();
    expect(screen.getByText('Central Library')).toBeInTheDocument();
    expect(screen.getByText(/showing 3 of 3/i)).toBeInTheDocument();

    // Filter by "Albany" (matches City in address for two entries)
    const filterBox = screen.getByPlaceholderText(/filter by name or address/i);
    await userEvent.type(filterBox, 'albany');

    await waitFor(() =>
      expect(screen.getByText(/showing 2 of 3/i)).toBeInTheDocument()
    );
    expect(screen.getByText('Railway Museum')).toBeInTheDocument();
    expect(screen.getByText('Central Library')).toBeInTheDocument();
    expect(screen.queryByText('Liberty Monument')).not.toBeInTheDocument();
  });

  test('Stage 7: invalid ZIP input shows a validation error and does not crash', async () => {
    // Initial load succeeds
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(
      mockResponse({
        type: 'FeatureCollection',
        features: [makeFeature(1, { RESNAME: 'Ok Place' })],
      })
    );

    render(<LandmarksPage />);

    expect(await screen.findByText('Ok Place')).toBeInTheDocument();

    // Enter invalid ZIP and click
    const zipBox = screen.getByPlaceholderText(/zip/i);
    await userEvent.clear(zipBox);
    await userEvent.type(zipBox, 'abc');
    await userEvent.click(
      screen.getByRole('button', { name: /search by zip/i })
    );

    // Validation error appears
    expect(
      await screen.findByText(/enter a valid us zip/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/loading landmarks/i)).not.toBeInTheDocument();
  });

  test('Stage 8: error clears and list re-renders on a successful retry (via re-mount)', async () => {
    const fetchSpy = jest
      .spyOn(global as any, 'fetch')
      // First mount: bad content-type (HTML)
      .mockResolvedValueOnce(
        mockResponse('<html>oops</html>', {
          ok: true,
          status: 200,
          contentType: 'text/html',
        })
      )
      // Second mount: valid FeatureCollection
      .mockResolvedValueOnce(
        mockResponse({
          type: 'FeatureCollection',
          features: [makeFeature(42, { RESNAME: 'Recovered Site' })],
        })
      );

    // First render -> error
    const first = render(<LandmarksPage />);
    expect(
      await screen.findByText(/expected json but got 200 text\/html/i)
    ).toBeInTheDocument();

    // Unmount and re-render (simulates user revisiting the page)
    first.unmount();

    // Second render -> success path
    render(<LandmarksPage />);
    expect(await screen.findByText('Recovered Site')).toBeInTheDocument();

    // We made two fetch calls overall
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  test('Pagin A1: shows only the first 10 items and reveals Load more', async () => {
    // Create 25 features to exceed default INITIAL_PAGE_SIZE (10)
    const fc = {
      type: 'FeatureCollection',
      features: Array.from({ length: 25 }, (_, i) =>
        makeFeature(i + 1, {
          RESNAME: `Place ${i + 1}`,
          Address: `${i + 1} Main St`,
          City: 'Metropolis',
          State: 'NY',
        })
      ),
    };
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(fc));

    render(<LandmarksPage />);

    //wait for first item to ensure render finished
    expect(await screen.findByText('Place 1')).toBeInTheDocument();

    //only the first ten should be visible initially
    expect(screen.getByText(/showing 10 of 25/i)).toBeInTheDocument();
    expect(screen.getByText('Place 10')).toBeInTheDocument();
    expect(screen.queryByText('Place 11')).not.toBeInTheDocument();

    //"Load more" button is present and shows how many will load
    const loadMoreBtn = screen.getByRole('button', { name: /load 10 more/i });
    expect(loadMoreBtn).toBeInTheDocument();
  });

  test('Pagin A2: clicking Load more reveals the next page and updates the counter', async () => {
    const fc = {
      type: 'FeatureCollection',
      features: Array.from({ length: 25 }, (_, i) =>
        makeFeature(i + 1, { RESNAME: `Place ${i + 1}` })
      ),
    };
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(fc));

    render(<LandmarksPage />);

    // Initial page
    expect(await screen.findByText('Place 1')).toBeInTheDocument();
    expect(screen.getByText(/showing 10 of 25/i)).toBeInTheDocument();

    // Load next 10
    await userEvent.click(
      screen.getByRole('button', { name: /load 10 more/i })
    );

    // Now 20 visible
    expect(screen.getByText(/showing 20 of 25/i)).toBeInTheDocument();
    expect(screen.getByText('Place 20')).toBeInTheDocument();
    expect(screen.queryByText('Place 21')).not.toBeInTheDocument();

    // Load the last 5
    await userEvent.click(screen.getByRole('button', { name: /load 5 more/i }));
    expect(screen.getByText(/showing 25 of 25/i)).toBeInTheDocument();
    expect(screen.getByText('Place 25')).toBeInTheDocument();

    // Button disappears when nothing left to load
    expect(
      screen.queryByRole('button', { name: /load/i })
    ).not.toBeInTheDocument();
  });

  test('Paging A3: changing page size resets visibleCount and text', async () => {
    const fc = {
      type: 'FeatureCollection',
      features: Array.from({ length: 30 }, (_, i) =>
        makeFeature(i + 1, { RESNAME: `Site ${i + 1}` })
      ),
    };
    jest.spyOn(global as any, 'fetch').mockResolvedValueOnce(mockResponse(fc));

    render(<LandmarksPage />);

    expect(await screen.findByText('Site 1')).toBeInTheDocument();
    expect(screen.getByText(/showing 10 of 30/i)).toBeInTheDocument();

    const pageSizeSelect = screen.getByRole('combobox', { name: /page size/i });
    await userEvent.selectOptions(pageSizeSelect, '20');

    // After changing page size, visible resets to new size
    expect(screen.getByText(/showing 20 of 30/i)).toBeInTheDocument();
    expect(screen.getByText('Site 20')).toBeInTheDocument();
    expect(screen.queryByText('Site 21')).not.toBeInTheDocument();
  });
});
