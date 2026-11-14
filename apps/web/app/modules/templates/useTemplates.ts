import { clone, copyTemplate, newTemplate } from './logic';
import { sampleTemplates } from './sample';
import type { Archetype, CampaignTemplate } from './types';

/**
 * The template library. State lives in `useState` (per request on the server, one copy in the
 * browser), never in module scope. Today it holds the labelled samples and changes last for the
 * session; swap the bodies for API calls when the templates module exists.
 */
export function useTemplates() {
  const templates = useState<CampaignTemplate[]>('business-templates', sampleTemplates);

  const get = (id: string): CampaignTemplate | undefined =>
    templates.value.find((t) => t.id === id);

  function save(template: CampaignTemplate): void {
    const stored = { ...clone(template), updatedAt: new Date().toISOString() };
    const exists = templates.value.some((t) => t.id === stored.id);
    templates.value = exists
      ? templates.value.map((t) => (t.id === stored.id ? stored : t))
      : [stored, ...templates.value];
  }

  function create(name: string, archetype: Archetype): CampaignTemplate {
    const template = newTemplate(crypto.randomUUID(), name, archetype, new Date());
    templates.value = [template, ...templates.value];
    return template;
  }

  function duplicate(id: string, copyName: string): CampaignTemplate | undefined {
    const source = get(id);
    if (!source) return undefined;
    const copy = copyTemplate(
      source,
      crypto.randomUUID(),
      copyName,
      () => crypto.randomUUID(),
      new Date(),
    );
    templates.value = [copy, ...templates.value];
    return copy;
  }

  function remove(id: string): void {
    templates.value = templates.value.filter((t) => t.id !== id);
  }

  return { templates, get, save, create, duplicate, remove };
}
