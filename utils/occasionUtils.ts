import ArafahIcon from '@/components/ArafahIcon';
import EidIcon from '@/components/EidIcon';
import HajjIcon from '@/components/HajjIcon';
import MiladIcon from '@/components/MiladIcon';
import MuharramIcon from '@/components/MuharramIcon';
import RamadanIcon from '@/components/RamadanIcon';
import React from 'react';

export const OCCASION_COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  Ramadan: RamadanIcon,
  Hajj: HajjIcon,
  EidUlFitr: EidIcon,
  EidUlAdha: HajjIcon,
  Arafah: ArafahIcon,
  Muharram: MuharramIcon,
  MiladUnNabi: MiladIcon,
};

export const OCCASIONS_FLAG_URL = 'https://raw.githubusercontent.com/aishiek/aishiek.github.io/refs/heads/main/IslamicSeasons.json';

export default OCCASION_COMPONENT_MAP;
