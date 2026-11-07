/**
 * src/core/endpoints/endpoint-registry.ts
 *
 * Endpoint Registry
 *
 * Endpoint CRUD operations, model management, validation logic (no VS Code API imports).
 */

import { URLValidator } from '../../utils/url-validator.js';

export type EndpointStatus = 'untested' | 'connected' | 'unreachable';
export type EndpointType = 'subscription' | 'api-credits' | 'ollama';

export interface Model {
  name: string;
  alias?: string;
}

export interface Endpoint {
  id: string;
  url: string;
  label: string;
  hasAuth: boolean;
  status: EndpointStatus;
  createdAt: Date;
  type: EndpointType;
  models: Model[];
}

export interface CreateEndpointInput {
  url: string;
  label?: string;
  hasAuth: boolean;
  type: EndpointType;
  models: Model[];
}

export interface UpdateEndpointInput {
  url?: string;
  label?: string;
  hasAuth?: boolean;
  status?: EndpointStatus;
  type?: EndpointType;
  models?: Model[];
}

export class EndpointValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EndpointValidationError';
  }
}

export class EndpointRegistry {
  private endpoints: Map<string, Endpoint> = new Map();
  private urlValidator: URLValidator = new URLValidator();
  private idCounter: number = 0;

  /**
   * Creates a new endpoint.
   */
  public create(input: CreateEndpointInput): Endpoint {
    this.validateCreateInput(input);

    const id = this.generateId();
    const endpoint: Endpoint = {
      id,
      url: this.urlValidator.normalize(input.url, { addDefaultPorts: false }),
      label: input.label ?? input.url,
      hasAuth: input.hasAuth,
      status: 'untested',
      createdAt: new Date(),
      type: input.type,
      models: input.models.map((m) => ({ ...m })),
    };

    this.endpoints.set(id, endpoint);
    return { ...endpoint };
  }

  /**
   * Gets an endpoint by ID.
   */
  public getById(id: string): Endpoint | undefined {
    const endpoint = this.endpoints.get(id);
    return endpoint ? { ...endpoint } : undefined;
  }

  /**
   * Gets an endpoint by URL.
   */
  public getByUrl(url: string): Endpoint | undefined {
    for (const endpoint of this.endpoints.values()) {
      if (endpoint.url === url) {
        return { ...endpoint };
      }
    }
    return undefined;
  }

  /**
   * Lists all endpoints.
   */
  public list(): Endpoint[] {
    return Array.from(this.endpoints.values()).map((ep) => ({ ...ep }));
  }

  /**
   * Updates an endpoint.
   */
  public update(id: string, updates: UpdateEndpointInput): Endpoint | undefined {
    const endpoint = this.endpoints.get(id);
    if (!endpoint) {
      return undefined;
    }

    if (updates.url !== undefined) {
      if (!this.urlValidator.isValid(updates.url)) {
        throw new EndpointValidationError(`Invalid URL: ${updates.url}`);
      }
      endpoint.url = this.urlValidator.normalize(updates.url, { addDefaultPorts: false });
    }

    if (updates.label !== undefined) {
      endpoint.label = updates.label;
    }

    if (updates.hasAuth !== undefined) {
      endpoint.hasAuth = updates.hasAuth;
    }

    if (updates.status !== undefined) {
      endpoint.status = updates.status;
    }

    if (updates.type !== undefined) {
      endpoint.type = updates.type;
    }

    if (updates.models !== undefined) {
      if (updates.models.length === 0) {
        throw new EndpointValidationError('Endpoint must have at least one model');
      }
      for (const model of updates.models) {
        if (!model.name || model.name.trim() === '') {
          throw new EndpointValidationError('Model name cannot be empty');
        }
      }
      endpoint.models = updates.models.map((m) => ({ ...m }));
    }

    return { ...endpoint };
  }

