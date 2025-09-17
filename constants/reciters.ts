export interface ReciterOption {
  identifier: string; // matches alquran.cloud audio identifier
  name: string; // Display name
  language: string; // ISO code
}

// Reliable reciters using alquran.cloud API only (verified via CDN)
export const RECITERS: ReciterOption[] = [
  { identifier: 'ar.alafasy', name: 'Mishary Alafasy', language: 'ar' },
  { identifier: 'ar.husary', name: 'Mahmoud Al-Husary', language: 'ar' },
  { identifier: 'ar.husarymujawwad', name: 'Husary (Mujawwad)', language: 'ar' },
  { identifier: 'ar.hudhaify', name: 'Ali Al-Hudhaify', language: 'ar' },
  { identifier: 'ar.ahmedajamy', name: 'Ahmed Al-Ajmy', language: 'ar' },
  { identifier: 'ar.mahermuaiqly', name: 'Maher Al-Muaiqly', language: 'ar' },
  { identifier: 'ar.minshawi', name: 'Muhammad Siddiq Al-Minshawi', language: 'ar' },
  { identifier: 'ar.shaatree', name: 'Abu Bakr Ash-Shaatree', language: 'ar' },
  { identifier: 'ar.muhammadayyoub', name: 'Muhammad Ayyoub', language: 'ar' },
  { identifier: 'ar.muhammadjibreel', name: 'Muhammad Jibreel', language: 'ar' },
  // Room to add up to 15 total; keep to top, reliable reciters
];

// Helper function to get reciter by identifier
export function getReciterByIdentifier(identifier: string): ReciterOption | undefined {
  return RECITERS.find(reciter => reciter.identifier === identifier);
}


