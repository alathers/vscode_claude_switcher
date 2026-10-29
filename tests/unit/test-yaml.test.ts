import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';

describe('YAML parsing debug', () => {
  it('should parse YAML without id field', () => {
    const yaml = `
schemaVersion: 1
label: No ID Profile
adapter: anthropic-compatible
model: test-model
credential:
  mode: none
permissions:
  mode: edit-only
network:
  providerClass: cloud
  supportingNetwork: allowed
capabilities:
  streaming: true
  tools: true
  fileEdits: true
  commands: false
  modelDiscovery: true
  transcriptObservable: false
`;

    const raw = parseYaml(yaml) as any;
    console.log('raw:', JSON.stringify(raw, null, 2));
    console.log('raw.id:', raw.id);
    console.log('typeof raw.id:', typeof raw.id);
    console.log('!raw.id:', !raw.id);

    expect(raw.id).toBeUndefined();
  });
});
