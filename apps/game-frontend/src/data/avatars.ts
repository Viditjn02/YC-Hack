export interface AvatarOption {
  id: string;
  label: string;
  modelUrl: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'random', label: 'Random', modelUrl: '/models/characters/player.glb' },
  { id: 'default', label: 'Scout', modelUrl: '/models/characters/player.glb' },
  { id: 'female-a', label: 'Luna', modelUrl: '/models/characters/avatars/character-female-a.glb' },
  { id: 'female-b', label: 'Sage', modelUrl: '/models/characters/avatars/character-female-b.glb' },
  { id: 'female-c', label: 'Nova', modelUrl: '/models/characters/avatars/character-female-c.glb' },
  { id: 'female-d', label: 'Ruby', modelUrl: '/models/characters/avatars/character-female-d.glb' },
  { id: 'female-e', label: 'Ivy', modelUrl: '/models/characters/avatars/character-female-e.glb' },
  { id: 'female-f', label: 'Aria', modelUrl: '/models/characters/avatars/character-female-f.glb' },
  { id: 'male-a', label: 'Max', modelUrl: '/models/characters/avatars/character-male-a.glb' },
  { id: 'male-b', label: 'Kai', modelUrl: '/models/characters/avatars/character-male-b.glb' },
  { id: 'male-c', label: 'Rex', modelUrl: '/models/characters/avatars/character-male-c.glb' },
  { id: 'male-d', label: 'Leo', modelUrl: '/models/characters/avatars/character-male-d.glb' },
  { id: 'male-e', label: 'Finn', modelUrl: '/models/characters/avatars/character-male-e.glb' },
  { id: 'male-f', label: 'Atlas', modelUrl: '/models/characters/avatars/character-male-f.glb' },
];

export function getAvatarModelUrl(avatarId: string | undefined): string {
  if (avatarId === 'random') {
    // 'random' should be resolved to a concrete avatar before rendering;
    // if it reaches here, fall back to default model
    return AVATARS.find((a) => a.id === 'default')?.modelUrl ?? AVATARS[0].modelUrl;
  }
  const avatar = AVATARS.find((a) => a.id === avatarId);
  return avatar?.modelUrl ?? AVATARS[0].modelUrl;
}
