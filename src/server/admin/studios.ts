// Studio normalization admin (Section 4.5): raw TMDB company id -> headline studio. SERVER ONLY.
import 'server-only';
import { getRepo } from '@/server/db';
import type { Repo } from '@/server/db/repo';
import { ApiFailure } from '@/server/http';
import type { Studio } from '@/lib/types';
import type { AdminStudiosResponse } from './types';

export async function listStudioData(repo: Repo = getRepo()): Promise<AdminStudiosResponse> {
  const [studios, aliases] = await Promise.all([repo.listStudios(), repo.listStudioAliases()]);
  return {
    studios: [...studios].sort((a, b) => a.name.localeCompare(b.name)),
    aliases: [...aliases].sort((a, b) => a.rawCompanyId - b.rawCompanyId),
  };
}

export async function createStudio(name: string, logoPath: string | null, repo: Repo = getRepo()): Promise<Studio> {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) throw new ApiFailure('bad_request', 'Studio name is required.');
  const existing = (await repo.listStudios()).find((s) => s.name.toLowerCase() === clean.toLowerCase());
  if (existing) throw new ApiFailure('bad_request', `A studio named "${existing.name}" already exists.`);
  return repo.upsertStudio({ name: clean, logoPath: logoPath?.trim() || null });
}

export async function setAlias(rawCompanyId: number, studioId: number, repo: Repo = getRepo()): Promise<AdminStudiosResponse> {
  if (!Number.isInteger(rawCompanyId) || rawCompanyId <= 0) throw new ApiFailure('bad_request', 'Company id must be a positive integer.');
  if (!(await repo.getStudio(studioId))) throw new ApiFailure('bad_request', 'Unknown studio.');
  await repo.setStudioAlias({ rawCompanyId, studioId });
  return listStudioData(repo);
}

export async function removeAlias(rawCompanyId: number, repo: Repo = getRepo()): Promise<AdminStudiosResponse> {
  await repo.deleteStudioAlias(rawCompanyId);
  return listStudioData(repo);
}
