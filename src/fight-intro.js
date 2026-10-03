export const INTRO_SECONDS=5.5;
export const INTRO_ZOOM_SECONDS=2;
export const INTRO_FIGHT_SECONDS=1.5;

export function fightIntro(remaining){
  const elapsed=Math.max(0,INTRO_SECONDS-remaining);
  const progress=Math.min(1,elapsed/INTRO_ZOOM_SECONDS);
  const eased=progress*progress*(3-2*progress);
  return {
    zoom:1+.12*(1-eased),
    call:elapsed<INTRO_ZOOM_SECONDS?null:remaining>INTRO_FIGHT_SECONDS?'round':'fight',
  };
}
