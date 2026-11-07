/**
 * tests/unit/core/endpoints/endpoint-registry.test.ts
 *
 * Endpoint Registry Unit Tests
 *
 * Tests endpoint CRUD operations, model management, validation logic (no VS Code API imports).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Endpoint,
  Model,
  EndpointRegistry,
  EndpointValidationError,
} from '../../../../src/core/endpoints/endpoint-registry.js';

describe('EndpointRegistry', () => {
  let registry: EndpointRegistry;

  beforeEach(() => {
    registry = new EndpointRegistry();
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Create Endpoint', () => {
    it('should create a new endpoint', () => {
      const endpoint: Omit<Endpoint, 'id' | 'createdAt' | 'status'> = {
        url: 'https://api.anthropic.com',
        label: 'Claude Official',
        hasAuth: true,
        models: [
          { name: 'claude-sonnet-5-5', alias: 'Sonnet 5.5' },
          { name: 'claude-haiku-5-5', alias: 'Haiku 5.5' },
        ],
      };

      const created = registry.create(endpoint);

      expect(created.id).toBeDefined();
      expect(created.id.length).toBeGreaterThan(0);
      expect(created.url).toBe(endpoint.url);
      expect(created.label).toBe(endpoint.label);
      expect(created.hasAuth).toBe(endpoint.hasAuth);
      expect(created.models).toEqual(endpoint.models);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.status).toBe('untested');
    });

    it('should generate unique IDs for each endpoint', () => {
      const ep1 = registry.create({ url: 'https://api1.example.com', label: 'EP1', hasAuth: false, models: [{ name: 'claude-3-5-sonnet' }] });
      const ep2 = registry.create({ url: 'https://api2.example.com', label: 'EP2', hasAuth: false, models: [{ name: 'claude-3-5-sonnet' }] });

      expect(ep1.id).not.toBe(ep2.id);
    });

    it('should validate URL format', () => {
      expect(() => {
        registry.create({
          url: 'invalid-url',
          label: 'Bad Endpoint',
          hasAuth: false,
          models: [],
        });
      }).toThrow(EndpointValidationError);
      expect(() => {
        registry.create({
          url: 'ftp://example.com',
          label: 'Bad Protocol',
          hasAuth: false,
          models: [],
        });
      }).toThrow(EndpointValidationError);
    });

    it('should accept localhost URLs for SSH tunnels', () => {
      const endpoint = registry.create({
        url: 'http://localhost:11434',
        label: 'Local Tunnel',
        hasAuth: false,
        models: [{ name: 'llama3.2', alias: 'Llama 3.2' }],
      });

      expect(endpoint.url).toBe('http://localhost:11434');
    });

    it('should require at least one model', () => {
      expect(() => {
        registry.create({
          url: 'https://api.example.com',
          label: 'No Models',
          hasAuth: false,
          models: [],
        });
      }).toThrow(EndpointValidationError);
    });

    it('should validate model names', () => {
      expect(() => {
        registry.create({
          url: 'https://api.example.com',
          label: 'Bad Model',
          hasAuth: false,
          models: [{ name: '', alias: 'Empty' }],
        });
      }).toThrow(EndpointValidationError);

      expect(() => {
        registry.create({
          url: 'https://api.example.com',
          label: 'No Model Name',
          hasAuth: false,
          models: [{ alias: 'Only Alias' } as any],
        });
      }).toThrow(EndpointValidationError);
    });

    it('should use URL as default label', () => {
      const endpoint = registry.create({
        url: 'https://api.anthropic.com',
        hasAuth: true,
        models: [{ name: 'claude-sonnet-5-5' }],
      });

      expect(endpoint.label).toBe('https://api.anthropic.com');
    });

    it('should allow empty alias for models', () => {
      const endpoint = registry.create({
        url: 'https://api.anthropic.com',
        label: 'Endpoint',
        hasAuth: true,
        models: [{ name: 'claude-sonnet-5-5' }],
      });

      expect(endpoint.models[0].alias).toBeUndefined();
    });
  });

  describe('Read Endpoint', () => {
    it('should find endpoint by ID', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const found = registry.getById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.url).toBe(created.url);
    });

    it('should return undefined for non-existent ID', () => {
      const found = registry.getById('non-existent-id');
      expect(found).toBeUndefined();
    });

    it('should find endpoint by URL', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const found = registry.getByUrl('https://api.example.com');

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return undefined for non-existent URL', () => {
      const found = registry.getByUrl('https://notfound.example.com');
      expect(found).toBeUndefined();
    });

    it('should list all registered endpoints', () => {
      const ep1 = registry.create({
        url: 'https://api1.example.com',
        label: 'EP1',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });
      const ep2 = registry.create({
        url: 'https://api2.example.com',
        label: 'EP2',
        hasAuth: false,
        models: [{ name: 'model2' }],
      });

      const all = registry.list();

      expect(all).toHaveLength(2);
      expect(all.find((ep) => ep.id === ep1.id)).toBeDefined();
      expect(all.find((ep) => ep.id === ep2.id)).toBeDefined();
    });

    it('should return empty array when registry is empty', () => {
      const all = registry.list();
      expect(all).toEqual([]);
    });
  });

  describe('Update Endpoint', () => {
    it('should update endpoint URL', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const updated = registry.update(created.id, {
        url: 'https://newapi.example.com',
      });

      expect(updated?.url).toBe('https://newapi.example.com');
      expect(updated?.id).toBe(created.id);
    });

    it('should update endpoint label', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const updated = registry.update(created.id, {
        label: 'Updated Label',
      });

      expect(updated?.label).toBe('Updated Label');
    });

    it('should update endpoint hasAuth flag', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const updated = registry.update(created.id, {
        hasAuth: true,
      });

      expect(updated?.hasAuth).toBe(true);
    });

    it('should update models', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const updated = registry.update(created.id, {
        models: [
          { name: 'model1', alias: 'Model One' },
          { name: 'model2', alias: 'Model Two' },
        ],
      });

      expect(updated?.models).toHaveLength(2);
      expect(updated?.models[0].alias).toBe('Model One');
    });

    it('should return undefined when updating non-existent endpoint', () => {
      const updated = registry.update('non-existent', { url: 'https://example.com' });
      expect(updated).toBeUndefined();
    });

    it('should validate updated URL', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      expect(() => {
        registry.update(created.id, { url: 'invalid-url' });
      }).toThrow(EndpointValidationError);
    });

    it('should accept partial updates', () => {
      const original: Omit<Endpoint, 'id' | 'createdAt' | 'status'> = {
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      };
      const created = registry.create(original);

      // Update only label, keep other fields
      const updated = registry.update(created.id, { label: 'Updated' });

      expect(updated?.url).toBe(original.url);
      expect(updated?.label).toBe('Updated');
      expect(updated?.hasAuth).toBe(original.hasAuth);
      expect(updated?.models).toEqual(original.models);
    });
  });

  describe('Delete Endpoint', () => {
    it('should delete endpoint by ID', () => {
      const created = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      const deleted = registry.delete(created.id);

      expect(deleted).toBe(true);
      expect(registry.getById(created.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent endpoint', () => {
      const deleted = registry.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should not affect other endpoints when deleting one', () => {
      const ep1 = registry.create({
        url: 'https://api1.example.com',
        label: 'EP1',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });
      const ep2 = registry.create({
        url: 'https://api2.example.com',
        label: 'EP2',
        hasAuth: false,
        models: [{ name: 'model2' }],
      });

      registry.delete(ep1.id);

      expect(registry.getById(ep2.id)).toBeDefined();
      expect(registry.list()).toHaveLength(1);
    });
  });

  describe('Model Management', () => {
    it('should add model to endpoint', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      registry.addModel(endpoint.id, { name: 'model2', alias: 'Model Two' });

      const updated = registry.getById(endpoint.id);
      expect(updated?.models).toHaveLength(2);
      expect(updated?.models[1].name).toBe('model2');
    });

    it('should update model by name', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      registry.updateModel(endpoint.id, 'model1', { alias: 'Updated Alias' });

      const updated = registry.getById(endpoint.id);
      expect(updated?.models[0].alias).toBe('Updated Alias');
    });

    it('should remove model from endpoint', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [
          { name: 'model1' },
          { name: 'model2' },
          { name: 'model3' },
        ],
      });

      registry.removeModel(endpoint.id, 'model2');

      const updated = registry.getById(endpoint.id);
      expect(updated?.models).toHaveLength(2);
      expect(updated?.models.find((m) => m.name === 'model2')).toBeUndefined();
    });

    it('should require at least one model after removal', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      expect(() => {
        registry.removeModel(endpoint.id, 'model1');
      }).toThrow(EndpointValidationError);
    });

    it('should replace all models', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      registry.setModels(endpoint.id, [
        { name: 'model2' },
        { name: 'model3' },
      ]);

      const updated = registry.getById(endpoint.id);
      expect(updated?.models).toHaveLength(2);
      expect(updated?.models[0].name).toBe('model2');
    });
  });

  describe('Validation', () => {
    it('should validate complete endpoint object', () => {
      const valid: Endpoint = {
        id: 'test-id',
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        status: 'untested',
        createdAt: new Date(),
        models: [{ name: 'model1' }],
      };

      expect(() => {
        EndpointRegistry.validate(valid);
      }).not.toThrow();
    });

    it('should reject endpoint with invalid URL', () => {
      const invalid = {
        id: 'test-id',
        url: 'invalid-url',
        label: 'Test',
        hasAuth: false,
        status: 'untested',
        createdAt: new Date(),
        models: [{ name: 'model1' }],
      } as Endpoint;

      expect(() => {
        EndpointRegistry.validate(invalid);
      }).toThrow(EndpointValidationError);
    });

    it('should reject endpoint without models', () => {
      const invalid = {
        id: 'test-id',
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        status: 'untested',
        createdAt: new Date(),
        models: [],
      } as Endpoint;

      expect(() => {
        EndpointRegistry.validate(invalid);
      }).toThrow(EndpointValidationError);
    });

    it('should reject endpoint with invalid model name', () => {
      const invalid = {
        id: 'test-id',
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        status: 'untested',
        createdAt: new Date(),
        models: [{ name: '' }],
      } as Endpoint;

      expect(() => {
        EndpointRegistry.validate(invalid);
      }).toThrow(EndpointValidationError);
    });
  });

  describe('Utility Methods', () => {
    it('should get endpoint count', () => {
      expect(registry.getCount()).toBe(0);

      registry.create({
        url: 'https://api1.example.com',
        label: 'EP1',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      expect(registry.getCount()).toBe(1);

      registry.create({
        url: 'https://api2.example.com',
        label: 'EP2',
        hasAuth: false,
        models: [{ name: 'model2' }],
      });

      expect(registry.getCount()).toBe(2);
    });

    it('should check if endpoint exists by ID', () => {
      const endpoint = registry.create({
        url: 'https://api.example.com',
        label: 'Test',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });

      expect(registry.exists(endpoint.id)).toBe(true);
      expect(registry.exists('non-existent')).toBe(false);
    });

    it('should clear all endpoints', () => {
      registry.create({
        url: 'https://api1.example.com',
        label: 'EP1',
        hasAuth: false,
        models: [{ name: 'model1' }],
      });
      registry.create({
        url: 'https://api2.example.com',
        label: 'EP2',
        hasAuth: false,
        models: [{ name: 'model2' }],
      });

      expect(registry.getCount()).toBe(2);

      registry.clear();

      expect(registry.getCount()).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });
});
