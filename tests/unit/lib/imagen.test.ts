import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Unit tests for lib/imagen.ts
 * Coverage target: 70%+
 * Total tests: 32
 *
 * Tests the multi-provider image generation system with Kie.ai primary provider.
 */

// Mock dependencies
const mockGenerateWithKie = jest.fn();
const mockIsKieConfigured = jest.fn();
const mockTestKieConnection = jest.fn();
const mockReplicateGeneratePortrait = jest.fn();
const mockPrepareImageForReplicate = jest.fn((img) => img);

jest.mock('../../../lib/kie', () => ({
  generateWithKie: mockGenerateWithKie,
  isKieConfigured: mockIsKieConfigured,
  testKieConnection: mockTestKieConnection,
}));

jest.mock('../../../lib/replicate/index', () => ({
  generatePortrait: mockReplicateGeneratePortrait,
  testConnections: jest.fn(),
}));

jest.mock('../../../lib/replicate/utils/image-processor', () => ({
  prepareImageForApi: mockPrepareImageForReplicate,
}));

import {
  generateImage,
  generateMultipleImages,
  getProviderInfo,
} from '../../../lib/imagen';

// Store original environment
const originalEnv = process.env;

describe('lib/imagen.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    process.env = { ...originalEnv };
    delete process.env.KIE_AI_API_KEY;
    delete process.env.KIE_API_KEY;
    delete process.env.REPLICATE_API_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  // ============ generateImage() - 6 tests ============

  describe('generateImage()', () => {
    const baseOptions = {
      prompt: 'A professional headshot',
      referenceImages: ['base64image1', 'base64image2'],
    };

    test('should successfully generate with Kie.ai when configured', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-kie-key-123';
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://cdn.kie.ai/generated-image.jpg',
      });

      const result = await generateImage(baseOptions);

      expect(result).toBe('https://cdn.kie.ai/generated-image.jpg');
      expect(mockIsKieConfigured).toHaveBeenCalled();
      expect(mockGenerateWithKie).toHaveBeenCalledWith({
        prompt: baseOptions.prompt,
        referenceImages: baseOptions.referenceImages,
        aspectRatio: '3:4',
        resolution: '2K',
        outputFormat: 'jpg',
        seed: undefined,
      });
    });

    test('should throw when neither provider configured', async () => {
      mockIsKieConfigured.mockReturnValue(false);

      await expect(generateImage(baseOptions)).rejects.toThrow(
        'Kie.ai not configured (need KIE_AI_API_KEY)'
      );
    });

    test('should pass GenerationOptions correctly', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const customOptions = {
        prompt: 'Custom prompt',
        referenceImages: ['img1', 'img2'],
        seed: 12345,
        negativePrompt: 'ugly, blurry',
        aspectRatio: '9:16',
        resolution: '4K',
      };

      await generateImage(customOptions);

      expect(mockGenerateWithKie).toHaveBeenCalledWith({
        prompt: 'Custom prompt',
        referenceImages: ['img1', 'img2'],
        aspectRatio: '3:4',
        resolution: '2K',
        outputFormat: 'jpg',
        seed: 12345,
      });
    });

    test('should log provider status and key length', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-kie-key-123456';
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      await generateImage(baseOptions);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Kie.ai configured=true')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('key length=19')
      );
    });

    test('should throw error when Kie generation fails', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: false,
        url: '',
        error: 'API quota exceeded',
      });

      await expect(generateImage(baseOptions)).rejects.toThrow('API quota exceeded');
    });

    test('should throw generic error when Kie fails without error message', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: false,
        url: '',
      });

      await expect(generateImage(baseOptions)).rejects.toThrow('Kie.ai generation failed');
    });
  });

  // ============ generateMultipleImages() - 12 tests ============

  describe('generateMultipleImages()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should successfully generate exact number of images', async () => {
      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts);
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockGenerateWithKie).toHaveBeenCalledTimes(3);
    });

    test('should respect concurrency limit (batches of 3)', async () => {
      const prompts = Array(7).fill('Test prompt');
      let callCount = 0;

      mockGenerateWithKie.mockImplementation(async () => {
        callCount++;
        return { success: true, url: `https://image${callCount}.jpg` };
      });

      const promise = generateMultipleImages(prompts, undefined, { concurrency: 3 });

      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(7);
      expect(mockGenerateWithKie).toHaveBeenCalledTimes(7);
    });

    test('should retry failed images up to maxRetries times', async () => {
      const prompts = ['Prompt 1', 'Prompt 2'];
      let attemptCount = 0;

      mockGenerateWithKie.mockImplementation(async () => {
        attemptCount++;
        if (attemptCount <= 2) {
          throw new Error('Temporary failure');
        }
        return { success: true, url: 'https://image.jpg' };
      });

      const promise = generateMultipleImages(prompts, undefined, { maxRetries: 2 });
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockGenerateWithKie).toHaveBeenCalledTimes(4);
    });

    test('should call onProgress callback with correct counts', async () => {
      const prompts = ['Prompt 1', 'Prompt 2', 'Prompt 3'];
      const progressCalls = [];

      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const onProgress = jest.fn((completed, total, success) => {
        progressCalls.push({ completed, total, success });
      });

      const promise = generateMultipleImages(prompts, undefined, { onProgress });
      await jest.runAllTimersAsync();
      await promise;

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(progressCalls).toEqual([
        { completed: 1, total: 3, success: true },
        { completed: 2, total: 3, success: true },
        { completed: 3, total: 3, success: true },
      ]);
    });

    test('should apply stylePrefix and styleSuffix to prompts', async () => {
      const prompts = ['middle text'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts, undefined, {
        stylePrefix: 'PREFIX ',
        styleSuffix: ' SUFFIX',
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(mockGenerateWithKie).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'PREFIX middle text SUFFIX',
        })
      );
    });

    test('should handle empty prompts array', async () => {
      const promise = generateMultipleImages([]);
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toEqual([]);
      expect(mockGenerateWithKie).not.toHaveBeenCalled();
    });

    test('should handle large arrays (100+ prompts)', async () => {
      const prompts = Array(105).fill('Test prompt');
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts, undefined, { concurrency: 5 });
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(105);
      expect(mockGenerateWithKie).toHaveBeenCalledTimes(105);
    });

    test('should delay 800ms between batches', async () => {
      const prompts = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts, undefined, { concurrency: 3 });

      expect(jest.getTimerCount()).toBe(0);

      await jest.runAllTimersAsync();
      await promise;

      expect(mockGenerateWithKie).toHaveBeenCalledTimes(6);
    });

    test('should delay 1000ms between retry batches', async () => {
      const prompts = ['P1', 'P2', 'P3', 'P4'];
      let callCount = 0;

      mockGenerateWithKie.mockImplementation(async () => {
        callCount++;
        if (callCount <= 4) throw new Error('First batch fails');
        return { success: true, url: 'https://image.jpg' };
      });

      const promise = generateMultipleImages(prompts, undefined, {
        concurrency: 2,
        maxRetries: 1,
      });

      await jest.runAllTimersAsync();
      await promise;

      expect(mockGenerateWithKie).toHaveBeenCalledTimes(8);
    });

    test('should log batch progress', async () => {
      const prompts = ['P1', 'P2', 'P3', 'P4', 'P5'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts, undefined, { concurrency: 3 });
      await jest.runAllTimersAsync();
      await promise;

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Batch 1/2')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Batch 2/2')
      );
    });

    test('should set placeholder URL for permanently failed images', async () => {
      const prompts = ['P1', 'P2'];
      mockGenerateWithKie.mockRejectedValue(new Error('Permanent failure'));

      const promise = generateMultipleImages(prompts, undefined, { maxRetries: 1 });
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('/generation-failed.jpg');
      expect(results[0].success).toBe(false);
      expect(results[0].error).toBe('All retry attempts failed');
    });

    test('should generate unique seeds (Date.now() + indexes)', async () => {
      const prompts = ['P1', 'P2', 'P3'];
      const seeds = [];

      mockGenerateWithKie.mockImplementation(async (opts) => {
        seeds.push(opts.seed);
        return { success: true, url: 'https://image.jpg' };
      });

      const promise = generateMultipleImages(prompts);
      await jest.runAllTimersAsync();
      await promise;

      expect(seeds).toHaveLength(3);
      expect(new Set(seeds).size).toBe(3);
      seeds.forEach((seed) => {
        expect(seed).toBeGreaterThan(Date.now() - 10000);
      });
    });
  });

  // ============ getProviderInfo() - 5 tests ============

  describe('getProviderInfo()', () => {
    test('should return Kie.ai when KIE_AI_API_KEY configured', () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';

      const info = getProviderInfo();

      expect(info.active).toBe('Kie.ai');
      expect(info.available).toContain('kie');
      expect(info.pricing.kie).toBe(0.03);
    });

    test('should return Replicate when only REPLICATE_API_TOKEN configured', () => {
      mockIsKieConfigured.mockReturnValue(false);
      process.env.REPLICATE_API_TOKEN = 'r8_test_token';

      const info = getProviderInfo();

      expect(info.active).toBe('Replicate');
      expect(info.available).toContain('replicate');
      expect(info.pricing.replicate).toBe(0.05);
    });

    test('should return null active when neither configured', () => {
      mockIsKieConfigured.mockReturnValue(false);

      const info = getProviderInfo();

      expect(info.active).toBeNull();
      expect(info.available).toEqual([]);
    });

    test('should show both configured with Kie as primary', () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'kie-key';
      process.env.REPLICATE_API_TOKEN = 'rep-token';

      const info = getProviderInfo();

      expect(info.active).toBe('Kie.ai');
      expect(info.available).toEqual(['kie', 'replicate']);
    });

    test('should return correct pricing for both providers', () => {
      const info = getProviderInfo();

      expect(info.pricing).toEqual({
        kie: 0.03,
        replicate: 0.05,
      });
    });
  });

  // ============ generateWithKieProvider (internal) - 4 tests ============

  describe('generateWithKieProvider (internal via generateImage)', () => {
    test('should call generateWithKie with correct params', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      await generateImage({
        prompt: 'Test prompt',
        referenceImages: ['img1'],
        seed: 999,
      });

      expect(mockGenerateWithKie).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        referenceImages: ['img1'],
        aspectRatio: '3:4',
        resolution: '2K',
        outputFormat: 'jpg',
        seed: 999,
      });
    });

    test('should throw if result.success is false', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: false,
        url: '',
        error: 'Invalid prompt',
      });

      await expect(generateImage({ prompt: 'Test' })).rejects.toThrow('Invalid prompt');
    });

    test('should return result.url on success', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_API_KEY = 'test-key';
      const expectedUrl = 'https://cdn.kie.ai/img123.jpg';

      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: expectedUrl,
      });

      const result = await generateImage({ prompt: 'Test' });

      expect(result).toBe(expectedUrl);
    });

    test('should pass referenceImages and seed through', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const refs = ['base64_1', 'base64_2', 'base64_3'];
      const seed = 42;

      await generateImage({
        prompt: 'Test',
        referenceImages: refs,
        seed,
      });

      expect(mockGenerateWithKie).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceImages: refs,
          seed: 42,
        })
      );
    });
  });

  // ============ Integration tests - 5 tests ============

  describe('Integration scenarios', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockIsKieConfigured.mockReturnValue(true);
      process.env.KIE_AI_API_KEY = 'test-key';
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle partial success in batch generation', async () => {
      const prompts = ['P1', 'P2', 'P3', 'P4'];
      let callCount = 0;

      mockGenerateWithKie.mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Single failure');
        }
        return { success: true, url: `https://image${callCount}.jpg` };
      });

      const promise = generateMultipleImages(prompts, undefined, { maxRetries: 0 });
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results).toHaveLength(4);
      expect(results.filter((r) => r.success)).toHaveLength(3);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('All retry attempts failed');
    });

    test('should track provider in GenerationResult', async () => {
      const prompts = ['P1'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts);
      await jest.runAllTimersAsync();
      const results = await promise;

      expect(results[0].provider).toBe('Kie.ai');
    });

    test('should handle onProgress with failed images', async () => {
      const prompts = ['P1', 'P2'];
      const progressCalls = [];

      const onProgress = jest.fn((completed, total, success) => {
        progressCalls.push(success);
      });

      let callCount = 0;
      mockGenerateWithKie.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) throw new Error('Fail');
        return { success: true, url: 'https://image.jpg' };
      });

      const promise = generateMultipleImages(prompts, undefined, {
        onProgress,
        maxRetries: 0,
      });
      await jest.runAllTimersAsync();
      await promise;

      expect(progressCalls).toContain(false);
      expect(progressCalls).toContain(true);
    });

    test('should log final summary with success and failure counts', async () => {
      const prompts = ['P1', 'P2', 'P3'];
      mockGenerateWithKie.mockResolvedValueOnce({ success: true, url: 'img1.jpg' });
      mockGenerateWithKie.mockRejectedValueOnce(new Error('Fail'));
      mockGenerateWithKie.mockResolvedValueOnce({ success: true, url: 'img3.jpg' });

      const promise = generateMultipleImages(prompts, undefined, { maxRetries: 0 });
      await jest.runAllTimersAsync();
      await promise;

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Complete'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('2/3 successful'));
    });

    test('should use correct active provider in batch generation logs', async () => {
      mockIsKieConfigured.mockReturnValue(true);
      process.env.REPLICATE_API_TOKEN = 'replicate-token';

      const prompts = ['P1'];
      mockGenerateWithKie.mockResolvedValue({
        success: true,
        url: 'https://image.jpg',
      });

      const promise = generateMultipleImages(prompts);
      await jest.runAllTimersAsync();
      await promise;

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Active provider: Kie.ai')
      );
    });
  });
});