  /**
   * Deletes an endpoint.
   */
  public delete(id: string): boolean {
    return this.endpoints.delete(id);
  }

  /**
   * Adds a model to an endpoint.
   */
  public addModel(endpointId: string, model: Model): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new EndpointValidationError(`Endpoint not found: ${endpointId}`);
    }

    if (!model.name || model.name.trim() === '') {
      throw new EndpointValidationError('Model name cannot be empty');
    }

    endpoint.models.push({ ...model });
  }

  /**
   * Updates a model in an endpoint.
   */
  public updateModel(endpointId: string, modelName: string, updates: Partial<Model>): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new EndpointValidationError(`Endpoint not found: ${endpointId}`);
    }

    const model = endpoint.models.find((m) => m.name === modelName);
    if (!model) {
      throw new EndpointValidationError(`Model not found: ${modelName}`);
    }

    if (updates.alias !== undefined) {
      model.alias = updates.alias;
    }
  }

  /**
   * Removes a model from an endpoint.
   */
  public removeModel(endpointId: string, modelName: string): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new EndpointValidationError(`Endpoint not found: ${endpointId}`);
    }

    if (endpoint.models.length === 1) {
      throw new EndpointValidationError('Endpoint must have at least one model');
    }

    const index = endpoint.models.findIndex((m) => m.name === modelName);
    if (index === -1) {
      throw new EndpointValidationError(`Model not found: ${modelName}`);
    }

    endpoint.models.splice(index, 1);
  }

  /**
   * Replaces all models for an endpoint.
   */
  public setModels(endpointId: string, models: Model[]): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new EndpointValidationError(`Endpoint not found: ${endpointId}`);
    }

    if (models.length === 0) {
      throw new EndpointValidationError('Endpoint must have at least one model');
    }

    for (const model of models) {
      if (!model.name || model.name.trim() === '') {
        throw new EndpointValidationError('Model name cannot be empty');
      }
    }

    endpoint.models = models.map((m) => ({ ...m }));
  }

  /**
   * Clears all endpoints.
   */
  public clear(): void {
    this.endpoints.clear();
  }

  /**
   * Gets endpoint count.
   */
  public getCount(): number {
    return this.endpoints.size;
  }

  /**
   * Checks if endpoint exists.
   */
  public exists(id: string): boolean {
    return this.endpoints.has(id);
  }

  /**
   * Validates a complete endpoint object.
   */
  public static validate(endpoint: Endpoint): void {
    if (!endpoint.id || !endpoint.url || !endpoint.label) {
      throw new EndpointValidationError('Endpoint requires id, url, and label');
    }

    const validator = new URLValidator();
    if (!validator.isValid(endpoint.url)) {
      throw new EndpointValidationError(`Invalid URL: ${endpoint.url}`);
    }

    const validTypes: EndpointType[] = ['subscription', 'api-credits', 'ollama'];
    if (!validTypes.includes(endpoint.type)) {
      throw new EndpointValidationError(`Invalid endpoint type: ${endpoint.type}`);
    }

    if (!endpoint.models || endpoint.models.length === 0) {
      throw new EndpointValidationError('Endpoint must have at least one model');
    }

    for (const model of endpoint.models) {
      if (!model.name || model.name.trim() === '') {
        throw new EndpointValidationError('Model name cannot be empty');
      }
    }
  }

  private validateCreateInput(input: CreateEndpointInput): void {
    if (!this.urlValidator.isValid(input.url)) {
      throw new EndpointValidationError(`Invalid URL: ${input.url}`);
    }

    if (!input.models || input.models.length === 0) {
      throw new EndpointValidationError('Endpoint must have at least one model');
    }

    for (const model of input.models) {
      if (!model.name || model.name.trim() === '') {
        throw new EndpointValidationError('Model name cannot be empty');
      }
    }
  }

  private generateId(): string {
    this.idCounter++;
    return `ep-${Date.now()}-${this.idCounter}`;
  }
}
