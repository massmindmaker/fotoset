/**
 * Example Component Test for persona-app.tsx
 *
 * This is a comprehensive example showing how to test the main PersonaApp component.
 * Copy to persona-app.test.tsx and expand with more test cases.
 *
 * @requires @testing-library/react
 * @requires @testing-library/user-event
 * @requires @testing-library/jest-dom
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonaApp from '../persona-app';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

// Mock API calls
global.fetch = jest.fn();

describe('PersonaApp Component', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
  });

  describe('Onboarding Flow', () => {
    it('should show onboarding for first-time users', () => {
      // Arrange: No onboarding completion flag
      localStorage.removeItem('pinglass_onboarding_complete');

      // Act: Render component
      render(<PersonaApp />);

      // Assert: Onboarding visible
      expect(screen.getByTestId('onboarding-container')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /начать/i })).toBeInTheDocument();
    });

    it('should skip onboarding for returning users', () => {
      // Arrange: Set onboarding complete flag
      localStorage.setItem('pinglass_onboarding_complete', 'true');

      // Act: Render component
      render(<PersonaApp />);

      // Assert: Dashboard visible, onboarding hidden
      expect(screen.queryByTestId('onboarding-container')).not.toBeInTheDocument();
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    it('should complete 3-step onboarding carousel', async () => {
      // Arrange
      const user = userEvent.setup();
      localStorage.removeItem('pinglass_onboarding_complete');

      // Act: Render and navigate through steps
      render(<PersonaApp />);

      // Step 1: Initial screen
      expect(screen.getByText(/Шаг 1/i)).toBeInTheDocument();

      // Step 2: Click next
      await user.click(screen.getByTestId('carousel-next'));
      expect(screen.getByText(/Шаг 2/i)).toBeInTheDocument();

      // Step 3: Click next again
      await user.click(screen.getByTestId('carousel-next'));
      expect(screen.getByText(/Шаг 3/i)).toBeInTheDocument();

      // Complete: Click start button
      await user.click(screen.getByRole('button', { name: /начать/i }));

      // Assert: Onboarding marked complete
      await waitFor(() => {
        expect(localStorage.getItem('pinglass_onboarding_complete')).toBe('true');
      });
    });

    it('should allow going back in carousel', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      // Act: Navigate forward then back
      await user.click(screen.getByTestId('carousel-next'));
      expect(screen.getByText(/Шаг 2/i)).toBeInTheDocument();

      await user.click(screen.getByTestId('carousel-prev'));

      // Assert: Back to step 1
      expect(screen.getByText(/Шаг 1/i)).toBeInTheDocument();
    });
  });

  describe('Upload Flow', () => {
    beforeEach(() => {
      // Skip onboarding for upload tests
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    });

    it('should accept 5-8 photos for upload', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      // Create test files
      const files = Array.from({ length: 6 }, (_, i) =>
        new File([`photo${i}`], `photo${i}.jpg`, { type: 'image/jpeg' })
      );

      // Act: Upload files
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      await user.upload(input, files);

      // Assert: All photos displayed
      await waitFor(() => {
        const uploadedPhotos = screen.getAllByTestId('uploaded-photo');
        expect(uploadedPhotos).toHaveLength(6);
      });
    });

    it('should show error when uploading fewer than 5 photos', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      const files = [
        new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
        new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      ];

      // Act: Upload insufficient photos
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      await user.upload(input, files);

      // Try to proceed
      await user.click(screen.getByRole('button', { name: /далее|next/i }));

      // Assert: Error message shown
      expect(screen.getByText(/минимум 5 фото/i)).toBeInTheDocument();
    });

    it('should allow deleting uploaded photos', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      const files = Array.from({ length: 5 }, (_, i) =>
        new File([`photo${i}`], `photo${i}.jpg`, { type: 'image/jpeg' })
      );

      // Act: Upload files
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      await user.upload(input, files);

      // Wait for photos to appear
      await waitFor(() => {
        expect(screen.getAllByTestId('uploaded-photo')).toHaveLength(5);
      });

      // Delete first photo
      const deleteButtons = screen.getAllByTestId('delete-photo');
      await user.click(deleteButtons[0]);

      // Assert: Photo removed
      await waitFor(() => {
        expect(screen.getAllByTestId('uploaded-photo')).toHaveLength(4);
      });
    });

    it('should reject non-image files', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      const invalidFile = new File(['text content'], 'document.txt', {
        type: 'text/plain',
      });

      // Act: Try to upload invalid file
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      await user.upload(input, invalidFile);

      // Assert: Error message shown
      expect(screen.getByText(/только изображения|images only/i)).toBeInTheDocument();
    });

    it('should show upload progress', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp />);

      const files = Array.from({ length: 5 }, (_, i) =>
        new File([`photo${i}`], `photo${i}.jpg`, { type: 'image/jpeg' })
      );

      // Act: Upload files
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      await user.upload(input, files);

      // Assert: Progress bar visible during upload
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument();

      // Wait for upload completion
      await waitFor(() => {
        expect(screen.queryByTestId('upload-progress')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });

  describe('Style Selection', () => {
    beforeEach(() => {
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    });

    it('should select professional style', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp initialView="SELECT_STYLE" />);

      // Act: Click professional style button
      await user.click(screen.getByRole('button', { name: /профессиональный|professional/i }));

      // Assert: Style selected
      const button = screen.getByRole('button', { name: /профессиональный|professional/i });
      expect(button).toHaveClass('selected');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show correct photo count for each style', () => {
      // Arrange & Act
      render(<PersonaApp initialView="SELECT_STYLE" />);

      // Assert: All styles show 23 photos
      expect(screen.getByText(/Professional.*23 фото/i)).toBeInTheDocument();
      expect(screen.getByText(/Lifestyle.*23 фото/i)).toBeInTheDocument();
      expect(screen.getByText(/Creative.*23 фото/i)).toBeInTheDocument();
    });

    it('should allow changing style selection', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp initialView="SELECT_STYLE" />);

      // Act: Select professional, then change to lifestyle
      await user.click(screen.getByRole('button', { name: /профессиональный/i }));
      await user.click(screen.getByRole('button', { name: /лайфстайл/i }));

      // Assert: Only lifestyle selected
      const professionalBtn = screen.getByRole('button', { name: /профессиональный/i });
      const lifestyleBtn = screen.getByRole('button', { name: /лайфстайл/i });

      expect(professionalBtn).not.toHaveClass('selected');
      expect(lifestyleBtn).toHaveClass('selected');
    });

    it('should enable continue button after style selection', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp initialView="SELECT_STYLE" />);

      // Initially disabled
      const continueBtn = screen.getByRole('button', { name: /продолжить|continue/i });
      expect(continueBtn).toBeDisabled();

      // Act: Select style
      await user.click(screen.getByRole('button', { name: /профессиональный/i }));

      // Assert: Button enabled
      expect(continueBtn).toBeEnabled();
    });
  });

  describe('Payment Integration', () => {
    beforeEach(() => {
      localStorage.setItem('pinglass_onboarding_complete', 'true');
    });

    it('should show payment modal for non-paid users', async () => {
      // Arrange: No payment flag
      localStorage.removeItem('pinglass_is_pro');

      // Mock API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ paid: false, status: 'pending' }),
      });

      // Act: Render and navigate to payment step
      render(<PersonaApp />);

      // Simulate navigation through flow
      // (In real test, would click through upload -> style select)

      // Assert: Payment modal visible
      await waitFor(() => {
        expect(screen.getByTestId('payment-modal')).toBeInTheDocument();
      });

      expect(screen.getByText(/500₽/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /оплатить/i })).toBeInTheDocument();
    });

    it('should skip payment modal for paid users', () => {
      // Arrange: Set paid flag
      localStorage.setItem('pinglass_is_pro', 'true');

      // Act: Render
      render(<PersonaApp />);

      // Assert: No payment modal
      expect(screen.queryByTestId('payment-modal')).not.toBeInTheDocument();
    });

    it('should create payment on button click', async () => {
      // Arrange
      const user = userEvent.setup();
      localStorage.removeItem('pinglass_is_pro');

      // Mock payment creation API
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          paymentId: 'test-payment-123',
          confirmationUrl: 'https://payment.example.com/pay',
          testMode: true,
        }),
      });

      render(<PersonaApp initialView="PAYMENT" />);

      // Act: Click payment button
      const payButton = screen.getByRole('button', { name: /оплатить 500₽/i });
      await user.click(payButton);

      // Assert: API called
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/payment/create'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
          })
        );
      });
    });

    it('should handle payment creation error', async () => {
      // Arrange
      const user = userEvent.setup();

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Payment service unavailable')
      );

      render(<PersonaApp initialView="PAYMENT" />);

      // Act: Click payment button
      await user.click(screen.getByRole('button', { name: /оплатить/i }));

      // Assert: Error message shown
      await waitFor(() => {
        expect(screen.getByText(/ошибка.*оплат/i)).toBeInTheDocument();
      });
    });
  });

  describe('Generation Flow', () => {
    beforeEach(() => {
      localStorage.setItem('pinglass_onboarding_complete', 'true');
      localStorage.setItem('pinglass_is_pro', 'true');
    });

    it('should show progress spinner during generation', () => {
      // Arrange & Act
      render(<PersonaApp initialView="GENERATING" />);

      // Assert: Spinner visible
      expect(screen.getByTestId('generating-spinner')).toBeInTheDocument();
      expect(screen.getByText(/генерация|generating/i)).toBeInTheDocument();
    });

    it('should poll generation status', async () => {
      // Arrange
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'processing', progress: 30 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'processing', progress: 60 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: 'completed',
            photos: Array.from({ length: 23 }, (_, i) => `photo${i}.jpg`),
          }),
        });

      // Act: Render generating view
      render(<PersonaApp initialView="GENERATING" jobId="test-job-123" />);

      // Assert: Polls multiple times
      await waitFor(
        () => {
          expect(global.fetch).toHaveBeenCalledTimes(3);
        },
        { timeout: 10000 }
      );
    });

    it('should display 23 photos on completion', async () => {
      // Arrange
      const mockPhotos = Array.from({ length: 23 }, (_, i) => ({
        url: `https://example.com/photo${i}.jpg`,
        id: i,
      }));

      // Act: Render results view
      render(<PersonaApp initialView="RESULTS" photos={mockPhotos} />);

      // Assert: All 23 photos visible
      await waitFor(() => {
        const photos = screen.getAllByTestId('result-photo');
        expect(photos).toHaveLength(23);
      });
    });

    it('should handle generation timeout', async () => {
      // Arrange
      jest.useFakeTimers();

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'processing', progress: 50 }),
      });

      render(<PersonaApp initialView="GENERATING" jobId="test-job-timeout" />);

      // Act: Fast-forward 15 minutes (timeout)
      jest.advanceTimersByTime(15 * 60 * 1000);

      // Assert: Timeout error shown
      await waitFor(() => {
        expect(screen.getByText(/превышено время ожидания|timeout/i)).toBeInTheDocument();
      });

      jest.useRealTimers();
    });
  });

  describe('Results View', () => {
    it('should allow downloading individual photos', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockPhotos = Array.from({ length: 23 }, (_, i) => ({
        url: `https://example.com/photo${i}.jpg`,
        id: i,
      }));

      render(<PersonaApp initialView="RESULTS" photos={mockPhotos} />);

      // Mock download
      const createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.createObjectURL = createObjectURL;

      // Act: Click download on first photo
      const downloadButtons = screen.getAllByTestId('download-photo');
      await user.click(downloadButtons[0]);

      // Assert: Download initiated
      expect(createObjectURL).toHaveBeenCalled();
    });

    it('should show "Generate More" button', () => {
      // Arrange
      const mockPhotos = Array.from({ length: 23 }, (_, i) => ({
        url: `https://example.com/photo${i}.jpg`,
        id: i,
      }));

      // Act
      render(<PersonaApp initialView="RESULTS" photos={mockPhotos} />);

      // Assert
      expect(screen.getByRole('button', { name: /создать ещё|generate more/i })).toBeInTheDocument();
    });

    it('should navigate to dashboard on "Generate More" click', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockPhotos = Array.from({ length: 23 }, (_, i) => ({
        url: `https://example.com/photo${i}.jpg`,
        id: i,
      }));

      render(<PersonaApp initialView="RESULTS" photos={mockPhotos} />);

      // Act: Click "Generate More"
      await user.click(screen.getByRole('button', { name: /создать ещё/i }));

      // Assert: Navigated to dashboard
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error modal on API failure', async () => {
      // Arrange
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      // Mock API error
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      // Act: Render and trigger API call
      render(<PersonaApp />);

      // Assert: Error modal visible
      await waitFor(() => {
        expect(screen.getByTestId('error-modal')).toBeInTheDocument();
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });

      consoleError.mockRestore();
    });

    it('should allow dismissing error modal', async () => {
      // Arrange
      const user = userEvent.setup();

      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('API Error')
      );

      render(<PersonaApp />);

      // Wait for error modal
      await waitFor(() => {
        expect(screen.getByTestId('error-modal')).toBeInTheDocument();
      });

      // Act: Click close button
      await user.click(screen.getByRole('button', { name: /закрыть|close/i }));

      // Assert: Modal dismissed
      expect(screen.queryByTestId('error-modal')).not.toBeInTheDocument();
    });
  });

  describe('State Persistence', () => {
    it('should persist device ID in localStorage', () => {
      // Arrange & Act
      render(<PersonaApp />);

      // Assert: Device ID created and stored
      const deviceId = localStorage.getItem('pinglass_device_id');
      expect(deviceId).toBeTruthy();
      expect(deviceId).toHaveLength(36); // UUID format
    });

    it('should restore state from localStorage on mount', () => {
      // Arrange: Set existing state
      localStorage.setItem('pinglass_onboarding_complete', 'true');
      localStorage.setItem('pinglass_is_pro', 'true');
      localStorage.setItem('pinglass_current_view', 'DASHBOARD');

      // Act: Render
      render(<PersonaApp />);

      // Assert: Restored to dashboard
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      // Arrange & Act
      render(<PersonaApp />);

      // Assert: h1 exists
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should have accessible form labels', () => {
      // Arrange
      localStorage.setItem('pinglass_onboarding_complete', 'true');

      // Act
      render(<PersonaApp />);

      // Assert: Upload input has label
      const input = screen.getByLabelText(/загрузить фото|upload/i);
      expect(input).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<PersonaApp initialView="SELECT_STYLE" />);

      // Act: Tab through buttons
      await user.tab();

      // Assert: First button focused
      const professionalBtn = screen.getByRole('button', { name: /профессиональный/i });
      expect(professionalBtn).toHaveFocus();

      // Tab to next button
      await user.tab();
      const lifestyleBtn = screen.getByRole('button', { name: /лайфстайл/i });
      expect(lifestyleBtn).toHaveFocus();
    });
  });
});
